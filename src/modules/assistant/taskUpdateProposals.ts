import type { ActionProposal } from './contracts';
import type { Task, TaskPriority } from '../tasks/types';

export type TaskPriorityPreparation =
  | { kind: 'not-request' }
  | { kind: 'not-found'; taskTitle: string }
  | { kind: 'ambiguous'; taskTitle: string; matches: number }
  | { kind: 'already-set'; task: Task; priority: TaskPriority }
  | { kind: 'proposal'; task: Task; priority: TaskPriority; proposal: ActionProposal };

function parsePriority(prompt: string): TaskPriority | null {
  const match = prompt.trim().replace(/[.!?]+$/, '').match(/\b(?:prioridade\s+)?(baixa|m[eé]dia|alta)\b/i);
  if (!match) return null;
  const value = match[1].toLocaleLowerCase('pt-BR');
  return value === 'baixa' ? 'low' : value === 'alta' ? 'high' : 'medium';
}

function hasUpdateIntent(prompt: string): boolean {
  return /\b(?:coloque|coloca|mude|mudar|altere|alterar|defina|definir|ajuste|ajustar|deixe|deixa|passe|passar|marque|marcar)\b/i.test(prompt);
}

function explicitTitle(prompt: string): string | null {
  const match = prompt.trim().replace(/[.!?]+$/, '').match(/^(?:por favor,?\s*)?(?:(?:coloque|coloca|mude|mudar|altere|alterar|defina|definir|ajuste|ajustar|deixe|deixa|passe|passar|marque|marcar)\s+)?(?:(?:prioridade\s+(?:baixa|m[eé]dia|alta)\s+(?:(?:da|para a)\s+)?tarefa)|(?:a\s+)?tarefa)\s+(.+)$/i);
  return match?.[1]?.trim().replace(/^["'“”]|["'“”]$/g, '').trim() ?? null;
}

export function prepareTaskPriorityUpdate(
  prompt: string,
  tasks: readonly Task[],
  options: { now?: string; proposalId?: string; referenceTaskId?: string | null } = {},
): TaskPriorityPreparation {
  const priority = parsePriority(prompt);
  if (!priority || !hasUpdateIntent(prompt)) return { kind: 'not-request' };
  const title = explicitTitle(prompt);
  const contextual = !title && /\b(?:ela|essa tarefa|esta tarefa|a tarefa anterior|a última tarefa)\b/i.test(prompt);
  if (!title && !contextual) return { kind: 'not-request' };
  const referenced = contextual && options.referenceTaskId
    ? tasks.find((task) => task.id === options.referenceTaskId)
    : undefined;
  if (contextual && !referenced) return { kind: 'not-found', taskTitle: 'a tarefa mencionada anteriormente' };
  const matches = referenced ? [referenced] : tasks.filter((task) => task.title.toLocaleLowerCase('pt-BR') === title!.toLocaleLowerCase('pt-BR'));
  const resolvedTitle = title ?? referenced?.title ?? 'a tarefa mencionada anteriormente';
  if (matches.length === 0) return { kind: 'not-found', taskTitle: resolvedTitle };
  if (matches.length > 1) return { kind: 'ambiguous', taskTitle: resolvedTitle, matches: matches.length };
  const task = matches[0];
  if (task.priority === priority) return { kind: 'already-set', task, priority };
  const label = priority === 'high' ? 'alta' : priority === 'low' ? 'baixa' : 'média';
  const proposal: ActionProposal = {
    id: options.proposalId ?? crypto.randomUUID(),
    title: 'Alterar prioridade da tarefa',
    explanation: 'Mudar a prioridade de “' + task.title + '” para ' + label + '. A alteração só será salva depois da sua confirmação.',
    affectedRecords: [task.id],
    operations: [{ toolId: 'tasks.update-priority', input: { id: task.id, priority, expectedPriority: task.priority } }],
    createdAt: options.now ?? new Date().toISOString(),
  };
  return { kind: 'proposal', task, priority, proposal };
}
