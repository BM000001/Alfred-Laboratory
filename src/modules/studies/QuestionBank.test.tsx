import 'fake-indexeddb/auto';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { QuestionBank } from './QuestionBank';
import { studyQuestionRepository, studyQuizAttemptRepository } from '../../storage/repositories';

beforeEach(async () => {
  await Promise.all([studyQuestionRepository.clear(), studyQuizAttemptRepository.clear()]);
  for (let index = 0; index < 3; index += 1) {
    await studyQuestionRepository.save({
      id: `q-${index}`, disciplineId: 'software', topicId: 'topic-1', prompt: `Questão ${index + 1}`,
      options: [`Correta ${index + 1}`, 'Incorreta B', 'Incorreta C', 'Incorreta D'], correctOptionIndex: 0,
      explanation: `Base da resposta ${index + 1}.`, difficulty: 'medium', createdAt: `2026-11-11T12:0${index}:00.000Z`,
    });
  }
});

afterEach(() => cleanup());

describe('QuestionBank quiz flow', () => {
  it('selects a question count, grades a quiz, reviews answers, and retains history after remount', async () => {
    const topics = [{ id: 'topic-1', disciplineId: 'software', title: 'Fundamentos', status: 'pending' as const, createdAt: '2026-11-11T12:00:00.000Z' }];
    const first = render(<QuestionBank disciplineId="software" topics={topics} />);
    expect(await screen.findByText('3 questão(ões) cadastrada(s) · simulados com até 50 questões')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Quantidade de questões'), { target: { value: '2' } });
    fireEvent.click(screen.getByRole('button', { name: 'Iniciar simulado' }));

    expect(await screen.findByText('Questão 1 de 2')).toBeInTheDocument();
    for (let index = 0; index < 2; index += 1) {
      fireEvent.click(screen.getAllByRole('radio')[0]);
      fireEvent.click(screen.getByRole('button', { name: 'Corrigir resposta' }));
      if (index === 0) fireEvent.click(screen.getByRole('button', { name: 'Próxima questão' }));
      else fireEvent.click(screen.getByRole('button', { name: 'Finalizar simulado' }));
    }
    expect(await screen.findByText('100%')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Revisar respostas e explicações'));
    expect(screen.getAllByText(/Base da resposta [123]\./)).toHaveLength(2);
    fireEvent.click(screen.getByRole('button', { name: 'Voltar ao banco' }));
    expect(await screen.findByText(/Histórico de simulados/)).toBeInTheDocument();
    first.unmount();

    render(<QuestionBank disciplineId="software" topics={topics} />);
    expect(await screen.findByText(/Histórico de simulados/)).toBeInTheDocument();
    await waitFor(async () => expect(await studyQuizAttemptRepository.getAll()).toHaveLength(1));
    expect((await studyQuizAttemptRepository.getAll())[0]).toMatchObject({ totalQuestions: 2, correctAnswers: 2 });
  });
});
