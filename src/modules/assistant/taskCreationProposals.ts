import type { ActionProposal } from './contracts';
import type { Task } from '../tasks/types';
import { TASK_TITLE_MAX_LENGTH, type TaskPriority } from '../tasks/types';

export type TaskCreationPreparation =
  | { kind: 'not-request' }
  | { kind: 'invalid-title'; reason: string }
  | { kind: 'already-exists'; taskTitle: string }
  | { kind: 'proposal'; taskId: string; taskTitle: string; priority: TaskPriority; proposal: ActionProposal };

function requestedTitle(prompt: string): string | null {
  const value = prompt.trim().replace(/[.!?]+$/, '').trim();
  const match = value.match(/^(?:por favor,?\s*)?(?:(?:pode|quero|preciso)\s+)?(?:criar|crie|cria|adicionar|adicione|adiciona|cadastrar|cadastre|cadastra|registrar|registre|registra)\s+(?:(?:uma|a|nova)\s+)?tarefa(?:\s*:\s*|\s+)(.+)$/i);
  if (!match?.[1]) return null;
  return match[1].trim().replace(/^["'“”]|["'“”]$/g, '').trim();
}

export function prepareTaskCreation(
  prompt: string,
  tasks: readonly Task[],
  options: { now?: string; proposalId?: string; taskId?: string } = {},
): TaskCreationPreparation {
  const title = requestedTitle(prompt);
  if (title === null) return { kind: 'not-request' };
  if (!title) return { kind: 'invalid-title', reason: 'Informe o título da nova tarefa.' };
  if (title.length > TASK_TITLE_MAX_LENGTH) {
    return { kind: 'invalid-title', reason: `O título deve ter no máximo ${TASK_TITLE_MAX_LENGTH} caracteres.` };
  }
  if (tasks.some((task) => task.title.toLocaleLowerCase('pt-BR') === title.toLocaleLowerCase('pt-BR'))) {
    return { kind: 'already-exists', taskTitle: title };
  }

  const taskId = options.taskId ?? crypto.randomUUID();
  const priority: TaskPriority = 'medium';
  const proposal: ActionProposal = {
    id: options.proposalId ?? crypto.randomUUID(),
    title: 'Criar tarefa',
    explanation: `Adicionar “${title}” à sua lista de tarefas pendentes com prioridade média. A tarefa só será criada depois que você confirmar.`,
    affectedRecords: [taskId],
    operations: [{ toolId: 'tasks.create', input: { id: taskId, title, priority } }],
    createdAt: options.now ?? new Date().toISOString(),
  };
  return { kind: 'proposal', taskId, taskTitle: title, priority, proposal };
}
