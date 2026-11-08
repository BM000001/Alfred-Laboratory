import type { Project } from '../modules/projects/types';
import type { Appointment } from '../modules/agenda/types';
import type { Task } from '../modules/tasks/types';
import type { Discipline, StudyTopic } from '../modules/studies/types';
import type { StudyFlashcard } from '../modules/studies/flashcardTypes';
import type { StudyQuestion, StudyQuizAttempt } from '../modules/studies/questionTypes';
import type { StoredFile } from '../modules/files/types';
import type { FocusSession } from '../modules/productivity/types';
import type { AssistantMessage } from '../modules/assistant/contracts';
import type { AssistantMemory } from '../modules/memory/types';
import type { EgressAuditEntry, EgressSettings } from '../modules/assistant/egressAudit';
import { openAlfredDatabase, runStoreRequest, STORE_NAMES } from './database';

export interface EntityRepository<T extends { id: string }> {
  getAll(): Promise<T[]>;
  getById(id: string): Promise<T | undefined>;
  save(entity: T): Promise<void>;
  delete(id: string): Promise<void>;
  clear(): Promise<void>;
}

function createRepository<T extends { id: string }>(storeName: string): EntityRepository<T> {
  async function withDatabase<R>(operation: (database: IDBDatabase) => Promise<R>): Promise<R> {
    const database = await openAlfredDatabase();
    try {
      return await operation(database);
    } finally {
      database.close();
    }
  }

  return {
    getAll: () => withDatabase((database) =>
      runStoreRequest<T[]>(database, storeName, 'readonly', (store) => store.getAll()),
    ),
    getById: (id) => withDatabase((database) =>
      runStoreRequest<T | undefined>(database, storeName, 'readonly', (store) => store.get(id)),
    ),
    save: (entity) => withDatabase(async (database) => {
      await runStoreRequest<IDBValidKey>(database, storeName, 'readwrite', (store) => store.put(entity));
    }),
    delete: (id) => withDatabase(async (database) => {
      await runStoreRequest<undefined>(database, storeName, 'readwrite', (store) => store.delete(id));
    }),
    clear: () => withDatabase(async (database) => {
      await runStoreRequest<undefined>(database, storeName, 'readwrite', (store) => store.clear());
    }),
  };
}

export const taskRepository = createRepository<Task>(STORE_NAMES.tasks);
export const projectRepository = createRepository<Project>(STORE_NAMES.projects);
export const appointmentRepository = createRepository<Appointment>(STORE_NAMES.appointments);
export const disciplineRepository = createRepository<Discipline>(STORE_NAMES.disciplines);
export const studyTopicRepository = createRepository<StudyTopic>(STORE_NAMES.studyTopics);
export const studyFlashcardRepository = createRepository<StudyFlashcard>(STORE_NAMES.studyFlashcards);
export const studyQuestionRepository = createRepository<StudyQuestion>(STORE_NAMES.studyQuestions);
export const studyQuizAttemptRepository = createRepository<StudyQuizAttempt>(STORE_NAMES.studyQuizAttempts);

export const fileRepository = createRepository<StoredFile>(STORE_NAMES.files);
export const focusSessionRepository = createRepository<FocusSession>(STORE_NAMES.focusSessions);
export const assistantMessageRepository = createRepository<AssistantMessage>(STORE_NAMES.assistantMessages);
export const memoryRepository = createRepository<AssistantMemory>(STORE_NAMES.memories);
export const egressAuditRepository = createRepository<EgressAuditEntry>(STORE_NAMES.egressAudit);
export const egressSettingsRepository = createRepository<EgressSettings>(STORE_NAMES.egressSettings);
