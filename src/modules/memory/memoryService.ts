import type { EntityRepository } from '../../storage/repositories';
import type { AssistantMemory, MemoryCategory } from './types';

export interface MemoryInput {
  title: string;
  content: string;
  category: MemoryCategory;
}

export interface MemoryMatch {
  memory: AssistantMemory;
  score: number;
  matchedTerms: string[];
}

const CATEGORIES: MemoryCategory[] = ['preference', 'goal', 'project', 'routine', 'other'];
const STOP_WORDS = new Set([
  'sobre', 'para', 'como', 'qual', 'quais', 'quando', 'onde', 'voce', 'voces',
  'mim', 'meu', 'minha', 'meus', 'minhas', 'isso', 'essa', 'esse', 'aquela',
  'aquele', 'lembra', 'lembro', 'memoria', 'memorias', 'sabe', 'quero',
  'gostaria', 'pode', 'poderia', 'informacao', 'informacoes',
]);

function normalize(value: string): string {
  return value.toLocaleLowerCase('pt-BR').normalize('NFD').split('')
    .filter(character => {
      const code = character.codePointAt(0) ?? 0;
      return code < 0x300 || code > 0x36f;
    })
    .join('').replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
}

/** Reduz apenas plurais regulares comuns; não tenta fazer stemming semântico. */
function canonicalizeTerm(term: string): string {
  if (term.length > 4 && term.endsWith('oes')) return term.slice(0, -3) + 'ao';
  if (term.length > 4 && term.endsWith('aes')) return term.slice(0, -3) + 'ao';
  if (term.length > 4 && term.endsWith('s')) return term.slice(0, -1);
  return term;
}

function termsOf(value: string): string[] {
  return [...new Set(
    normalize(value).split(' ')
      .filter(term => term.length > 2 && !STOP_WORDS.has(term)),
  )];
}

function validate(input: MemoryInput): MemoryInput {
  const title = input.title.trim();
  const content = input.content.trim();
  if (!title) throw new Error('Informe um título para a memória.');
  if (title.length > 80) throw new Error('O título deve ter no máximo 80 caracteres.');
  if (!content) throw new Error('Informe o conteúdo que deseja lembrar.');
  if (content.length > 500) throw new Error('O conteúdo deve ter no máximo 500 caracteres.');
  if (!CATEGORIES.includes(input.category)) throw new Error('Categoria de memória inválida.');
  return { title, content, category: input.category };
}

export async function createMemory(
  repository: EntityRepository<AssistantMemory>,
  input: MemoryInput,
  options: { createId?: () => string; now?: () => Date } = {},
): Promise<AssistantMemory> {
  const normalized = validate(input);
  const now = (options.now ?? (() => new Date()))().toISOString();
  const memory: AssistantMemory = {
    id: (options.createId ?? (() => crypto.randomUUID()))(),
    ...normalized,
    createdAt: now,
    updatedAt: now,
  };
  await repository.save(memory);
  return memory;
}

export async function updateMemory(
  repository: EntityRepository<AssistantMemory>,
  id: string,
  input: MemoryInput,
  now: () => Date = () => new Date(),
): Promise<AssistantMemory> {
  const current = await repository.getById(id);
  if (!current) throw new Error('Memória não encontrada.');
  const updated = { ...current, ...validate(input), updatedAt: now().toISOString() };
  await repository.save(updated);
  return updated;
}

export async function deleteMemory(repository: EntityRepository<AssistantMemory>, id: string): Promise<void> {
  if (!await repository.getById(id)) throw new Error('Memória não encontrada.');
  await repository.delete(id);
}

export async function listMemories(repository: EntityRepository<AssistantMemory>): Promise<AssistantMemory[]> {
  return (await repository.getAll()).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

/** Retorna correspondências explicáveis; não inclui memórias sem termos relevantes em comum. */
export function retrieveRelevantMemories(memories: AssistantMemory[], query: string, limit = 3): MemoryMatch[] {
  const terms = termsOf(query);
  if (!terms.length || !Number.isInteger(limit) || limit < 1) return [];

  return memories.map(memory => {
    const titleTerms = new Set(termsOf(memory.title).map(canonicalizeTerm));
    const contentTerms = new Set(termsOf(memory.content).map(canonicalizeTerm));
    const categoryTerms = new Set(termsOf(memory.category).map(canonicalizeTerm));
    const title = terms.filter(term => titleTerms.has(canonicalizeTerm(term)));
    const content = terms.filter(term => contentTerms.has(canonicalizeTerm(term)));
    const category = terms.filter(term => categoryTerms.has(canonicalizeTerm(term)));
    const matchedTerms = [...new Set([...title, ...content, ...category])];
    const score = title.length * 3 + content.length + category.length;
    return { memory, score, matchedTerms };
  }).filter(match => match.score > 0)
    .sort((a, b) => b.score - a.score || b.memory.updatedAt.localeCompare(a.memory.updatedAt))
    .slice(0, limit);
}

export function searchMemories(memories: AssistantMemory[], query: string): AssistantMemory[] {
  return retrieveRelevantMemories(memories, query, memories.length).map(match => match.memory);
}
