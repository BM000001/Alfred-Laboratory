export const ALFRED_DATABASE_NAME = 'alfred';
export const ALFRED_DATABASE_VERSION = 10;
export const STORE_NAMES = {
  tasks: 'tasks',
  projects: 'projects',
  appointments: 'appointments',
  disciplines: 'disciplines',
  studyTopics: 'studyTopics',
  studyFlashcards: 'studyFlashcards',
  studyQuestions: 'studyQuestions',
  studyQuizAttempts: 'studyQuizAttempts',
  files: 'files',
  focusSessions: 'focusSessions',
  assistantMessages: 'assistantMessages',
  memories: 'memories',
  egressAudit: 'egressAudit',
  egressSettings: 'egressSettings',
} as const;

export function openAlfredDatabase(factory: IDBFactory = indexedDB): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = factory.open(ALFRED_DATABASE_NAME, ALFRED_DATABASE_VERSION);
    request.onupgradeneeded = () => {
      const database = request.result;
      for (const storeName of Object.values(STORE_NAMES)) {
        if (!database.objectStoreNames.contains(storeName)) database.createObjectStore(storeName, { keyPath: 'id' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('Não foi possível abrir o banco de dados.'));
    request.onblocked = () => reject(new Error('A abertura do banco foi bloqueada por outra conexão.'));
  });
}

export function runStoreRequest<T>(database: IDBDatabase, storeName: string, mode: IDBTransactionMode, operation: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    let result: T;
    try {
      const transaction = database.transaction(storeName, mode);
      const request = operation(transaction.objectStore(storeName));
      request.onsuccess = () => { result = request.result; };
      request.onerror = () => reject(request.error ?? new Error('A operação no banco de dados falhou.'));
      transaction.oncomplete = () => resolve(result);
      transaction.onerror = () => reject(transaction.error ?? new Error('A transação no banco de dados falhou.'));
      transaction.onabort = () => reject(transaction.error ?? new Error('A transação no banco de dados foi cancelada.'));
    } catch (error) { reject(error); }
  });
}
