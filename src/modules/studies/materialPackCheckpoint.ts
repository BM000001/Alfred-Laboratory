import { openAlfredDatabase, STORE_NAMES } from '../../storage/database';
import type { StoredFile } from '../files/types';
import { requestAIStudyPack, validateAIStudyPack } from './studyRemotePack';
import { isSameOriginAIAvailable, selectAIStudyChunks } from './studyRemoteQuestions';

type PendingPack = NonNullable<NonNullable<StoredFile['processing']>['pendingStudyPack']>;
type Source = { fileId: string; disciplineId: string; topicId: string; sourceText: string };

async function checkpoint(source: Source, write?: PendingPack, remove?: string) {
  const db = await openAlfredDatabase();
  try {
    return await new Promise<PendingPack | undefined>((resolve, reject) => {
      const tx = db.transaction(STORE_NAMES.files, write || remove ? 'readwrite' : 'readonly');
      const store = tx.objectStore(STORE_NAMES.files);
      const get = store.get(source.fileId);
      let pending: PendingPack | undefined;
      tx.onabort = () => reject(tx.error ?? new Error('O material ou a unidade mudou.'));
      tx.oncomplete = () => resolve(pending);
      get.onsuccess = () => {
        const file: StoredFile | undefined = get.result;
        const state = file?.processing;
        if (!file || !state || file.disciplineId !== source.disciplineId || state.topicId !== source.topicId ||
            state.raw?.text !== source.sourceText) { tx.abort(); return; }
        pending = state.pendingStudyPack;
        if (remove && pending?.id === remove) {
          delete state.pendingStudyPack;
          store.put(file);
        } else if (write) {
          state.pendingStudyPack = write;
          store.put(file);
        }
      };
    });
  } finally { db.close(); }
}

export async function prepareMaterialPack(source: Source, request: Parameters<typeof requestAIStudyPack>[0]) {
  request.signal.throwIfAborted();
  if (!request.consent || !isSameOriginAIAvailable(request.configuredOrigin, request.currentOrigin) ||
      source.sourceText !== request.sourceText) throw new Error('Origem, consentimento ou material inválido.');
  let pending = await checkpoint(source);
  const chunks = selectAIStudyChunks(source.sourceText);
  if (pending?.version === 1) {
    try {
      const pack = validateAIStudyPack(pending.payload, chunks);
      if (pack.lessons.length || pack.questions.length || pack.flashcards.length) {
        const id = pending.id;
        return { pack, finish: () => checkpoint(source, undefined, id) };
      }
    } catch { /* A malformed saved response is replaced by a fresh request. */ }
    await checkpoint(source, undefined, pending.id);
  }
  let id: string | undefined;
  const pack = await requestAIStudyPack({...request, onValidatedPayload: async payload => {
    if (JSON.stringify(payload).length > 64000) throw new Error('Resposta excedeu o limite do pacote.');
    id = crypto.randomUUID();
    await checkpoint(source, {version:1, id, payload});
  }});
  return { pack, finish: () => id ? checkpoint(source, undefined, id) : Promise.resolve(undefined) };
}
