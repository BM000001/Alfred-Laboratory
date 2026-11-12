import { describe, expect, it, vi } from 'vitest';
import { createNoteService } from './noteService';
import { createFileService } from './fileService';
import { fileRepository } from '../../storage/repositories';
import { createBackup, inspectBackup, restoreBackup } from '../backup/backupService';
const notes = createNoteService(fileRepository);
describe('workspace records', () => {
  it('keeps notes scoped to their project and updates without duplication', async () => {
    const a = await notes.save({ projectId: 'scope-a' }, 'Decisões', 'Primeira versão');
    await notes.save({ projectId: 'scope-b' }, 'Outro projeto', 'Separado');
    await notes.save({ projectId: 'scope-a' }, 'Decisões finais', 'Segunda versão', a.id);
    expect(await notes.list({ projectId: 'scope-a' })).toHaveLength(1);
    expect((await notes.list({ projectId: 'scope-a' }))[0].noteText).toBe('Segunda versão');
    await expect(notes.save({ projectId: 'scope-b' }, 'Não mover', 'Teste', a.id)).rejects.toThrow('neste espaço');
  });
  it('retains project and discipline links in file summaries', async () => {
    const files = createFileService(fileRepository);
    const file = await files.add(new File(['conteúdo'], 'arquivo.txt', { type: 'text/plain' }), 'disciplina', 'projeto');
    expect((await files.list()).find(item => item.id === file.id)).toMatchObject({ projectId: 'projeto', disciplineId: 'disciplina' });
    await fileRepository.delete(file.id);
  });
  it('round-trips note text and scope through backup', async () => {
    // jsdom Blob lacks arrayBuffer; use the native Node Blob for the backup path.
    const { Blob: NodeBlob } = await vi.importActual<{ Blob: typeof Blob }>('node:buffer');
    const note = await notes.save({ projectId: 'backup-project' }, 'Plano', 'Conteúdo persistente');
    await fileRepository.save({ ...note, blob: new NodeBlob(['Conteúdo persistente']) as unknown as Blob });
    // Other records in this test file also need native blobs for serialization.
    for (const file of await fileRepository.getAll()) if (file.kind === 'note') await fileRepository.save({ ...file, blob: new NodeBlob([file.noteText || '']) as unknown as Blob });
    const backup = await createBackup();
    inspectBackup(backup);
    await fileRepository.delete(note.id);
    await restoreBackup(inspectBackup(backup).payload);
    expect(await fileRepository.getById(note.id)).toMatchObject({ name: 'Plano', projectId: 'backup-project', kind: 'note', noteText: 'Conteúdo persistente' });
  });
});
