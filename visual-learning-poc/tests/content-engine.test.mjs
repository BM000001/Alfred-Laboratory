import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import content from '../content/ordenacao-bolhas.v1.json' with { type: 'json' };
import { createProgressRecord, evaluateCompletion, gradeChoice, validateLearningContent } from '../src/content-engine.js';

test('sample has versioned learning goals, feedback, accessible visuals, completion and source', () => {
  assert.deepEqual(validateLearningContent(content), { ok: true, errors: [] });
});

test('choice grading returns specific contextual feedback', () => {
  const choice = content.interactions[0];
  assert.deepEqual(gradeChoice(choice, 'swap'), { correct: true, feedback: choice.feedbackCorrect });
  assert.deepEqual(gradeChoice(choice, 'keep'), { correct: false, feedback: choice.feedbackIncorrect });
});

test('completion requires both correct evidence and sorted result', () => {
  const rules = content.completion.rules;
  assert.equal(evaluateCompletion(rules, { total: 1, correct: 1, vector: [1, 2, 4] }), true);
  assert.equal(evaluateCompletion(rules, { total: 1, correct: 0, vector: [1, 2, 4] }), false);
  assert.equal(evaluateCompletion(rules, { total: 1, correct: 1, vector: [2, 1] }), false);
});

test('progress is versioned and contains only allowlisted learning evidence', () => {
  const progress = createProgressRecord(content, { completed: ['first-pair', 'first-pair'], answers: [{ interactionId: 'first-pair', selectedOptionId: 'swap', correct: true, arbitraryCode: 'alert(1)' }] });
  assert.deepEqual(progress.completed, ['first-pair']);
  assert.deepEqual(progress.answers[0], { interactionId: 'first-pair', selectedOptionId: 'swap', correct: true });
  assert.equal(progress.contentVersion, '1.0.0');
  assert.throws(() => createProgressRecord(content, { answers: [{ interactionId: 'missing', selectedOptionId: 'x', correct: true }] }), /outside the content contract/);
});

test('unknown versions, unsupported rules and missing references fail closed', () => {
  assert.equal(validateLearningContent({ ...content, version: '2.0.0' }).ok, false);
  assert.equal(validateLearningContent({ ...content, references: [] }).ok, false);
  assert.equal(validateLearningContent({ ...content, completion: { ...content.completion, rules: [{ type: 'eval-code' }] } }).ok, false);
  assert.equal(evaluateCompletion([{ type: 'execute-code' }], {}), false);
});

test('concept maps reject dangling nodes and cyclic parent relationships', () => {
  const dangling = structuredClone(content);
  dangling.conceptMap.relations[0].to = 'missing-node';
  assert.equal(validateLearningContent(dangling).ok, false);
  const cyclic = structuredClone(content);
  cyclic.conceptMap.nodes[0].parentId = 'stop';
  assert.equal(validateLearningContent(cyclic).ok, false);
});

test('the published JSON schema is valid JSON and explicitly pins the format version', async () => {
  const schema = JSON.parse(await readFile(new URL('../content/learning-content.schema.json', import.meta.url), 'utf8'));
  assert.equal(schema.properties.format.const, 'alfred.learning-content');
  assert.equal(schema.properties.version.const, '1.0.0');
});

test('interactive content renderer uses text nodes and no dynamic code execution', async () => {
  const renderer = await readFile(new URL('../src/concept-map.js', import.meta.url), 'utf8');
  const app = await readFile(new URL('../src/main.js', import.meta.url), 'utf8');
  assert.match(renderer, /\.textContent\s*=/);
  assert.doesNotMatch(renderer, /innerHTML|\beval\s*\(|new\s+Function\s*\(/);
  assert.doesNotMatch(app, /\beval\s*\(|new\s+Function\s*\(/);
});
