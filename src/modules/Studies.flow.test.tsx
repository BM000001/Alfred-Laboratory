import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
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
  await screen.findByRole('button', { name: 'Materiais de Orientação a objetos' });
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
  expect(await screen.findByText(/4 flashcard\(s\) e 4 questão\(ões\) gerados/)).toBeInTheDocument();
  await screen.findByRole('button', { name: 'Ler texto de conceitos.txt' });
  await waitFor(async () => {
    const [material] = await fileRepository.getAll();
    expect(material).toMatchObject({ disciplineId: discipline.id, extraction: { text: definitions } });
    expect(await studyTopicRepository.getById(unit.id)).toMatchObject({ sourceFileId: material.id });
  });
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
  expect(await screen.findByText('0 acerto(s) de 1 questão(ões) · 1 erro(s)')).toBeInTheDocument();
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
});


it('abre os trechos do Markdown na aba Materiais da disciplina antes de pedir consentimento', async () => {
  const preview = await import('./studies/isRemoteStudyPreview');
  const gate = vi.spyOn(preview, 'isRemoteStudyPreview').mockReturnValue(true);
  try {
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: 'Aprender' }));
    await screen.findByRole('heading', { name: 'Disciplinas' });
    create('Nova disciplina');
    fireEvent.change(screen.getByLabelText('Nome'), { target: { value: 'Teste 2' } });
    fireEvent.click(screen.getByRole('button', { name: 'Salvar disciplina' }));
    await screen.findByRole('heading', { name: 'Teste 2' });
    fireEvent.click(screen.getByRole('button', { name: 'Materiais' }));
    create('Adicionar material');
    fireEvent.change(screen.getByLabelText('Adicionar arquivos'), { target: {
      files: [new File([definitions], 'teste.md', { type: 'text/markdown' })],
    } });
    fireEvent.click(screen.getByRole('button', { name: 'Salvar' }));
    expect(await within(await screen.findByLabelText('Material para exercícios')).findByRole('option', { name: 'teste.md' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Gerar exercícios com IA' }));
    expect(await screen.findByLabelText(/autorizo o envio/i)).not.toBeChecked();
    expect(screen.getByRole('button', { name: 'Enviar trechos e gerar exercícios' })).toBeDisabled();
  } finally {
    gate.mockRestore();
  }
});
