import { openAlfredDatabase, STORE_NAMES } from '../../storage/database';
import type { Task } from '../tasks/types';
import type { Project } from '../projects/types';
import type { Appointment } from '../agenda/types';
import type { Discipline, StudyTopic } from '../studies/types';
import type { StoredFile } from '../files/types';
import type { FocusSession } from '../productivity/types';
import type { AssistantMemory } from '../memory/types';

const BACKUP_FORMAT = 'alfred-local-backup';
const BACKUP_VERSION = 1;

type BackupPayload = {
  format: typeof BACKUP_FORMAT;
  version: typeof BACKUP_VERSION;
  createdAt: string;
  data: {
    tasks: Task[];
    projects: Project[];
    appointments: Appointment[];
    disciplines: Discipline[];
    studyTopics: StudyTopic[];
    focusSessions: FocusSession[];
    memories: AssistantMemory[];
    files: Array<Omit<StoredFile, 'blob'> & { contentBase64: string }>;
  };
};

function toBase64(bytes: Uint8Array): string {
  let binary = '';
  const chunkSize = 0x8000;
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize));
  }
  return btoa(binary);
}

function fromBase64(value: string): Uint8Array {
  if (value.length % 4 !== 0 || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(value)) {
    throw new Error('Conteúdo Base64 inválido.');
  }
  const binary = atob(value);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function assertEntities(value: unknown, label: string): asserts value is Array<{ id: string }> {
  if (!Array.isArray(value) || !value.every((item) => isRecord(item) && typeof item.id === 'string' && item.id.length > 0)) {
    throw new Error(`O backup contém dados inválidos em: ${label}.`);
  }
}

export async function createBackup(): Promise<string> {
  const database = await openAlfredDatabase();
  try {
    const names = [
      STORE_NAMES.tasks, STORE_NAMES.projects, STORE_NAMES.appointments,
      STORE_NAMES.disciplines, STORE_NAMES.studyTopics, STORE_NAMES.files,
      STORE_NAMES.focusSessions, STORE_NAMES.assistantMessages, STORE_NAMES.memories,
    ];
    const transaction = database.transaction(names, 'readonly');
    const requests = names.map((name) => new Promise<unknown[]>((resolve, reject) => {
      const request = transaction.objectStore(name).getAll();
      request.onsuccess = () => resolve(request.result as unknown[]);
      request.onerror = () => reject(request.error ?? new Error('Falha ao ler os dados locais.'));
    }));
    const [tasks, projects, appointments, disciplines, studyTopics, files, focusSessions, , memories] = await Promise.all(requests);
    const filePayload = await Promise.all((files as StoredFile[]).map(async (file) => ({
      id: file.id, name: file.name, type: file.type, size: file.size, createdAt: file.createdAt,
      contentBase64: toBase64(new Uint8Array(await file.blob.arrayBuffer())),
    })));
    const payload: BackupPayload = {
      format: BACKUP_FORMAT, version: BACKUP_VERSION, createdAt: new Date().toISOString(),
      data: { tasks: tasks as Task[], projects: projects as Project[], appointments: appointments as Appointment[],
        disciplines: disciplines as Discipline[], studyTopics: studyTopics as StudyTopic[], focusSessions: focusSessions as FocusSession[], memories: memories as AssistantMemory[], files: filePayload },
    };
    return JSON.stringify(payload);
  } finally { database.close(); }
}

export function inspectBackup(raw: string): { createdAt: string; counts: Record<string, number>; payload: BackupPayload } {
  let parsed: unknown;
  try { parsed = JSON.parse(raw); } catch { throw new Error('O arquivo selecionado não contém um JSON válido.'); }
  if (!isRecord(parsed) || parsed.format !== BACKUP_FORMAT || parsed.version !== BACKUP_VERSION || !isRecord(parsed.data)) {
    throw new Error('Formato de backup inválido ou versão não compatível.');
  }
  const data = parsed.data;
  // Backups created before focus-history support remain readable.
  if (data.focusSessions === undefined) data.focusSessions = [];
  if (data.memories === undefined) data.memories = [];
  for (const name of ['tasks', 'projects', 'appointments', 'disciplines', 'studyTopics', 'focusSessions', 'memories', 'files']) assertEntities(data[name], name);
  const validCategories = ['preference', 'goal', 'project', 'routine', 'other'];
  if (!(data.memories as unknown[]).every((item) => isRecord(item) && typeof item.title === 'string' && item.title.trim().length > 0 && item.title.length <= 80 && typeof item.content === 'string' && item.content.trim().length > 0 && item.content.length <= 500 && validCategories.includes(String(item.category)) && typeof item.createdAt === 'string' && !Number.isNaN(Date.parse(item.createdAt)) && typeof item.updatedAt === 'string' && !Number.isNaN(Date.parse(item.updatedAt)))) {
    throw new Error('O backup contém memórias inválidas.');
  }
  const files = data.files as unknown[];
  for (const file of files) {
    if (!isRecord(file) || typeof file.contentBase64 !== 'string' || typeof file.name !== 'string'
      || typeof file.type !== 'string' || !Number.isSafeInteger(file.size) || (file.size as number) < 0
      || typeof file.createdAt !== 'string') {
      throw new Error('O backup contém arquivos inválidos.');
    }
    let bytes: Uint8Array;
    try { bytes = fromBase64(file.contentBase64); } catch {
      throw new Error('O backup contém arquivos com conteúdo Base64 inválido.');
    }
    if (bytes.byteLength !== file.size) throw new Error('O tamanho do conteúdo de um arquivo não corresponde aos metadados.');
  }
  if (typeof parsed.createdAt !== 'string' || Number.isNaN(Date.parse(parsed.createdAt))) {
    throw new Error('Data de criação do backup inválida.');
  }
  return {
    createdAt: parsed.createdAt,
    counts: { tasks: (data.tasks as unknown[]).length, projects: (data.projects as unknown[]).length, appointments: (data.appointments as unknown[]).length,
      disciplines: (data.disciplines as unknown[]).length, studyTopics: (data.studyTopics as unknown[]).length,
      focusSessions: (data.focusSessions as unknown[]).length, memories: (data.memories as unknown[]).length, files: files.length },
    payload: parsed as unknown as BackupPayload,
  };
}

export async function restoreBackup(payload: BackupPayload): Promise<void> {
  // Decode every file before opening the write transaction: malformed data must never
  // leave a partially populated transaction or clear the user's existing records.
  const restoredFiles = payload.data.files.map((file) => {
    const bytes = fromBase64(file.contentBase64);
    if (bytes.byteLength !== file.size) throw new Error('O tamanho do conteúdo de um arquivo não corresponde aos metadados.');
    const { contentBase64, ...metadata } = file;
    return { ...metadata, blob: new Blob([bytes], { type: file.type }) };
  });
  const database = await openAlfredDatabase();
  const names = Object.values(STORE_NAMES);
  try {
    const transaction = database.transaction(names, 'readwrite');
    const completion = new Promise<void>((resolve, reject) => {
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error ?? new Error('Não foi possível restaurar o backup.'));
      transaction.onabort = () => reject(transaction.error ?? new Error('A restauração foi cancelada.'));
    });
    const rows: Record<string, unknown[]> = {
      [STORE_NAMES.tasks]: payload.data.tasks,
      [STORE_NAMES.projects]: payload.data.projects,
      [STORE_NAMES.appointments]: payload.data.appointments,
      [STORE_NAMES.disciplines]: payload.data.disciplines,
      [STORE_NAMES.studyTopics]: payload.data.studyTopics,
      [STORE_NAMES.focusSessions]: payload.data.focusSessions ?? [],
      [STORE_NAMES.files]: restoredFiles,
      [STORE_NAMES.memories]: payload.data.memories ?? [],
    };
    for (const name of Object.keys(rows)) {
      const store = transaction.objectStore(name);
      store.clear();
      for (const entity of rows[name] ?? []) store.put(entity);
    }
    await completion;
  } finally { database.close(); }
}
