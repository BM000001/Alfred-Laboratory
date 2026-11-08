import 'fake-indexeddb/auto';
import { afterEach, describe, expect, it } from 'vitest';
import type { Project } from '../modules/projects/types';
import type { Appointment } from '../modules/agenda/types';
import type { Task } from '../modules/tasks/types';
import { ALFRED_DATABASE_NAME } from './database';
import { appointmentRepository, egressAuditRepository, egressSettingsRepository, projectRepository, studyQuestionRepository, studyQuizAttemptRepository, taskRepository } from './repositories';
import type { StudyQuestion, StudyQuizAttempt } from '../modules/studies/questionTypes';

const task: Task = {
  id: 'task-1',
  title: 'Estudar IndexedDB',
  status: 'pending',
  priority: 'high',
  createdAt: '2026-11-02T10:00:00.000Z',
};

const appointment: Appointment = {
  id: 'appointment-1',
  title: 'Aula de programação',
  type: 'class',
  status: 'scheduled',
  startsAt: '2026-11-03T08:00:00.000-03:00',
  endsAt: '2026-11-03T09:30:00.000-03:00',
  createdAt: '2026-11-02T10:00:00.000Z',
};

const project: Project = {
  id: 'project-1',
  name: 'Alfred',
  status: 'active',
  createdAt: '2026-11-02T10:00:00.000Z',
};

afterEach(() => {
  indexedDB.deleteDatabase(ALFRED_DATABASE_NAME);
});

describe('taskRepository', () => {
  it('saves and retrieves tasks', async () => {
    await taskRepository.save(task);
    expect(await taskRepository.getById(task.id)).toEqual(task);
    expect(await taskRepository.getAll()).toEqual([task]);
  });

  it('updates an existing task using its id', async () => {
    await taskRepository.save(task);
    const updated = { ...task, status: 'completed' as const };
    await taskRepository.save(updated);
    expect(await taskRepository.getById(task.id)).toEqual(updated);
  });

  it('deletes a task', async () => {
    await taskRepository.save(task);
    await taskRepository.delete(task.id);
    expect(await taskRepository.getById(task.id)).toBeUndefined();
    expect(await taskRepository.getAll()).toEqual([]);
  });
});

describe('projectRepository', () => {
  it('saves and retrieves projects', async () => {
    await projectRepository.save(project);
    expect(await projectRepository.getById(project.id)).toEqual(project);
    expect(await projectRepository.getAll()).toEqual([project]);
  });

  it('updates and deletes projects', async () => {
    await projectRepository.save(project);
    const updated = { ...project, status: 'archived' as const };
    await projectRepository.save(updated);
    expect(await projectRepository.getById(project.id)).toEqual(updated);

    await projectRepository.delete(project.id);
    expect(await projectRepository.getById(project.id)).toBeUndefined();
  });
});


describe('appointmentRepository', () => {
  it('saves, retrieves, updates and deletes appointments', async () => {
    await appointmentRepository.save(appointment);
    expect(await appointmentRepository.getById(appointment.id)).toEqual(appointment);
    expect(await appointmentRepository.getAll()).toEqual([appointment]);

    const updated = { ...appointment, status: 'cancelled' as const };
    await appointmentRepository.save(updated);
    expect(await appointmentRepository.getById(appointment.id)).toEqual(updated);

    await appointmentRepository.delete(appointment.id);
    expect(await appointmentRepository.getById(appointment.id)).toBeUndefined();
  });
});


describe('repositórios de privacidade de exportação', () => {
  it('persiste somente metadados de auditoria e permite apagar o histórico', async () => {
    const entry = {
      id: 'egress-audit-1',
      copiedAt: '2026-11-03T10:00:00.000Z',
      classes: ['academic'] as const,
      itemCount: 1,
      characterCount: 42,
      action: 'copied_to_clipboard' as const,
    };
    await egressAuditRepository.save(entry);
    expect(await egressAuditRepository.getById(entry.id)).toEqual(entry);
    await egressAuditRepository.clear();
    expect(await egressAuditRepository.getAll()).toEqual([]);
  });

  it('persiste a preferência global de bloqueio', async () => {
    const disabled = { id: 'global' as const, enabled: false };
    await egressSettingsRepository.save(disabled);
    expect(await egressSettingsRepository.getById('global')).toEqual(disabled);
  });
});


describe('repositórios do banco de questões', () => {
  it('persiste questões e tentativas de simulado no IndexedDB', async () => {
    const question: StudyQuestion = {
      id: 'question-1',
      disciplineId: 'math',
      prompt: 'Quanto é 2 + 2?',
      options: ['3', '4', '5', '6'],
      correctOptionIndex: 1,
      difficulty: 'easy',
      createdAt: '2026-11-04T12:00:00.000Z',
    };
    const attempt: StudyQuizAttempt = {
      id: 'attempt-1',
      disciplineId: 'math',
      startedAt: '2026-11-04T12:00:00.000Z',
      completedAt: '2026-11-04T12:05:00.000Z',
      totalQuestions: 1,
      correctAnswers: 1,
      answers: [{ questionId: question.id, selectedOptionIndex: 1, isCorrect: true }],
    };
    await studyQuestionRepository.save(question);
    await studyQuizAttemptRepository.save(attempt);
    expect(await studyQuestionRepository.getById(question.id)).toEqual(question);
    expect(await studyQuizAttemptRepository.getById(attempt.id)).toEqual(attempt);
  });
});
