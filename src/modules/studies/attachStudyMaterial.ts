import { openAlfredDatabase, STORE_NAMES } from '../../storage/database';
import type { StoredFile } from '../files/types';
import type { StudyTopic } from './types';

export async function attachStudyMaterial(topicId: string, disciplineId: string, fileId: string): Promise<StudyTopic> {
  const database = await openAlfredDatabase();
  try {
    return await new Promise((resolve, reject) => {
      const transaction = database.transaction([STORE_NAMES.studyTopics, STORE_NAMES.files], 'readwrite');
      const topics = transaction.objectStore(STORE_NAMES.studyTopics);
      const topicRequest = topics.get(topicId);
      const files = transaction.objectStore(STORE_NAMES.files);
      const fileRequest = files.get(fileId);
      let updated: StudyTopic;
      let failure: unknown;
      transaction.oncomplete = () => resolve(updated);
      transaction.onabort = () => reject(failure ?? transaction.error ?? new Error('Não foi possível vincular o material.'));
      function queueUpdate(operation: () => void) {
        try { operation(); } catch (cause) {
          failure = cause;
          transaction.abort();
        }
      }
      fileRequest.onsuccess = () => queueUpdate(() => {
        const topic = topicRequest.result as StudyTopic | undefined;
        const file = fileRequest.result as StoredFile | undefined;
        if (topic?.disciplineId !== disciplineId || file?.disciplineId !== disciplineId || file.kind === 'note') {
          throw new Error('O material e a unidade precisam pertencer à mesma disciplina.');
        }
        const saveLink = () => {
          updated = { ...topic, sourceFileId: fileId, sourceFileName: file.name };
          topics.put(updated);
        };
        if (topic.sourceFileId && topic.sourceFileId !== fileId) {
          const linkedFile = files.getKey(topic.sourceFileId);
          linkedFile.onsuccess = () => queueUpdate(() => {
            if (linkedFile.result !== undefined) {
              throw new Error('A unidade já tem um material vinculado. Use outra unidade para este arquivo.');
            }
            saveLink();
          });
        } else saveLink();
      });
    });
  } finally {
    database.close();
  }
}
