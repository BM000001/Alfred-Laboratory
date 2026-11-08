import { describe, expect, it } from 'vitest';
import type { Task } from '../tasks/types';
import { prepareTaskCompletion } from './actionProposals';

const tasks: Task[] = [
  { id: 'task-1', title: 'Estudar álgebra', status: 'pending', priority: 'medium', createdAt: '2026-11-01T10:00:00.000Z' },
  { id: 'task-2', title: 'Estudar álgebra', status: 'pending', priority: 'low', createdAt: '2026-11-01T11:00:00.000Z' },
  { id: 'task-3', title: 'Entregar relatório', status: 'completed', priority: 'high', createdAt: '2026-10-01T10:00:00.000Z' },
];

describe('prepareTaskCompletion', () => {
  it('cria proposta sem alterar a tarefa quando o nome corresponde exatamente', () => {
    const result = prepareTaskCompletion('concluir tarefa Estudar álgebra', tasks.slice(0, 1), {
      now: '2026-11-02T12:00:00.000Z', proposalId: 'proposal-1',
    });
    expect(result.kind).toBe('proposal');
    if (result.kind !== 'proposal') return;
    expect(result.task.status).toBe('pending');
    expect(result.proposal.operations).toEqual([{ toolId: 'tasks.complete', input: { id: 'task-1' } }]);
    expect(result.proposal.id).toBe('proposal-1');
  });

  it('aceita variações naturais de concluir uma tarefa', () => {
    expect(prepareTaskCompletion('por favor, conclua a tarefa Entregar relatório', tasks).kind).toBe('already-completed');
    expect(prepareTaskCompletion('termine a tarefa Entregar relatório', tasks).kind).toBe('already-completed');
    expect(prepareTaskCompletion('marque a tarefa Entregar relatório como concluída', tasks).kind).toBe('already-completed');
  });

  it('não escolhe arbitrariamente entre tarefas com título duplicado', () => {
    const result = prepareTaskCompletion('finalizar tarefa Estudar álgebra', tasks);
    expect(result).toMatchObject({ kind: 'ambiguous', matches: 2 });
  });

  it('retorna estado explícito quando não encontra título exato', () => {
    expect(prepareTaskCompletion('concluir tarefa Álgebra', tasks)).toMatchObject({ kind: 'not-found', taskTitle: 'Álgebra' });
  });

  it('não interpreta perguntas normais como comandos de escrita', () => {
    expect(prepareTaskCompletion('quais tarefas estão pendentes?', tasks).kind).toBe('not-request');
  });
});
