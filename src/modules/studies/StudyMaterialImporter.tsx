import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import { extractTextDocument } from '../files/documentExtractor';
import { createFileService } from '../files/fileService';
import { fileRepository, disciplineRepository, studyFlashcardRepository, studyQuestionRepository, studyTopicRepository, studyQuizAttemptRepository } from '../../storage/repositories';
import type { StoredFile } from '../files/types';
import type { ExtractedTextDocument } from '../files/documentExtractor';
import { createStudyService } from './studyService';
import { createFlashcardService } from './flashcardService';
import { createQuestionService } from './questionService';
import { generateStudyResources } from './studyMaterialGeneration';

const files = createFileService(fileRepository);
const study = createStudyService(disciplineRepository, studyTopicRepository);
const flashcards = createFlashcardService(studyFlashcardRepository);
const questions = createQuestionService(studyQuestionRepository, studyQuizAttemptRepository);

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
    setSaving(true); setError(''); cancelRef.current = false;
    const queue = [...staged];
    const nextStatuses: ProcessingStatus[] = [];
    const processedSuccessfully = new Set<File>();
    setStatuses(queue.map((file) => ({ name: file.name, status: 'processing', detail: 'Aguardando processamento local.' })));
    try {
      const [existingCards, existingQuestions] = await Promise.all([flashcards.list(), questions.list()]);
      const savedFiles = await fileRepository.getAll();
      const cardKeys = new Set(existingCards.filter((item) => item.disciplineId === disciplineId).map((item) => normalize(item.front) + '|' + normalize(item.back)));
      const questionKeys = new Set(existingQuestions.filter((item) => item.disciplineId === disciplineId).map((item) => normalize(item.prompt)));
      for (const [index, file] of queue.entries()) {
          if (cancelRef.current) {
            setStatuses((current) => current.map((status, statusIndex) => statusIndex >= index && status.status === 'processing' ? { ...status, status: 'error', detail: 'Cancelado antes deste arquivo; permaneceu na preparação para uma nova tentativa.' } : status));
            break;
          }
        setStatuses((current) => current.map((status, statusIndex) => statusIndex === index ? { ...status, detail: 'Salvando original e extraindo texto no dispositivo…' } : status));
        let sourceId = '';
        try {
          // Save the original first. A format/extraction failure must not erase the user's file.
          const previous = await findPreviouslyStoredFile(savedFiles, file, disciplineId);
          let extracted: ExtractedTextDocument;
          if (previous?.extraction) {
            sourceId = previous.id;
            extracted = { fileName: previous.name, ...previous.extraction };
          } else {
            if (previous) sourceId = previous.id;
            else sourceId = (await files.add(file, disciplineId)).id;
            extracted = await extractTextDocument(file, () => new Date(), (progress) => {
              setStatuses((current) => current.map((status, statusIndex) => statusIndex === index
                ? { ...status, detail: `${progress.status} · ${Math.round(progress.progress * 100)}%` }
                : status));
            });
            await files.saveExtraction(sourceId, extracted);
          }
          const generated = generateStudyResources(extracted.text);
          const topic = await study.createTopic({
            disciplineId,
            title: file.name,
            sourceFileId: sourceId,
            sourceFileName: file.name,
            notes: `${extracted.wordCount} palavras extraídas localmente em ${new Date(extracted.extractedAt).toLocaleString('pt-BR')}.`,
          });
          let cardsAdded = 0, questionsAdded = 0, duplicates = 0;
          for (const card of generated.flashcards) {
            const key = normalize(card.front) + '|' + normalize(card.back);
            if (cardKeys.has(key)) { duplicates++; continue; }
            await flashcards.create({ disciplineId, ...card, topicId: topic.id, sourceFileId: sourceId, sourceFileName: file.name });
            cardKeys.add(key); cardsAdded++;
          }
          for (const question of generated.questions) {
            const key = normalize(question.prompt);
            if (questionKeys.has(key)) { duplicates++; continue; }
            await questions.create({ disciplineId, topicId: topic.id, ...question, sourceFileId: sourceId, sourceFileName: file.name });
            questionKeys.add(key); questionsAdded++;
          }
          const resourceMessage = cardsAdded || questionsAdded
            ? `${cardsAdded} flashcard(s) e ${questionsAdded} questão(ões) gerados${duplicates ? `; ${duplicates} duplicado(s) ignorado(s)` : ''}.`
            : `Texto salvo (${extracted.wordCount} palavras), mas não encontrei definições explícitas suficientes para gerar cartões ou questões com segurança.`;
          const ocrReview = extracted.extractionMethod === 'ocr'
            ? `Texto reconhecido por OCR${typeof extracted.confidence === 'number' ? ` (confiança estimada: ${Math.round(extracted.confidence)}%)` : ''}: confira o conteúdo antes de estudar. A pontuação do mecanismo não é uma taxa de acerto${extracted.preprocessing ? `; leitura escolhida: ${extracted.preprocessing === 'original' ? 'imagem original' : extracted.preprocessing === 'contrast' ? 'contraste ajustado' : 'alto contraste'}` : ''}. `
            : '';
          nextStatuses.push({ name: file.name, status: 'success', detail: `${resourceMessage} ${ocrReview}Original e texto extraído estão associados à disciplina.` });
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
    } finally { setSaving(false); }
  }

  function normalize(value: string) {
    return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLocaleLowerCase('pt-BR').replace(/\s+/g, ' ');
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
      <button className="text-action" type="button" onClick={() => { cancelRef.current = true; }}>Parar após o arquivo atual</button>
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
