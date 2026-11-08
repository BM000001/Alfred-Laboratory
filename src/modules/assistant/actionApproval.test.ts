import { describe, expect, it, vi } from 'vitest';
import type { ActionProposal, ToolDefinition } from './contracts';
import { ActionApprovalError, executeApprovedProposal } from './actionApproval';

const proposal: ActionProposal = {
  id: 'proposal-1',
  title: 'Concluir tarefa',
  explanation: 'Solicitação explícita do usuário.',
  affectedRecords: ['task-1'],
  operations: [{ toolId: 'tasks.complete', input: { id: 'task-1' } }],
  createdAt: '2026-11-02T12:00:00.000Z',
};

function writeTool(execute = vi.fn(async () => 'done')): ToolDefinition<unknown, unknown> {
  return {
    id: 'tasks.complete',
    description: 'Conclui uma tarefa.',
    risk: 'write',
    approval: 'explicit-confirmation',
    execute,
  };
}

describe('executeApprovedProposal', () => {
  it('não executa operação sem aprovação explícita', async () => {
    const execute = vi.fn(async () => 'done');
    await expect(executeApprovedProposal(proposal, {
      proposalId: proposal.id, approved: false, decidedAt: '2026-11-02T12:01:00.000Z',
    }, [writeTool(execute)])).rejects.toBeInstanceOf(ActionApprovalError);
    expect(execute).not.toHaveBeenCalled();
  });

  it('rejeita decisão referente a outra proposta', async () => {
    const execute = vi.fn(async () => 'done');
    await expect(executeApprovedProposal(proposal, {
      proposalId: 'another-proposal', approved: true, decidedAt: '2026-11-02T12:01:00.000Z',
    }, [writeTool(execute)])).rejects.toThrow('não corresponde');
    expect(execute).not.toHaveBeenCalled();
  });

  it('valida todas as ferramentas antes de executar a primeira operação', async () => {
    const execute = vi.fn(async () => 'done');
    const multiStep = { ...proposal, operations: [
      ...proposal.operations,
      { toolId: 'unregistered.tool', input: {} },
    ] };
    await expect(executeApprovedProposal(multiStep, {
      proposalId: proposal.id, approved: true, decidedAt: '2026-11-02T12:01:00.000Z',
    }, [writeTool(execute)])).rejects.toThrow('não permitida');
    expect(execute).not.toHaveBeenCalled();
  });

  it('executa a ferramenta registrada após aprovar a mesma proposta', async () => {
    const execute = vi.fn(async () => 'done');
    const result = await executeApprovedProposal(proposal, {
      proposalId: proposal.id, approved: true, decidedAt: '2026-11-02T12:01:00.000Z',
    }, [writeTool(execute)]);
    expect(execute).toHaveBeenCalledWith({ id: 'task-1' });
    expect(result).toEqual({ proposalId: proposal.id, outputs: ['done'], executedToolIds: ['tasks.complete'] });
  });

  it('recusa ferramentas de escrita configuradas para nunca pedir aprovação', async () => {
    const unsafeTool = { ...writeTool(), approval: 'never' as const };
    await expect(executeApprovedProposal(proposal, {
      proposalId: proposal.id, approved: true, decidedAt: '2026-11-02T12:01:00.000Z',
    }, [unsafeTool])).rejects.toThrow('política de aprovação');
  });
});
