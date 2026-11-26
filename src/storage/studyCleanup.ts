import { openAlfredDatabase, STORE_NAMES } from './database';

const STORES_TO_REMOVE = [
  STORE_NAMES.disciplines,
  STORE_NAMES.studyTopics,
  STORE_NAMES.studyFlashcards,
  STORE_NAMES.studyQuestions,
  STORE_NAMES.studyQuizAttempts,
  STORE_NAMES.studyLearningProgress,
] as const;

/** Remove a discipline and its learning records atomically, preserving source files. */
export async function deleteDisciplineStudyRecords(disciplineId: string): Promise<void> {
  if (!disciplineId) throw new Error('Disciplina inválida.');
  const database = await openAlfredDatabase();
  try {
    await new Promise<void>((resolve, reject) => {
      let transaction: IDBTransaction;
      try {
        transaction = database.transaction([...STORES_TO_REMOVE], 'readwrite');
      } catch (error) {
        reject(error);
        return;
      }

      transaction.oncomplete = () => resolve();
      transaction.onabort = () => reject(transaction.error ?? new Error('A exclusão da disciplina foi cancelada.'));
      transaction.onerror = () => reject(transaction.error ?? new Error('Não foi possível excluir os dados da disciplina.'));

      const scan = (storeName: typeof STORES_TO_REMOVE[number], matches: (value: Record<string, unknown>) => boolean) => {
        const store = transaction.objectStore(storeName);
        const request = store.openCursor();
        request.onsuccess = () => {
          const cursor = request.result;
          if (!cursor) return;
          const value = cursor.value as Record<string, unknown>;
          if (matches(value)) {
            cursor.delete();
          }
          cursor.continue();
        };
      };

      scan(STORE_NAMES.disciplines, value => value.id === disciplineId);
      scan(STORE_NAMES.studyTopics, value => value.disciplineId === disciplineId);
      scan(STORE_NAMES.studyFlashcards, value => value.disciplineId === disciplineId);
      scan(STORE_NAMES.studyQuestions, value => value.disciplineId === disciplineId);
      scan(STORE_NAMES.studyQuizAttempts, value => value.disciplineId === disciplineId);
      scan(STORE_NAMES.studyLearningProgress, value => value.disciplineId === disciplineId);
    });
  } finally {
    database.close();
  }
}
