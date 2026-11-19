import { EditDialog } from '../../components/EditDialog';
import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import { createFileService } from '../files/fileService';
import { fileRepository, disciplineRepository, studyTopicRepository } from '../../storage/repositories';
import type { StoredFile } from '../files/types';
import { createStudyService } from './studyService';
import { attachStudyMaterial } from './attachStudyMaterial';
import type { StudyTopic } from './types';
import { confirmMaterialDefinition, processStoredMaterial } from './materialProcessor';
import { PROCESSING_PROFILES, relevantAmbiguities, type ProcessingProfile } from './materialReliability';

const files = createFileService(fileRepository);
const study = createStudyService(disciplineRepository, studyTopicRepository);

type PendingMaterial = { file: StoredFile; topic?: StudyTopic };

interface ProcessingStatus { name: string; status: 'processing' | 'success' | 'review' | 'error'; detail: string; }

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
  const blockSize = 256 * 1024;
  for (let offset = 0; offset < left.size; offset += blockSize) {
    const end = offset + blockSize;
    const [leftBytes, rightBytes] = await Promise.all([readBlob(left.slice(offset, end)), readBlob(right.slice(offset, end))]);
    const a = new Uint8Array(leftBytes), b = new Uint8Array(rightBytes);
    if (!a.every((byte, index) => byte === b[index])) return false;
  }
  return true;
}

