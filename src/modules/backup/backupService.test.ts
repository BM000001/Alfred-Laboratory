// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import { decryptBackup, encryptBackup } from './encryptedBackup';
import { createBackup, inspectBackup, restoreBackup } from './backupService';
import { focusSessionRepository, memoryRepository, projectRepository, studyFlashcardRepository, studyQuestionRepository, studyQuizAttemptRepository } from '../../storage/repositories';
import { openAlfredDatabase, runStoreRequest, STORE_NAMES } from '../../storage/database';
import type { AssistantMemory } from '../memory/types';
import type { FocusSession } from '../productivity/types';

const validBackup = {
  format: 'alfred-local-backup',
  version: 1,
  createdAt: '2026-11-02T12:00:00.000Z',
  data: { tasks: [], projects: [], appointments: [], disciplines: [], studyTopics: [], focusSessions: [], memories: [], files: [] },
};

it('preserva etapas opcionais de projetos ao restaurar e exportar o backup', async () => {
  const project = {
    id: 'staged-project', name: 'Trabalho', createdAt: validBackup.createdAt, status: 'active' as const,
    stages: [{ id: 'stage-1', title: 'Rascunho', completed: true }],
  };
  await restoreBackup(inspectBackup(JSON.stringify({ ...validBackup, data: { ...validBackup.data, projects: [project] } })).payload);
  expect(await projectRepository.getById(project.id)).toEqual(project);
  expect(inspectBackup(await createBackup()).payload.data.projects).toContainEqual(project);
});

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
  completedAt: '2026-11-15T12:03:00.000Z', context: 'technical' as const,
};

async function request<T>(name: string, mode: IDBTransactionMode, operation: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await openAlfredDatabase();
  try { return await runStoreRequest<T>(db, name, mode, operation); }
  finally { db.close(); }
}

