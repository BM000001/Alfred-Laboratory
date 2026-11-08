import type { ActionProposal } from './contracts';
import type { Task } from '../tasks/types';

export type TaskCompletionPreparation =
  | { kind: 'not-request' }
  | { kind: 'not-found'; taskTitle: string }
  | { kind: 'ambiguous'; taskTitle: string; matches: number }
  | { kind: 'already-completed'; task: Task }
  | { kind: 'proposal'; task: Task; proposal: ActionProposal };

function requestedTaskTitle(prompt: string): string | null {
  const value = prompt.trim().replace(/[.!?]+$/, '').trim();
  const patterns = [
    /^(?:por favor,?\s*)?(?:(?:pode|quero|preciso)\s+)?(?:concluir|conclua|conclui|finalizar|finalize|finaliza|completar|complete|completa|terminar|termine|termina)\s+(?:(?:a|essa|esta)\s+)?tarefa\s+(.+)$/i,
    /^(?:por favor,?\s*)?(?:(?:pode|quero|preciso)\s+)?(?:marcar|marque|marca)\s+(?:(?:a|essa|esta)\s+)?tarefa\s+(.+?)\s+como\s+(?:conclu[ií]da|feita|finalizada)$/i,
    /^(?:por favor,?\s*)?(?:marque|marca)\s+(.+?)\s+como\s+(?:conclu[ií]da|feita)$/i,
  ];
  for (const pattern of patterns) {
    const match = value.match(pattern);
    const title = match?.[1] ?? match?.[2];
    if (title) return title.trim().replace(/^["'“”]|["'“”]$/g, '').trim();
  }
  return null;
}

export function prepareTaskCompletion(
  prompt: string,
  tasks: readonly Task[],
  options: { now?: string; proposalId?: string; referenceTaskId?: string | null } = {},
): TaskCompletionPreparation {
  const title = requestedTaskTitle(prompt);
  const refersToRecentTask = /^(?:por favor,?\s*)?(?:(?:pode|quero|preciso)\s+)?(?:concluir|conclua|conclui|finalizar|finalize|finaliza|completar|complete|completa|terminar|termine|termina|marcar|marque|marca)\s+(?:ela|essa tarefa|esta tarefa|a tarefa anterior|a última tarefa)(?:\s+como\s+(?:conclu[ií]da|feita|finalizada))?$/i.test(prompt.trim().replace(/[.!?]+$/, '').trim());
  if (!title && !refersToRecentTask) return { kind: 'not-request' };

  const referencedTask = refersToRecentTask && options.referenceTaskId
    ? tasks.find((task) => task.id === options.referenceTaskId)
    : undefined;
  if (refersToRecentTask && !referencedTask) return { kind: 'not-found', taskTitle: 'a tarefa mencionada anteriormente' };
  const matches = referencedTask
    ? [referencedTask]
    : tasks.filter((task) => task.title.toLocaleLowerCase('pt-BR') === title!.toLocaleLowerCase('pt-BR'));
  const resolvedTitle = title ?? referencedTask?.title ?? 'a tarefa mencionada anteriormente';
  if (matches.length === 0) return { kind: 'not-found', taskTitle: resolvedTitle };
  if (matches.length > 1) return { kind: 'ambiguous', taskTitle: resolvedTitle, matches: matches.length };

  const task = matches[0];
  if (task.status === 'completed') return { kind: 'already-completed', task };

  const proposal: ActionProposal = {
    id: options.proposalId ?? crypto.randomUUID(),
    title: 'Concluir tarefa',
    explanation: `Marcar “${task.title}” como concluída. A tarefa só será alterada depois que você confirmar.`,
    affectedRecords: [task.id],
    operations: [{ toolId: 'tasks.complete', input: { id: task.id } }],
    createdAt: options.now ?? new Date().toISOString(),
  };
  return { kind: 'proposal', task, proposal };
}
