import { describe, expect, it } from 'vitest';
import type { Task } from '../tasks/types';
import { prepareTaskPriorityUpdate } from './taskUpdateProposals';

const tasks: Task[] = [
  { id: 'task-1', title: 'Estudar álgebra', status: 'pending', priority: 'medium', createdAt: '2026-11-01T10:00:00.000Z' },
  { id: 'task-2', title: 'Estudar álgebra', status: 'pending', priority: 'low', createdAt: '2026-11-01T11:00:00.000Z' },
];

describe('prepareTaskPriorityUpdate', () => {
  it('prepara uma proposta para a tarefa identificada pelo título exato', () => {
    const result = prepareTaskPriorityUpdate('coloque prioridade alta tarefa Estudar álgebra', tasks.slice(0, 1), {
      now: '2026-11-02T12:00:00.000Z', proposalId: 'proposal-1',
    });
    expect(result.kind).toBe('proposal');
    if (result.kind !== 'proposal') return;
    expect(result.task.priority).toBe('medium');
    expect(result.priority).toBe('high');
    expect(result.proposal.operations).toEqual([{ toolId: 'tasks.update-priority', input: { id: 'task-1', priority: 'high', expectedPriority: 'medium' } }]);
  });

  it('resolve uma referência contextual somente quando recebe o ID da tarefa', () => {
    const result = prepareTaskPriorityUpdate('coloque ela como prioridade alta', tasks, { referenceTaskId: 'task-2' });
    expect(result).toMatchObject({ kind: 'proposal', task: { id: 'task-2' }, priority: 'high' });
  });

  it('não escolhe entre títulos duplicados', () => {
    expect(prepareTaskPriorityUpdate('coloque prioridade alta tarefa Estudar álgebra', tasks)).toMatchObject({
      kind: 'ambiguous', matches: 2,
    });
  });

  it('não cria proposta quando a prioridade já está definida', () => {
    expect(prepareTaskPriorityUpdate('coloque ela como prioridade baixa', tasks, { referenceTaskId: 'task-2' }))
      .toMatchObject({ kind: 'already-set', task: { id: 'task-2' }, priority: 'low' });
  });

  it('não interpreta consulta como alteração', () => {
    expect(prepareTaskPriorityUpdate('quais tarefas têm prioridade alta?', tasks).kind).toBe('not-request');
  });
});