const documentFile = {
  id: 'file-59', name: 'material.pdf', type: 'application/pdf', size: 1, createdAt: validBackup.createdAt,
  projectId: 'project-59', disciplineId: card.disciplineId, contentBase64: 'YQ==',
  extraction: {
    format: 'pdf', text: 'Trecho de teste', characterCount: 15, wordCount: 3, extractedAt: validBackup.createdAt,
    extractionMethod: 'ocr', pageCount: 2,
    pages: [{ pageNumber: 2, text: 'Trecho de teste', method: 'text', confidence: null }],
  },
};

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

  it('conserva foco e memórias omitidos em v1 e substitui apenas as coleções presentes', async () => {
    const original = inspectBackup(await createBackup()).payload;
    const focus: FocusSession = {
      id: 'foco-local', startedAt: validBackup.createdAt, completedAt: validBackup.createdAt, durationMinutes: 25, kind: 'focus',
    };
    const memory: AssistantMemory = {
      id: 'memoria-local', title: 'Meta sintética', content: 'Revisar o material', category: 'goal',
      createdAt: validBackup.createdAt, updatedAt: validBackup.createdAt,
    };
    try {
      await focusSessionRepository.save(focus);
      await memoryRepository.save(memory);
      const { focusSessions: _focus, memories: _memories, ...historic } = validBackup.data;
      await restoreBackup(inspectBackup(JSON.stringify({ ...validBackup, data: historic })).payload);
      expect(await focusSessionRepository.getById(focus.id)).toEqual(focus);
      expect(await memoryRepository.getById(memory.id)).toEqual(memory);
      await restoreBackup(inspectBackup(JSON.stringify(validBackup)).payload);
      expect(await focusSessionRepository.getById(focus.id)).toBeUndefined();
      expect(await memoryRepository.getById(memory.id)).toBeUndefined();
    } finally { await restoreBackup(original); }
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
      await request(STORE_NAMES.studyLearningProgress, 'readwrite', (store) => store.put(progress));
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
      await request(STORE_NAMES.studyLearningProgress, 'readwrite', (store) => store.delete(progress.id));
      await restoreBackup(preview.payload);
      expect(await studyFlashcardRepository.getById(card.id)).toEqual(card);
      expect(await studyQuestionRepository.getById(question.id)).toEqual(question);
      expect(await studyQuizAttemptRepository.getById(attempt.id)).toEqual(attempt);
      expect(await request(STORE_NAMES.studyLearningProgress, 'readonly', (store) => store.get(progress.id))).toEqual(progress);
    } finally {
      await studyFlashcardRepository.delete(card.id);
      await studyQuestionRepository.delete(question.id);
      await studyQuizAttemptRepository.delete(attempt.id);
      await request(STORE_NAMES.studyLearningProgress, 'readwrite', (store) => store.delete(progress.id));
    }
  });

  it.each([
    ['disciplina', 'disciplines'],
    ['conteúdo de estudo', 'studyTopics'],
    ['arquivo de origem', 'files'],
    ['questão', 'studyQuestions'],
    ['flashcard da unidade', 'studyFlashcards'],
  ] as const)('bloqueia v1 que removeria %s de um estudo preservado antes de limpar qualquer store', async (label, key) => {
    const original = inspectBackup(await createBackup()).payload;
    const disciplines = [{ id: card.disciplineId, name: 'Disciplina anterior', createdAt: validBackup.createdAt }];
    const studyTopics = [{ id: card.topicId, disciplineId: card.disciplineId, title: 'Tópico', status: 'pending', createdAt: validBackup.createdAt }];
    const common = { ...validBackup.data, disciplines, studyTopics, files: [documentFile] };
    const v2 = { ...validBackup, version: 2, data: { ...common,
      studyFlashcards: [card], studyQuestions: [question], studyQuizAttempts: [attempt],
      studyLearningProgress: [{ ...progress, lessonId: `lesson:${card.id}` }],
    } };
    try {
      await restoreBackup(inspectBackup(JSON.stringify(v2)).payload);
      const data = { ...common, [key]: [] };
      const preview = inspectBackup(JSON.stringify({ ...validBackup, data }));
      expect(preview.legacyStudyData).toBe(true);
      const before = inspectBackup(await createBackup()).payload.data;
      const clear = vi.spyOn(IDBObjectStore.prototype, 'clear');
      try {
        await expect(restoreBackup(preview.payload)).rejects.toThrow(new RegExp(label));
        expect(clear).not.toHaveBeenCalled();
      } finally { clear.mockRestore(); }
      expect(inspectBackup(await createBackup()).payload.data).toEqual(before);
    } finally { await restoreBackup(original); }
  });

  it('restaura v1 cifrado com os vínculos mantidos e conserva os estudos e mensagens locais', async () => {
    const original = inspectBackup(await createBackup()).payload;
    const discipline = { id: card.disciplineId, name: 'Disciplina anterior', createdAt: validBackup.createdAt };
    const message = { id: 'local-message', content: 'Mensagem sintética local' };
    const data = { ...validBackup.data, disciplines: [discipline] };
    const password = 'senha-sintetica-123';
    try {
      await studyFlashcardRepository.save(card); // topic and source were already absent before restore
      await request(STORE_NAMES.disciplines, 'readwrite', (store) => store.put(discipline));
      await request(STORE_NAMES.assistantMessages, 'readwrite', (store) => store.put(message));
      const encrypted = await encryptBackup(JSON.stringify({ ...validBackup, data }), password);
      await restoreBackup(inspectBackup(await decryptBackup(encrypted, password)).payload);
      expect(await studyFlashcardRepository.getById(card.id)).toEqual(card);
      expect(await request(STORE_NAMES.assistantMessages, 'readonly', (store) => store.get(message.id))).toEqual(message);
    } finally {
      await request(STORE_NAMES.assistantMessages, 'readwrite', (store) => store.delete(message.id));
      await restoreBackup(original);
    }
  });

  it('usa o estado local após uma escrita concorrente já enfileirada para decidir a restauração v1', async () => {
    const original = inspectBackup(await createBackup()).payload;
    const database = await openAlfredDatabase();
    const write = database.transaction([STORE_NAMES.disciplines, STORE_NAMES.studyFlashcards], 'readwrite');
    const written = new Promise<void>((resolve, reject) => {
      write.oncomplete = () => resolve();
      write.onabort = () => reject(write.error);
    });
    write.objectStore(STORE_NAMES.disciplines).put({ id: card.disciplineId });
    write.objectStore(STORE_NAMES.studyFlashcards).put(card);
    try {
      const restored = restoreBackup(inspectBackup(JSON.stringify(validBackup)).payload);
      await Promise.all([written, expect(restored).rejects.toThrow(/disciplina/)]);
      expect(await studyFlashcardRepository.getById(card.id)).toEqual(card);
    } finally {
      database.close();
      await restoreBackup(original);
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

  it.each([1, 2])('restaura anexo de 10 MiB com e sem AES-GCM em v%i', async (version) => {
    const original = inspectBackup(await createBackup()).payload;
    const password = 'senha-sintetica-123';
    const bytes = new Uint8Array(10 * 1024 * 1024);
    for (let index = 0; index < bytes.length; index++) bytes[index] = index % 251;
    const study = version === 2 ? {
      studyFlashcards: [card], studyQuestions: [question], studyQuizAttempts: [attempt], studyLearningProgress: [progress],
    } : {};
    const note = {
      ...documentFile, id: 'note', name: 'Nota sintética', type: 'text/plain', kind: 'note',
      noteText: 'a', updatedAt: validBackup.createdAt, extraction: undefined,
    };
    try {
      const { contentBase64: _contentBase64, ...metadata } = documentFile;
      await restoreBackup(inspectBackup(JSON.stringify({
        ...validBackup, version, data: { ...validBackup.data, ...study, files: [note],
          disciplines: [{ id: card.disciplineId, name: 'Matéria sintética', createdAt: validBackup.createdAt }],
        },
      })).payload);
      await request(STORE_NAMES.files, 'readwrite', (store) => store.put({
        ...metadata, size: bytes.length, blob: new Blob([bytes], { type: metadata.type }),
      }));
      const exported = inspectBackup(await createBackup()).payload;
      const expected = version === 2 ? exported : { ...exported, version, data: {
        ...exported.data, studyFlashcards: undefined, studyQuestions: undefined,
        studyQuizAttempts: undefined, studyLearningProgress: undefined,
      } };
      const json = JSON.stringify(expected);
      const encrypted = await encryptBackup(json, password);
      for (const raw of [json, await decryptBackup(encrypted, password)]) {
        await restoreBackup(original);
        await restoreBackup(inspectBackup(raw).payload);
        const restored = await request(STORE_NAMES.files, 'readonly', (store) => store.get(metadata.id));
        const restoredBytes = new Uint8Array(await restored.blob.arrayBuffer());
        expect(restoredBytes.length).toBe(bytes.length);
        expect(restoredBytes.every((byte, index) => byte === bytes[index])).toBe(true);
        const restoredPayload = inspectBackup(await createBackup()).payload;
        expect(restoredPayload.data).toMatchObject({
          ...study, disciplines: expected.data.disciplines, files: expected.data.files,
        });
      }
    } finally {
      await restoreBackup(original);
    }
  }, 30_000);

  it.each(['clear', 'put'] as const)('reverte toda a restauração quando %s lança após operações enfileiradas', async (operation) => {
    const original = inspectBackup(await createBackup()).payload;
    const initial = { ...original, data: { ...original.data,
      tasks: [{ id: 'tarefa-anterior' }], projects: [{ id: 'projeto-anterior' }],
    } } as typeof original;
    const incoming = { ...initial, data: { ...initial.data,
      tasks: [{ id: 'tarefa-nova' }], projects: [{ id: 'projeto-novo' }],
    } } as typeof initial;
    await restoreBackup(initial);
    const before = inspectBackup(await createBackup()).payload.data;
    const normal = IDBObjectStore.prototype[operation];
    const fault = new DOMException('Falha sintética', 'DataCloneError');
    const injected = vi.spyOn(IDBObjectStore.prototype, operation).mockImplementation(function (this: IDBObjectStore, ...args: unknown[]) {
      if (this.name === STORE_NAMES.projects) throw fault;
      return Reflect.apply(normal, this, args);
    });
    try {
      await expect(restoreBackup(incoming)).rejects.toBe(fault);
      expect(injected.mock.contexts.some((store) => (store as IDBObjectStore).name === STORE_NAMES.tasks)).toBe(true);
      expect(inspectBackup(await createBackup()).payload.data).toEqual(before);
    } finally {
      injected.mockRestore();
      await restoreBackup(original);
    }
  });

  it.each([
    ['disciplinas duplicadas', { disciplines: [{ id: 'd' }, { id: 'd' }] }, /disciplines/],
    ['arquivos duplicados', { files: [documentFile, documentFile] }, /files/],
    ['texto numérico', { files: [{ ...documentFile, extraction: { ...documentFile.extraction, text: 123 } }] }, /extração/],
    ['extração nula', { files: [{ ...documentFile, extraction: null }] }, /extração/],
    ['página inválida', { files: [{ ...documentFile, extraction: { ...documentFile.extraction, pages: [{ pageNumber: 0, text: 'x' }] } }] }, /extração/],
    ['padding interno', { files: [{ ...documentFile, contentBase64: 'Y=Q=' }] }, /Base64/],
    ['Base64 com quebra de linha', { files: [{ ...documentFile, contentBase64: 'YQ=\n' }] }, /Base64/],
  ])('rejeita %s antes de abrir uma transação de escrita', async (_label, data, message) => {
    const original = inspectBackup(await createBackup()).payload;
    for (const base of [validBackup, original]) {
      const invalid = { ...base, data: { ...base.data, ...data } };
      expect(() => inspectBackup(JSON.stringify(invalid))).toThrow(message);
      const startTransaction = vi.spyOn(IDBDatabase.prototype, 'transaction');
      try {
        await expect(restoreBackup(invalid as typeof original)).rejects.toThrow(message);
        expect(startTransaction).not.toHaveBeenCalled();
      } finally {
        startTransaction.mockRestore();
      }
    }
  });

  it('preserva metadados opcionais de OCR de imagem dos PRs de Estudos', async () => {
    const original = inspectBackup(await createBackup()).payload;
    const image = {
      ...documentFile, extraction: {
        ...documentFile.extraction, format: 'image', confidence: 82, imageQuality: 90, preprocessing: 'contrast',
      },
    };
    try {
      await restoreBackup(inspectBackup(JSON.stringify({
        ...validBackup, data: { ...validBackup.data, files: [image] },
      })).payload);
      expect(inspectBackup(await createBackup()).payload.data.files).toEqual([image]);
    } finally {
      await restoreBackup(original);
    }
  });

  it('mantém o estado anterior se a transação for abortada após a primeira escrita efetiva', async () => {
    const original = inspectBackup(await createBackup()).payload;
    const initial = inspectBackup(JSON.stringify({
      ...validBackup, data: { ...validBackup.data, tasks: [{ id: 'tarefa-anterior' }] },
    })).payload;
    const incoming = inspectBackup(JSON.stringify({
      ...validBackup, data: { ...validBackup.data, tasks: [{ id: 'tarefa-nova' }] },
    })).payload;
    await restoreBackup(initial);
    const before = inspectBackup(await createBackup()).payload.data;
    const put = IDBObjectStore.prototype.put;
    const interrupted = vi.fn();
    const injected = vi.spyOn(IDBObjectStore.prototype, 'put').mockImplementation(function (this: IDBObjectStore, ...args) {
      const write = put.apply(this, args);
      if (this.name === STORE_NAMES.tasks) {
        write.addEventListener('success', () => {
          interrupted();
          this.transaction.abort();
        });
      }
      return write;
    });
    try {
      await expect(restoreBackup(incoming)).rejects.toThrow(/cancelada/);
      expect(interrupted).toHaveBeenCalledOnce();
      expect(inspectBackup(await createBackup()).payload.data).toEqual(before);
    } finally {
      injected.mockRestore();
      await restoreBackup(original);
    }
  });

  it.each([
    { version: 1, profile: 'printed', status: 'completed', stage: 'incompleto' },
    { version: 1, profile: 'printed', status: 'cancelled', stage: 'inválido',
      raw: documentFile.extraction, corrected: 'a',
      corrections: [{ sourceFileId: 'outro', region: { start: 0, end: 1 } }] },
    { version: -1, status: 'inválido' },
    null,
  ])('recusa checkpoint estrangeiro ou inválido antes de qualquer acesso ao banco (%j)', async (processing) => {
    const invalid = { ...validBackup, data: { ...validBackup.data, files: [{ ...documentFile, processing }] } };
    expect(() => inspectBackup(JSON.stringify(invalid))).toThrow(/checkpoints/);
    const transaction = vi.spyOn(IDBDatabase.prototype, 'transaction');
    try {
      await expect(restoreBackup(invalid as ReturnType<typeof inspectBackup>['payload'])).rejects.toThrow(/checkpoints/);
      expect(transaction).not.toHaveBeenCalled();
    } finally { transaction.mockRestore(); }
  });

  it('transporta evidência e revisão em AES-GCM, descarta cache e bloqueia substituição que perderia o checkpoint', async () => {
    const original = inspectBackup(await createBackup()).payload;
    const processing = { version: 1, profile: 'printed', status: 'running', stage: 'Etapa intermediária',
      raw: documentFile.extraction, corrected: 'Trecho revisto', generated: { flashcards: ['cache'] },
      corrections: [{ original: 'Trecho', corrected: 'Trecho revisto', reason: 'Revisão sintética',
        confidence: 100, sourceFileId: documentFile.id, region: { start: 0, end: 6 } }],
    };
    const file = { ...documentFile, processing, blob: new Blob(['a'], { type: documentFile.type }) };
    await request(STORE_NAMES.files, 'readwrite', (store) => store.put(file));
    const clear = vi.spyOn(IDBObjectStore.prototype, 'clear');
    try {
      const password = 'senha-sintetica-123';
      const raw = await createBackup();
      const exported = inspectBackup(await decryptBackup(await encryptBackup(raw, password), password)).payload;
      expect(exported.data.files[0].processing).toMatchObject({
        raw: processing.raw, corrected: processing.corrected, corrections: processing.corrections, status: 'cancelled',
      });
      expect(exported.data.files[0].processing).not.toHaveProperty('generated');
      await restoreBackup(exported);
      expect(await request(STORE_NAMES.files, 'readonly', (store) => store.get(file.id))).toMatchObject({
        processing: exported.data.files[0].processing,
      });
      clear.mockClear();
      await expect(restoreBackup(original)).rejects.toThrow(/checkpoints/);
      expect(clear).not.toHaveBeenCalled();
      expect(await request(STORE_NAMES.files, 'readonly', (store) => store.get(file.id))).toMatchObject({ processing: exported.data.files[0].processing });
    } finally {
      clear.mockRestore();
      await request(STORE_NAMES.files, 'readwrite', (store) => store.delete(file.id));
      await restoreBackup(original);
    }
  });

  it('restaura checkpoint v1 numa base sem material e deixa os recursos ausentes recuperáveis', async () => {
    const original = inspectBackup(await createBackup()).payload;
    const processing = {
      version: 1, profile: 'printed', status: 'completed', stage: 'Resultados salvos',
      raw: documentFile.extraction, corrected: documentFile.extraction.text,
    };
    const incoming = inspectBackup(JSON.stringify({ ...validBackup, data: {
      ...validBackup.data, files: [{ ...documentFile, processing }],
    } })).payload;
    try {
      await restoreBackup(incoming);
      const file = await request(STORE_NAMES.files, 'readonly', (store) => store.get(documentFile.id));
      expect(file.processing).toMatchObject({ status: 'cancelled', corrected: processing.corrected });
      expect(await file.blob.text()).toBe('a');
    } finally {
      await request(STORE_NAMES.files, 'readwrite', (store) => store.delete(documentFile.id));
      await restoreBackup(original);
    }
  });

  it('recusa dados da Central de IA que não consegue importar e aceita uma coleção vazia', async () => {
    const compatible = { ...validBackup, data: { ...validBackup.data, aiTasks: [] } };
    expect(inspectBackup(JSON.stringify(compatible)).legacyStudyData).toBe(true);
    for (const aiTasks of [[{ id: 'ai-anterior' }], { id: 'ai-inválido' }]) {
      const incompatible = { ...compatible, data: { ...compatible.data, aiTasks } };
      expect(() => inspectBackup(JSON.stringify(incompatible))).toThrow(/tarefas de IA/);
      await expect(restoreBackup(incompatible as ReturnType<typeof inspectBackup>['payload'])).rejects.toThrow(/tarefas de IA/);
    }
  });

});
