import { describe, expect, it } from 'vitest';
import type { Task } from '../tasks/types';
import { prepareTaskDueDateUpdate } from './taskDueDateProposals';

const tasks: Task[] = [
  { id: 'task-1', title: 'Estudar álgebra', status: 'pending', priority: 'medium', createdAt: '2026-11-01T10:00:00.000Z' },
  { id: 'task-2', title: 'Estudar álgebra', status: 'pending', priority: 'low', createdAt: '2026-11-01T11:00:00.000Z' },
];
const options = { now: '2026-11-03T12:00:00.000Z', proposalId: 'proposal-1' };

describe('prepareTaskDueDateUpdate', () => {
  it('interpreta amanhã pela data local fornecida', () => {
    const result = prepareTaskDueDateUpdate('coloque essa tarefa para amanhã', tasks, { ...options, referenceTaskId: 'task-1' });
    expect(result).toMatchObject({ kind: 'proposal', dueDate: '2026-11-04' });
  });
  it('interpreta dias relativos', () => {
    expect(prepareTaskDueDateUpdate('coloque essa tarefa para daqui a 3 dias', tasks, { ...options, referenceTaskId: 'task-1' }))
      .toMatchObject({ kind: 'proposal', dueDate: '2026-11-06' });
  });
  it('interpreta o próximo dia da semana', () => {
    expect(prepareTaskDueDateUpdate('coloque essa tarefa para sexta-feira', tasks, { ...options, referenceTaskId: 'task-1' }))
      .toMatchObject({ kind: 'proposal', dueDate: '2026-11-06' });
  });
  it('aceita data explícita e título exato', () => {
    expect(prepareTaskDueDateUpdate('defina prazo da tarefa Estudar álgebra para 10/11/2026', tasks.slice(0, 1), options))
      .toMatchObject({ kind: 'proposal', dueDate: '2026-11-10', task: { id: 'task-1' } });
  });
  it('não escolhe entre títulos duplicados', () => {
    expect(prepareTaskDueDateUpdate('defina prazo da tarefa Estudar álgebra para amanhã', tasks, options))
      .toMatchObject({ kind: 'ambiguous', matches: 2 });
  });
  it('não propõe a mesma data duas vezes', () => {
    const withDate = [{ ...tasks[0], dueDate: '2026-11-04' }];
    expect(prepareTaskDueDateUpdate('coloque essa tarefa para amanhã', withDate, { ...options, referenceTaskId: 'task-1' }))
      .toMatchObject({ kind: 'already-set' });
  });
  it('recusa data inválida', () => {
    expect(prepareTaskDueDateUpdate('defina prazo da tarefa Estudar álgebra para 31/02/2026', tasks.slice(0, 1), options).kind)
      .toBe('invalid-date');
  });
});
