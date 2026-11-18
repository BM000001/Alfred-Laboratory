import { openAlfredDatabase, STORE_NAMES } from '../../storage/database';
import type { Task } from '../tasks/types';
import type { Project } from '../projects/types';
import type { Appointment } from '../agenda/types';
import type { Discipline, StudyTopic } from '../studies/types';
import type { StoredFile } from '../files/types';
import type { FocusSession } from '../productivity/types';
import type { AssistantMemory } from '../memory/types';
import type { StudyFlashcard } from '../studies/flashcardTypes';
import type { StudyQuestion, StudyQuizAttempt } from '../studies/questionTypes';
import { base64ByteLength, decodeBase64, encodeBase64 } from './backupBase64';

const BACKUP_FORMAT = 'alfred-local-backup';
// Version 2 includes the complete study state. Version 1 remains readable.
const BACKUP_VERSION = 2;
const CHECKPOINT_ERROR = 'O backup não pode ser criado ou restaurado com checkpoints de processamento. Use a versão que criou esses checkpoints para preservar o trabalho.';
const STUDY_BACKUP_KEYS = ['studyFlashcards', 'studyQuestions', 'studyQuizAttempts', 'studyLearningProgress'] as const;

type StudyLearningProgressBackup = {
  id: string;
  disciplineId: string;
  lessonId: string;
  completedAt: string;
  context: 'technical' | 'football' | 'sports' | 'series' | 'games' | 'daily';
};

