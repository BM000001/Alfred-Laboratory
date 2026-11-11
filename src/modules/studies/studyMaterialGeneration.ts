import type { StudyQuestionDifficulty } from './questionTypes';

export interface StudyDefinition {
  term: string;
  definition: string;
  sourceExcerpt: string;
}

export function extractStudyDefinitions(source: string): StudyDefinition[] {
  const definitions: StudyDefinition[] = [];
  const seen = new Set<string>();
  const lines = source
    .replace(/\[Página\s+\d+\]/gi, '')
    .replace(/\r/g, '\n')
    .split(/(?<=[.!?])\s+|\n+/u)
    .map((line) => line.replace(/^\s*(?:[-*•]|\d+[.)])\s*/, '').trim())
    .filter(Boolean);

  for (const line of lines) {
    // Local generation is deliberately conservative: only explicit “term: definition”
    // statements and simple “term é/são ...” sentences become study resources.
    const colon = line.match(/^([^:]{2,90}):\s*(.{20,500})$/u);
    const copula = line.match(/^(.{2,90}?)\s+(?:é|são|significa|consiste em|corresponde a)\s+(.{20,500})$/iu);
    const match = colon ?? copula;
    if (!match) continue;
    const term = match[1].trim().replace(/[.,;]+$/, '');
    const definition = match[2].trim();
    if (term.split(/\s+/).length > 10 || definition.split(/\s+/).length < 4) continue;
    const key = `${term.toLocaleLowerCase('pt-BR')}|${definition.toLocaleLowerCase('pt-BR')}`;
    if (seen.has(key)) continue;
    seen.add(key);
    definitions.push({ term, definition, sourceExcerpt: line });
  }
  return definitions;
}

export function generateStudyResources(source: string): {
  flashcards: Array<{ front: string; back: string; subject: string }>;
  questions: Array<{ prompt: string; options: string[]; correctOptionIndex: number; explanation: string; difficulty: StudyQuestionDifficulty; subject: string }>;
} {
  const definitions = extractStudyDefinitions(source);
  const flashcards = definitions.map(({ term, definition }) => ({
    front: `O que o material define como “${term}”?`,
    back: definition,
    subject: term,
  }));
  const questions = definitions.length >= 4
    ? definitions.slice(0, 30).flatMap((entry, index) => {
      const distractors = definitions
        .filter((candidate) => candidate.term !== entry.term && candidate.definition !== entry.definition)
        .slice(index % Math.max(1, definitions.length - 1))
        .concat(definitions.filter((candidate) => candidate.term !== entry.term));
      const uniqueDefinitions = [...new Set(distractors.map((candidate) => candidate.definition))]
        .filter((definition) => definition !== entry.definition && definition.length <= 300)
        .slice(0, 3);
      if (entry.definition.length > 300 || uniqueDefinitions.length < 3) return [];
      const options = [entry.definition, ...uniqueDefinitions];
      // Deterministic per item but not always in the first position.
      const correctOptionIndex = (index * 3 + 1) % options.length;
      [options[0], options[correctOptionIndex]] = [options[correctOptionIndex], options[0]];
      return [{
        prompt: `Qual alternativa corresponde à definição de “${entry.term}” apresentada no material?`,
        options,
        correctOptionIndex,
        explanation: `Trecho de origem: ${entry.sourceExcerpt}`,
        difficulty: 'medium' as const,
        subject: entry.term,
      }];
    })
    : [];
  return { flashcards, questions };
}
