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
  });
});
