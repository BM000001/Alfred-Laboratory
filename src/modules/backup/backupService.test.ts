import { describe, expect, it } from 'vitest';
import { createBackup, inspectBackup, restoreBackup } from './backupService';
import { focusSessionRepository, memoryRepository, studyFlashcardRepository, studyQuestionRepository, studyQuizAttemptRepository } from '../../storage/repositories';
import { openAlfredDatabase, runStoreRequest, STORE_NAMES } from '../../storage/database';
import type { AssistantMemory } from '../memory/types';
import type { FocusSession } from '../productivity/types';

const validBackup = {
  format: 'alfred-local-backup',
  version: 1,
  createdAt: '2026-11-02T12:00:00.000Z',
  data: { tasks: [], projects: [], appointments: [], disciplines: [], studyTopics: [], focusSessions: [], memories: [], files: [] },
};

const card = {
  id: 'backup-card-59', disciplineId: 'software', front: 'Mitose?', back: 'Divisão celular.',
  createdAt: '2026-11-15T12:00:00.000Z', nextReviewAt: '2026-11-16T12:00:00.000Z',
  intervalDays: 1, reviewCount: 0, topicId: 'topic-59', sourceFileId: 'file-59',
};
const question = {
  id: 'backup-question-59', disciplineId: 'software', prompt: 'Qual definição está correta?',
  options: ['Mitose', 'Meiose'], correctOptionIndex: 0, difficulty: 'easy' as const,
  createdAt: '2026-11-15T12:00:00.000Z', topicId: 'topic-59', sourceFileId: 'file-59',
};
const attempt = {
  id: 'backup-attempt-59', disciplineId: 'software', startedAt: '2026-11-15T12:00:00.000Z',
  completedAt: '2026-11-15T12:02:00.000Z', totalQuestions: 1, correctAnswers: 1,
  answers: [{ questionId: question.id, selectedOptionIndex: 0, isCorrect: true, questionSnapshot: question }],
};
const progress = {
  id: 'backup-progress-59', disciplineId: 'software', lessonId: 'lesson-59',
  completedAt: '2026-11-15T12:03:00.000Z', context: 'technical',
};

async function progressRequest<T>(mode: IDBTransactionMode, operation: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await openAlfredDatabase();
  try { return await runStoreRequest<T>(db, STORE_NAMES.studyLearningProgress, mode, operation); }
  finally { db.close(); }
}

