import { describe, expect, it } from 'vitest';
import { LocalAssistantProvider } from './localAssistant';
import type { AssistantRequest } from './contracts';
import type { Task } from '../tasks/types';

const request = (content: string): AssistantRequest => ({
  messages: [{ id: '1', role: 'user', content, createdAt: '2026-11-02T12:00:00.000Z' }],
  context: { locale: 'pt-BR', now: '2026-11-02T12:00:00.000Z', timezone: 'America/Sao_Paulo' },
});
const tasks: Task[] = [
  { id: '1', title: 'Entregar projeto', status: 'pending', priority: 'high', createdAt: '2026-11-01T12:00:00.000Z' },
  { id: '2', title: 'Tarefa concluída', status: 'completed', priority: 'low', createdAt: '2026-11-01T12:00:00.000Z' },
];

describe('LocalAssistantProvider', () => {
  it('consulta tarefas pendentes sem incluir concluídas', async () => {
    const provider = new LocalAssistantProvider({ tasks, appointments: [], topics: [], now: new Date('2026-11-02T12:00:00.000Z') });
    const result = await provider.generate(request('Quais tarefas estão pendentes?'));
    expect(result.message).toContain('Entregar projeto');
    expect(result.message).not.toContain('Tarefa concluída');
    expect(result.usedTools).toEqual(['tasks.list']);
    expect(result.warnings[0]).toContain('somente leitura');
  });

  it('consulta memórias salvas quando perguntado o que Alfred lembra', async () => {
    const provider = new LocalAssistantProvider({ tasks: [], appointments: [], topics: [] }, [
      { id: 'm1', title: 'Preferência', content: 'Prefiro respostas objetivas.', category: 'preference', createdAt: '', updatedAt: '' },
    ]);
    const result = await provider.generate(request('O que você lembra sobre mim?'));
    expect(result.message).toContain('Prefiro respostas objetivas.');
    expect(result.usedTools).toEqual(['memory.retrieve']);
  });

  it('recupera somente memórias relacionadas ao assunto solicitado', async () => {
    const provider = new LocalAssistantProvider({ tasks: [], appointments: [], topics: [] }, [
      { id: 'm1', title: 'Projeto Alfred', content: 'Assistente pessoal local.', category: 'project', createdAt: '', updatedAt: '2026-11-03' },
      { id: 'm2', title: 'Rotina de estudos', content: 'Matemática à noite.', category: 'routine', createdAt: '', updatedAt: '2026-11-02' },
    ]);
    const result = await provider.generate(request('O que você lembra sobre estudos?'));
    expect(result.message).toContain('Matemática à noite.');
    expect(result.message).not.toContain('Assistente pessoal local.');
    expect(result.message).toContain('relação: estudos');
  });

  it('não expõe todas as memórias quando não há correspondência com o assunto', async () => {
    const provider = new LocalAssistantProvider({ tasks: [], appointments: [], topics: [] }, [
      { id: 'm1', title: 'Projeto Alfred', content: 'Assistente pessoal local.', category: 'project', createdAt: '', updatedAt: '' },
    ]);
    const result = await provider.generate(request('O que você lembra sobre culinária?'));
    expect(result.message).toContain('Não encontrei uma memória relacionada');
    expect(result.message).not.toContain('Assistente pessoal local.');
  });

  it('pede esclarecimento quando o pedido mistura domínios e não consulta dados', async () => {
    const provider = new LocalAssistantProvider({ tasks, appointments: [], topics: [] });
    const result = await provider.generate(request('Confira minha agenda e minhas tarefas pendentes'));
    expect(result.message).toContain('mais de um assunto');
    expect(result.usedTools).toEqual([]);
    expect(result.warnings).toContain('Pedido ambíguo: nenhuma ferramenta foi executada.');
  });

  it('trata o assunto após “lembra sobre” como tema da memória, não como segunda intenção', async () => {
    const provider = new LocalAssistantProvider({ tasks: [], appointments: [], topics: [] }, [
      { id: 'm1', title: 'Estudos', content: 'Matemática.', category: 'routine', createdAt: '', updatedAt: '' },
    ]);
    const result = await provider.generate(request('O que você lembra sobre meus estudos?'));
    expect(result.message).toContain('Matemática.');
    expect(result.usedTools).toEqual(['memory.retrieve']);
  });

  it('continua pedindo esclarecimento quando a pergunta de memória vem acompanhada de outra ação', async () => {
    const provider = new LocalAssistantProvider({ tasks: [], appointments: [], topics: [] });
    const result = await provider.generate(request('O que você lembra sobre meus estudos? E confira minha agenda.'));
    expect(result.message).toContain('mais de um assunto');
    expect(result.usedTools).toEqual([]);
  });

  it('não executa ferramentas quando o pedido não é reconhecido', async () => {
    const provider = new LocalAssistantProvider({ tasks, appointments: [], topics: [] });
    const result = await provider.generate(request('Olá Alfred'));
    expect(result.usedTools).toEqual([]);
    expect(result.message).toContain('modelo de IA');
  });
});
