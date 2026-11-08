import type { EntityRepository } from '../../storage/repositories';
import type { StoredFile, FileSummary, StoredTextExtraction } from './types';
import { MAX_FILE_SIZE } from './types';

type IdFactory = () => string;
export function createFileService(repository: EntityRepository<StoredFile>, createId: IdFactory = () => crypto.randomUUID(), now: () => Date = () => new Date()) {
  return {
    async list(): Promise<FileSummary[]> {
      const files = await repository.getAll();
      return files.map(({ id, name, type, size, createdAt, disciplineId, extraction }) => ({
        id, name, type, size, createdAt,
        ...(disciplineId ? { disciplineId } : {}),
        hasExtractedText: Boolean(extraction),
        ...(extraction ? { extractedAt: extraction.extractedAt } : {}),
      })).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    },
    async add(file: File, disciplineId?: string): Promise<FileSummary> {
      const name = file.name.trim();
      if (!name) throw new Error('Escolha um arquivo válido.');
      if (file.size <= 0) throw new Error('O arquivo está vazio.');
      if (file.size > MAX_FILE_SIZE) throw new Error('O arquivo deve ter no máximo 10 MB.');
      const stored: StoredFile = {
        id: createId(), name, type: file.type || 'application/octet-stream',
        size: file.size, createdAt: now().toISOString(),
        ...(disciplineId ? { disciplineId } : {}), blob: file,
      };
      await repository.save(stored);
      return {
        id: stored.id, name: stored.name, type: stored.type, size: stored.size,
        createdAt: stored.createdAt, ...(stored.disciplineId ? { disciplineId: stored.disciplineId } : {}),
        hasExtractedText: false,
      };
    },
    async get(id: string): Promise<StoredFile | undefined> { return repository.getById(id); },
    async setDiscipline(id: string, disciplineId?: string): Promise<void> {
      const stored = await repository.getById(id);
      if (!stored) throw new Error('Arquivo não encontrado.');
      const updated = { ...stored };
      if (disciplineId) updated.disciplineId = disciplineId;
      else delete updated.disciplineId;
      await repository.save(updated);
    },
    async saveExtraction(id: string, extraction: StoredTextExtraction): Promise<void> {
      const stored = await repository.getById(id);
      if (!stored) throw new Error('Arquivo não encontrado.');
      await repository.save({ ...stored, extraction });
    },
    async delete(id: string): Promise<void> { await repository.delete(id); },
  };
}
