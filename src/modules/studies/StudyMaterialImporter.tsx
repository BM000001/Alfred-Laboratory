import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import { createFileService } from '../files/fileService';
import { fileRepository } from '../../storage/repositories';
import type { StoredFile } from '../files/types';
import { confirmMaterialDefinition, processStoredMaterial } from './materialProcessor';
import { PROCESSING_PROFILES, type ProcessingProfile } from './materialReliability';
const files = createFileService(fileRepository);

interface ProcessingStatus { name: string; status: 'processing' | 'success' | 'error'; detail: string; }

function readBlob(blob: Blob): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => reader.result instanceof ArrayBuffer ? resolve(reader.result) : reject(new Error('Não foi possível comparar o arquivo salvo.'));
    reader.onerror = () => reject(reader.error ?? new Error('Falha ao comparar o arquivo salvo.'));
    reader.readAsArrayBuffer(blob);
  });
}

async function sameBytes(left: Blob, right: Blob): Promise<boolean> {
  if (left.size !== right.size) return false;
  const [leftBytes, rightBytes] = await Promise.all([readBlob(left), readBlob(right)]);
  const a = new Uint8Array(leftBytes), b = new Uint8Array(rightBytes);
  return a.every((byte, index) => byte === b[index]);
}

export function StudyMaterialImporter({ disciplineId, onProcessed }: { disciplineId: string; onProcessed?: () => Promise<void> }) {
  const [staged, setStaged] = useState<File[]>([]);
  const [statuses, setStatuses] = useState<ProcessingStatus[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const fileInput = useRef<HTMLInputElement>(null);
  const cancelRef = useRef(false);
  const abortRef = useRef<AbortController | null>(null);
  const [profileOverride, setProfileOverride] = useState(false);
  const [profile, setProfile] = useState<ProcessingProfile>('board');
  const [pending, setPending] = useState<StoredFile[]>([]);
  useEffect(() => {
    let disposed = false;
    void fileRepository.getAll().then(items => { if (!disposed) setPending(items.filter(item => item.disciplineId === disciplineId && item.processing && item.processing.status !== 'completed')); }).catch(cause => { if (!disposed) setError(cause instanceof Error ? cause.message : 'Falha ao carregar etapas salvas.'); });
    return () => { disposed = true; abortRef.current?.abort(); };
  }, [disciplineId]);
  async function confirmDefinition(id: string, excerpt: string) {
    try {
      await confirmMaterialDefinition(id, excerpt);
      setPending((await fileRepository.getAll()).filter(item => item.disciplineId === disciplineId && item.processing && item.processing.status !== 'completed'));
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Não foi possível confirmar o trecho.'); }
  }
  async function resume() {
    if (saving) return;
    setSaving(true); cancelRef.current = false; abortRef.current = new AbortController();
    const queue = [...pending];
    setStatuses(queue.map(item => ({ name: item.name, status: 'processing', detail: 'Retomando etapa salva…' })));
    try {
      for (const [index, item] of queue.entries()) {
        if (abortRef.current.signal.aborted) break;
        try {
          const result = await processStoredMaterial(item.id, item.processing!.profile, abortRef.current.signal, detail => setStatuses(current => current.map((status, i) => i === index ? { ...status, detail } : status)));
          setStatuses(current => current.map((status, i) => i === index ? { ...status, status: 'success', detail: describe(result) } : status));
        } catch (cause) { setStatuses(current => current.map((status, i) => i === index ? { ...status, status: 'error', detail: cause instanceof Error ? cause.message : 'Falha ao retomar.' } : status)); }
      }
      await onProcessed?.();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Falha ao atualizar os resultados.');
    } finally {
      setStatuses(current => current.map(status => status.status === 'processing' ? { ...status, status: 'error', detail: 'Interrompido. As etapas salvas estão disponíveis para retomada.' } : status));
      setSaving(false);
      try { setPending((await fileRepository.getAll()).filter(item => item.disciplineId === disciplineId && item.processing && item.processing.status !== 'completed')); }
      catch { setError('Não foi possível atualizar a lista de retomada. Reabra a disciplina para tentar novamente.'); }
    }
  }
  function describe(result: Awaited<ReturnType<typeof processStoredMaterial>>) {
    return `${result.status === 'review' ? 'Um trecho precisa de confirmação. ' : ''}${result.raw?.extractionMethod === 'ocr' ? 'Texto reconhecido por OCR. ' : ''}${!result.structured?.definitions.length ? 'Não encontrei definições explícitas suficientes para gerar recursos. ' : ''}${result.structured?.definitions.length ?? 0} tópicos; ${result.structured?.formulas.length ?? 0} fórmulas; ${result.corrections?.length ?? 0} correções; ${result.generated?.flashcards.length ?? 0} flashcards e ${result.generated?.questions.length ?? 0} questões validados. Confiança composta: ${result.assessment?.score ?? 0}%. Validade dos candidatos: ${result.generated?.validity ?? 0}%. ${result.generated?.rejected ?? 0} recursos descartados. ${result.assessment?.conflicts ? 'Definições conflitantes: geração bloqueada; original preservado.' : 'Original e etapas preservados localmente.'}`;
  }

  useEffect(() => { setStaged([]); setStatuses([]); setError(''); }, [disciplineId]);

  function stageFiles(event: ChangeEvent<HTMLInputElement>) {
    const incoming = Array.from(event.target.files ?? []);
    if (incoming.length) {
      setStaged((current) => {
        const seen = new Set(current.map((file) => `${file.name}:${file.size}:${file.lastModified}`));
        return [...current, ...incoming.filter((file) => {
          const key = `${file.name}:${file.size}:${file.lastModified}`;
          if (seen.has(key)) return false;
          seen.add(key); return true;
        })];
      });
      setError('');
    }
    event.target.value = '';
  }

  async function saveAndProcess() {
    if (!staged.length || saving || !disciplineId) return;
    setSaving(true); setError(''); cancelRef.current = false; abortRef.current = new AbortController();
    const queue = [...staged];
    const nextStatuses: ProcessingStatus[] = [];
    const processedSuccessfully = new Set<File>();
    setStatuses(queue.map((file) => ({ name: file.name, status: 'processing', detail: 'Aguardando processamento local.' })));
    try {
      const savedFiles = await fileRepository.getAll();
      const sourceIds = new Map<File, string>();
      // Persist every original before OCR, including files waiting in the queue.
      const preparationErrors = new Map<File, string>();
      for (const file of queue) {
        if (cancelRef.current) break;
        try {
          let saved = await findPreviouslyStoredFile(savedFiles, file, disciplineId);
          if (!saved) { const summary = await files.add(file, disciplineId); saved = await fileRepository.getById(summary.id); if (saved) savedFiles.push(saved); }
          if (saved) sourceIds.set(file, saved.id);
          const fileProfile: ProcessingProfile = profileOverride ? profile : /\.pptx$/i.test(file.name) ? 'slide' : /\.(pdf|docx)$/i.test(file.name) ? 'printed' : /\.(txt|md|csv|json)$/i.test(file.name) ? 'prose' : profile;
          if (saved && !saved.processing) await fileRepository.save({ ...saved, processing: { version: 1, profile: fileProfile, status: 'running', stage: 'Aguardando processamento' } });
        } catch (cause) { preparationErrors.set(file, cause instanceof Error ? cause.message : 'Não foi possível salvar o original.'); }
      }
      for (const [index, file] of queue.entries()) {
          if (cancelRef.current) {
            setStatuses((current) => current.map((status, statusIndex) => statusIndex >= index && status.status === 'processing' ? { ...status, status: 'error', detail: 'Cancelado antes deste arquivo; permaneceu na preparação para uma nova tentativa.' } : status));
            break;
          }
        setStatuses((current) => current.map((status, statusIndex) => statusIndex === index ? { ...status, detail: 'Salvando original e extraindo texto no dispositivo…' } : status));
        let sourceId = '';
        try {
          if (preparationErrors.has(file)) throw new Error(preparationErrors.get(file));
          // Save the original first. A format/extraction failure must not erase the user's file.
          const previous = await fileRepository.getById(sourceIds.get(file)!);
          sourceId = previous?.id ?? (await files.add(file, disciplineId)).id;
          // Persist the queue before starting OCR so reloads can recover originals.
          const original = await fileRepository.getById(sourceId);
          if (original && !original.processing) await fileRepository.save({ ...original, processing: { version: 1, profile, status: 'running', stage: 'Preparando material' } });
          const result = await processStoredMaterial(sourceId, profile, abortRef.current!.signal, detail => {
            setStatuses(current => current.map((status, statusIndex) => statusIndex === index ? { ...status, detail } : status));
          }, file);
          nextStatuses.push({ name: file.name, status: 'success', detail: describe(result) });
          processedSuccessfully.add(file);
        } catch (cause) {
          const message = cause instanceof Error ? cause.message : 'Falha inesperada ao processar este arquivo.';
          nextStatuses.push({ name: file.name, status: 'error', detail: `${message}${sourceId ? ' O original foi preservado na biblioteca.' : ''}` });
        }
        setStatuses((current) => current.map((status, statusIndex) => statusIndex === index ? nextStatuses[nextStatuses.length - 1] : status));
      }
      if (cancelRef.current) setError('Processamento interrompido. Os arquivos já concluídos foram preservados.');
      setStaged((current) => current.filter((file) => !processedSuccessfully.has(file)));
      if (processedSuccessfully.size) {
        try { await onProcessed?.(); }
        catch { setError('Os materiais foram salvos, mas a tela não conseguiu atualizar. Recarregue para ver os recursos.'); }
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível iniciar o processamento.');
    } finally {
      setSaving(false);
      try { setPending((await fileRepository.getAll()).filter(item => item.disciplineId === disciplineId && item.processing && item.processing.status !== 'completed')); }
      catch { setError('Não foi possível atualizar a lista de retomada. Reabra a disciplina para tentar novamente.'); }
    }
  }

  async function findPreviouslyStoredFile(existing: StoredFile[], file: File, currentDisciplineId: string): Promise<StoredFile | undefined> {
    for (const candidate of existing) {
      if (candidate.disciplineId !== currentDisciplineId || candidate.name !== file.name || candidate.size !== file.size) continue;
      if (await sameBytes(candidate.blob, file)) return candidate;
    }
    return undefined;
  }

  const finishedCount = statuses.filter((item) => item.status !== 'processing').length;
  return <section className="study-material-importer" aria-label="Adicionar material de estudo">
    <div>
      <span className="card-label">MATERIAL DA DISCIPLINA</span>
      <h3>Adicionar materiais de estudo</h3>
      <p>Escolha documentos ou fotos da galeria. Ao tocar em Salvar, Alfred guarda os originais, lê o texto localmente e cria flashcards e exercícios quando o conteúdo oferece base suficiente.</p>
    </div>
    <label>Tipo de material <select value={profile} disabled={saving} onChange={event => { setProfile(event.target.value as ProcessingProfile); setProfileOverride(true); }}>{Object.entries(PROCESSING_PROFILES).map(([key, value]) => <option key={key} value={key}>{value.label}</option>)}</select></label>
    {pending.length > 0 && <button type="button" disabled={saving} onClick={() => void resume()}>Retomar {pending.length} arquivo(s) interrompido(s)</button>}
    {pending.filter(item => item.processing?.status === 'review').map(item => <article key={item.id} className="study-material-result" aria-label={`Confirmar trecho de ${item.name}`}>
      <strong>{item.name}: qual definição corresponde ao material?</strong>
      {item.processing?.ambiguities?.[0]?.map(entry => <button key={entry.sourceExcerpt} type="button" disabled={saving} onClick={() => void confirmDefinition(item.id, entry.sourceExcerpt)}>{entry.sourceExcerpt}</button>)}
      <p>Somente este trecho precisa de confirmação. O texto original está preservado.</p>
    </article>)}
    <label className="file-upload-button study-material-select">
      Escolher arquivos ou fotos
      <input ref={fileInput} type="file" multiple accept="image/*,.pdf,.docx,.pptx,.txt,.md,.csv,.json,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.openxmlformats-officedocument.presentationml.presentation,text/plain,text/markdown,text/csv,application/json" disabled={saving} onChange={stageFiles} />
    </label>
    {staged.length > 0 && <div className="study-material-staging" aria-label="Arquivos aguardando processamento">
      <strong>{staged.length} arquivo(s) na preparação</strong>
      {staged.map((file) => <div className="study-material-staged-file" key={`${file.name}:${file.size}:${file.lastModified}`}>
        <span className="study-material-staged-file-info">{file.type.startsWith('image/') && <ImagePreview file={file} />}<span>{file.name} · {(file.size / 1024).toFixed(0)} KB</span></span>
        <button className="text-action" type="button" disabled={saving} aria-label={`Remover ${file.name}`} onClick={() => setStaged((current) => current.filter((item) => item !== file))}>Remover</button>
      </div>)}
      <button className="primary-action" type="button" onClick={() => void saveAndProcess()} disabled={saving || !disciplineId}>{saving ? 'Salvando e processando…' : 'Salvar'}</button>
    </div>}
    {error && <p className="module-error" role="alert">{error}</p>}
    {saving && <div className="study-material-progress" aria-live="polite">
      <strong>Processamento local · {finishedCount} de {statuses.length} concluído(s)</strong>
      <progress value={finishedCount} max={statuses.length || 1} aria-label="Progresso real do processamento dos materiais" />
      <button className="text-action" type="button" onClick={() => { cancelRef.current = true; abortRef.current?.abort(); }}>Cancelar com segurança</button>
    </div>}
    {statuses.length > 0 && <div className="study-material-results" aria-live="polite">
      {statuses.map((item, index) => <article key={`${item.name}:${index}`} className={`study-material-result ${item.status}`}>
        <strong>{item.name}</strong><span>{item.status === 'processing' ? 'Processando' : item.status === 'success' ? 'Pronto' : 'Falha neste arquivo'}</span><p>{item.detail}</p>
      </article>)}
    </div>}
    <p className="study-material-privacy">Privacidade: fotos e documentos são lidos no dispositivo com OCR local em português; nada é enviado a serviços externos. Fotos HEIC dependem do suporte de leitura do Safari. Arquivos até 10 MB; DOCX/PPTX até 25 MB descompactados.</p>
  </section>;
}

function ImagePreview({ file }: { file: File }) {
  const [url, setUrl] = useState('');
  useEffect(() => {
    const objectUrl = URL.createObjectURL(file);
    setUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [file]);
  return url ? <img className="study-material-photo-preview" src={url} alt={`Prévia de ${file.name}`} /> : null;
}
