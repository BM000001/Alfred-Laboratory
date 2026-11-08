import type { ActionProposal, ApprovalDecision, ToolDefinition } from './contracts';

export class ActionApprovalError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ActionApprovalError';
  }
}

export interface ActionExecutionResult {
  proposalId: string;
  outputs: unknown[];
  executedToolIds: string[];
}

/**
 * Execute a proposal only after an explicit approval for that exact proposal.
 * Tool existence and approval policy are checked for every operation before
 * any operation runs, so a malformed proposal cannot partially run just
 * because a later tool is missing or configured with an unsafe policy.
 */
export async function executeApprovedProposal(
  proposal: ActionProposal,
  decision: ApprovalDecision,
  tools: readonly ToolDefinition<unknown, unknown>[],
): Promise<ActionExecutionResult> {
  if (decision.proposalId !== proposal.id) {
    throw new ActionApprovalError('A decisão não corresponde à proposta.');
  }
  if (!decision.approved) {
    throw new ActionApprovalError('A proposta não foi aprovada.');
  }
  if (proposal.operations.length === 0) {
    throw new ActionApprovalError('A proposta não contém operações.');
  }

  const toolMap = new Map(tools.map((tool) => [tool.id, tool]));
  const planned = proposal.operations.map((operation) => {
    const tool = toolMap.get(operation.toolId);
    if (!tool) {
      throw new ActionApprovalError(`Ferramenta não permitida: ${operation.toolId}.`);
    }
    if (tool.risk !== 'read' && tool.approval === 'never') {
      throw new ActionApprovalError(`A ferramenta ${tool.id} exige uma política de aprovação válida.`);
    }
    return { tool, input: operation.input };
  });

  const outputs: unknown[] = [];
  const executedToolIds: string[] = [];
  for (const operation of planned) {
    outputs.push(await operation.tool.execute(operation.input));
    executedToolIds.push(operation.tool.id);
  }

  return { proposalId: proposal.id, outputs, executedToolIds };
}
