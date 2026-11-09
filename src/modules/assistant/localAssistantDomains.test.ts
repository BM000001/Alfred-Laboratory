import { describe, expect, it } from 'vitest';
import { LocalAssistantProvider } from './localAssistant';
import type { AssistantRequest } from './contracts';
import type { Appointment } from '../agenda/types';
import type { StudyTopic } from '../studies/types';

const request = (content: string): AssistantRequest => ({
  messages: [{ id: 'query', role: 'user', content, createdAt: '2026-11-09T12:00:00.000Z' }],
  context: { locale: 'pt-BR', now: '2026-11-09T12:00:00.000Z', timezone: 'America/Sao_Paulo' },
});

const now = new Date('2026-11-09T12:00:00.000Z');

describe('Consultas locais por domínio do Alfred', () => {
  it('mostra somente compromissos futuros agendados e não modifica os registros', async () => {
    const appointments: Appointment[] = [
      { id: 'past', title: 'Reunião passada', type: 'other', status: 'scheduled', startsAt: '2026-11-08T12:00:00.000Z', endsAt: '2026-11-08T13:00:00.000Z', createdAt: '2026-11-01T12:00:00.000Z' },
      { id: 'future', title: 'Consulta futura', type: 'personal', status: 'scheduled', startsAt: '2026-11-10T12:00:00.000Z', endsAt: '2026-11-10T13:00:00.000Z', createdAt: '2026-11-01T12:00:00.000Z' },
      { id: 'cancelled', title: 'Evento cancelado', type: 'other', status: 'cancelled', startsAt: '2026-11-11T12:00:00.000Z', endsAt: '2026-11-11T13:00:00.000Z', createdAt: '2026-11-01T12:00:00.000Z' },
    ];
    const before = structuredClone(appointments);
    const provider = new LocalAssistantProvider({ tasks: [], appointments, topics: [], now });

    const result = await provider.generate(request('Quais compromissos tenho na agenda?'));

    expect(result.usedTools).toEqual(['agenda.upcoming']);
    expect(result.message).toContain('Consulta futura');
    expect(result.message).not.toContain('Reunião passada');
    expect(result.message).not.toContain('Evento cancelado');
    expect(result.warnings).toContain('Consulta somente leitura. Nenhum dado foi alterado.');
    expect(appointments).toEqual(before);
  });

  it('resume o progresso dos estudos sem alterar os tópicos locais', async () => {
    const topics: StudyTopic[] = [
      { id: 'one', disciplineId: 'math', title: 'Álgebra', status: 'completed', createdAt: '2026-11-01T12:00:00.000Z' },
      { id: 'two', disciplineId: 'math', title: 'Geometria', status: 'pending', createdAt: '2026-11-01T12:00:00.000Z' },
    ];
    const before = structuredClone(topics);
    const provider = new LocalAssistantProvider({ tasks: [], appointments: [], topics, now });

    const result = await provider.generate(request('Como está meu progresso nos estudos?'));

    expect(result.usedTools).toEqual(['studies.progress']);
    expect(result.message).toContain('1 de 2 tópico(s) concluído(s).');
    expect(result.message).toContain('Álgebra — concluído');
    expect(result.message).toContain('Geometria — pendente');
    expect(result.warnings).toContain('Consulta somente leitura. Nenhum dado foi alterado.');
    expect(topics).toEqual(before);
  });

  it('não consulta outros domínios quando a pergunta é somente sobre agenda', async () => {
    const provider = new LocalAssistantProvider({
      tasks: [{ id: 'task', title: 'Tarefa confidencial', status: 'pending', priority: 'high', createdAt: '2026-11-01T12:00:00.000Z' }],
      appointments: [], topics: [], now,
    });

    const result = await provider.generate(request('Tenho compromissos na agenda?'));

    expect(result.usedTools).toEqual(['agenda.upcoming']);
    expect(result.message).toContain('Nenhum compromisso futuro encontrado.');
    expect(result.message).not.toContain('Tarefa confidencial');
  });
});
