import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { studyQuestionRepository } from '../../storage/repositories';
import { saveValidatedAIStudyQuestions } from './studyAIQuestionStore';
import type { ValidatedAIStudyQuestion } from './studyRemoteQuestions';

const source = 'HTTP é um protocolo de transferência de informações entre clientes e servidores web.';
const question: ValidatedAIStudyQuestion = {
  prompt: 'Qual protocolo foi citado?',
  options: ['HTTP', 'SMTP', 'FTP'],
  correctOptionIndex: 0,
  explanation: 'Trecho de origem: ' + source + '\nExplicação gerada por IA: HTTP é o protocolo citado.',
  sourceExcerpt: source,
  difficulty: 'medium',
  subject: 'Questão fundamentada no material',
};

beforeEach(async () => studyQuestionRepository.clear());

describe('persist validated AI questions', () => {
  it('links provenance and is idempotent on retries', async () => {
    const args = { fileId: 'material-a', fileName: 'apostila.txt', disciplineId: 'software', topicId: 'chapter-1', sourceText: source, questions: [question], signal: new AbortController().signal };
    expect(await saveValidatedAIStudyQuestions(args)).toBe(1);
    expect(await saveValidatedAIStudyQuestions(args)).toBe(0);
    const items = await studyQuestionRepository.getAll();
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ sourceFileId: 'material-a', topicId: 'chapter-1', sourceExcerpt: source, prompt: question.prompt });
  });

  it('rejects unsupported source excerpts rather than storing guesses', async () => {
    const unrelated = { ...question, sourceExcerpt: 'Ausente da fonte' };
    const result = await saveValidatedAIStudyQuestions({ fileId: 'f', fileName: 'f.txt', disciplineId: 'd', topicId: 't', sourceText: source, questions: [unrelated], signal: new AbortController().signal });
    expect(result).toBe(0);
    expect(await studyQuestionRepository.getAll()).toEqual([]);
  });
});
