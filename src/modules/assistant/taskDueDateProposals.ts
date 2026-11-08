import type { ActionProposal } from './contracts';
import type { Task } from '../tasks/types';

export type TaskDueDatePreparation =
  | { kind: 'not-request' }
  | { kind: 'not-found'; taskTitle: string }
  | { kind: 'ambiguous'; taskTitle: string; matches: number }
  | { kind: 'already-set'; task: Task; dueDate: string }
  | { kind: 'proposal'; task: Task; dueDate: string; proposal: ActionProposal }
  | { kind: 'invalid-date' };

function dateString(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return year + '-' + month + '-' + day;
}

function parseDueDate(prompt: string, now: Date): string | null | undefined {
  const text = prompt.toLocaleLowerCase('pt-BR').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const base = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (/\bhoje\b/.test(text)) return dateString(base);
  if (/\bamanha\b/.test(text)) {
    base.setDate(base.getDate() + 1);
    return dateString(base);
  }
  const relative = text.match(/\bdaqui a (\d{1,2}) dias?\b/);
  if (relative) {
    const days = Number(relative[1]);
    if (days < 1 || days > 365) return null;
    base.setDate(base.getDate() + days);
    return dateString(base);
  }
  const explicit = text.match(/\b(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{4})\b/);
  if (explicit) {
    const day = Number(explicit[1]), month = Number(explicit[2]), year = Number(explicit[3]);
    const candidate = new Date(year, month - 1, day);
    if (candidate.getFullYear() !== year || candidate.getMonth() !== month - 1 || candidate.getDate() !== day) return null;
    return dateString(candidate);
  }
  const weekdayMatch = text.match(/\b(domingo|segunda(?:-feira)?|terca(?:-feira)?|quarta(?:-feira)?|quinta(?:-feira)?|sexta(?:-feira)?|sabado)\b/);
  if (weekdayMatch) {
    const dayName = weekdayMatch[1];
    const target = dayName.startsWith('segunda') ? 1 : dayName.startsWith('terca') ? 2 : dayName.startsWith('quarta') ? 3 : dayName.startsWith('quinta') ? 4 : dayName.startsWith('sexta') ? 5 : dayName.startsWith('sabado') ? 6 : 0;
    let delta = (target - base.getDay() + 7) % 7;
    if (delta === 0) delta = 7;
    base.setDate(base.getDate() + delta);
    return dateString(base);
  }
  return undefined;
}

function extractTitle(prompt: string): string | null {
  const clean = prompt.trim().replace(/[.!?]+$/, '');
  const match = clean.match(/^(?:por favor,?\s*)?(?:(?:defina|definir|coloque|coloca|mude|mudar|altere|alterar|adicione|adicionar)\s+)?(?:o\s+)?prazo\s+(?:da|de|para a)\s+tarefa\s+(.+?)\s+(?:para|até|em)\s+/i)
    ?? clean.match(/^(?:coloque|coloca|defina|definir|mude|mudar|altere|alterar)\s+(?:a\s+)?tarefa\s+(.+?)\s+(?:para|com prazo|até)\s+/i);
  return match?.[1]?.trim().replace(/^["'“”]|["'“”]$/g, '').trim() ?? null;
}

export function prepareTaskDueDateUpdate(
  prompt: string,
  tasks: readonly Task[],
  options: { now?: string; proposalId?: string; referenceTaskId?: string | null } = {},
): TaskDueDatePreparation {
  const now = new Date(options.now ?? new Date().toISOString());
  if (!Number.isFinite(now.getTime())) return { kind: 'invalid-date' };
  const dueDate = parseDueDate(prompt, now);
  if (dueDate === undefined) return { kind: 'not-request' };
  if (dueDate === null) return { kind: 'invalid-date' };
  const title = extractTitle(prompt);
  const normalizedPrompt = prompt.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const contextual = !title && (/\b(?:ela|essa tarefa|esta tarefa|a tarefa anterior|a ultima tarefa)\b/i.test(normalizedPrompt) || /^\s*(?:o\s+)?prazo\s+(?:e|sera)\s+/i.test(normalizedPrompt));
  if (!title && !contextual) return { kind: 'not-request' };
  const referenced = contextual && options.referenceTaskId ? tasks.find((task) => task.id === options.referenceTaskId) : undefined;
  if (contextual && !referenced) return { kind: 'not-found', taskTitle: 'a tarefa mencionada anteriormente' };
  const matches = referenced ? [referenced] : tasks.filter((task) => task.title.toLocaleLowerCase('pt-BR') === title!.toLocaleLowerCase('pt-BR'));
  const resolvedTitle = title ?? referenced?.title ?? 'a tarefa mencionada anteriormente';
  if (!matches.length) return { kind: 'not-found', taskTitle: resolvedTitle };
  if (matches.length > 1) return { kind: 'ambiguous', taskTitle: resolvedTitle, matches: matches.length };
  const task = matches[0];
  if (task.dueDate === dueDate) return { kind: 'already-set', task, dueDate };
  const [year, month, day] = dueDate.split('-').map(Number);
  const label = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'long', timeZone: 'UTC' }).format(new Date(Date.UTC(year, month - 1, day)));
  const proposal: ActionProposal = {
    id: options.proposalId ?? crypto.randomUUID(),
    title: 'Definir prazo da tarefa',
    explanation: 'Definir o prazo de “' + task.title + '” para ' + label + '. A data só será salva depois da sua confirmação.',
    affectedRecords: [task.id],
    operations: [{ toolId: 'tasks.update-due-date', input: { id: task.id, dueDate, expectedDueDate: task.dueDate ?? null } }],
    createdAt: options.now ?? new Date().toISOString(),
  };
  return { kind: 'proposal', task, dueDate, proposal };
}
