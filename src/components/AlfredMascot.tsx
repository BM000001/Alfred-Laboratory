export type AlfredMood = 'idle' | 'thinking' | 'curious' | 'warning' | 'success';

const moodLabels: Record<AlfredMood, string> = {
  idle: 'Disponível',
  thinking: 'Pensando',
  curious: 'Aguardando sua confirmação',
  warning: 'Atenção necessária',
  success: 'Ação concluída',
};

export function AlfredMascot({ mood = 'idle', compact = false }: { mood?: AlfredMood; compact?: boolean }) {
  return (
    <div
      className={`alfred-mascot alfred-mascot--${mood} ${compact ? 'alfred-mascot--compact' : ''}`}
      role="img"
      aria-label={`Alfred: ${moodLabels[mood]}`}
    >
      <span className="alfred-mascot-aura" aria-hidden="true" />
      <img src={`${import.meta.env.BASE_URL}brand/alfred-mascot.svg`} alt="" />
      <span className="alfred-mascot-status" aria-hidden="true" />
    </div>
  );
}
