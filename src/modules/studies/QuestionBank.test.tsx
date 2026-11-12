import 'fake-indexeddb/auto';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { QuestionBank } from './QuestionBank';
import { disciplineRepository, studyFlashcardRepository, studyQuestionRepository, studyQuizAttemptRepository, studyTopicRepository } from '../../storage/repositories';

beforeEach(async () => {
  await Promise.all([disciplineRepository.clear(), studyTopicRepository.clear(), studyFlashcardRepository.clear(), studyQuestionRepository.clear(), studyQuizAttemptRepository.clear()]);
  await disciplineRepository.save({ id: 'software', name: 'Engenharia de Software', createdAt: new Date().toISOString() });
});
afterEach(() => cleanup());

describe('QuestionBank option editor', () => {
  it('lets the student choose between two and six alternatives and persists the selected answer', async () => {
    render(<QuestionBank disciplineId="software" topics={[]} />);
    await screen.findByText(/0 questão\(ões\) cadastrada/);
    fireEvent.change(screen.getByLabelText('Enunciado da questão'), { target: { value: 'Qual alternativa é válida?' } });
    fireEvent.change(screen.getByLabelText('Alternativa A'), { target: { value: 'Resposta A' } });
    fireEvent.change(screen.getByLabelText('Alternativa B'), { target: { value: 'Resposta B' } });
    fireEvent.click(screen.getByRole('button', { name: /Adicionar alternativa/ }));
    expect(screen.getByLabelText('Alternativa E')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Remover alternativa C' }));
    fireEvent.click(screen.getByRole('button', { name: 'Remover alternativa C' }));
    fireEvent.click(screen.getByRole('button', { name: 'Remover alternativa C' }));
    expect(screen.queryByLabelText('Alternativa C')).not.toBeInTheDocument();
    const correctRadios = screen.getAllByRole('radio');
    fireEvent.click(correctRadios[1]);
    fireEvent.click(screen.getByRole('button', { name: 'Salvar questão' }));

    expect(await screen.findByText('Qual alternativa é válida?')).toBeInTheDocument();
    const [saved] = await studyQuestionRepository.getAll();
    expect(saved.options).toEqual(['Resposta A', 'Resposta B']);
    expect(saved.correctOptionIndex).toBe(1);
    fireEvent.click(await screen.findByRole('button', { name: 'Editar' }));
    fireEvent.change(screen.getByLabelText('Enunciado da questão'), { target: { value: 'Enunciado revisado pelo estudante?' } });
    fireEvent.click(screen.getByRole('button', { name: 'Salvar alterações' }));
    expect(await screen.findByText('Enunciado revisado pelo estudante?')).toBeInTheDocument();
    expect((await studyQuestionRepository.getById(saved.id))?.options).toEqual(['Resposta A', 'Resposta B']);
  });

  it('saves a reviewed question snapshot and lets the student reopen that attempt after the question is deleted', async () => {
    await studyQuestionRepository.save({
      id: 'question-history', disciplineId: 'software', topicId: 'topic-1',
      prompt: 'Qual conceito descreve a proteção de dados?', options: ['Herança', 'Encapsulamento'],
      correctOptionIndex: 1, explanation: 'O conteúdo associa encapsulamento à proteção de dados.',
      difficulty: 'medium', createdAt: '2026-11-11T12:00:00.000Z', sourceFileName: 'aula.pdf',
    });
    const view = render(<QuestionBank disciplineId="software" topics={[]} />);
    await screen.findByText(/1 questão\(ões\) cadastrada/);
    fireEvent.click(screen.getByRole('button', { name: 'Iniciar simulado' }));
    fireEvent.click(screen.getAllByRole('radio')[1]);
    fireEvent.click(screen.getByRole('button', { name: 'Corrigir resposta' }));
    fireEvent.click(screen.getByRole('button', { name: 'Finalizar simulado' }));
    expect(await screen.findByText('100%')).toBeInTheDocument();

    const [attempt] = await studyQuizAttemptRepository.getAll();
    expect(attempt.answers[0].questionSnapshot).toMatchObject({ prompt: 'Qual conceito descreve a proteção de dados?', sourceFileName: 'aula.pdf' });
    view.unmount();
    await studyQuestionRepository.delete('question-history');
    render(<QuestionBank disciplineId="software" topics={[]} />);
    await screen.findByText(/0 questão\(ões\) cadastrada/);
    fireEvent.click(await screen.findByRole('button', { name: 'Revisar' }));

    expect(await screen.findByText(/Qual conceito descreve a proteção de dados\?/)).toBeInTheDocument();
    expect(screen.getByText('O conteúdo associa encapsulamento à proteção de dados.')).toBeInTheDocument();
  });
});
