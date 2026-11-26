import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { MaterialProcessingState } from './materialProcessor';
import { StudyVisualLesson } from './StudyVisualLesson';

const lesson: NonNullable<MaterialProcessingState['aiLessons']>[number] = {
  id: 'lesson-visual-test', title: 'Conceitos do material',
  explanation: 'Explicação já produzida e salva pela IA.',
  example: 'Exemplo complementar já salvo.',
  check: 'Qual regra foi apresentada?', answer: 'A regra descrita na explicação.',
  sourceExcerpt: 'Trecho literal preservado do arquivo acadêmico.', createdAt: '2026-11-26T00:00:00.000Z',
};

describe('StudyVisualLesson', () => {
  it('apresenta em etapas apenas conteúdo recebido e permite navegar sem perder a fonte', () => {
    render(<StudyVisualLesson lesson={lesson} learned={false} onComplete={vi.fn()} />);
    expect(screen.getByText(lesson.explanation)).toBeInTheDocument();
    expect(screen.getByText('CONTEÚDO ELABORADO POR IA')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Próxima etapa' }));
    expect(screen.getByText(lesson.example)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Etapa 3: Verificação' }));
    expect(screen.getByText(lesson.check)).toBeInTheDocument();
    expect(screen.getByText(/não é enviada nem corrigida automaticamente/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Etapa 4: Material de origem' }));
    expect(screen.getByText(lesson.sourceExcerpt)).toBeInTheDocument();
  });

  it('não corrige a autoavaliação e só grava conclusão quando a pessoa a confirma', () => {
    const onComplete = vi.fn();
    render(<StudyVisualLesson lesson={lesson} learned={false} onComplete={onComplete} />);
    expect(onComplete).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Etapa 4: Material de origem' }));
    fireEvent.click(screen.getByRole('button', { name: 'Marcar como aprendido' }));
    expect(onComplete).toHaveBeenCalledOnce();
  });

  it('indica conclusão persistida e impede gravá-la novamente', () => {
    const onComplete = vi.fn();
    render(<StudyVisualLesson lesson={lesson} learned onComplete={onComplete} />);
    fireEvent.click(screen.getByRole('button', { name: 'Etapa 4: Material de origem' }));
    expect(screen.getByRole('button', { name: 'Aula concluída' })).toBeDisabled();
    expect(onComplete).not.toHaveBeenCalled();
  });
});
