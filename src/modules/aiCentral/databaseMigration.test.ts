import { IDBFactory } from 'fake-indexeddb';
import { expect, it } from 'vitest';
import { ALFRED_DATABASE_NAME, openAlfredDatabase, runStoreRequest, STORE_NAMES } from '../../storage/database';
it('adds AI stores without losing records saved before the Central existed', async () => {
  const factory = new IDBFactory();
  const legacy = await new Promise<IDBDatabase>((resolve, reject) => {
    const request = factory.open(ALFRED_DATABASE_NAME, 13);
    request.onupgradeneeded = () => request.result.createObjectStore('tasks', { keyPath: 'id' });
    request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error);
  });
  await runStoreRequest(legacy, 'tasks', 'readwrite', store => store.put({ id: 'old-task', title: 'Preservar' })); legacy.close();
  const upgraded = await openAlfredDatabase(factory);
  try {
    expect(upgraded.objectStoreNames.contains(STORE_NAMES.aiTasks)).toBe(true);
    expect(upgraded.objectStoreNames.contains(STORE_NAMES.aiCentralSettings)).toBe(true);
    expect(await runStoreRequest(upgraded, 'tasks', 'readonly', store => store.get('old-task'))).toEqual({ id: 'old-task', title: 'Preservar' });
  } finally { upgraded.close(); }
});
