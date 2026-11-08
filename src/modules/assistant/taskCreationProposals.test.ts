import { describe, expect, it } from 'vitest';
import type { Task } from '../tasks/types';
import { prepareTaskCreation } from './taskCreationProposals';

const tasks: Task[] = [
  { id: 'existing', title: 'Estudar álgebra', status: 'pending', priority: 'medium', createdAt: '2026-11-01T10:00:00.000Z' },
];

describe('prepareTaskCreation', () => {
  it('prepara uma proposta sem gravar uma tarefa', () => {
    const result = prepareTaskCreation('criar tarefa Revisar capítulo', tasks, {
      now: '2026-11-02T12:00:00.000Z', proposalId: 'proposal-1', taskId: 'new-task',
    });
    expect(result.kind).toBe('proposal');
    if (result.kind !== 'proposal') return;
    expect(result.taskTitle).toBe('Revisar capítulo');
    expect(result.priority).toBe('medium');
    expect(result.proposal.operations).toEqual([{ toolId: 'tasks.create', input: { id: 'new-task', title: 'Revisar capítulo', priority: 'medium' } }]);
    expect(tasks).toHaveLength(1);
  });

  it('aceita variações naturais e opcionais de pontuação', () => {
    expect(prepareTaskCreation('adicionar tarefa: Organizar arquivos', tasks).kind).toBe('proposal');
    expect(prepareTaskCreation('por favor, crie uma tarefa: Revisar matéria', tasks).kind).toBe('proposal');
    expect(prepareTaskCreation('adiciona tarefa Organizar mesa', tasks).kind).toBe('proposal');
    expect(prepareTaskCreation('registre a tarefa: Fazer exercícios', tasks).kind).toBe('proposal');
  });

  it('não cria duplicata de título já existente', () => {
    expect(prepareTaskCreation('criar tarefa Estudar álgebra', tasks)).toMatchObject({ kind: 'already-exists', taskTitle: 'Estudar álgebra' });
  });

  it('rejeita títulos maiores que o limite do domínio', () => {
    expect(prepareTaskCreation(`criar tarefa ${'x'.repeat(121)}`, tasks)).toMatchObject({ kind: 'invalid-title' });
  });

  it('ignora mensagens que não são comandos de criação', () => {
    expect(prepareTaskCreation('quais tarefas estão pendentes?', tasks).kind).toBe('not-request');
  });
});
