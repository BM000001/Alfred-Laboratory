import type { EntityRepository } from '../../storage/repositories';
import type { StoredFile } from './types';
export type NoteScope = { projectId?: string; disciplineId?: string };
export function createNoteService(repository: EntityRepository<StoredFile>) {
  return {
    async list(scope: NoteScope) {
      return (await repository.getAll()).filter(file => file.kind === 'note' && file.projectId === scope.projectId && file.disciplineId === scope.disciplineId)
        .sort((a, b) => (b.updatedAt || b.createdAt).localeCompare(a.updatedAt || a.createdAt));
    },
    async save(scope: NoteScope, title: string, text: string, id?: string) {
      if (!title.trim()) throw new Error('Dê um título à anotação.');
      if (text.length > 100000) throw new Error('A anotação deve ter até 100 mil caracteres.');
      const current = id ? await repository.getById(id) : undefined;
      if (id && (!current || current.kind !== 'note' || current.projectId !== scope.projectId || current.disciplineId !== scope.disciplineId)) throw new Error('Anotação não encontrada neste espaço.');
      const blob = new Blob([text], { type: 'text/plain' });
      const note: StoredFile = { ...scope, id: id || crypto.randomUUID(), name: title.trim(), kind: 'note', noteText: text, blob, type: 'text/plain', size: blob.size, createdAt: current?.createdAt || new Date().toISOString(), updatedAt: new Date().toISOString() };
      await repository.save(note);
      return note;
    },
  };
}
