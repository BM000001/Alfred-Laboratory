import { createContext, useContext } from 'react';
import './studyMascot.css';

export const StudyMascotVisible = createContext(true);
type Mood = 'neutral' | 'happy' | 'thinking' | 'complete' | 'attention' | 'learning' | 'welcome';
const moods: Record<Mood, string> = {
  neutral: 'Em repouso', happy: 'Feliz', thinking: 'Pensando', complete: 'Concluído',
  attention: 'Atenção', learning: 'Aprendendo', welcome: 'Boas-vindas',
};

export function StudyMascot({ mood = 'neutral', variant = 'head' }: { mood?: Mood; variant?: 'full' | 'bust' | 'head' }) {
  const visible = useContext(StudyMascotVisible);
  if (!visible) return null;
  return <span className={'study-butler ' + variant + ' ' + mood} role="img" aria-label={'Alfred de Estudos · ' + moods[mood]}>
    <span className="study-butler-figure"><img src={import.meta.env.BASE_URL + 'studies/butler.webp'} width="420" height="630" alt="" />
      <i className="eye left" /><i className="eye right" /></span>
  </span>;
}
