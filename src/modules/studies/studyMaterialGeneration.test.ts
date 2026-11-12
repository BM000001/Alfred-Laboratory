import { describe, expect, it } from 'vitest';
import { extractStudyDefinitions, generateStudyResources } from './studyMaterialGeneration';

describe('studyMaterialGeneration', () => {
  it('creates flashcards from explicit source definitions and avoids duplicate statements', () => {
    const text = 'Encapsulamento: mecanismo que protege os dados internos de um objeto.\nEncapsulamento: mecanismo que protege os dados internos de um objeto.';
    expect(extractStudyDefinitions(text)).toHaveLength(1);
    expect(generateStudyResources(text).flashcards[0]).toMatchObject({ subject: 'Encapsulamento', back: 'mecanismo que protege os dados internos de um objeto.' });
    expect(generateStudyResources(text).questions).toEqual([]);
  });

  it('asks which source concept matches the extracted definition and uses only source concepts as choices', () => {
    const text = [
      'Encapsulamento: mecanismo que protege os dados internos de um objeto.',
      'Herança: relação que permite reutilizar características definidas em outra classe.',
      'Polimorfismo: capacidade de responder de formas diferentes a uma mesma operação.',
      'Abstração: processo que representa somente aspectos importantes de uma entidade.',
    ].join('\n');
    const result = generateStudyResources(text);
    expect(result.flashcards).toHaveLength(4);
    expect(result.questions).toHaveLength(4);
    const sourceTerms = ['Encapsulamento', 'Herança', 'Polimorfismo', 'Abstração'];
    expect(result.questions).toHaveLength(4);
    expect(result.questions.every((question) => question.options.length === 4 && sourceTerms.includes(question.options[question.correctOptionIndex]) && question.prompt.startsWith('Qual conceito é definido no material como:') && question.explanation.startsWith('Trecho de origem:') && question.difficulty === 'easy')).toBe(true);
    expect(result.questions[0].prompt).toContain('protege os dados internos');
    expect(result.questions[0].options).not.toContain('mecanismo que protege os dados internos de um objeto.');
  });

  it('ignores generic section labels instead of turning them into study concepts', () => {
    const text = [
      'Capítulo 1: Este texto apresenta uma introdução geral ao tema principal.',
      'Exemplo: Este texto demonstra uma situação que não representa um conceito importante.',
      'Herança: relação que permite reutilizar características definidas em outra classe.',
    ].join('\n');
    expect(extractStudyDefinitions(text).map((item) => item.term)).toEqual(['Herança']);
    expect(generateStudyResources(text).questions).toEqual([]);
  });

  it('does not invent resources from ordinary prose without explicit definitions', () => {
    expect(generateStudyResources('Hoje estudamos exemplos importantes e fizemos vários exercícios.')).toEqual({ flashcards: [], questions: [] });
  });
});
