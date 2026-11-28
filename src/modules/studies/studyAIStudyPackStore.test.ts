import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { fileRepository, studyFlashcardRepository, studyQuestionRepository } from '../../storage/repositories';
import { saveValidatedAIStudyPack } from './studyAIStudyPackStore';
import type { ValidatedAIStudyPack } from './studyRemotePack';

const source = 'HTTP é um protocolo usado para transferir informações entre clientes e servidores web.';
const pack: ValidatedAIStudyPack = {
  questions: [{
    prompt: 'Qual protocolo aparece no material?', options: ['HTTP', 'FTP', 'SMTP'],
    correctOptionIndex: 0, explanation: 'Trecho de origem: ' + source + '\nExplicação gerada por IA: HTTP.',
    sourceExcerpt: source, difficulty: 'medium', subject: 'Conceito do material',
  }],
  lessons: [{
    title: 'HTTP', explanation: 'A IA explica o uso desse protocolo.',
    example: 'Exemplo complementar da IA: uma requisição web.',
    check: 'Qual protocolo?', answer: 'HTTP', sourceExcerpt: source,
  }],
  flashcards: [{ front: 'Qual protocolo aparece na fonte?', back: 'HTTP', sourceExcerpt: source }],
};

beforeEach(async () => {
  await Promise.all([fileRepository.clear(), studyFlashcardRepository.clear(), studyQuestionRepository.clear()]);
  await fileRepository.save({
    id: 'f', disciplineId: 'd', name: 'aula.txt', type: 'text/plain', size: source.length,
    blob: new Blob([source]), createdAt: '',
    processing: { version: 1, profile: 'printed', status: 'awaiting-ai', topicId: 't', stage: 'Aguardando IA' },
  });
});

describe('study pack persistence', () => {
  it('stores all source-linked resources once and keeps existing material metadata', async () => {
    const args = { fileId: 'f', fileName: 'aula.txt', disciplineId: 'd', topicId: 't', sourceText: source, pack, signal: new AbortController().signal };
    expect(await saveValidatedAIStudyPack(args)).toEqual({ questionsAdded: 1, flashcardsAdded: 1, lessonsAdded: 1 });
    expect(await saveValidatedAIStudyPack(args)).toEqual({ questionsAdded: 0, flashcardsAdded: 0, lessonsAdded: 0 });
    expect((await studyQuestionRepository.getAll())[0].sourceFileId).toBe('f');
    expect((await studyFlashcardRepository.getAll())[0].sourceExcerpt).toBe(source);
    const file = await fileRepository.getById('f');
    expect(file?.processing?.aiLessons).toHaveLength(1);
    expect(file?.processing?.aiLessons?.[0]).toMatchObject({ title: 'HTTP', sourceExcerpt: source });
  });

  it('recusa o pacote inteiro quando a unidade mudou antes da retomada', async () => {
    await expect(saveValidatedAIStudyPack({ fileId: 'f', fileName: 'aula.txt', disciplineId: 'd', topicId: 'outra',
      sourceText: source, pack, signal: new AbortController().signal })).rejects.toThrow('vínculo');
    expect(await studyQuestionRepository.getAll()).toHaveLength(0);
    expect(await studyFlashcardRepository.getAll()).toHaveLength(0);
  });

  it('does not save lessons lacking literal support from the original source', async () => {
    const invalid = { ...pack, questions: [], flashcards: [], lessons: [{ ...pack.lessons[0], answer: 'Não existe' }] };
    const result = await saveValidatedAIStudyPack({ fileId: 'f', fileName: 'aula.txt', disciplineId: 'd', topicId: 't', sourceText: source, pack: invalid, signal: new AbortController().signal });
    expect(result.lessonsAdded).toBe(0);
    expect((await fileRepository.getById('f'))?.processing?.aiLessons).toBeUndefined();
  });
});
