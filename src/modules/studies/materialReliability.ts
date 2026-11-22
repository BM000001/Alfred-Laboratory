import { extractStudyDefinitions, generateStudyResources, isConcreteConcept } from './studyMaterialGeneration';

export const PROCESSING_PROFILES = {
  board: { label: 'Quadro manuscrito', minimum: 82, layout: 'sparse', variants: 3 },
  printed: { label: 'Documento impresso', minimum: 78, layout: 'auto', variants: 2 },
  slide: { label: 'Slide', minimum: 80, layout: 'sparse', variants: 2 },
  note: { label: 'Anotação', minimum: 82, layout: 'sparse', variants: 3 },
  formula: { label: 'Fórmula', minimum: 90, layout: 'block', variants: 1 },
  diagram: { label: 'Diagrama', minimum: 90, layout: 'sparse', variants: 1 },
  prose: { label: 'Texto corrido', minimum: 78, layout: 'block', variants: 2 },
} as const;
export type ProcessingProfile = keyof typeof PROCESSING_PROFILES;
export interface Correction { original: string; corrected: string; reason: string; confidence: number; sourceFileId: string; region: { start: number; end: number }; }
export const normalizeMaterial = (text: string) => text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();

/** These are conservative quality signals, not a calibrated probability of truth. */
export function assessMaterial(text: string, ocr?: number, imageQuality?: number) {
  const words = text.match(/[\p{L}\p{N}]+/gu) ?? [];
  const tokens = text.split(/\s+/).filter(Boolean);
  const clean = tokens.filter(word => /^[\p{L}\p{N}.,:;!?()“”'"=+−/*%-]+$/u.test(word)).length / Math.max(1, tokens.length);
  const incomplete = tokens.filter(word => /[�]|\p{L}[-¬]$/u.test(word) || /\p{L}\d\p{L}/u.test(word)).length / Math.max(1, tokens.length);
  const frequencies = new Map<string, number>();
  words.forEach(word => { const key = normalizeMaterial(word); frequencies.set(key, (frequencies.get(key) ?? 0) + 1); });
  let largestFrequency = 0;
  for (const count of frequencies.values()) largestFrequency = Math.max(largestFrequency, count);
  const repetition = largestFrequency / Math.max(1, words.length);
  const definitions = extractStudyDefinitions(text);
  const conflicts = relevantAmbiguities(text).length > 0;
  const signals = {
    image: Math.max(0, Math.min(100, imageQuality ?? (ocr === undefined ? 100 : 50))),
    ocr: Math.max(0, Math.min(100, Number.isFinite(ocr) ? ocr! : ocr === undefined ? 100 : 0)),
    coherence: words.length >= 4 ? clean * 100 : 0,
    completeWords: (1 - incomplete) * 100,
    repetition: repetition > .35 ? 20 : 100,
    topics: conflicts ? 0 : definitions.length ? 100 : 50,
  };
  const score = Math.round(signals.image * .15 + signals.ocr * .3 + signals.coherence * .2 + signals.completeWords * .15 + signals.repetition * .1 + signals.topics * .1);
  return { score: Math.min(score, incomplete > .1 ? 60 : 100, signals.ocr < 65 ? 64 : 100), signals, conflicts };
}

export function correctMaterial(raw: string, sourceFileId: string, profile: ProcessingProfile) {
  const corrections: Correction[] = [];
  // Only typography/line wrapping: no dictionary guesses, especially in formulas.
  const corrected = raw.replace(/\u00ad|\u00a0|([\p{Ll}]{3,})-\r?\n([\p{Ll}]{3,})|([^\n]+:[^\n.!?;]*)\r?\n(?=[\p{Ll}][^:\n=]*(?:\n|$))/gu, (original: string, left: string | undefined, right: string | undefined, wrapped: string | undefined, offset: number) => {
    if (wrapped) {
      if (!['printed', 'prose'].includes(profile)) return original;
      const replacement = wrapped.trimEnd() + ' ';
      corrections.push({ original, corrected: replacement, reason: 'Continuação de linha de definição em texto impresso; nenhum termo acrescentado', confidence: 95, sourceFileId, region: { start: offset, end: offset + original.length } });
      return replacement;
    }
    const joined = left && right ? left + right : undefined;
    if (joined && (profile === 'formula' || profile === 'diagram' || !new RegExp(`\\b${joined}\\b`, 'iu').test(raw))) return original;
    const replacement = joined ?? (original === '\u00a0' ? ' ' : '');
    corrections.push({ original, corrected: replacement, reason: joined ? 'Palavra completa também presente na fonte' : 'Normalização tipográfica sem alteração semântica', confidence: joined ? 95 : 100, sourceFileId, region: { start: offset, end: offset + original.length } });
    return replacement;
  });
  return { corrected, corrections };
}

export function validateMaterialResources(source: string, confidence: number, profile: ProcessingProfile, original = source) {
  const definitions = extractStudyDefinitions(source);
  const generated = generateStudyResources(source);
  const seen = new Set<string>();
  const eligible = confidence >= PROCESSING_PROFILES[profile].minimum && !['formula', 'diagram'].includes(profile);
  const evidence = (subject: string) => definitions.filter(entry => normalizeMaterial(entry.term) === normalizeMaterial(subject));
  const flashcards = generated.flashcards.filter(card => {
    const matches = evidence(card.subject), key = normalizeMaterial(card.front);
    if (!eligible || matches.length !== 1 || !original.includes(matches[0].sourceExcerpt) || !/[.!?;]$/.test(matches[0].definition) || assessMaterial(matches[0].sourceExcerpt, confidence, 100).score < PROCESSING_PROFILES[profile].minimum || card.back !== matches[0].definition || seen.has(key)) return false;
    seen.add(key); return true;
  }).map(card => ({ ...card, sourceExcerpt: evidence(card.subject)[0].sourceExcerpt, confidence }));
  const questions = generated.questions.filter(question => {
    const matches = evidence(question.subject), key = normalizeMaterial(question.prompt);
    if (!eligible || matches.length !== 1 || !original.includes(matches[0].sourceExcerpt) || !/[.!?;]$/.test(matches[0].definition) || assessMaterial(matches[0].sourceExcerpt, confidence, 100).score < PROCESSING_PROFILES[profile].minimum || seen.has(key) || new Set(question.options.map(normalizeMaterial)).size !== question.options.length) return false;
    const entry = matches[0];
    if (!question.options.every(option => definitions.some(definition =>
      definition.definition === option && original.includes(definition.sourceExcerpt) && evidence(definition.term).length === 1))) return false;
    const supportedAnswers = definitions.filter(candidate => normalizeMaterial(candidate.definition) === normalizeMaterial(entry.definition));
    if (supportedAnswers.length !== 1 || question.options[question.correctOptionIndex] !== entry.definition || question.explanation !== `Trecho de origem: ${entry.sourceExcerpt}`) return false;
    seen.add(key); return true;
  }).map(question => ({ ...question, sourceExcerpt: evidence(question.subject)[0].sourceExcerpt, confidence }));
  const reasons: Record<string, number> = {};
  const reject = (reason: string, count = 1) => { if (count) reasons[reason] = (reasons[reason] ?? 0) + count; };
  extractStudyDefinitions(source, reject);
  reject('definition_evidence_or_ambiguity', generated.flashcards.length + generated.questions.length - flashcards.length - questions.length);
  const reserved = new Set(flashcards.map(card => normalizeMaterial(card.front)));
  for (const item of literalStudyResources(source, reject)) {
    const key = normalizeMaterial(item.front);
    if (!eligible || !original.includes(item.sourceExcerpt)) { reject('insufficient_evidence'); continue; }
    if (reserved.has(key)) { reject('duplicate'); continue; }
    reserved.add(key);
    flashcards.push({ ...item, confidence });
  }
  const rejected = Object.values(reasons).reduce((sum, count) => sum + count, 0);
  const total = flashcards.length + questions.length + rejected;
  return { flashcards, questions, rejected, reasons, validity: total ? Math.round((flashcards.length + questions.length) / total * 100) : 0 };
}

export function definitionDifferences(text: string) {
  const groups = new Map<string, ReturnType<typeof extractStudyDefinitions>>();
  for (const entry of extractStudyDefinitions(text)) {
    const key = normalizeMaterial(entry.term);
    groups.set(key, [...(groups.get(key) ?? []), entry]);
  }
  return [...groups.values()].filter(entries => new Set(entries.map(entry => normalizeMaterial(entry.definition))).size > 1);
}

/** Opposing predicates are signals for review, not proof of a contradiction. */
export function relevantAmbiguities(text: string) {
  return definitionDifferences(text).filter(entries => {
    const definitions = entries.map(entry => normalizeMaterial(entry.definition));
    return definitions.some((left, leftIndex) => definitions.some((right, rightIndex) => {
      if (entries[leftIndex].context !== entries[rightIndex].context) return false;
      // Direct definitions of one metric as a duration and a rate need source review.
      if (/^(?:e |o |a )*(?:tempo|duracao) (?:ate|entre|de)\b/.test(left) &&
          /^(?:e |o |a )*(?:quantidade|numero) de [\p{L} -]+ por (?:segundo|minuto|hora)\b/u.test(right)) return true;
      const bare = (value: string) => value.replace(/\bnao\s+/g, '');
      if (left !== right && bare(left) === bare(right)) return true;
      return /\b(?:mantem|aumenta)\b/.test(left) &&
        left.replace(/\b(?:mantem|aumenta)\b/, 'reduz') === right;
    }));
  });
}

export function structureMaterial(source: string) {
  const blocks: Array<{ kind: 'title' | 'formula' | 'list' | 'step' | 'comparison' | 'cause' | 'example' | 'question'; text: string; region: { start: number; end: number } }> = [];
  let offset = 0;
  for (const line of source.split('\n')) {
    const text = line.trim();
    const kind = /[=∑∫√]/u.test(text) ? 'formula'
      : /\?$/.test(text) ? 'question'
      : /^\d+[.)]\s/.test(text) ? 'step'
      : /^[-*•]\s/.test(text) ? 'list'
      : /\bexemplo\b|\bpor exemplo\b/iu.test(text) ? 'example'
      : /\bporque\b|\bcausa\b|\bconsequência\b/iu.test(text) ? 'cause'
      : /\benquanto\b|\bdiferentemente\b|\bcomparado\b/iu.test(text) ? 'comparison'
      : text.length > 2 && text.length < 80 && text === text.toLocaleUpperCase('pt-BR') && /\p{L}/u.test(text) ? 'title' : undefined;
    if (kind) blocks.push({ kind, text, region: { start: offset + line.indexOf(text), end: offset + line.indexOf(text) + text.length } });
    offset += line.length + 1;
  }
  return blocks;
}


/** Literal recall only. Blocks are used as cues, without filling gaps or inferring relations. */
function literalStudyResources(source: string, reject: (reason: string) => void) {
  type Candidate = { front: string; back: string; subject: string; sourceExcerpt: string };
  const candidates: Candidate[] = [];
  const blocks = structureMaterial(source);
  function add(front: string, back: string, excerpt: string) {
    if (front.length > 500 || back.length < 2 || back.length > 500 || excerpt.length > 800) return;
    candidates.push({ front, back, subject: front, sourceExcerpt: excerpt });
  }
  for (let index = 0; index < blocks.length && candidates.length < 30; index++) {
    const block = blocks[index];
    if (block.kind === 'question' && /^Pergunta:\s*/iu.test(block.text)) {
      const next = source.slice(block.region.end).match(/^(?:[ \t]*\r?\n)[ \t]*Resposta:[ \t]*([^\r\n]+)/iu);
      const prompt = block.text.replace(/^Pergunta:\s*/iu, '');
      if (next && prompt.split(/\s+/).length >= 4 &&
          !/^(?:o que|qual|segundo)\s+(?:(?:diz|mostra|apresenta)\s+)?(?:o texto|o material|o trecho|a informação|isso)/iu.test(prompt)) {
        add(prompt, next[1].trim(), source.slice(block.region.start, block.region.end + next[0].length));
      } else reject('vague_prompt');
      continue;
    }
    if (block.kind === 'title') {
      const list = [];
      let end = block.region.end;
      const kind = blocks[index + 1]?.kind;
      for (let cursor = index + 1; cursor < blocks.length && list.length < 12; cursor++) {
        const item = blocks[cursor];
        if (item.kind !== kind || (kind !== 'list' && kind !== 'step') ||
            !/^[ \t]*\r?\n[ \t]*$/u.test(source.slice(end, item.region.start))) break;
        list.push(item.text);
        end = item.region.end;
      }
      if (list.length >= 2 && isConcreteConcept(block.text)) add(`Quais são as etapas ou elementos de “${block.text}”?`, list.join('\n'), source.slice(block.region.start, end));
      continue;
    }
    if (block.kind === 'formula') {
      const match = block.text.match(/^(Fórmula (?:de|da|do) [^:]{2,80}):\s*(.{2,200}=.{1,200})$/iu);
      if (match) add(`Qual expressão o material apresenta como “${match[1]}”?`, match[2], block.text);
      continue;
    }
    const separator = block.kind === 'comparison' ? /\s+enquanto\s+/iu
      : block.kind === 'cause' ? /\s+porque\s+/iu
      : block.kind === 'example' ? /\s+por exemplo,?\s+/iu : undefined;
    const match = separator?.exec(block.text);
    if (match && match.index >= 12 && /[.!?]$/u.test(block.text)) {
      const left = block.text.slice(0, match.index);
      const answer = block.text.slice(match.index + match[0].length);
      if (!isConcreteConcept(left) || /^\s*(?:ele|ela|isso|isto|aquilo|eles|elas)\b/iu.test(left) || answer.split(/\s+/).length < 4) {
        reject('vague_prompt');
        continue;
      }
      const front = block.kind === 'cause' ? `Por que ocorre esta situação: “${left}”?`
        : block.kind === 'comparison' ? `Que situação se contrapõe a “${left}”?`
        : `Qual exemplo ilustra “${left}”?`;
      add(front, answer, block.text);
    }
  }
  const answersByPrompt = new Map<string, Set<string>>();
  for (const { front, back } of candidates) {
    const key = normalizeMaterial(front);
    const answers = answersByPrompt.get(key) ?? new Set<string>();
    answers.add(normalizeMaterial(back));
    answersByPrompt.set(key, answers);
  }
  return candidates.filter(({ front }) => {
    const unique = answersByPrompt.get(normalizeMaterial(front))?.size === 1;
    if (!unique) reject('ambiguous_answer');
    return unique;
  });
}
