import { describe, expect, it, vi } from 'vitest';
import type { AIProvider, AssistantContext, AssistantMessage, ToolDefinition } from '../../assistant/contracts';
import { Brain, classifyIntent, ToolRegistry } from '../index';

const context: AssistantContext = { locale: 'pt-BR', now: '2026-11-04T12:00:00.000Z', timezone: 'America/Sao_Paulo' };
const message: AssistantMessage = { id: 'm1', role: 'user', content: 'Quais tarefas estão pendentes?', createdAt: context.now };

describe('Brain foundation', () => {
  it('classifies supported local domains and unknown requests', () => {
    expect(classifyIntent('Como estão meus estudos?').intent).toBe('studies');
    expect(classifyIntent('Quais são meus compromissos?').intent).toBe('agenda');
    expect(classifyIntent('O que você lembra sobre mim?').intent).toBe('memory');
    expect(classifyIntent('Conte uma piada').intent).toBe('unknown');
  });

  it('matches complete words instead of substrings inside unrelated words', () => {
    expect(classifyIntent('Sou independente e estou agendando algo').intent).toBe('unknown');
    expect(classifyIntent('Tenho uma tarefa pendente').intent).toBe('tasks');
  });

  it('marks messages that mention multiple domains as ambiguous', () => {
    const result = classifyIntent('Confira minha agenda e minhas tarefas');
    expect(result.intent).toBe('agenda');
    expect(result.confidence).toBe('low');
  });

  it('recognizes normalized multi-word phrases with accents', () => {
    expect(classifyIntent('Como está meu progresso acadêmico?').intent).toBe('studies');
  });

  it('delegates generation to the configured provider and returns classification metadata', async () => {
    const provider: AIProvider = {
      id: 'test-provider',
      generate: vi.fn(async () => ({ message: 'Há duas tarefas.', usedTools: ['tasks.list'], warnings: [] })),
    };
    const brain = new Brain({ provider });
    const result = await brain.process([message], context);
    expect(result.message).toBe('Há duas tarefas.');
    expect(result.intent).toBe('tasks');
    expect(result.providerId).toBe('test-provider');
    expect(provider.generate).toHaveBeenCalledOnce();
  });

  it('registers tools exposed by its provider', () => {
    const tool = { id: 'tasks.list', description: 'Read tasks', risk: 'read' as const, approval: 'never' as const, execute: async () => [] };
    const provider: AIProvider = {
      id: 'provider-with-tools',
      tools: [tool],
      generate: vi.fn(async () => ({ message: 'ok', usedTools: [], warnings: [] })),
    };
    const brain = new Brain({ provider });
    expect(brain.tools.get('tasks.list')).toBeDefined();
  });

  it('rejects duplicate tool identifiers', () => {
    const registry = new ToolRegistry();
    const tool = { id: 'tasks.list', description: 'Read tasks', risk: 'read' as const, approval: 'never' as const, execute: async () => [] };
    registry.register(tool);
    expect(() => registry.register(tool)).toThrow('Ferramenta já registrada');
  });
  it('does not delegate ambiguous multi-domain requests to the provider', async () => {
    const provider: AIProvider = {
      id: 'test-provider',
      generate: vi.fn(async () => ({ message: 'Should not run', usedTools: ['agenda.upcoming'], warnings: [] })),
    };
    const brain = new Brain({ provider });
    const result = await brain.process([{
      ...message,
      content: 'Confira minha agenda e minhas tarefas',
    }], context);

    expect(provider.generate).not.toHaveBeenCalled();
    expect(result.usedTools).toEqual([]);
    expect(result.warnings).toContain('Pedido ambíguo: nenhuma ferramenta foi executada.');
    expect(result.message).toContain('mais de uma área');
  });

  it('treats a memory topic as one intent instead of a second domain', async () => {
    const classification = classifyIntent('O que você lembra sobre meus estudos?');
    expect(classification.intent).toBe('memory');
    expect(classification.confidence).toBe('high');
  });

  it('still marks a memory query plus a separate agenda action as ambiguous', async () => {
    const classification = classifyIntent('O que você lembra sobre meus estudos? E confira minha agenda.');
    expect(classification.confidence).toBe('low');
  });


  it('dispatches a registered read-only task tool without calling the provider', async () => {
    const execute = vi.fn(async (_input: unknown) => ({ summary: '1 tarefa pendente.', items: ['Estudar Python'] }));
    const tool: ToolDefinition<unknown, unknown> = {
      id: 'tasks.list', description: 'Lista tarefas', risk: 'read', approval: 'never', execute,
    };
    const provider: AIProvider = {
      id: 'local-provider',
      tools: [tool],
      generate: vi.fn(async () => ({ message: 'provider fallback', usedTools: [], warnings: [] })),
    };
    const brain = new Brain({ provider });
    const result = await brain.process([message], context);

    expect(execute).toHaveBeenCalledWith({});
    expect(provider.generate).not.toHaveBeenCalled();
    expect(result.usedTools).toEqual(['tasks.list']);
    expect(result.message).toContain('Estudar Python');
    expect(result.warnings).toContain('Consulta somente leitura. Nenhum dado foi alterado.');
  });

  it('passes a focused topic query to the study read tool', async () => {
    const execute = vi.fn(async (_input: unknown) => ({ summary: '1 tópico.', items: ['Álgebra'] }));
    const tool: ToolDefinition<unknown, unknown> = {
      id: 'studies.progress', description: 'Progresso', risk: 'read', approval: 'never', execute,
    };
    const provider: AIProvider = {
      id: 'local-provider', tools: [tool],
      generate: vi.fn(async () => ({ message: 'fallback', usedTools: [], warnings: [] })),
    };
    const brain = new Brain({ provider });
    await brain.process([{ ...message, content: 'Como está meu progresso nos estudos em Álgebra?' }], context);
    expect(execute).toHaveBeenCalledWith({ query: 'Álgebra' });
    expect(provider.generate).not.toHaveBeenCalled();
  });

  it('blocks a mapped tool that is not explicitly read-only', async () => {
    const execute = vi.fn(async () => ({ summary: 'unsafe', items: [] }));
    const tool: ToolDefinition<unknown, unknown> = {
      id: 'tasks.list', description: 'Misconfigured tool', risk: 'write', approval: 'explicit-confirmation', execute,
    };
    const provider: AIProvider = {
      id: 'local-provider', tools: [tool],
      generate: vi.fn(async () => ({ message: 'must not run', usedTools: [], warnings: [] })),
    };
    const brain = new Brain({ provider });
    const result = await brain.process([message], context);

    expect(execute).not.toHaveBeenCalled();
    expect(provider.generate).not.toHaveBeenCalled();
    expect(result.usedTools).toEqual([]);
    expect(result.warnings[0]).toContain('bloqueada');
  });

  it('does not execute read tools for an ambiguous multi-domain request', async () => {
    const execute = vi.fn(async () => ({ summary: 'unsafe', items: [] }));
    const tool: ToolDefinition<unknown, unknown> = {
      id: 'tasks.list', description: 'Lista tarefas', risk: 'read', approval: 'never', execute,
    };
    const provider: AIProvider = {
      id: 'local-provider', tools: [tool],
      generate: vi.fn(async () => ({ message: 'fallback', usedTools: [], warnings: [] })),
    };
    const brain = new Brain({ provider });
    const result = await brain.process([{ ...message, content: 'Confira minha agenda e minhas tarefas' }], context);
    expect(execute).not.toHaveBeenCalled();
    expect(provider.generate).not.toHaveBeenCalled();
    expect(result.usedTools).toEqual([]);
  });

  it('keeps memory requests on the provider path', async () => {
    const provider: AIProvider = {
      id: 'local-provider',
      generate: vi.fn(async () => ({ message: 'Memória local consultada.', usedTools: ['memory.retrieve'], warnings: [] })),
    };
    const brain = new Brain({ provider });
    const result = await brain.process([{ ...message, content: 'O que você lembra sobre meus estudos?' }], context);
    expect(provider.generate).toHaveBeenCalledOnce();
    expect(result.message).toBe('Memória local consultada.');
  });

  it('rejects direct read execution for a write tool', async () => {
    const tool: ToolDefinition<unknown, unknown> = {
      id: 'tasks.list', description: 'Misconfigured tool', risk: 'write', approval: 'explicit-confirmation',
      execute: vi.fn(async () => 'should not execute'),
    };
    const provider: AIProvider = {
      id: 'local-provider', tools: [tool],
      generate: vi.fn(async () => ({ message: 'fallback', usedTools: [], warnings: [] })),
    };
    const brain = new Brain({ provider });
    await expect(brain.tools.executeRead('tasks.list', {})).rejects.toThrow('não está autorizada');
    expect(tool.execute).not.toHaveBeenCalled();
  });

});
