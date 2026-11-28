import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { expect, it } from 'vitest';
import App from '../app/App';
import { create } from '../app/testActions';
import { disciplineRepository, fileRepository, studyFlashcardRepository, studyQuestionRepository, studyQuizAttemptRepository, studyTopicRepository } from '../storage/repositories';

const definitions = [
  'Encapsulamento: mecanismo que protege os dados internos de um objeto.',
  'Herança: relação que permite reutilizar características definidas em outra classe.',
  'Polimorfismo: capacidade de responder de formas diferentes a uma mesma operação.',
  'Abstração: processo que representa somente aspectos importantes de uma entidade.',
].join('\n');

it('organiza material na unidade, corrige a atividade e retoma o progresso salvo após reabrir', async () => {
  const view = render(<App />);
  fireEvent.click(screen.getByRole('button', { name: 'Aprender' }));
  await screen.findByRole('heading', { name: 'Disciplinas' });
  create('Nova disciplina');
  fireEvent.change(screen.getByLabelText('Nome'), { target: { value: 'Software sintético' } });
  fireEvent.click(screen.getByRole('button', { name: 'Salvar disciplina' }));
  await screen.findByRole('heading', { name: 'Software sintético' });
  create('Nova unidade');
  fireEvent.change(screen.getByLabelText('Nome da unidade'), { target: { value: 'Orientação a objetos' } });
  fireEvent.click(screen.getByRole('button', { name: 'Salvar unidade' }));
  const [discipline] = await disciplineRepository.getAll();
  await screen.findByRole('button', { name: 'Materiais de Orientação a objetos' }, { timeout: 5000 });
  const [unit] = await studyTopicRepository.getAll();
  await studyQuestionRepository.save({
    id: 'unassigned', disciplineId: discipline.id, prompt: 'Questão sem unidade',
    options: ['a', 'b'], correctOptionIndex: 0, difficulty: 'easy', createdAt: new Date().toISOString(),
  });
  fireEvent.click(screen.getByRole('button', { name: 'Materiais de Orientação a objetos' }));
  create('Adicionar material');
  fireEvent.change(screen.getByLabelText('Adicionar arquivos'), { target: {
    files: [new File([definitions], 'conceitos.txt', { type: 'text/plain' })],
  } });
  fireEvent.click(screen.getByRole('button', { name: 'Salvar' }));
  expect(await screen.findByText(/Questões aguardam uma prévia autenticada/)).toBeInTheDocument();
  await screen.findByRole('button', { name: 'Ler texto de conceitos.txt' }, { timeout: 5000 });
  await waitFor(async () => {
    const [material] = await fileRepository.getAll();
    expect(material).toMatchObject({ disciplineId: discipline.id, extraction: { text: definitions } });
    expect(await studyTopicRepository.getById(unit.id)).toMatchObject({ sourceFileId: material.id });
  }, { timeout: 5000 });
  // Legacy navigation/quiz tests use explicit fixtures; the importer must NOT invent these.
  expect(await studyFlashcardRepository.getAll()).toHaveLength(0);
  expect((await studyQuestionRepository.getAll()).filter(q => q.topicId === unit.id)).toHaveLength(0);
  const [source] = await fileRepository.getAll();
  for (const [index, line] of definitions.split('\n').entries()) {
    const separator = line.indexOf(':');
    const subject = line.slice(0, separator);
    const definition = line.slice(separator + 1).trim();
    await studyFlashcardRepository.save({
      id: `prepared-card-${index}`, disciplineId: discipline.id, topicId: unit.id,
      sourceFileId: source.id, sourceFileName: source.name, sourceExcerpt: line,
      front: `Explique ${subject}.`, back: definition, subject,
      createdAt: new Date().toISOString(), nextReviewAt: '2026-01-01T00:00:00.000Z',
      intervalDays: 0, reviewCount: 0,
    });
    await studyQuestionRepository.save({
      id: `prepared-question-${index}`, disciplineId: discipline.id, topicId: unit.id,
      sourceFileId: source.id, sourceFileName: source.name, sourceExcerpt: line,
      subject, prompt: `Qual definição corresponde a ${subject}?`,
      options: [definition, 'Alternativa incorreta A', 'Alternativa incorreta B', 'Alternativa incorreta C'],
      correctOptionIndex: 0, difficulty: 'medium', explanation: `Trecho de origem: ${line}`,
      createdAt: new Date().toISOString(),
    });
  }
  fireEvent.click(screen.getByRole('button', { name: 'Praticar' }));
  expect(await screen.findByText('4 questão(ões) cadastrada(s) · simulados com até 50 questões')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Revisar flashcards' }));
  const flashcards = screen.getByRole('region', { name: 'Flashcards e revisão espaçada' });
  await within(flashcards).findByText('4 para revisar · 4 no total');
  expect(screen.queryByText('Questão sem unidade')).not.toBeInTheDocument();
  expect((await studyFlashcardRepository.getAll()).every((card) => card.topicId === unit.id)).toBe(true);
  expect((await studyQuestionRepository.getAll()).filter((question) => question.topicId === unit.id)).toHaveLength(4);
  fireEvent.click(screen.getByRole('button', { name: 'Simulados' }));
  fireEvent.change(screen.getByLabelText('Quantidade de questões'), { target: { value: '1' } });
  fireEvent.click(screen.getByRole('button', { name: 'Iniciar simulado' }));
  expect(screen.getByText('Questão 1 de 1')).toBeInTheDocument();
  const prompt = screen.getByRole('heading', { level: 4 }).textContent;
  const question = (await studyQuestionRepository.getAll()).find((item) => item.prompt === prompt)!;
  fireEvent.click(screen.getAllByRole('radio')[question.correctOptionIndex === 0 ? 1 : 0]);
  fireEvent.click(screen.getByRole('button', { name: 'Corrigir resposta' }));
  expect(await screen.findByText(/Resposta incorreta/)).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Finalizar simulado' }));
  expect(await screen.findByText('0 acerto(s) de 1 questão(ões) · 1 erro(s) · 0 pulada(s)')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Desempenho' }));
  const performance = screen.getByRole('region', { name: 'Desempenho por tópico' });
  expect(await within(performance).findByText('1 erro(s) em 1 resposta(s)')).toBeInTheDocument();
  fireEvent.click(within(performance).getByRole('button', { name: 'Revisar com flashcard' }));
  fireEvent.click(screen.getByRole('button', { name: 'Revisar flashcards' }));
  await within(flashcards).findByText('5 para revisar · 5 no total');
  fireEvent.click(within(flashcards).getByRole('button', { name: 'Revelar resposta' }));
  fireEvent.click(within(flashcards).getByRole('button', { name: 'Bom' }));
  await within(flashcards).findByText('4 para revisar · 5 no total');
  expect((await studyFlashcardRepository.getAll()).some((card) => card.topicId === unit.id && card.reviewCount === 1)).toBe(true);
  const [attempt] = await studyQuizAttemptRepository.getAll();
  expect(attempt.answers[0]).toMatchObject({ isCorrect: false, questionSnapshot: { topicId: unit.id, prompt } });

  view.unmount();
  await studyQuestionRepository.delete(question.id);
  render(<App />);
  fireEvent.click(screen.getByRole('button', { name: 'Aprender' }));
  fireEvent.click(await screen.findByRole('button', { name: /Software sintético/ }));
  fireEvent.click(screen.getByLabelText('Gerenciar matéria'));
  fireEvent.click(await screen.findByRole('button', { name: 'Unidades e materiais' }));
  fireEvent.click(await screen.findByRole('button', { name: 'Praticar Orientação a objetos' }));
  expect(await screen.findByText('3 questão(ões) cadastrada(s) · simulados com até 50 questões')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Desempenho' }));
  expect(await screen.findByText('1 erro(s) em 1 resposta(s)')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Revisar flashcards' }));
  expect(await screen.findByText('4 para revisar · 5 no total')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Simulados' }));
  fireEvent.click(screen.getByRole('button', { name: 'Ver correção' }));
  fireEvent.click(await screen.findByText('Revisar respostas e explicações'));
  expect(await screen.findByText(`1. ${prompt}`)).toBeInTheDocument();
  expect(await screen.findByText(`Correta: ${question.options[question.correctOptionIndex]}`)).toBeInTheDocument();
}, 20000);
