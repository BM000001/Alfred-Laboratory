import type { ActionProposal } from './contracts';
import type { Task } from '../tasks/types';

export type TaskDescriptionPreparation =
  | { kind: 'not-request' }
  | { kind: 'not-found'; taskTitle: string }
  | { kind: 'ambiguous'; taskTitle: string; matches: number }
  | { kind: 'already-set'; task: Task }
  | { kind: 'invalid-description' }
  | { kind: 'proposal'; task: Task; description: string; proposal: ActionProposal };

function normalize(value: string): string {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR');
}

function parseDescription(prompt: string): { title: string | null; description: string } | null {
  const clean = prompt.trim().replace(/[.!?]+$/, '');
  const patterns = [
    /^(?:por favor,?\s*)?(?:altere|alterar|mude|mudar|atualize|atualizar|defina|definir|adicione|adicionar)\s+(?:a\s+)?descri[cç][aã]o\s+(?:da\s+tarefa\s+)?(.+?)\s+para\s+(.+)$/i,
    /^(?:por favor,?\s*)?(?:altere|alterar|mude|mudar|atualize|atualizar|defina|definir|adicione|adicionar)\s+(?:a\s+)?descri[cç][aã]o\s+(?:dessa|desta)\s+tarefa\s+para\s+(.+)$/i,
  ];
  const contextual = clean.match(patterns[1]);
  if (contextual) return { title: null, description: contextual[1].trim().replace(/^["'“”]|["'“”]$/g, '').trim() };
  const explicit = clean.match(patterns[0]);
  if (explicit) return { title: explicit[1].trim().replace(/^["'“”]|["'“”]$/g, '').trim(), description: explicit[2].trim().replace(/^["'“”]|["'“”]$/g, '').trim() };
  const normalized = normalize(clean);
  if (/^(?:altere|alterar|mude|mudar|atualize|atualizar|defina|definir|adicione|adicionar)\s+(?:a\s+)?descricao\b/.test(normalized)) {
    return { title: null, description: '' };
  }
  return null;
}

export function prepareTaskDescriptionUpdate(
  prompt: string,
  tasks: readonly Task[],
  options: { now?: string; proposalId?: string; referenceTaskId?: string | null } = {},
): TaskDescriptionPreparation {
  const parsed = parseDescription(prompt);
  if (!parsed) return { kind: 'not-request' };
  const description = parsed.description;
  if (!description || description.length > 500) return { kind: 'invalid-description' };
  const contextual = parsed.title === null;
  const referenced = contextual && options.referenceTaskId ? tasks.find((task) => task.id === options.referenceTaskId) : undefined;
  if (contextual && !referenced) return { kind: 'not-found', taskTitle: 'a tarefa mencionada anteriormente' };
  const matches = referenced ? [referenced] : tasks.filter((task) => task.title.toLocaleLowerCase('pt-BR') === parsed.title!.toLocaleLowerCase('pt-BR'));
  const taskTitle = parsed.title ?? referenced?.title ?? 'a tarefa mencionada anteriormente';
  if (!matches.length) return { kind: 'not-found', taskTitle };
  if (matches.length > 1) return { kind: 'ambiguous', taskTitle, matches: matches.length };
  const task = matches[0];
  if ((task.description ?? '') === description) return { kind: 'already-set', task };
  const proposal: ActionProposal = {
    id: options.proposalId ?? crypto.randomUUID(),
    title: 'Atualizar descrição da tarefa',
    explanation: 'Substituir a descrição de “' + task.title + '” pelo texto informado. A alteração só será salva depois da sua confirmação.',
    affectedRecords: [task.id],
    operations: [{ toolId: 'tasks.update-description', input: { id: task.id, description, expectedDescription: task.description ?? null } }],
    createdAt: options.now ?? new Date().toISOString(),
  };
  return { kind: 'proposal', task, description, proposal };
}