describe('backupService', () => {
  it('inspeciona um backup válido e contabiliza os dados', () => {
    const result = inspectBackup(JSON.stringify(validBackup));
    expect(result.createdAt).toBe(validBackup.createdAt);
    expect(result.counts).toEqual({ tasks: 0, projects: 0, appointments: 0, disciplines: 0, studyTopics: 0, studyFlashcards: 0, studyQuestions: 0, studyQuizAttempts: 0, studyLearningProgress: 0, focusSessions: 0, memories: 0, files: 0 });
    expect(result.legacyStudyData).toBe(true);
  });

  it('continua lendo backups antigos sem histórico de foco', () => {
    const { memories: _memories, focusSessions: _focusSessions, ...legacyData } = validBackup.data;
    const legacy = { ...validBackup, data: { ...legacyData, files: [] } };
    expect(inspectBackup(JSON.stringify(legacy)).counts.focusSessions).toBe(0);
  });

  it('inclui o histórico Pomodoro no backup exportado', async () => {
    const id = 'backup-focus-session-test';
    const session: FocusSession = { id, startedAt: '2026-11-02T10:00:00.000Z', completedAt: '2026-11-02T10:25:00.000Z', durationMinutes: 25, kind: 'focus' };
    try {
      await focusSessionRepository.save(session);
      expect(inspectBackup(await createBackup()).counts.focusSessions).toBe(1);
    } finally {
      await focusSessionRepository.delete(id);
    }
  });

  it('inclui memórias explícitas no backup', async () => {
    const memory: AssistantMemory = { id: 'memory-backup-test', title: 'Preferência', content: 'Prefiro planos objetivos.', category: 'preference', createdAt: '2026-11-03T10:00:00.000Z', updatedAt: '2026-11-03T10:00:00.000Z' };
    try {
      await memoryRepository.save(memory);
      expect(inspectBackup(await createBackup()).counts.memories).toBe(1);
    } finally { await memoryRepository.delete(memory.id); }
  });

  it('restaura memórias do backup para o IndexedDB', async () => {
    const memory: AssistantMemory = { id: 'memory-restore-test', title: 'Objetivo', content: 'Concluir o projeto.', category: 'goal', createdAt: '2026-11-03T10:00:00.000Z', updatedAt: '2026-11-03T10:00:00.000Z' };
    try {
      await memoryRepository.save(memory);
      const preview = inspectBackup(await createBackup());
      await memoryRepository.delete(memory.id);
      await restoreBackup(preview.payload);
      expect(await memoryRepository.getById(memory.id)).toEqual(memory);
    } finally { await memoryRepository.delete(memory.id); }
  });

  it('rejeita memórias inválidas no backup', () => {
    const invalid = { ...validBackup, data: { ...validBackup.data, memories: [{ id: 'm1', title: '', content: 'x', category: 'unknown', createdAt: 'invalid', updatedAt: 'invalid' }] } };
    expect(() => inspectBackup(JSON.stringify(invalid))).toThrow('memórias inválidas');
  });

  it('rejeita JSON inválido', () => {
    expect(() => inspectBackup('{')).toThrow('JSON válido');
  });

  it('rejeita formato e versão incompatíveis', () => {
    expect(() => inspectBackup(JSON.stringify({ ...validBackup, version: 99 }))).toThrow('não compatível');
  });

  it('rejeita entidades sem identificador', () => {
    const invalid = { ...validBackup, data: { ...validBackup.data, tasks: [{ title: 'Sem id' }] } };
    expect(() => inspectBackup(JSON.stringify(invalid))).toThrow('tasks');
  });

  it('rejeita arquivo sem metadados e conteúdo Base64', () => {
    const invalid = { ...validBackup, data: { ...validBackup.data, files: [{ id: 'f1', name: 'a.txt', type: 'text/plain', size: 1, createdAt: validBackup.createdAt }] } };
    expect(() => inspectBackup(JSON.stringify(invalid))).toThrow('arquivos inválidos');
  });

  it('rejeita conteúdo Base64 malformado', () => {
    const invalid = { ...validBackup, data: { ...validBackup.data, files: [{ id: 'f1', name: 'a.txt', type: 'text/plain', size: 1, createdAt: validBackup.createdAt, contentBase64: '!!!' }] } };
    expect(() => inspectBackup(JSON.stringify(invalid))).toThrow('Base64 inválido');
  });

  it('rejeita divergência entre tamanho declarado e conteúdo', () => {
    const invalid = { ...validBackup, data: { ...validBackup.data, files: [{ id: 'f1', name: 'a.txt', type: 'text/plain', size: 2, createdAt: validBackup.createdAt, contentBase64: 'YQ==' }] } };
    expect(() => inspectBackup(JSON.stringify(invalid))).toThrow('não corresponde');
  });

  it('aceita arquivo vazio com tamanho zero', () => {
    const valid = { ...validBackup, data: { ...validBackup.data, files: [{ id: 'f1', name: 'vazio.txt', type: 'text/plain', size: 0, createdAt: validBackup.createdAt, contentBase64: '' }] } };
    expect(inspectBackup(JSON.stringify(valid)).counts.files).toBe(1);
  });

  it('exports and restores flashcards, questions, attempts with snapshots, and learning progress', async () => {
    try {
      await studyFlashcardRepository.save(card);
      await studyQuestionRepository.save(question);
      await studyQuizAttemptRepository.save(attempt);
      await progressRequest('readwrite', (store) => store.put(progress));
      const serialized = await createBackup();
      const preview = inspectBackup(serialized);
      expect(JSON.parse(serialized).version).toBe(2);
      expect(preview.legacyStudyData).toBe(false);
      expect(preview.counts).toMatchObject({
        studyFlashcards: 1, studyQuestions: 1, studyQuizAttempts: 1, studyLearningProgress: 1,
      });

      await studyFlashcardRepository.delete(card.id);
      await studyQuestionRepository.delete(question.id);
      await studyQuizAttemptRepository.delete(attempt.id);
      await progressRequest('readwrite', (store) => store.delete(progress.id));
      await restoreBackup(preview.payload);
      expect(await studyFlashcardRepository.getById(card.id)).toEqual(card);
      expect(await studyQuestionRepository.getById(question.id)).toEqual(question);
      expect(await studyQuizAttemptRepository.getById(attempt.id)).toEqual(attempt);
      expect(await progressRequest('readonly', (store) => store.get(progress.id))).toEqual(progress);
    } finally {
      await studyFlashcardRepository.delete(card.id);
      await studyQuestionRepository.delete(question.id);
      await studyQuizAttemptRepository.delete(attempt.id);
      await progressRequest('readwrite', (store) => store.delete(progress.id));
    }
  });

  it('preserves existing study records when a legacy v1 backup omitted the collections', async () => {
    try {
      await studyFlashcardRepository.save(card);
      const preview = inspectBackup(JSON.stringify(validBackup));
      expect(preview.legacyStudyData).toBe(true);
      await restoreBackup(preview.payload);
      expect(await studyFlashcardRepository.getById(card.id)).toEqual(card);
    } finally {
      await studyFlashcardRepository.delete(card.id);
    }
  });

  it('replaces study collections with explicit empty arrays in a v2 backup', async () => {
    try {
      await studyFlashcardRepository.save(card);
      const preview = inspectBackup(await createBackup());
      preview.payload.data.studyFlashcards = [];
      await restoreBackup(preview.payload);
      expect(await studyFlashcardRepository.getById(card.id)).toBeUndefined();
    } finally {
      await studyFlashcardRepository.delete(card.id);
    }
  });

  it('rejects incomplete v2 study data and invalid questions before any write', async () => {
    const emptyV2 = { ...validBackup, version: 2, data: { ...validBackup.data } };
    expect(() => inspectBackup(JSON.stringify(emptyV2))).toThrow('incompleto');
    try {
      await studyFlashcardRepository.save(card);
      const broken = JSON.parse(await createBackup()) as ReturnType<typeof inspectBackup>['payload'];
      broken.data.studyQuestions = [{
        ...question, options: ['apenas uma'], correctOptionIndex: 3,
      }];
      expect(() => inspectBackup(JSON.stringify(broken))).toThrow('studyQuestions');
      await expect(restoreBackup(broken)).rejects.toThrow('studyQuestions');
      expect(await studyFlashcardRepository.getById(card.id)).toEqual(card);
    } finally {
      await studyFlashcardRepository.delete(card.id);
    }
  });

  it('rejects duplicate learning progress IDs before restoring any records', async () => {
    const broken = JSON.parse(await createBackup()) as ReturnType<typeof inspectBackup>['payload'];
    broken.data.studyLearningProgress = [progress, { ...progress }];
    expect(() => inspectBackup(JSON.stringify(broken))).toThrow('studyLearningProgress');
    await expect(restoreBackup(broken)).rejects.toThrow('studyLearningProgress');
  });

});
