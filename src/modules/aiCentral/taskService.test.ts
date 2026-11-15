import { beforeEach, describe, expect, it, vi } from 'vitest';
import { aiTaskRepository, fileRepository, egressSettingsRepository, egressAuditRepository } from '../../storage/repositories';
import { createAITaskService } from './taskService';
import { localExecution, remoteExecution, validateRemoteResult, validateEndpoint } from './providers';
import type { AITask, AITaskInput } from './contracts';
const input: AITaskInput = { sourceFileId: 'file', disciplineId: 'biology', text: 'Mitose: divisão celular que mantém o número de cromossomos.', confidence: 95, profile: 'prose' };
const signal = () => new AbortController().signal;
async function source() { await fileRepository.save({ id: 'file', disciplineId: 'biology', name: 'a.txt', size: 1, type: 'text/plain', blob: new Blob(['a']), createdAt: new Date().toISOString() }); }
beforeEach(async () => { vi.restoreAllMocks(); await Promise.all([aiTaskRepository.clear(), fileRepository.clear(), egressSettingsRepository.clear(), egressAuditRepository.clear()]); });
describe('Central de IAs', () => {
  it('executes the two study operations locally without network access', async () => {
    const network = vi.spyOn(globalThis, 'fetch');
    const central = createAITaskService(aiTaskRepository);
    await central.enqueue('analysis', 'studies.analyze', input);
    const analysis = await central.run('analysis', signal());
    expect(analysis.result?.analysis?.definitions).toHaveLength(1);
    await central.enqueue('generation', 'studies.generate', input);
    expect((await central.run('generation', signal())).result?.resources?.flashcards).toHaveLength(1);
    expect(network).not.toHaveBeenCalled();
  });
  it('reuses completed results across service instances', async () => {
    const execute = vi.fn(async (task: AITask) => localExecution(task));
    const central = createAITaskService(aiTaskRepository, execute);
    await central.enqueue('cache', 'studies.analyze', input); await central.run('cache', signal());
    await createAITaskService(aiTaskRepository, execute).run('cache', signal());
    expect(execute).toHaveBeenCalledTimes(1);
  });
  it('rejects reuse of an id for changed material', async () => {
    const central = createAITaskService(aiTaskRepository); await central.enqueue('id', 'studies.analyze', input);
    await expect(central.enqueue('id', 'studies.analyze', { ...input, text: 'Outro texto' })).rejects.toThrow('outro conteúdo');
  });
  it('persists cancellation and resumes safely', async () => {
    const central = createAITaskService(aiTaskRepository); await central.enqueue('cancel', 'studies.analyze', input);
    const abort = new AbortController(); abort.abort(); await expect(central.run('cancel', abort.signal)).rejects.toThrow();
    expect((await aiTaskRepository.getById('cancel'))?.status).toBe('cancelled');
    expect((await central.run('cancel', signal())).status).toBe('completed');
  });
  it('keeps failed files independent', async () => {
    const central = createAITaskService(aiTaskRepository, async task => { if (task.id === 'bad') throw new Error('Falha no modelo'); return localExecution(task); });
    await central.enqueue('good', 'studies.analyze', input); await central.enqueue('bad', 'studies.analyze', input);
    await central.run('good', signal()); await expect(central.run('bad', signal())).rejects.toThrow('Falha no modelo');
    expect((await aiTaskRepository.getById('good'))?.status).toBe('completed'); expect((await aiTaskRepository.getById('bad'))?.error?.code).toBe('EXECUTION_FAILED');
  });
  it('rejects remote execution without per-task consent', async () => {
    const network = vi.spyOn(globalThis, 'fetch'); const central = createAITaskService(aiTaskRepository);
    const task = await central.enqueue('remote', 'studies.analyze', input, 'gateway');
    await expect(remoteExecution(task, { endpoint: 'https://central.example', token: 'private-token', consent: { taskId: 'another', endpoint: 'https://central.example', includeImage: false } }, signal())).rejects.toThrow('autorize');
    expect(network).not.toHaveBeenCalled();
  });
  it('honors the existing global egress switch', async () => {
    await egressSettingsRepository.save({ id: 'global', enabled: false });
    const central = createAITaskService(aiTaskRepository); const task = await central.enqueue('remote', 'studies.analyze', input, 'gateway');
    await expect(remoteExecution(task, { endpoint: 'https://central.example', token: 'token', consent: { taskId: task.id, endpoint: 'https://central.example', includeImage: false } }, signal())).rejects.toThrow('desativado');
  });
  it('treats remote transcription as a proposal, preserving the original', async () => {
    await source(); const central = createAITaskService(aiTaskRepository); const task = await central.enqueue('remote', 'studies.analyze', input, 'gateway');
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ version: 1, id: 'remote', result: { text: input.text, uncertainties: ['Trecho manuscrito'] } })));
    const result = await remoteExecution(task, { endpoint: 'https://central.example', token: 'token', consent: { taskId: task.id, endpoint: 'https://central.example', includeImage: false } }, signal());
    expect(result.analysis?.requiresReview).toBe(true); expect((await fileRepository.getById('file'))?.extraction).toBeUndefined(); expect(await egressAuditRepository.getAll()).toHaveLength(1);
  });
  it('rejects a response for another task', async () => {
    await source(); const central = createAITaskService(aiTaskRepository); const task = await central.enqueue('remote', 'studies.analyze', input, 'gateway');
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ version: 1, id: 'wrong', result: {} })));
    await expect(remoteExecution(task, { endpoint: 'https://central.example', token: 'token', consent: { taskId: task.id, endpoint: 'https://central.example', includeImage: false } }, signal())).rejects.toThrow('não corresponde');
  });
  it('discards invented resources and ambiguous alternatives', async () => {
    const task = await createAITaskService(aiTaskRepository).enqueue('remote', 'studies.generate', input, 'gateway');
    const result = validateRemoteResult(task, { flashcards: [{ front: 'Qual a data?', back: '1900', sourceExcerpt: input.text }], questions: [{ prompt: 'X?', options: ['a','a'], correctOptionIndex: 0 }] });
    expect(result.resources?.flashcards).toEqual([]); expect(result.resources?.questions).toEqual([]); expect(result.resources?.rejected).toBe(2);
  });
  it('does not persist a gateway token', async () => {
    const task = await createAITaskService(aiTaskRepository).enqueue('remote', 'studies.analyze', input, 'gateway');
    expect(JSON.stringify(task)).not.toContain('token');
  });
  it('requires encrypted remote URLs and no embedded credentials', () => {
    expect(() => validateEndpoint('http://10.0.0.2:8787')).toThrow('HTTPS');
    expect(() => validateEndpoint('https://user:pass@server.example')).toThrow('credenciais');
    expect(validateEndpoint('http://localhost:8787/')).toBe('http://localhost:8787');
  });
});