export function StudyMaterialImporter({ disciplineId, unit, onProcessed, uploadOpen, onCloseUpload }: {
  disciplineId: string; unit?: StudyTopic; onProcessed?: () => Promise<void>;
  uploadOpen?: boolean; onCloseUpload?: () => void;
}) {
  const [pending, setPending] = useState<PendingMaterial[]>([]);
  const [staged, setStaged] = useState<File[]>([]);
  const [statuses, setStatuses] = useState<ProcessingStatus[]>([]);
  const [profile, setProfile] = useState<ProcessingProfile>('printed');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const fileInput = useRef<HTMLInputElement>(null);
  const cancelRef = useRef(false);
  const processingController = useRef<AbortController | null>(null);

  useEffect(() => {
    let active = true;
    loadPending(disciplineId, unit?.id).then((items) => { if (active) setPending(items); })
      .catch(() => { if (active) setError('Não foi possível carregar o processamento salvo.'); });
    return () => { active = false; };
  }, [disciplineId, unit?.id]);

  useEffect(() => () => {
    cancelRef.current = true;
    processingController.current?.abort();
  }, []);

  async function resume(file: StoredFile, topic?: StudyTopic, excerpt?: string) {
    if (saving) return;
    setSaving(true);
    setError('');
    try {
      if (excerpt !== undefined) await confirmMaterialDefinition(file.id, excerpt);
      const target = topic ?? (await study.listTopics()).find((item) => item.disciplineId === disciplineId && item.sourceFileId === file.id)
        ?? await study.createTopic({ disciplineId, title: file.name.slice(0, 120), sourceFileId: file.id, sourceFileName: file.name });
      const controller = new AbortController();
      processingController.current = controller;
      await processStoredMaterial(file.id, 'printed', controller.signal, () => {}, undefined, target);
      await onProcessed?.();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível retomar este material.');
    } finally {
      processingController.current = null;
      try { setPending(await loadPending(disciplineId, unit?.id)); }
      catch { setError('Não foi possível atualizar o processamento salvo.'); }
      setSaving(false);
    }
  }

  function stageFiles(event: ChangeEvent<HTMLInputElement>) {
    const incoming = Array.from(event.target.files ?? []);
    if (unit && incoming.length > 1) {
      setError('Selecione um arquivo por unidade.');
      event.target.value = '';
      return;
    }
    if (incoming.length) {
      setStaged(current => unit ? incoming : [...new Set([...current, ...incoming])]);
      setError('');
    }
    event.target.value = '';
  }

  async function saveAndProcess() {
    if (!staged.length || saving || !disciplineId) return;
    setSaving(true); setError(''); cancelRef.current = false;
    const queue = [...staged];
    const prepared: { index: number; file: File; sourceId: string; topic: StudyTopic }[] = [];
    function updateStatus(index: number, status: ProcessingStatus['status'], detail: string) {
      setStatuses(current => current.map((item, position) => position === index ? { ...item, status, detail } : item));
    }
    let storedChanges = false;
    const storedOriginals = new Set<File>();
    setStatuses(queue.map((file) => ({ name: file.name, status: 'processing', detail: 'Aguardando processamento local.' })));
    try {
      const [existingTopics, savedFiles] = await Promise.all([study.listTopics(), fileRepository.getAll()]);
      for (const [index, file] of queue.entries()) {
        updateStatus(index, 'processing', 'Salvando original no dispositivo…');
        let sourceId = '';
        try {
          // Save the original first. A format/extraction failure must not erase the user's file.
          const previous = await findPreviouslyStoredFile(savedFiles, file, disciplineId);
          if (unit?.sourceFileId && unit.sourceFileId !== previous?.id
            && savedFiles.some((candidate) => candidate.id === unit.sourceFileId)) {
            throw new Error('A unidade já tem um material vinculado. Use outra unidade para este arquivo.');
          }
          if (previous) sourceId = previous.id;
          else sourceId = (await files.add(file, disciplineId)).id;
          storedChanges = true;
          if (!previous) {
            const saved = await files.get(sourceId);
            if (saved) savedFiles.push(saved);
          }
          const topic = unit ? await attachStudyMaterial(unit.id, disciplineId, sourceId)
            : existingTopics.find((item) => item.disciplineId === disciplineId && item.sourceFileId === sourceId)
            ?? await study.createTopic({ disciplineId, title: file.name.slice(0, 120), sourceFileId: sourceId, sourceFileName: file.name });
          if (!existingTopics.some((item) => item.id === topic.id)) existingTopics.push(topic);
          const saved = savedFiles.find(item => item.id === sourceId);
          if (saved && !saved.processing) {
            const pending = { ...saved, processing: {
              version: 1 as const, profile, status: 'cancelled' as const, stage: 'Original salvo. Aguardando processamento.', topicId: topic.id,
            } };
            await fileRepository.save(pending);
            savedFiles[savedFiles.indexOf(saved)] = pending;
          }
          prepared.push({ index, sourceId, file, topic });
          storedOriginals.add(file);
        } catch (cause) {
          const message = cause instanceof Error ? cause.message : 'Falha inesperada ao salvar este arquivo.';
          updateStatus(index, 'error', message + (sourceId ? ' O original foi preservado na biblioteca.' : ''));
        }
      }
      for (const { file, index, sourceId, topic } of prepared) {
        if (cancelRef.current) {
          updateStatus(index, 'error', 'Original salvo. Retome o processamento quando desejar.');
          continue;
        }
        const controller = new AbortController();
        processingController.current = controller;
        try {
          const { state, cardsAdded, questionsAdded } = await processStoredMaterial(
            sourceId, profile, controller.signal, detail => updateStatus(index, 'processing', detail), file, topic,
          );
          const resourceMessage = state.status === 'review' ? 'Confirme o trecho de origem para continuar.'
            : cardsAdded || questionsAdded ? `${cardsAdded} flashcard(s) e ${questionsAdded} questão(ões) gerados.`
            : `Texto salvo (${state.raw?.wordCount ?? 0} palavras), mas não encontrei novas definições explícitas ou outros trechos adequados para gerar cartões ou questões com segurança. O enriquecimento semântico depende de IA.`;
          updateStatus(index, state.status === 'review' ? 'review' : 'success', `${resourceMessage} Original e texto extraído estão associados à disciplina.`);
        } catch (cause) {
          const message = cause instanceof Error ? cause.message : 'Falha inesperada ao processar este arquivo.';
          updateStatus(index, 'error', `${message} O original foi preservado na biblioteca.`);
        } finally { processingController.current = null; }
      }
      if (cancelRef.current) setError('Processamento interrompido. Os arquivos salvos podem ser retomados.');
      setStaged((current) => current.filter((file) => !storedOriginals.has(file)));
      if (storedChanges) {
        try { setPending(await loadPending(disciplineId, unit?.id)); await onProcessed?.(); }
        catch { setError('Os materiais foram salvos, mas a tela não conseguiu atualizar. Recarregue para ver os recursos.'); }
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível iniciar o processamento.');
    } finally { processingController.current = null; setSaving(false); }
  }

  async function findPreviouslyStoredFile(existing: StoredFile[], file: File, currentDisciplineId: string): Promise<StoredFile | undefined> {
    for (const candidate of existing) {
      if (candidate.kind === 'note' || candidate.projectId || candidate.disciplineId !== currentDisciplineId || candidate.name !== file.name || candidate.size !== file.size) continue;
      if (await sameBytes(candidate.blob, file)) return candidate;
    }
    return undefined;
  }

  const finishedCount = statuses.filter((item) => item.status !== 'processing').length;
  const uploadFields = <div className="dialog-form">
    <div>
      <span className="card-label">MATERIAL DA DISCIPLINA</span>
      <h3>{unit ? `Material de ${unit.title}` : 'Adicionar arquivos de estudo'}</h3>
      <p>{unit ? 'Selecione um arquivo para vincular a esta unidade.' : 'Selecione um ou vários materiais.'} Ao salvar, Alfred guarda os originais e cria atividades localmente quando encontra definições explícitas.</p>
    </div>
    <div className="study-filter">
      <label className="field-label" htmlFor="study-processing-profile">Perfil do material</label>
      <select id="study-processing-profile" value={profile} disabled={saving}
        onChange={(event) => setProfile(event.target.value as ProcessingProfile)}>
        {Object.entries(PROCESSING_PROFILES).map(([value, item]) => <option key={value} value={value}>{item.label}</option>)}
      </select>
    </div>
    <label className="file-upload-button study-material-select">
      Adicionar arquivos
      <input ref={fileInput} type="file" multiple={!unit} accept="image/*,.pdf,.docx,.pptx,.txt,.md,.csv,.json,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.openxmlformats-officedocument.presentationml.presentation,text/plain,text/markdown,text/csv,application/json" disabled={saving} onChange={stageFiles} />
    </label>
    {staged.length > 0 && <div className="study-material-staging" aria-label="Arquivos aguardando processamento">
      <strong>{staged.length} arquivo(s) na preparação</strong>
      {staged.map((file, index) => <div className="study-material-staged-file" key={index}>
        <span>{file.name} · {(file.size / 1024).toFixed(0)} KB</span>
        <button className="text-action" type="button" disabled={saving} aria-label={`Remover ${file.name}`} onClick={() => setStaged((current) => current.filter((item) => item !== file))}>Remover</button>
      </div>)}
      <button className="primary-action" type="button" onClick={() => { onCloseUpload?.(); void saveAndProcess(); }} disabled={saving || !disciplineId}>{saving ? 'Salvando e processando…' : 'Salvar'}</button>
    </div>}
  </div>;
  if (uploadOpen === false && !saving && !error && !statuses.length && !pending.length && !staged.length) return null;

  return <section className="study-material-importer" aria-label="Adicionar material de estudo">
    {uploadOpen === undefined ? uploadFields : uploadOpen && <EditDialog title="Adicionar material" onClose={() => {
      setStaged([]); onCloseUpload?.();
    }}>{uploadFields}</EditDialog>}
    {error && <p className="module-error" role="alert">{error}</p>}
    {saving && <div className="study-material-progress" aria-live="polite">
      <strong>Processamento local · {finishedCount} de {statuses.length} concluído(s)</strong>
      <progress value={finishedCount} max={statuses.length || 1} aria-label="Progresso real do processamento dos materiais" />
      <button className="text-action" type="button" onClick={() => { cancelRef.current = true; processingController.current?.abort(); }}>Interromper processamento</button>
    </div>}
    {statuses.length > 0 && <div className="study-material-results" aria-live="polite">
      {statuses.map((item, index) => <article key={`${item.name}:${index}`} className={`study-material-result ${item.status}`}>
        <strong>{item.name}</strong><span>{item.status === 'processing' ? 'Processando' : item.status === 'success' ? 'Pronto' : item.status === 'review' ? 'Revisão necessária' : 'Falha neste arquivo'}</span><p>{item.detail}</p>
      </article>)}
    </div>}
    {pending.map(({ file, topic }) => {
      const choices = file.processing?.status === 'review' && file.processing.corrected
        ? relevantAmbiguities(file.processing.corrected)[0] : undefined;
      return <article className="study-material-result" key={topic?.id ?? file.id}>
        <strong>{file.name}</strong><p>{file.processing?.stage}</p>
        {choices?.length ? choices.map(({ sourceExcerpt }) =>
          <button className="text-action" type="button" key={sourceExcerpt} disabled={saving}
            onClick={() => void resume(file, topic, sourceExcerpt)}>Manter: {sourceExcerpt}</button>)
          : <button className="text-action" type="button" disabled={saving} onClick={() => void resume(file, topic)}>Retomar processamento</button>}
      </article>;
    })}
    <p className="study-material-privacy">Privacidade: extração e geração são locais. PDFs digitalizados continuam exigindo OCR local acionado na área Arquivos antes de serem usados aqui. Arquivos até 10 MB; DOCX/PPTX até 25 MB descompactados.</p>
  </section>;
}


async function loadPending(disciplineId: string, unitId?: string) {
  const [topics, stored] = await Promise.all([study.listTopics(), fileRepository.getAll()]);
  const filesById = new Map(stored.filter((file) => file.disciplineId === disciplineId && file.processing
    && file.processing.status !== 'completed').map((file) => [file.id, file]));
  const linked: PendingMaterial[] = topics.flatMap((topic) => {
    if (topic.disciplineId !== disciplineId || (unitId && topic.id !== unitId) || !topic.sourceFileId) return [];
    const file = filesById.get(topic.sourceFileId);
    return file && (!file.processing?.topicId || file.processing.topicId === topic.id) ? [{ file, topic }] : [];
  });
  if (!unitId) {
    const linkedIds = new Set(linked.map(({ file }) => file.id));
    for (const file of filesById.values()) if (!linkedIds.has(file.id)) linked.push({ file });
  }
  return linked;
}
