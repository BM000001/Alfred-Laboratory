import type { EntityRepository } from '../../storage/repositories';
import { aiTaskRepository } from '../../storage/repositories';
import type { AITask, AITaskInput, AIOperation, AIResult, RemoteExecution } from './contracts';
import { localExecution, remoteExecution } from './providers';
import { PROCESSING_PROFILES } from '../studies/materialReliability';

// A single local queue, no autonomous agents. Web Locks coordinates other tabs
// on supporting browsers; the durable record is authoritative after reload.
const running = new Set<string>();
export function createAITaskService(repository: EntityRepository<AITask>, execute: (task: AITask, remote: RemoteExecution | undefined, signal: AbortSignal) => Promise<AIResult> = async (task, remote, signal) => task.provider === 'local' ? localExecution(task) : remote ? remoteExecution(task, remote, signal) : Promise.reject(new Error('A execução remota exige autorização por tarefa.'))) {
  async function enqueue(id: string, operation: AIOperation, input: AITaskInput, provider: AITask['provider'] = 'local') {
    if (!id || !input.sourceFileId || !input.disciplineId || input.text.length > (provider === 'local' ? 5 * 1024 * 1024 : 200_000) || !Number.isFinite(input.confidence) || input.confidence < 0 || input.confidence > 100 || !Object.hasOwn(PROCESSING_PROFILES, input.profile) || !['studies.analyze', 'studies.generate'].includes(operation) || !['local', 'gateway'].includes(provider)) throw new Error('Solicitação inválida ou material maior que 200 mil caracteres.');
    const previous = await repository.getById(id);
    if (previous) {
      if (previous.operation !== operation || previous.provider !== provider || JSON.stringify(previous.input) !== JSON.stringify(input)) throw new Error('O identificador já pertence a outro conteúdo. Crie uma nova tarefa.');
      return previous;
    }
    const now = new Date().toISOString();
    const task: AITask = { id, version: 1, operation, input, provider, status: 'queued', attempts: 0, createdAt: now, updatedAt: now };
    await repository.save(task); return task;
  }
  async function executeTask(id: string, signal: AbortSignal, remote?: RemoteExecution): Promise<AITask> {
    if (running.has(id)) throw new Error('Esta tarefa já está em execução.');
    running.add(id);
    let task: AITask | undefined;
    try {
      task = await repository.getById(id);
      if (!task) throw new Error('Tarefa não encontrada.');
      if (task.status === 'completed') return task;
      signal.throwIfAborted();
      task = { ...task, status: 'running', attempts: task.attempts + 1, updatedAt: new Date().toISOString(), error: undefined };
      await repository.save(task);
      const result = await execute(task, remote, signal);
      if (task.provider === 'local') result.execution = { provider: 'local', promptVersion: 'studies-v1' };
      // Preserve a fully completed response even if cancel was requested while
      // committing it. Cancellation must not erase usable results.
      task = { ...task, status: 'completed', result, updatedAt: new Date().toISOString() };
      await repository.save(task); return task;
    } catch (cause) {
      if (task) await repository.save({ ...task, status: signal.aborted ? 'cancelled' : 'failed', updatedAt: new Date().toISOString(), error: { code: signal.aborted ? 'CANCELLED' : 'EXECUTION_FAILED', message: cause instanceof Error ? cause.message : 'Falha ao executar solicitação.' } });
      throw cause;
    } finally { running.delete(id); }
  }
  async function run(id: string, signal: AbortSignal, remote?: RemoteExecution) {
    if (typeof navigator !== 'undefined' && navigator.locks) return navigator.locks.request(`alfred-ai:${id}`, { mode: 'exclusive', ifAvailable: true }, lock => {
      if (!lock) throw new Error('A tarefa está em execução em outra aba.');
      return executeTask(id, signal, remote);
    });
    return executeTask(id, signal, remote);
  }
  return { enqueue, run, list: () => repository.getAll() };
}
export const aiCentral = createAITaskService(aiTaskRepository);

export async function enqueueLocalStudyTask(operation: AIOperation, input: AITaskInput) {
  const previous = (await aiCentral.list()).find(task => task.provider === 'local' && task.operation === operation && JSON.stringify(task.input) === JSON.stringify(input));
  return previous ?? aiCentral.enqueue(crypto.randomUUID(), operation, input);
}
