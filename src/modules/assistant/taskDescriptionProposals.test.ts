import { describe, expect, it } from 'vitest';
import type { Task } from '../tasks/types';
import { prepareTaskDescriptionUpdate } from './taskDescriptionProposals';

const tasks: Task[] = [
  { id: 'task-1', title: 'Estudar álgebra', status: 'pending', priority: 'medium', createdAt: '2026-11-01T10:00:00.000Z' },
  { id: 'task-2', title: 'Estudar álgebra', status: 'pending', priority: 'low', createdAt: '2026-11-01T11:00:00.000Z' },
];
const options = { now: '2026-11-03T12:00:00.000Z', proposalId: 'proposal-1' };

describe('prepareTaskDescriptionUpdate', () => {
  it('prepara a atualização para um título exato', () => {
    const result = prepareTaskDescriptionUpdate('altere a descrição da tarefa Estudar álgebra para Resolver exercícios 1 a 10', tasks.slice(0, 1), options);
    expect(result).toMatchObject({ kind: 'proposal', task: { id: 'task-1' }, description: 'Resolver exercícios 1 a 10' });
    if (result.kind === 'proposal') expect(result.proposal.operations[0].input).toEqual({
      id: 'task-1', description: 'Resolver exercícios 1 a 10', expectedDescription: null,
    });
  });
  it('usa a tarefa contextual somente quando há referência', () => {
    expect(prepareTaskDescriptionUpdate('mude a descrição dessa tarefa para Ler páginas 10 a 20', tasks, { ...options, referenceTaskId: 'task-2' }))
      .toMatchObject({ kind: 'proposal', task: { id: 'task-2' }, description: 'Ler páginas 10 a 20' });
  });
  it('não escolhe entre títulos duplicados', () => {
    expect(prepareTaskDescriptionUpdate('altere a descrição da tarefa Estudar álgebra para Fazer resumo', tasks, options))
      .toMatchObject({ kind: 'ambiguous', matches: 2 });
  });
  it('não propõe a mesma descrição', () => {
    expect(prepareTaskDescriptionUpdate('altere a descrição da tarefa Estudar álgebra para Revisar', [{ ...tasks[0], description: 'Revisar' }], options))
      .toMatchObject({ kind: 'already-set' });
  });
  it('recusa descrição vazia ou excessiva', () => {
    expect(prepareTaskDescriptionUpdate('mude a descrição dessa tarefa para ', tasks, { ...options, referenceTaskId: 'task-1' }).kind)
      .toBe('invalid-description');
    expect(prepareTaskDescriptionUpdate('mude a descrição dessa tarefa para ' + 'x'.repeat(501), tasks, { ...options, referenceTaskId: 'task-1' }).kind)
      .toBe('invalid-description');
  });
  it('ignora mensagens sem intenção de alterar descrição', () => {
    expect(prepareTaskDescriptionUpdate('qual é a descrição dessa tarefa?', tasks, options).kind).toBe('not-request');
  });
});
