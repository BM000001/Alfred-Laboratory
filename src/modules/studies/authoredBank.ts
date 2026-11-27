import { openAlfredDatabase, STORE_NAMES } from '../../storage/database';
import { authoredActivities } from './authoredActivities';
import type { StudyQuestion } from './questionTypes';

export async function addAuthoredBank(disciplineId: string, topicId: string) {
  const db = await openAlfredDatabase();
  try {
    return await new Promise<number>((resolve, reject) => {
      const tx = db.transaction([STORE_NAMES.studyQuestions, STORE_NAMES.studyTopics], 'readwrite');
      const questions = tx.objectStore(STORE_NAMES.studyQuestions);
      const topic = tx.objectStore(STORE_NAMES.studyTopics).get(topicId);
      let added = 0;
      tx.oncomplete = () => resolve(added);
      tx.onabort = () => reject(tx.error ?? new Error('Unidade indisponível.'));
      topic.onsuccess = () => {
        if (topic.result?.disciplineId !== disciplineId) { tx.abort(); return; }
        for (const scene of authoredActivities) for (const step of scene.steps) {
          const id = JSON.stringify(['practice-v1', disciplineId, topicId, scene.id, step.difficulty]);
          const existing = questions.getKey(id);
          existing.onsuccess = () => {
            if (existing.result !== undefined) return;
            const question: StudyQuestion = { ...step, id, disciplineId, topicId,
              prompt: scene.title + ' · ' + step.prompt + '\n' + scene.material,
              subject: scene.title, sourceExcerpt: scene.material, createdAt: new Date().toISOString() };
            questions.add(question);
            added++;
          };
        }
      };
    });
  } finally { db.close(); }
}
