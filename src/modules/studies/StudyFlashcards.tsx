import { useEffect, useMemo, useState, type FormEvent } from 'react';
import type { FlashcardRating, StudyFlashcard } from './flashcardTypes';
import { createFlashcardService, isFlashcardDue } from './flashcardService';
import { studyFlashcardRepository } from '../../storage/repositories';

const service = createFlashcardService(studyFlashcardRepository);
const ratingLabels: Array<{ value: FlashcardRating; label: string }> = [
  { value: 'again', label: 'Errei' }, { value: 'hard', label: 'Difícil' }, { value: 'good', label: 'Bom' }, { value: 'easy', label: 'Fácil' },
];

export function StudyFlashcards({ disciplineId, refreshToken = 0 }: { disciplineId: string; refreshToken?: number }) {
  const [cards, setCards] = useState<StudyFlashcard[]>([]);
  const [front, setFront] = useState('');
  const [back, setBack] = useState('');
  const [editingId, setEditingId] = useState('');
  const [editingFront, setEditingFront] = useState('');
  const [editingBack, setEditingBack] = useState('');
  const [showAnswer, setShowAnswer] = useState(false);
  const [currentId, setCurrentId] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  async function refresh() {
    const all = await service.list();
    setCards(all.filter((card) => card.disciplineId === disciplineId).sort((a, b) => a.nextReviewAt.localeCompare(b.nextReviewAt)));
  }

  useEffect(() => {
    let active = true;
    service.list().then((all) => { if (active) setCards(all.filter((card) => card.disciplineId === disciplineId).sort((a, b) => a.nextReviewAt.localeCompare(b.nextReviewAt))); })
      .catch(() => { if (active) setError('Não foi possível carregar os flashcards.'); })
      .finally(() => { if (active) setLoading(false); });
    setShowAnswer(false); setCurrentId('');
    return () => { active = false; };
  }, [disciplineId, refreshToken]);

  const dueCards = useMemo(() => cards.filter((card) => isFlashcardDue(card)), [cards]);
  const current = dueCards.find((card) => card.id === currentId) ?? dueCards[0];

  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError('');
    try { await service.create({ disciplineId, front, back }); setFront(''); setBack(''); await refresh(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Não foi possível criar o flashcard.'); }
  }

  async function rate(rating: FlashcardRating) {
    if (!current) return;
    setError('');
    try { await service.review(current.id, rating); setShowAnswer(false); setCurrentId(''); await refresh(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Não foi possível registrar a revisão.'); }
  }

  async function saveEdit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editingId) return;
    setError('');
    try { await service.update(editingId, { front: editingFront, back: editingBack }); setEditingId(''); await refresh(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Não foi possível editar o flashcard.'); }
  }

  async function removeCurrent() {
    if (!current || !window.confirm('Excluir este flashcard?')) return;
    try { await service.delete(current.id); setShowAnswer(false); setCurrentId(''); await refresh(); }
    catch { setError('Não foi possível excluir o flashcard.'); }
  }

  return <section className="study-flashcards" aria-label="Flashcards e revisão espaçada">
    <div className="study-flashcards-header"><div><span className="card-label">MEMORIZAÇÃO ATIVA</span><h3>Flashcards</h3></div><span className="study-flashcards-count">{dueCards.length} para revisar · {cards.length} no total</span></div>
    {error && <p className="module-error" role="alert">{error}</p>}
    <form className="study-flashcard-form" onSubmit={create}>
      <label htmlFor="flashcard-front">Pergunta ou conceito</label>
      <textarea id="flashcard-front" rows={2} maxLength={500} value={front} onChange={(event) => setFront(event.target.value)} placeholder="Ex.: O que é uma estrutura de dados?" required />
      <label htmlFor="flashcard-back">Resposta</label>
      <textarea id="flashcard-back" rows={2} maxLength={2000} value={back} onChange={(event) => setBack(event.target.value)} placeholder="Escreva a resposta com suas palavras..." required />
      <button className="primary-action" type="submit">Criar flashcard</button>
    </form>
    {editingId && <form className="study-flashcard-form" onSubmit={(event) => void saveEdit(event)}>
      <strong>Editar flashcard</strong>
      <label htmlFor="flashcard-edit-front">Pergunta</label><textarea id="flashcard-edit-front" rows={2} maxLength={500} value={editingFront} onChange={(event) => setEditingFront(event.target.value)} required />
      <label htmlFor="flashcard-edit-back">Resposta</label><textarea id="flashcard-edit-back" rows={2} maxLength={2000} value={editingBack} onChange={(event) => setEditingBack(event.target.value)} required />
      <button className="primary-action" type="submit">Salvar edição</button><button className="text-action" type="button" onClick={() => setEditingId('')}>Cancelar</button>
    </form>}
    {loading ? <p className="module-feedback">Carregando cartões...</p> : current ? <article className="study-flashcard">
      <div className="study-flashcard-face"><span>{showAnswer ? 'Resposta' : 'Pergunta'}</span><strong>{showAnswer ? current.back : current.front}</strong></div>
      {!showAnswer ? <div className="study-flashcard-actions"><button type="button" onClick={() => setShowAnswer(true)}>Revelar resposta</button></div> : <div className="study-flashcard-actions">{ratingLabels.map((rating) => <button type="button" key={rating.value} onClick={() => void rate(rating.value)}>{rating.label}</button>)}</div>}
      <div className="study-flashcard-meta">Revisado {current.reviewCount} vez(es) · {dueCards.length} cartão(ões) na fila</div>
      <div className="study-flashcard-actions"><button type="button" onClick={() => void removeCurrent()}>Excluir cartão</button></div>
    </article> : <div className="study-flashcard-empty">{cards.length === 0 ? 'Crie seu primeiro cartão acima. Pergunta na frente, resposta no verso.' : 'Excelente. Você revisou todos os cartões vencidos desta disciplina. Os próximos retornam na data programada.'}</div>}
    {cards.length > 0 && <div className="study-flashcard-list" aria-label="Todos os flashcards desta disciplina">
      <strong>Cartões da disciplina</strong>
      {cards.map((card) => <article key={card.id}><div><span>{card.subject ?? card.sourceFileName ?? 'Criado manualmente'}</span><strong>{card.front}</strong></div><div>
        <button className="text-action" type="button" onClick={() => { setEditingId(card.id); setEditingFront(card.front); setEditingBack(card.back); }}>Editar</button>
        <button className="text-action" type="button" onClick={() => { if (window.confirm('Excluir este flashcard?')) void service.delete(card.id).then(refresh); }}>Excluir</button>
      </div></article>)}
    </div>}
  </section>;
}
