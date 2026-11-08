export type AssistantRole = 'user' | 'assistant' | 'system';

export interface AssistantMessage {
  id: string;
  role: AssistantRole;
  content: string;
  createdAt: string;
}

export interface AssistantContext {
  locale: 'pt-BR';
  now: string;
  timezone: string;
}

export interface AssistantRequest {
  messages: AssistantMessage[];
  context: AssistantContext;
}

export interface AssistantResponse {
  message: string;
  usedTools: string[];
  warnings: string[];
}

export interface AIProvider {
  readonly id: string;
  readonly tools?: readonly ToolDefinition[];
  generate(request: AssistantRequest): Promise<AssistantResponse>;
}

export type ToolRisk = 'read' | 'write' | 'external' | 'destructive';
export type ApprovalMode = 'never' | 'before-execution' | 'explicit-confirmation';

export interface ToolDefinition<TInput = unknown, TOutput = unknown> {
  id: string;
  description: string;
  risk: ToolRisk;
  approval: ApprovalMode;
  execute(input: TInput): Promise<TOutput>;
}

export interface ActionProposal {
  id: string;
  title: string;
  explanation: string;
  affectedRecords: string[];
  operations: Array<{ toolId: string; input: unknown }>;
  createdAt: string;
}

export type ApprovalDecision =
  | { proposalId: string; approved: true; decidedAt: string }
  | { proposalId: string; approved: false; decidedAt: string; reason?: string };
