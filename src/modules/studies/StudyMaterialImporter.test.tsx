import 'fake-indexeddb/auto';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { StudyMaterialImporter } from './StudyMaterialImporter';
import { studyFlashcardRepository, studyQuestionRepository, studyQuizAttemptRepository } from '../../storage/repositories';
import type { StudyTopic } from './types';

const topic: StudyTopic = {
  id: 'material-1',
  disciplineId: 'math',
  title: 'Material gerado — limites',
  status: 'pending',
  createdAt: '2026-11-04T12:00:00.000Z',
  notes: `Material gerado a partir de: limites.pdf

\`\`\`json
{
  "flashcards": [{ "front": "O que é limite?", "back": "Valor ao qual a função se aproxima." }],
  "questions": [{ "prompt": "Quanto é 2 + 2?", "options": ["3", "4"], "correctOptionIndex": 1, "explanation": "Soma básica.", "difficulty": "easy" }]
}
\`\`\`
`,
};

beforeEach(async () => {
  await Promise.all([studyFlashcardRepository.clear(), studyQuestionRepository.clear(), studyQuizAttemptRepository.clear()]);
});

afterEach(() => cleanup());

describe('StudyMaterialImporter', () => {
  it('previews, imports and avoids importing the same material twice', async () => {
    render(<StudyMaterialImporter disciplineId="math" topics={[topic]} />);
    fireEvent.change(screen.getByLabelText('Material salvo'), { target: { value: topic.id } });
    fireEvent.click(screen.getByRole('button', { name: 'Analisar conteúdo salvo' }));
    expect(await screen.findByText('1 flashcard(s) · 1 questão(ões)')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar e importar' }));

    await waitFor(async () => {
      expect(await studyFlashcardRepository.getAll()).toHaveLength(1);
      expect(await studyQuestionRepository.getAll()).toHaveLength(1);
    });
    expect(await screen.findByText(/1 flashcard\(s\) e 1 questão\(ões\) adicionados/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Analisar conteúdo salvo' }));
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar e importar' }));
    expect(await screen.findByText(/0 flashcard\(s\) e 0 questão\(ões\) adicionados\. 2 duplicado\(s\) ignorado\(s\)/)).toBeInTheDocument();
    expect(await studyFlashcardRepository.getAll()).toHaveLength(1);
    expect(await studyQuestionRepository.getAll()).toHaveLength(1);
  });
});
