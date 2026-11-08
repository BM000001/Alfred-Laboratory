import { describe, expect, it } from 'vitest';
import type { EntityRepository } from '../../storage/repositories';
import type { AssistantMemory } from './types';
import {
  createMemory, deleteMemory, listMemories, retrieveRelevantMemories, searchMemories, updateMemory,
} from './memoryService';

function repo(): EntityRepository<AssistantMemory> {
  const items = new Map<string, AssistantMemory>();
  return {
    async getAll() { return [...items.values()]; },
    async getById(id) { return items.get(id); },
    async save(item) { items.set(item.id, item); },
    async delete(id) { items.delete(id); },
    async clear() { items.clear(); },
  };
}

describe('memoryService', () => {
  it('cria memória manual com campos normalizados', async () => {
    const r = repo();
    const memory = await createMemory(r, {
      title: ' Preferência ', content: ' Respostas objetivas. ', category: 'preference',
    }, { createId: () => 'm1', now: () => new Date('2026-11-03T12:00:00Z') });
    expect(memory).toMatchObject({
      id: 'm1', title: 'Preferência', content: 'Respostas objetivas.', category: 'preference',
    });
    expect(await r.getById('m1')).toEqual(memory);
  });

  it('rejeita campos vazios ou acima dos limites', async () => {
    const r = repo();
    await expect(createMemory(r, { title: ' ', content: 'x', category: 'other' })).rejects.toThrow('título');
    await expect(createMemory(r, { title: 'x', content: ' ', category: 'other' })).rejects.toThrow('conteúdo');
    await expect(createMemory(r, { title: 'x'.repeat(81), content: 'y', category: 'other' })).rejects.toThrow('80');
    await expect(createMemory(r, { title: 'x', content: 'y'.repeat(501), category: 'other' })).rejects.toThrow('500');
  });

  it('edita sem trocar id nem data de criação', async () => {
    const r = repo();
    const memory = await createMemory(r, {
      title: 'Projeto', content: 'Inicial', category: 'project',
    }, { createId: () => 'm2', now: () => new Date('2026-11-03T10:00:00Z') });
    const updated = await updateMemory(r, memory.id, {
      title: 'Projeto Alfred', content: 'Atualizado', category: 'project',
    }, () => new Date('2026-11-03T11:00:00Z'));
    expect(updated).toMatchObject({
      id: memory.id, createdAt: memory.createdAt, updatedAt: '2026-11-03T11:00:00.000Z',
      title: 'Projeto Alfred',
    });
  });

  it('não edita nem apaga memória inexistente', async () => {
    const r = repo();
    await expect(updateMemory(r, 'missing', { title: 'x', content: 'y', category: 'other' }))
      .rejects.toThrow('não encontrada');
    await expect(deleteMemory(r, 'missing')).rejects.toThrow('não encontrada');
  });

  it('ordena e pesquisa ignorando acentos', async () => {
    const r = repo();
    await createMemory(r, {
      title: 'Rotina', content: 'Estudo matemática à noite', category: 'routine',
    }, { createId: () => 'a', now: () => new Date('2026-11-03T10:00:00Z') });
    await createMemory(r, {
      title: 'Preferência', content: 'Prefiro respostas curtas', category: 'preference',
    }, { createId: () => 'b', now: () => new Date('2026-11-03T11:00:00Z') });
    const all = await listMemories(r);
    expect(all[0].id).toBe('b');
    expect(searchMemories(all, 'matematica')).toHaveLength(1);
    expect(searchMemories(all, 'inexistente')).toHaveLength(0);
  });

  it('prioriza correspondências no título e explica os termos encontrados', () => {
    const memories: AssistantMemory[] = [
      { id: '1', title: 'Projeto Alfred', content: 'Assistente pessoal', category: 'project', createdAt: '', updatedAt: '2026-11-03' },
      { id: '2', title: 'Rotina de estudos', content: 'Matemática à noite', category: 'routine', createdAt: '', updatedAt: '2026-11-02' },
    ];
    const result = retrieveRelevantMemories(memories, 'projeto Alfred');
    expect(result).toHaveLength(1);
    expect(result[0].memory.id).toBe('1');
    expect(result[0].matchedTerms).toEqual(['projeto', 'alfred']);
  });

  it('não retorna memórias sem relação com o assunto consultado', () => {
    const memories: AssistantMemory[] = [
      { id: '1', title: 'Projeto Alfred', content: 'Assistente pessoal', category: 'project', createdAt: '', updatedAt: '' },
    ];
    expect(retrieveRelevantMemories(memories, 'nutrição e receitas')).toHaveLength(0);
  });

  it('limita a quantidade de memórias recuperadas', () => {
    const memories: AssistantMemory[] = Array.from({ length: 5 }, (_, index) => ({
      id: String(index), title: 'Projeto Alfred ' + index, content: 'Assistente pessoal',
      category: 'project', createdAt: '', updatedAt: '',
    }));
    expect(retrieveRelevantMemories(memories, 'projeto Alfred', 2)).toHaveLength(2);
  });

  it('encontra variações comuns de singular e plural em português', () => {
    const memories: AssistantMemory[] = [
      { id: '1', title: 'Rotina de estudos', content: 'Revisar matérias e disciplinas', category: 'routine', createdAt: '', updatedAt: '' },
      { id: '2', title: 'Projeto pessoal', content: 'Planejar uma ação', category: 'project', createdAt: '', updatedAt: '' },
    ];
    expect(retrieveRelevantMemories(memories, 'estudo matéria disciplina')).toHaveLength(1);
    expect(retrieveRelevantMemories(memories, 'estudos matérias disciplinas')).toHaveLength(1);
    expect(retrieveRelevantMemories(memories, 'ações')).toHaveLength(1);
  });

  it('não remove o s de palavras curtas como mais', () => {
    const memories: AssistantMemory[] = [
      { id: '1', title: 'Mais foco', content: 'Organização pessoal', category: 'routine', createdAt: '', updatedAt: '' },
    ];
    expect(retrieveRelevantMemories(memories, 'mais')).toHaveLength(1);
  });
});
