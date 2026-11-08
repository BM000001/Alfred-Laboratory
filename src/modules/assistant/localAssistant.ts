import type { AIProvider, AssistantRequest, AssistantResponse } from './contracts';
import type { ReadToolData } from './readTools';
import { createReadOnlyTools } from './readTools';
import type { AssistantMemory } from '../memory/types';
import { retrieveRelevantMemories } from '../memory/memoryService';

type Intent = 'tasks' | 'agenda' | 'studies' | 'memory' | 'unknown';

function latestUserMessage(request: AssistantRequest): string {
  return [...request.messages].reverse().find((message) => message.role === 'user')?.content.trim() ?? '';
}

function normalizePrompt(value: string): string {
  return value.toLocaleLowerCase('pt-BR')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function detectIntents(prompt: string): Intent[] {
  const clauses = prompt.split(/[.!?]+/).map(normalizePrompt).filter(Boolean);
  const intents = new Set<Intent>();

  for (const value of clauses) {
    const has = (patterns: RegExp[]) => patterns.some((pattern) => pattern.test(value));
    const asksAboutMemory = has([/\b(memoria|memorias|lembra|lembrancas|recorda)\w*/]) &&
      /\bsobre\b/.test(value);

    if (asksAboutMemory || has([/\b(memoria|memorias|lembra|lembrancas|recorda)\w*/]) ||
        /\bo que voce sabe sobre mim\b/.test(value)) intents.add('memory');
    if (!asksAboutMemory && has([/\b(estud|materia|disciplina|topico|aprend|revis|conteudo|progresso academico)\w*/])) intents.add('studies');
    if (has([/\b(agenda|compromisso|evento|reuniao|consulta|encontro|horario|calendario)\w*/]) ||
        /\b(quando|que dia|qual dia|o que tenho)\b/.test(value) && /\b(marcad|agendad|programad)\w*/.test(value)) intents.add('agenda');
    if (has([/\b(tarefa|pendencia|pendente|afazer|to do|prioridade|entrega|prazo)\w*/]) ||
        /\b(o que|quais|qual) (preciso|devo|tenho que) fazer\b/.test(value) ||
        /\b(minhas coisas|meus afazeres)\b/.test(value)) intents.add('tasks');
  }

  return [...intents];
}

function extractTopicQuery(prompt: string): string | undefined {
  const normalized = prompt.trim().replace(/[?.!]+$/, '').trim();
  const match = normalized.match(/(?:sobre|de|para|na disciplina|na materia|em)\s+(.+)$/i);
  const query = match?.[1]?.trim();
  return query && query.length > 1 ? query : undefined;
}

export class LocalAssistantProvider implements AIProvider {
  readonly id = 'local-rules';

  readonly tools: ReturnType<typeof createReadOnlyTools>;

  constructor(data: ReadToolData, private readonly memories: AssistantMemory[] = []) {
    this.tools = createReadOnlyTools(data);
  }

  async generate(request: AssistantRequest): Promise<AssistantResponse> {
    const rawPrompt = latestUserMessage(request);
    if (!rawPrompt) return { message: 'Diga o que deseja consultar.', usedTools: [], warnings: [] };

    const detectedIntents = detectIntents(rawPrompt);
    if (detectedIntents.length > 1) {
      const labels: Record<Exclude<Intent, 'unknown'>, string> = { tasks: 'tarefas', agenda: 'agenda', studies: 'estudos', memory: 'memórias' };
      const areas = detectedIntents.map((intent) => labels[intent as Exclude<Intent, 'unknown'>]);
      return {
        message: `Identifiquei mais de um assunto no pedido (${areas.join(' e ')}). Para evitar consultar a área errada, diga qual deles deseja priorizar.`,
        usedTools: [],
        warnings: ['Pedido ambíguo: nenhuma ferramenta foi executada.'],
      };
    }
    const intent = detectedIntents[0] ?? 'unknown';
    if (intent === 'memory') {
      const normalizedPrompt = normalizePrompt(rawPrompt);
      const broadRequest = /\b(sobre mim|tudo que voce sabe|todas as memorias|quais memorias|listar memorias|o que voce lembra|o que voce recorda|o que voce sabe)\b/.test(normalizedPrompt);
      const topicMatch = rawPrompt.match(/\bsobre\s+(?!mim\b)(.+)$/i);
      const topic = topicMatch?.[1]?.replace(/[?.!]+$/, '').trim();
      const matches = topic
        ? retrieveRelevantMemories(this.memories, topic, 3)
        : broadRequest
          ? this.memories.slice().sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, 10).map(memory => ({ memory, matchedTerms: [], score: 0 }))
          : retrieveRelevantMemories(this.memories, rawPrompt, 3);
      const message = matches.length
        ? 'Encontrei estas memórias locais relevantes:\n' + matches.map(({ memory, matchedTerms }) =>
            '• ' + memory.title + ' (' + memory.category + '): ' + memory.content +
            (matchedTerms.length ? ' — relação: ' + matchedTerms.join(', ') : ' — listada a pedido geral')
          ).join('\n')
        : this.memories.length
          ? 'Não encontrei uma memória relacionada a esse assunto. Não vou listar informações sem relação com o pedido. Se desejar, tente outro termo ou consulte todas as memórias salvas.'
          : 'Ainda não há memórias salvas. O senhor pode adicionar preferências, objetivos, rotinas ou informações de projetos no painel “Memórias do Alfred”. Não salvo informações automaticamente.';
      return {
        message,
        usedTools: ['memory.retrieve'],
        warnings: ['Memórias cadastradas manualmente e armazenadas somente neste dispositivo. A relação exibida é baseada em correspondência textual, não em compreensão semântica.'],
      };
    }
    const tools = this.tools;
    const selectedId = intent === 'agenda' ? 'agenda.upcoming'
      : intent === 'studies' ? 'studies.progress'
        : intent === 'tasks' ? 'tasks.list' : undefined;
    const selected = tools.find((tool) => tool.id === selectedId);

    if (!selected) {
      return {
        message: 'Posso ajudar com três áreas: tarefas e pendências, compromissos da agenda e progresso dos estudos. Experimente perguntar, por exemplo: “O que preciso fazer?”, “Tenho algo marcado esta semana?” ou “Como estão meus estudos?”. Ainda não utilizo um modelo de IA generativa; esta versão interpreta comandos por regras locais.',
        usedTools: [],
        warnings: ['Assistente local: a compreensão é feita por regras e não por um modelo de IA.'],
      };
    }

    const query = intent === 'studies' ? extractTopicQuery(rawPrompt) : undefined;
    const result = await selected.execute({ query });
    return {
      message: `${result.summary}\n${result.items.length ? result.items.map((item) => `• ${item}`).join('\n') : 'Não há itens para mostrar.'}`,
      usedTools: [selected.id],
      warnings: ['Consulta somente leitura. Nenhum dado foi alterado.'],
    };
  }
}
