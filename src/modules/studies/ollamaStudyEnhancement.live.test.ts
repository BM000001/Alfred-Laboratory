import { expect, it } from 'vitest';
import type { StoredFile } from '../files/types';
import { generateLocalStudyQuestions, prepareLocalStudyQuestions } from './localStudyQuestions';
import { OLLAMA_STUDY_MODEL, OllamaStudyEnhancementProvider } from './ollamaStudyEnhancement';

it.runIf(import.meta.env.VITE_ALFRED_OLLAMA_LIVE === '1')('gera questões com o modelo real no loopback', async () => {
  const topic = { id: 'rotacao', disciplineId: 'ciencias', title: 'Movimentos da Terra', status: 'pending' as const, createdAt: '', sourceFileId: 'terra' };
  const text = [
    'A rotação da Terra é o movimento da Terra em torno do seu próprio eixo.',
    'Uma rotação da Terra leva aproximadamente 24 horas.',
    'A rotação da Terra explica a alternância entre o dia e a noite.',
  ].join('\n\n');
  const file: StoredFile = {
    id: 'terra', disciplineId: 'ciencias', name: 'terra.txt', type: 'text/plain', createdAt: '',
    size: text.length, blob: new Blob([text]),
    extraction: { format: 'txt', text, characterCount: text.length, wordCount: 37, extractedAt: '' },
  };
  const base = 'http://127.0.0.1:11434';
  const versionResponse = await fetch(base + '/api/version', { redirect: 'error' });
  const tagsResponse = await fetch(base + '/api/tags', { redirect: 'error' });
  expect(versionResponse.ok && tagsResponse.ok).toBe(true);
  const { version } = await versionResponse.json();
  const { models } = await tagsResponse.json();
  const model = models.find((entry: { name: string }) => entry.name === OLLAMA_STUDY_MODEL);
  expect(model?.digest).toMatch(/^[a-f0-9]{64}$/);

  const start = performance.now();
  const result = await generateLocalStudyQuestions(new OllamaStudyEnhancementProvider(), prepareLocalStudyQuestions(file, topic), []);
  const elapsedMs = Math.round(performance.now() - start);
  console.info(JSON.stringify({
    ollamaVersion: version, model: OLLAMA_STUDY_MODEL, digest: model.digest, elapsedMs,
    generated: result.generated, passedValidation: result.questions.length, questions: result.questions,
  }, null, 2));
  expect(result.generated).toBeGreaterThan(0);
  expect(result.generated).toBeLessThanOrEqual(3);
  expect(result.questions.length).toBeGreaterThan(0);
}, 250_000);
