import 'fake-indexeddb/auto';
import { expect, it } from 'vitest';
import { openAlfredDatabase, runStoreRequest, STORE_NAMES } from '../../storage/database';
import { studyQuestionRepository } from '../../storage/repositories';
import { addAuthoredBank } from './authoredBank';
import { selectQuizQuestions } from './questionService';

it('preserva a unidade e as edições em importações concorrentes e após reabertura', async () => {
  const db = await openAlfredDatabase();
  await runStoreRequest(db, STORE_NAMES.studyTopics, 'readwrite', store => store.put({id:'demo-topic', disciplineId:'demo'}));
  db.close();
  expect((await Promise.all([addAuthoredBank('demo','demo-topic'), addAuthoredBank('demo','demo-topic')])).sort()).toEqual([0,30]);
  await expect(addAuthoredBank('outro','demo-topic')).rejects.toThrow();
  const questions = await studyQuestionRepository.getAll();
  for (const difficulty of ['easy','medium','hard'] as const) {
    const level = selectQuizQuestions(questions,{difficulty,topicId:'demo-topic'});
    expect(level).toHaveLength(10);
    for (const q of level) {
      expect(q.options[q.correctOptionIndex]).toBeTruthy();
      expect(new Set(q.options).size).toBe(q.options.length);
      expect(q.prompt).toContain(q.sourceExcerpt);
    }
  }
  await studyQuestionRepository.save({...questions[0], explanation:'Minha revisão'});
  expect(await addAuthoredBank('demo','demo-topic')).toBe(0);
  expect((await studyQuestionRepository.getById(questions[0].id))?.explanation).toBe('Minha revisão');
});
