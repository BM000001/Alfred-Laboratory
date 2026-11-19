import type { StudyQuestionDifficulty } from './questionTypes';

export interface StudyDefinition {
  term: string;
  definition: string;
  sourceExcerpt: string;
  context?: string;
}

export function isConcreteConcept(term: string): boolean {
  return /\p{L}{3}/u.test(term) && !/[|=!?();]/u.test(term) &&
    !/^(?:existem?|há|temos?|exemplos?|respostas?|observações?|nota|atenção|dica|introdução|conclusão|resumo|resultados?|versão|estado|etapa|passo|o que|segundo|neste|aqui)\b/iu.test(term) &&
    !/\b(?:respostas? certas?|continua[m]? igual|mudou|aumentou|diminuiu|foi|ficou|não muda)\b/iu.test(term);
}

export function extractStudyDefinitions(source: string, rejected?: (reason: 'context' | 'duplicate') => void): StudyDefinition[] {
  const definitions: StudyDefinition[] = [];
  const seen = new Set<string>();
  let context: string | undefined;
  const lines = source.replace(/\[Página\s+\d+\]/gi, '').split(/\r?\n|\r/u).flatMap(raw => {
    const heading = raw.trim();
    if (/^(?:antes|depois|versão|etapa|passo|estado|cenário|exemplo)(?:\s+|:|$)/iu.test(heading)) {
      context = heading;
    } else if (/^[\p{Lu}\d ]{4,80}$/u.test(heading) && /\p{Lu}/u.test(heading)) {
      context = undefined;
    }
    return raw.split(/(?<=[.!?])\s+/u).map(line => ({
      line: line.replace(/^\s*(?:[-*•]|\d+[.)])\s*/, '').trim(), context,
    }));
  });

  for (const { line, context } of lines) {
    if (/^(?:Pergunta|Resposta|Fórmula (?:de|da|do) [^:]+):/iu.test(line)) continue;
    // Local generation is deliberately conservative: only explicit “term: definition”
    // statements and simple “term é/são ...” sentences become study resources.
    if (line.includes('|') || /^(?:antes|depois|versão|etapa|passo|estado|cenário|exemplo)\s*[:\d(]/iu.test(line)) {
      rejected?.('context'); continue;
    }
    const colon = line.match(/^([^:]{2,90}):\s*(.{20,500})$/u);
    const copula = line.match(/^(.{2,90}?)\s+(?:é|são|significa|consiste em|corresponde a)\s+(.{20,500})$/iu);
    const match = colon ?? copula;
    if (!match) continue;
    const term = match[1].trim().replace(/[.,;]+$/, '');
    const definition = match[2].trim();
    if (term.split(/\s+/).length > 10 || definition.split(/\s+/).length < 4) continue;
    if (!isConcreteConcept(term)) { rejected?.('context'); continue; }
    const key = [term, definition].map(value => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\s+/g, ' ')).join('|');
    if (seen.has(key)) { rejected?.('duplicate'); continue; }
    seen.add(key);
    definitions.push({ term, definition, sourceExcerpt: line, ...(context ? { context } : {}) });
  }
  return definitions;
}

export function generateStudyResources(source: string): {
  flashcards: Array<{ front: string; back: string; subject: string }>;
  questions: Array<{ prompt: string; options: string[]; correctOptionIndex: number; explanation: string; difficulty: StudyQuestionDifficulty; subject: string }>;
} {
  const definitions = extractStudyDefinitions(source);
  const flashcards = definitions.map(({ term, definition }) => ({
    front: `Como você explicaria o conceito de “${term}”?`,
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
        prompt: `Qual alternativa descreve corretamente “${entry.term}”?`,
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
