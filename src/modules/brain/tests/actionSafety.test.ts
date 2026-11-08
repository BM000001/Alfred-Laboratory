import { describe, expect, it, vi } from 'vitest';
import type { ActionProposal, ToolDefinition } from '../../assistant/contracts';
import { ActionApprovalError, executeApprovedProposal } from '../../assistant/actionApproval';

const proposal: ActionProposal = {
  id: 'proposal-1',
  title: 'Criar tarefa',
  explanation: 'Cria uma tarefa após confirmação.',
  affectedRecords: [],
  operations: [{ toolId: 'tasks.create', input: { title: 'Estudar' } }],
  createdAt: '2026-11-04T12:00:00.000Z',
};

function createWriteTool(approval: ToolDefinition['approval'] = 'explicit-confirmation') {
  return {
    id: 'tasks.create',
    description: 'Cria uma tarefa.',
    risk: 'write' as const,
    approval,
    execute: vi.fn(async () => ({ id: 'task-1' })),
  };
}

describe('Brain action safety boundary', () => {
  it('does not execute a proposal when its approval refers to another proposal', async () => {
    const tool = createWriteTool();
    await expect(executeApprovedProposal(
      proposal,
      { proposalId: 'different-proposal', approved: true, decidedAt: proposal.createdAt },
      [tool],
    )).rejects.toThrow(ActionApprovalError);
    expect(tool.execute).not.toHaveBeenCalled();
  });

  it('does not execute a proposal that was explicitly rejected', async () => {
    const tool = createWriteTool();
    await expect(executeApprovedProposal(
      proposal,
      { proposalId: proposal.id, approved: false, decidedAt: proposal.createdAt },
      [tool],
    )).rejects.toThrow('A proposta não foi aprovada');
    expect(tool.execute).not.toHaveBeenCalled();
  });

  it('blocks unknown tools before executing any operation', async () => {
    const tool = createWriteTool();
    const invalidProposal = {
      ...proposal,
      operations: [
        ...proposal.operations,
        { toolId: 'unknown.delete-everything', input: {} },
      ],
    };
    await expect(executeApprovedProposal(
      invalidProposal,
      { proposalId: proposal.id, approved: true, decidedAt: proposal.createdAt },
      [tool],
    )).rejects.toThrow('Ferramenta não permitida');
    expect(tool.execute).not.toHaveBeenCalled();
  });

  it('blocks write tools configured without an approval policy', async () => {
    const tool = createWriteTool('never');
    await expect(executeApprovedProposal(
      proposal,
      { proposalId: proposal.id, approved: true, decidedAt: proposal.createdAt },
      [tool],
    )).rejects.toThrow('exige uma política de aprovação válida');
    expect(tool.execute).not.toHaveBeenCalled();
  });

  it('executes a write tool only with approval for the exact proposal', async () => {
    const tool = createWriteTool();
    const result = await executeApprovedProposal(
      proposal,
      { proposalId: proposal.id, approved: true, decidedAt: proposal.createdAt },
      [tool],
    );
    expect(tool.execute).toHaveBeenCalledWith({ title: 'Estudar' });
    expect(result.executedToolIds).toEqual(['tasks.create']);
  });
});
