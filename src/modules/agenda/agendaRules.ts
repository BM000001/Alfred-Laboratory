import type { Appointment } from './types';

export function validateAppointment(input: Pick<Appointment, 'title' | 'startsAt' | 'endsAt'>): string | null {
  if (!input.title.trim()) return 'O título do compromisso é obrigatório.';

  const start = Date.parse(input.startsAt);
  const end = Date.parse(input.endsAt);
  if (!Number.isFinite(start) || !Number.isFinite(end)) return 'Informe datas e horários válidos.';
  if (end <= start) return 'O horário de término deve ser posterior ao início.';

  return null;
}

export function findAppointmentConflicts(
  appointments: Appointment[],
  candidate: Pick<Appointment, 'id' | 'startsAt' | 'endsAt'>,
): Appointment[] {
  const start = Date.parse(candidate.startsAt);
  const end = Date.parse(candidate.endsAt);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return [];

  return appointments.filter((appointment) => {
    if (appointment.id === candidate.id || appointment.status === 'cancelled') return false;
    const existingStart = Date.parse(appointment.startsAt);
    const existingEnd = Date.parse(appointment.endsAt);
    if (!Number.isFinite(existingStart) || !Number.isFinite(existingEnd)) return false;
    return start < existingEnd && end > existingStart;
  });
}

/** Infers a useful Agenda category from complete Portuguese title words. */
export function classifyImportedAppointment(title: string): Appointment['type'] {
  const words = new Set(
    title
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLocaleLowerCase('pt-BR')
      .split(/[^a-z0-9]+/)
      .filter(Boolean),
  );

  const hasAny = (terms: readonly string[]) => terms.some((term) => words.has(term));

  if (hasAny(['prova', 'provas', 'exame', 'exames', 'avaliacao', 'avaliacoes', 'vestibular', 'vestibulares', 'simulado', 'simulados'])) return 'exam';
  if (hasAny(['aula', 'aulas', 'materia', 'materias', 'disciplina', 'disciplinas', 'curso', 'cursos', 'palestra', 'palestras', 'seminario', 'seminarios', 'laboratorio', 'laboratorios'])) return 'class';
  if (hasAny(['prazo', 'prazos', 'entrega', 'entregas', 'deadline', 'deadlines', 'trabalho', 'trabalhos', 'atividade', 'atividades', 'vencimento', 'vencimentos', 'inscricao', 'inscricoes'])) return 'deadline';
  if (hasAny(['consulta', 'consultas', 'medico', 'medicos', 'dentista', 'dentistas', 'aniversario', 'aniversarios', 'viagem', 'viagens', 'ferias', 'academia', 'academias', 'treino', 'treinos'])) return 'personal';
  return 'other';
}

export function sortAppointmentsByStart(appointments: Appointment[]): Appointment[] {
  return [...appointments].sort(
    (a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt),
  );
}
