import 'fake-indexeddb/auto';
import { afterEach, describe, expect, it } from 'vitest';
import { ALFRED_DATABASE_NAME, openAlfredDatabase, runStoreRequest, STORE_NAMES } from './database';
import { deleteDisciplineStudyRecords } from './studyCleanup';

afterEach(() => indexedDB.deleteDatabase(ALFRED_DATABASE_NAME));

describe('deleteDisciplineStudyRecords', () => {
  it('atomically removes linked learning rows and preserves other disciplines and source files', async () => {
    const database = await openAlfredDatabase();
    try {
      const rows: Record<string, Array<{ id: string; disciplineId?: string }>> = {
        [STORE_NAMES.disciplines]: [{ id: 'd1' }, { id: 'd2' }],
        [STORE_NAMES.studyTopics]: [{ id: 't1', disciplineId: 'd1' }, { id: 't2', disciplineId: 'd2' }],
        [STORE_NAMES.studyFlashcards]: [{ id: 'c1', disciplineId: 'd1' }, { id: 'c2', disciplineId: 'd2' }],
        [STORE_NAMES.studyQuestions]: [{ id: 'q1', disciplineId: 'd1' }, { id: 'q2', disciplineId: 'd2' }],
        [STORE_NAMES.studyQuizAttempts]: [{ id: 'a1', disciplineId: 'd1' }, { id: 'a2', disciplineId: 'd2' }],
        [STORE_NAMES.studyLearningProgress]: [{ id: 'p1', disciplineId: 'd1' }, { id: 'p2', disciplineId: 'd2' }],
        [STORE_NAMES.files]: [{ id: 'f1', disciplineId: 'd1' }],
      };
      for (const [storeName, values] of Object.entries(rows)) {
        for (const value of values) await runStoreRequest(database, storeName, 'readwrite', store => store.put(value));
      }
    } finally { database.close(); }

    await deleteDisciplineStudyRecords('d1');
    const reopened = await openAlfredDatabase();
    try {
      for (const name of [STORE_NAMES.disciplines, STORE_NAMES.studyTopics, STORE_NAMES.studyFlashcards,
        STORE_NAMES.studyQuestions, STORE_NAMES.studyQuizAttempts, STORE_NAMES.studyLearningProgress]) {
        expect(await runStoreRequest<Array<{ id: string }>>(reopened, name, 'readonly', store => store.getAll()))
          .toEqual([{ id: name === STORE_NAMES.disciplines ? 'd2' : name === STORE_NAMES.studyTopics ? 't2' : name === STORE_NAMES.studyFlashcards ? 'c2' : name === STORE_NAMES.studyQuestions ? 'q2' : name === STORE_NAMES.studyQuizAttempts ? 'a2' : 'p2', ...(name === STORE_NAMES.disciplines ? {} : { disciplineId: 'd2' }) }]);
      }
      expect(await runStoreRequest(reopened, STORE_NAMES.files, 'readonly', store => store.get('f1'))).toMatchObject({ id: 'f1', disciplineId: 'd1' });
    } finally { reopened.close(); }
  });

  it('rejects an empty discipline id without changing the database', async () => {
    await expect(deleteDisciplineStudyRecords('')).rejects.toThrow('Disciplina inválida');
  });
});
