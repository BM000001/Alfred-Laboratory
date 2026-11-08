import type { AIProvider, AssistantMessage, AssistantResponse, AssistantContext, ToolDefinition } from '../../assistant/contracts';
import { buildAssistantRequest } from '../context/contextBuilder';
import { classifyIntent } from '../intent/intentEngine';
import type { AssistantIntent } from '../intent/intentTypes';
import { ToolRegistry } from '../tools/toolRegistry';

export interface BrainResult extends AssistantResponse {
  intent: AssistantIntent;
  providerId: string;
}

export interface BrainOptions {
  provider: AIProvider;
  tools?: ToolRegistry;
}

interface ReadToolResult {
  summary: string;
  items: string[];
}

const readToolByIntent: Partial<Record<AssistantIntent, string>> = {
  tasks: 'tasks.list',
  agenda: 'agenda.upcoming',
  studies: 'studies.progress',
};

function isReadToolResult(value: unknown): value is ReadToolResult {
  if (typeof value !== 'object' || value === null) return false;
  const result = value as Record<string, unknown>;
  return typeof result.summary === 'string' &&
    Array.isArray(result.items) &&
    result.items.every((item) => typeof item === 'string');
}

function extractStudyQuery(message: string): string | undefined {
  const normalized = message.trim().replace(/[?.!]+$/, '').trim();
  const match = normalized.match(/(?:sobre|de|para|na disciplina|na materia|em)\s+(.+)$/i);
  const query = match?.[1]?.trim();
  return query && query.length > 1 ? query : undefined;
}

export class Brain {
  readonly tools: ToolRegistry;
  private readonly provider: AIProvider;

  constructor(options: BrainOptions) {
    this.provider = options.provider;
    this.tools = options.tools ?? new ToolRegistry();
    for (const tool of options.provider.tools ?? []) {
      if (!this.tools.get(tool.id)) this.tools.register(tool as ToolDefinition<unknown, unknown>);
    }
  }

  async process(messages: readonly AssistantMessage[], context: AssistantContext): Promise<BrainResult> {
    const request = buildAssistantRequest(messages, context);
    const latestUserMessage = [...request.messages].reverse().find((message) => message.role === 'user');
    const prompt = latestUserMessage?.content ?? '';
    const classification = classifyIntent(prompt);

    if (classification.confidence === 'low' && classification.matchedTerms.length > 0) {
      return {
        message: 'Identifiquei mais de uma área no pedido. Para evitar consultar a área errada, diga qual assunto deseja priorizar.',
        usedTools: [],
        warnings: ['Pedido ambíguo: nenhuma ferramenta foi executada.'],
        intent: classification.intent,
        providerId: this.provider.id,
      };
    }

    const toolId = readToolByIntent[classification.intent];
    if (toolId) {
      const tool = this.tools.get(toolId);
      if (tool) {
        if (tool.risk !== 'read' || tool.approval !== 'never') {
          return {
            message: 'A consulta foi bloqueada porque a ferramenta registrada não está configurada como somente leitura.',
            usedTools: [],
            warnings: ['Ferramenta insegura bloqueada pelo Brain; nenhuma execução foi realizada.'],
            intent: classification.intent,
            providerId: this.provider.id,
          };
        }

        const input = classification.intent === 'studies'
          ? { query: extractStudyQuery(prompt) }
          : {};
        const result = await this.tools.executeRead(toolId, input);
        if (!isReadToolResult(result)) {
          return {
            message: 'A ferramenta retornou um formato inesperado. Não vou apresentar dados que não consegui validar.',
            usedTools: [],
            warnings: ['Formato de resposta inválido para ferramenta de consulta.'],
            intent: classification.intent,
            providerId: this.provider.id,
          };
        }
        return {
          message: result.summary + '\n' + (result.items.length ? result.items.map((item) => '• ' + item).join('\n') : 'Não há itens para mostrar.'),
          usedTools: [toolId],
          warnings: ['Consulta somente leitura. Nenhum dado foi alterado.'],
          intent: classification.intent,
          providerId: this.provider.id,
        };
      }
    }

    const response = await this.provider.generate(request);
    return { ...response, intent: classification.intent, providerId: this.provider.id };
  }
}
