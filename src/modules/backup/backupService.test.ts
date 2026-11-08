import { describe, expect, it } from 'vitest';
import { createBackup, inspectBackup, restoreBackup } from './backupService';
import { focusSessionRepository, memoryRepository } from '../../storage/repositories';
import type { AssistantMemory } from '../memory/types';
import type { FocusSession } from '../productivity/types';

const validBackup = {
  format: 'alfred-local-backup',
  version: 1,
  createdAt: '2026-11-02T12:00:00.000Z',
  data: { tasks: [], projects: [], appointments: [], disciplines: [], studyTopics: [], focusSessions: [], memories: [], files: [] },
};

describe('backupService', () => {
  it('inspeciona um backup válido e contabiliza os dados', () => {
    const result = inspectBackup(JSON.stringify(validBackup));
    expect(result.createdAt).toBe(validBackup.createdAt);
    expect(result.counts).toEqual({ tasks: 0, projects: 0, appointments: 0, disciplines: 0, studyTopics: 0, focusSessions: 0, memories: 0, files: 0 });
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
});
