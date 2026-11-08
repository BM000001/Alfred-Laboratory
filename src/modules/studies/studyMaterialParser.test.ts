import { describe, expect, it } from 'vitest';
import { parseStudyMaterial } from './studyMaterialParser';

describe('parseStudyMaterial', () => {
  it('parses JSON with flashcards and multiple-choice questions', () => {
    const json = JSON.stringify({
      flashcards: [{ front: 'O que é limite?', back: 'Valor ao qual a função se aproxima.' }],
      questions: [{ prompt: 'Quanto é 2 + 2?', options: ['3', '4'], correctOptionIndex: 1, difficulty: 'easy' }],
    });
    const result = parseStudyMaterial('\`\`\`json\n' + json + '\n\`\`\`');
    expect(result.flashcards).toHaveLength(1);
    expect(result.questions[0]).toMatchObject({ prompt: 'Quanto é 2 + 2?', correctOptionIndex: 1, difficulty: 'easy' });
  });

  it('accepts question-only or flashcard-only responses', () => {
    expect(parseStudyMaterial('{"flashcards":[{"front":"A","back":"B"}]}').questions).toEqual([]);
    expect(parseStudyMaterial('{"questions":[{"prompt":"P","options":["A","B"],"correctOptionIndex":0}]}').flashcards).toEqual([]);
  });

  it('rejects invalid JSON and invalid answer indexes', () => {
    expect(() => parseStudyMaterial('not json')).toThrow(/JSON válido/);
    expect(() => parseStudyMaterial('{"questions":[{"prompt":"P","options":["A","B"],"correctOptionIndex":4}]}')).toThrow(/correctOptionIndex/);
  });

  it('rejects empty and oversized material', () => {
    expect(() => parseStudyMaterial(' ')).toThrow(/vazio/);
    const tooMany = JSON.stringify({ flashcards: Array.from({ length: 101 }, () => ({ front: 'A', back: 'B' })) });
    expect(() => parseStudyMaterial(tooMany)).toThrow(/no máximo 100/);
  });
});
