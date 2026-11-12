import { describe, expect, it } from 'vitest';
import { extractStudyDefinitions, generateStudyResources } from './studyMaterialGeneration';

describe('studyMaterialGeneration', () => {
  it('creates flashcards from explicit source definitions and avoids duplicate statements', () => {
    const text = 'Encapsulamento: mecanismo que protege os dados internos de um objeto.\nEncapsulamento: mecanismo que protege os dados internos de um objeto.';
    expect(extractStudyDefinitions(text)).toHaveLength(1);
    expect(generateStudyResources(text).flashcards[0]).toMatchObject({ subject: 'Encapsulamento', back: 'mecanismo que protege os dados internos de um objeto.' });
    expect(generateStudyResources(text).questions).toEqual([]);
  });

  it('creates a source-grounded multiple-choice question only with four distinct definitions', () => {
    const text = [
      'Encapsulamento: mecanismo que protege os dados internos de um objeto.',
      'Herança: relação que permite reutilizar características definidas em outra classe.',
      'Polimorfismo: capacidade de responder de formas diferentes a uma mesma operação.',
      'Abstração: processo que representa somente aspectos importantes de uma entidade.',
    ].join('\n');
    const result = generateStudyResources(text);
    expect(result.flashcards).toHaveLength(4);
    expect(result.questions).toHaveLength(4);
    expect(result.questions.every((question) => question.options.length === 4 && question.options[question.correctOptionIndex] === question.explanation.replace('Trecho de origem: ', '').split(': ').slice(1).join(': '))).toBe(true);
  });

  it('does not invent resources from ordinary prose without explicit definitions', () => {
    expect(generateStudyResources('Hoje estudamos exemplos importantes e fizemos vários exercícios.')).toEqual({ flashcards: [], questions: [] });
  });
});