type BackupPayload = {
  format: typeof BACKUP_FORMAT;
  version: 1 | typeof BACKUP_VERSION;
  createdAt: string;
  data: {
    tasks: Task[];
    projects: Project[];
    appointments: Appointment[];
    disciplines: Discipline[];
    studyTopics: StudyTopic[];
    // Optional solely for historic v1 backups that never contained these collections.
    studyFlashcards?: StudyFlashcard[];
    studyQuestions?: StudyQuestion[];
    studyQuizAttempts?: StudyQuizAttempt[];
    studyLearningProgress?: StudyLearningProgressBackup[];
    focusSessions?: FocusSession[];
    memories?: AssistantMemory[];
    files: Array<Omit<StoredFile, 'blob'> & { contentBase64: string }>;
  };
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function assertEntities(value: unknown, label: string): void {
  if (!Array.isArray(value)) throw new Error(`O backup contém dados inválidos em: ${label}.`);
  const ids = new Set<string>();
  for (const item of value) {
    if (!isRecord(item) || typeof item.id !== 'string' || item.id.length === 0 || ids.has(item.id)) {
      throw new Error(`O backup contém dados inválidos em: ${label}.`);
    }
    ids.add(item.id);
  }
}

function assertPortableFile(file: object): void {
  if ('processing' in file && file.processing !== undefined) throw new Error(CHECKPOINT_ERROR);
}

export async function createBackup(): Promise<string> {
  const database = await openAlfredDatabase();
  try {
    const names = [
      STORE_NAMES.tasks, STORE_NAMES.projects, STORE_NAMES.appointments,
      STORE_NAMES.disciplines, STORE_NAMES.studyTopics,
      STORE_NAMES.studyFlashcards, STORE_NAMES.studyQuestions, STORE_NAMES.studyQuizAttempts, STORE_NAMES.studyLearningProgress,
      STORE_NAMES.files, STORE_NAMES.focusSessions, STORE_NAMES.assistantMessages, STORE_NAMES.memories,
    ];
    const transaction = database.transaction(names, 'readonly');
    const requests = names.map((name) => new Promise<unknown[]>((resolve, reject) => {
      const request = transaction.objectStore(name).getAll();
      request.onsuccess = () => resolve(request.result as unknown[]);
      request.onerror = () => reject(request.error ?? new Error('Falha ao ler os dados locais.'));
    }));
    const [tasks, projects, appointments, disciplines, studyTopics, studyFlashcards, studyQuestions, studyQuizAttempts, studyLearningProgress, files, focusSessions, , memories] = await Promise.all(requests);
    (files as StoredFile[]).forEach(assertPortableFile);
    const filePayload = await Promise.all((files as StoredFile[]).map(async (file) => ({
      id: file.id, name: file.name, type: file.type, size: file.size, createdAt: file.createdAt,
      ...(file.projectId ? { projectId: file.projectId } : {}),
      ...(file.disciplineId ? { disciplineId: file.disciplineId } : {}),
      ...(file.kind ? { kind: file.kind, noteText: file.noteText, updatedAt: file.updatedAt } : {}),
      ...(file.extraction ? { extraction: file.extraction } : {}),
      contentBase64: encodeBase64(new Uint8Array(await file.blob.arrayBuffer())),
    })));
    const payload: BackupPayload = {
      format: BACKUP_FORMAT, version: BACKUP_VERSION, createdAt: new Date().toISOString(),
      data: { tasks: tasks as Task[], projects: projects as Project[], appointments: appointments as Appointment[],
        disciplines: disciplines as Discipline[], studyTopics: studyTopics as StudyTopic[],
        studyFlashcards: studyFlashcards as StudyFlashcard[], studyQuestions: studyQuestions as StudyQuestion[],
        studyQuizAttempts: studyQuizAttempts as StudyQuizAttempt[], studyLearningProgress: studyLearningProgress as StudyLearningProgressBackup[],
        focusSessions: focusSessions as FocusSession[], memories: memories as AssistantMemory[], files: filePayload },
    };
    return JSON.stringify(payload);
  } finally { database.close(); }
}

function hasId(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function isValidDate(value: unknown): value is string {
  return typeof value === 'string' && !Number.isNaN(Date.parse(value));
}

function isCount(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
}

/** Validate study records before any IndexedDB write. Extra fields (such as snapshots) are retained. */
function assertStudyRows(value: unknown, label: string, validator: (entry: Record<string, unknown>) => boolean): void {
  if (!Array.isArray(value)) throw new Error('O backup contém dados de estudo inválidos em: ' + label + '.');
  const ids = new Set<string>();
  for (const entry of value) {
    if (!isRecord(entry) || !hasId(entry.id) || ids.has(entry.id) || !validator(entry)) {
      throw new Error('O backup contém dados de estudo inválidos em: ' + label + '.');
    }
    ids.add(entry.id);
  }
}

function validateStudyData(data: Record<string, unknown>, version: 1 | 2): void {
  if (version === 2 && STUDY_BACKUP_KEYS.some((key) => data[key] === undefined)) {
    throw new Error('O backup v2 está incompleto: faltam coleções de estudo.');
  }
  if (data.studyFlashcards !== undefined) {
    assertStudyRows(data.studyFlashcards, 'studyFlashcards', (card) =>
      hasId(card.disciplineId) && hasId(card.front) && hasId(card.back)
      && isValidDate(card.createdAt) && isValidDate(card.nextReviewAt)
      && typeof card.intervalDays === 'number' && Number.isFinite(card.intervalDays) && card.intervalDays >= 0
      && isCount(card.reviewCount) && (card.lastReviewedAt === undefined || isValidDate(card.lastReviewedAt)));
  }
  if (data.studyQuestions !== undefined) {
    assertStudyRows(data.studyQuestions, 'studyQuestions', (question) =>
      hasId(question.disciplineId) && hasId(question.prompt)
      && Array.isArray(question.options) && question.options.length >= 2
      && question.options.every(hasId) && isCount(question.correctOptionIndex)
      && question.correctOptionIndex < question.options.length
      && ['easy', 'medium', 'hard'].includes(String(question.difficulty))
      && isValidDate(question.createdAt)
      && (question.explanation === undefined || typeof question.explanation === 'string'));
  }
  if (data.studyQuizAttempts !== undefined) {
    assertStudyRows(data.studyQuizAttempts, 'studyQuizAttempts', (attempt) =>
      hasId(attempt.disciplineId) && isValidDate(attempt.startedAt) && isValidDate(attempt.completedAt)
      && isCount(attempt.totalQuestions) && isCount(attempt.correctAnswers)
      && attempt.correctAnswers <= attempt.totalQuestions && Array.isArray(attempt.answers)
      && attempt.answers.length <= attempt.totalQuestions && attempt.answers.every((answer: unknown) =>
        isRecord(answer) && hasId(answer.questionId)
        && (answer.selectedOptionIndex === null || isCount(answer.selectedOptionIndex))
        && typeof answer.isCorrect === 'boolean'));
  }
  if (data.studyLearningProgress !== undefined) {
    assertStudyRows(data.studyLearningProgress, 'studyLearningProgress', (progress) =>
      hasId(progress.disciplineId) && hasId(progress.lessonId) && isValidDate(progress.completedAt)
      && ['technical', 'football', 'sports', 'series', 'games', 'daily'].includes(String(progress.context)));
  }
}

function isExtractionMethod(value: unknown): boolean {
  return value === 'text' || value === 'ocr';
}

function isFiniteNumber(value: unknown): boolean {
  return typeof value === 'number' && Number.isFinite(value);
}

function isValidExtraction(value: unknown): boolean {
  // OCR branches also use the image format and carry additional metadata.
  return isRecord(value)
    && typeof value.format === 'string' && ['txt', 'md', 'csv', 'json', 'pdf', 'docx', 'pptx', 'image'].includes(value.format)
    && typeof value.text === 'string' && isCount(value.characterCount) && isCount(value.wordCount)
    && isValidDate(value.extractedAt)
    && (value.extractionMethod === undefined || isExtractionMethod(value.extractionMethod))
    && (value.language === undefined || typeof value.language === 'string')
    && (value.confidence === undefined || isFiniteNumber(value.confidence))
    && (value.pageCount === undefined || isCount(value.pageCount))
    && (value.pages === undefined || (Array.isArray(value.pages) && value.pages.every((page: unknown) =>
      isRecord(page) && isCount(page.pageNumber) && page.pageNumber > 0 && typeof page.text === 'string'
      && (page.method === undefined || isExtractionMethod(page.method))
      && (page.confidence === undefined || page.confidence === null || isFiniteNumber(page.confidence)))));
}

/** Shared verification also protects callers that invoke restoreBackup directly. */
function validateBackupPayload(value: unknown): asserts value is BackupPayload {
  if (!isRecord(value) || value.format !== BACKUP_FORMAT || (value.version !== 1 && value.version !== BACKUP_VERSION) || !isRecord(value.data)) {
    throw new Error('Formato de backup inválido ou versão não compatível.');
  }
  const data = value.data;
  // The experimental AI branch produced v1 backups with data this build cannot restore.
  if (data.aiTasks !== undefined && (!Array.isArray(data.aiTasks) || data.aiTasks.length > 0)) {
    throw new Error('Este backup contém tarefas de IA. Use uma versão compatível para restaurar esses dados.');
  }
  for (const name of ['tasks', 'projects', 'appointments', 'disciplines', 'studyTopics', 'files']) {
    assertEntities(data[name], name);
  }
  // Historic backups can omit these stores. Absence differs from an explicit empty array.
  for (const name of ['focusSessions', 'memories']) {
    if (data[name] !== undefined) assertEntities(data[name], name);
  }
  const validCategories = ['preference', 'goal', 'project', 'routine', 'other'];
  if (!((data.memories ?? []) as unknown[]).every((item) =>
    isRecord(item) && hasId(item.title) && item.title.length <= 80
    && hasId(item.content) && item.content.length <= 500
    && validCategories.includes(String(item.category))
    && isValidDate(item.createdAt) && isValidDate(item.updatedAt))) {
    throw new Error('O backup contém memórias inválidas.');
  }
  validateStudyData(data, value.version);
  for (const file of data.files as unknown[]) {
    if (!isRecord(file) || typeof file.contentBase64 !== 'string' || typeof file.name !== 'string'
      || typeof file.type !== 'string' || !Number.isSafeInteger(file.size) || (file.size as number) < 0
      || typeof file.createdAt !== 'string') {
      throw new Error('O backup contém arquivos inválidos.');
    }
    for (const field of ['projectId', 'disciplineId', 'noteText', 'updatedAt']) {
      if (file[field] !== undefined && typeof file[field] !== 'string') throw new Error('Metadados de arquivo inválidos.');
    }
    if (file.kind !== undefined && file.kind !== 'note') throw new Error('Tipo de anotação inválido.');
    assertPortableFile(file);
    if (file.extraction !== undefined && !isValidExtraction(file.extraction)) {
      throw new Error('O backup contém uma extração de arquivo inválida.');
    }
    let decodedSize: number;
    try { decodedSize = base64ByteLength(file.contentBase64); } catch {
      throw new Error('O backup contém arquivos com conteúdo Base64 inválido.');
    }
    if (decodedSize !== file.size) throw new Error('O tamanho do conteúdo de um arquivo não corresponde aos metadados.');
  }
  if (!isValidDate(value.createdAt)) throw new Error('Data de criação do backup inválida.');
}

export function inspectBackup(raw: string): { createdAt: string; counts: Record<string, number>; payload: BackupPayload; legacyStudyData: boolean } {
  let parsed: unknown;
  try { parsed = JSON.parse(raw); } catch { throw new Error('O arquivo selecionado não contém um JSON válido.'); }
  validateBackupPayload(parsed);
  const { data } = parsed;
  const legacyStudyData = STUDY_BACKUP_KEYS.some((key) => data[key] === undefined);
  return {
    createdAt: parsed.createdAt,
    counts: {
      tasks: data.tasks.length, projects: data.projects.length, appointments: data.appointments.length,
      disciplines: data.disciplines.length, studyTopics: data.studyTopics.length,
      studyFlashcards: data.studyFlashcards?.length ?? 0, studyQuestions: data.studyQuestions?.length ?? 0,
      studyQuizAttempts: data.studyQuizAttempts?.length ?? 0, studyLearningProgress: data.studyLearningProgress?.length ?? 0,
      focusSessions: data.focusSessions?.length ?? 0, memories: data.memories?.length ?? 0, files: data.files.length,
    },
    payload: parsed,
    legacyStudyData,
  };
}

type RestoreRows = Partial<Record<string, { id: string }[]>>;
const KEY_TARGETS = ['disciplines', 'studyTopics', 'studyQuestions', 'studyFlashcards'] as const;
type ReferenceTarget = typeof KEY_TARGETS[number] | 'files';

function assertRetainedStudyLinks(
  retained: Record<string, unknown[]>,
  removed: Record<ReferenceTarget, Set<IDBValidKey>>,
): void {
  function assertLink(id: unknown, target: ReferenceTarget, label: string, collection: string) {
    if (typeof id === 'string' && removed[target].has(id)) {
      throw new Error(`Restauração bloqueada: o backup removeria ${label} ("${id}") usado em ${collection} preservados. Exporte os dados atuais e use um backup v2 completo ou um backup que mantenha esses vínculos.`);
    }
  }
  for (const [key, records] of Object.entries(retained)) {
    for (const record of records) {
      if (!isRecord(record)) continue;
      assertLink(record.disciplineId, 'disciplines', 'o vínculo com a disciplina', key);
      if (key === STORE_NAMES.studyFlashcards || key === STORE_NAMES.studyQuestions) {
        assertLink(record.topicId, 'studyTopics', 'o vínculo com o conteúdo de estudo', key);
        assertLink(record.sourceFileId, 'files', 'o vínculo com o arquivo de origem', key);
      }
      if (key === STORE_NAMES.studyLearningProgress && typeof record.lessonId === 'string' && record.lessonId.startsWith('lesson:')) {
        // In the study branches, units are derived from cards rather than stored independently.
        assertLink(record.lessonId.slice('lesson:'.length), 'studyFlashcards', 'o vínculo com o flashcard da unidade', key);
      }
      if (key === STORE_NAMES.studyQuizAttempts && Array.isArray(record.answers)) {
        for (const answer of record.answers) {
          if (isRecord(answer)) assertLink(answer.questionId, 'studyQuestions', 'o vínculo com a questão', key);
        }
      }
    }
  }
}

function queueRestore(
  transaction: IDBTransaction,
  rows: RestoreRows,
  abort: (error: unknown) => void,
): void {
  const retained = STUDY_BACKUP_KEYS.filter((key) => rows[key] === undefined);
  const studyReads = retained.map((key) => [key, transaction.objectStore(key).getAll()] as const);
  const targetReads = KEY_TARGETS.flatMap((key) =>
    retained.length && rows[key] !== undefined ? [[key, transaction.objectStore(key).getAllKeys()] as const] : []);
  // IndexedDB runs requests in enqueue order. The final cursor checks for local
  // checkpoints, then queues writes in its event callback while the transaction is active.
  const fileKeys: IDBValidKey[] = [];
  const files = transaction.objectStore(STORE_NAMES.files).openCursor();
  files.onsuccess = () => {
    try {
      const cursor = files.result;
      if (cursor) {
        assertPortableFile(cursor.value);
        if (retained.length) fileKeys.push(cursor.primaryKey);
        cursor.continue();
        return;
      }
      if (retained.length) {
        const removed: Record<ReferenceTarget, Set<IDBValidKey>> = {
          disciplines: new Set(), studyTopics: new Set(), files: new Set(), studyQuestions: new Set(), studyFlashcards: new Set(),
        };
        const previousKeys = [...targetReads.map(([key, request]) => [key, request.result] as const), ['files', fileKeys] as const];
        for (const [key, before] of previousKeys) {
          const after = new Set<IDBValidKey>(rows[key]?.map(({ id }) => id));
          removed[key] = new Set(before.filter((id) => !after.has(id)));
        }
        assertRetainedStudyLinks(Object.fromEntries(studyReads.map(([key, request]) => [key, request.result])), removed);
      }
      for (const [name, entities] of Object.entries(rows)) {
        const store = transaction.objectStore(name);
        store.clear();
        for (const entity of entities ?? []) store.put(entity);
      }
    } catch (error) {
      abort(error);
    }
  };
}

export async function restoreBackup(payload: BackupPayload): Promise<void> {
  validateBackupPayload(payload); // Reject malformed records before touching any store.
  // Decode every file before opening the write transaction: malformed data must never
  // leave a partially populated transaction or clear the user's existing records.
  const restoredFiles = payload.data.files.map((file) => {
    const { contentBase64, ...metadata } = file;
    return { ...metadata, blob: new Blob([decodeBase64(contentBase64)], { type: file.type }) };
  });
  const database = await openAlfredDatabase();
  try {
    const rows: RestoreRows = {
      [STORE_NAMES.tasks]: payload.data.tasks,
      [STORE_NAMES.projects]: payload.data.projects,
      [STORE_NAMES.appointments]: payload.data.appointments,
      [STORE_NAMES.disciplines]: payload.data.disciplines,
      [STORE_NAMES.studyTopics]: payload.data.studyTopics,
      [STORE_NAMES.files]: restoredFiles,
    };
    if (payload.data.focusSessions !== undefined) rows[STORE_NAMES.focusSessions] = payload.data.focusSessions;
    if (payload.data.memories !== undefined) rows[STORE_NAMES.memories] = payload.data.memories;
    // Old backups never included these collections. Keep existing study records
    // rather than clearing them without data to restore; the UI warns about legacy files.
    if (payload.data.studyFlashcards !== undefined) rows[STORE_NAMES.studyFlashcards] = payload.data.studyFlashcards;
    if (payload.data.studyQuestions !== undefined) rows[STORE_NAMES.studyQuestions] = payload.data.studyQuestions;
    if (payload.data.studyQuizAttempts !== undefined) rows[STORE_NAMES.studyQuizAttempts] = payload.data.studyQuizAttempts;
    if (payload.data.studyLearningProgress !== undefined) rows[STORE_NAMES.studyLearningProgress] = payload.data.studyLearningProgress;
    const transaction = database.transaction([...new Set([...Object.keys(rows), ...STUDY_BACKUP_KEYS])], 'readwrite');
    await new Promise<void>((resolve, reject) => {
      let failure: unknown;
      transaction.oncomplete = () => resolve();
      transaction.onabort = () => reject(failure ?? transaction.error ?? new Error('A restauração foi cancelada.'));
      const abort = (error: unknown) => {
        failure = error;
        transaction.abort();
      };
      try { queueRestore(transaction, rows, abort); }
      catch (error) { abort(error); }
    });
  } finally { database.close(); }
}
