// @vitest-environment node
import { IDBFactory } from 'fake-indexeddb';
import { expect, it } from 'vitest';
import { ALFRED_DATABASE_NAME, openAlfredDatabase, runStoreRequest, STORE_NAMES } from './database';

function openVersion(factory: IDBFactory, version: number, stores: string[]): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = factory.open(ALFRED_DATABASE_NAME, version);
    request.onupgradeneeded = () => {
      for (const name of stores) request.result.createObjectStore(name, { keyPath: 'id' });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

it('migra 12→13 de forma aditiva e conserva estudos, anexos, notas e dados fora do backup', async () => {
  const factory = new IDBFactory();
  const before = {
    [STORE_NAMES.disciplines]: { id: 'disciplina' },
    [STORE_NAMES.studyTopics]: { id: 'tópico', disciplineId: 'disciplina' },
    [STORE_NAMES.studyQuestions]: { id: 'questão', disciplineId: 'disciplina' },
    [STORE_NAMES.studyFlashcards]: { id: 'cartão', disciplineId: 'disciplina' },
    [STORE_NAMES.studyQuizAttempts]: { id: 'simulado', disciplineId: 'disciplina' },
    [STORE_NAMES.files]: { id: 'nota', kind: 'note', blob: new Blob(['nota sintética']) },
    [STORE_NAMES.assistantMessages]: { id: 'mensagem' },
  };
  const old = await openVersion(factory, 12, Object.keys(before));
  try {
    for (const [name, row] of Object.entries(before)) {
      await runStoreRequest(old, name, 'readwrite', (store) => store.add(row));
    }
  } finally { old.close(); }
  const migrated = await openAlfredDatabase(factory);
  try {
    expect(migrated.version).toBe(13);
    expect([...migrated.objectStoreNames]).toEqual(Object.values(STORE_NAMES).sort());
    for (const [name, row] of Object.entries(before)) {
      expect(await runStoreRequest(migrated, name, 'readonly', (store) => store.get(row.id))).toEqual(row);
    }
    expect(await runStoreRequest(migrated, STORE_NAMES.studyLearningProgress, 'readonly', (store) => store.count())).toBe(0);
  } finally { migrated.close(); }
});

it('preserva dados quando uma abertura v13 tenta acessar um banco v14 com stores da Central', async () => {
  const factory = new IDBFactory();
  const current = await openAlfredDatabase(factory);
  const discipline = { id: 'disciplina' };
  await runStoreRequest(current, STORE_NAMES.disciplines, 'readwrite', (store) => store.add(discipline));
  current.close();
  // Modela a migração aditiva do #52 sem abrir o serviço ou usar suas credenciais.
  const future = await openVersion(factory, 14, ['aiTasks', 'aiCentralSettings']);
  const task = { id: 'tarefa-de-ia' };
  await runStoreRequest(future, 'aiTasks', 'readwrite', (store) => store.add(task));
  future.close();
  await expect(openAlfredDatabase(factory)).rejects.toMatchObject({ name: 'VersionError' });
  const reopened = await openVersion(factory, 14, []);
  try {
    expect(await runStoreRequest(reopened, STORE_NAMES.disciplines, 'readonly', (store) => store.get(discipline.id))).toEqual(discipline);
    expect(await runStoreRequest(reopened, 'aiTasks', 'readonly', (store) => store.get(task.id))).toEqual(task);
  } finally { reopened.close(); }
});
