import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import App from './App';
import { create } from './testActions';
import { appointmentRepository, disciplineRepository, projectRepository, studyTopicRepository, taskRepository } from '../storage/repositories';

describe('App', () => {
  beforeEach(async () => {
    await Promise.all([appointmentRepository, disciplineRepository, projectRepository, studyTopicRepository, taskRepository]
      .map((repository) => repository.clear()));
  });

  it('exibe a identidade e a mensagem inicial do Alfred', async () => {
    render(<App />);

    expect(screen.getByRole('link', { name: /alfred, início/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /alfred, início/i }).querySelector('img')).toHaveAttribute('src', expect.stringContaining('brand/alfred-mark.svg'));
    expect(screen.getByRole('heading', { name: /bom dia\.|boa tarde\.|boa noite\./i })).toBeInTheDocument();
    expect(await screen.findByRole('heading', { name: 'Agenda' })).toBeVisible();
    expect(screen.queryByRole('heading', { name: 'Prioridades' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Conversar com Alfred' })).toBeVisible();
    expect(screen.queryByRole('heading', { name: 'Sugestões do Alfred' })).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Continuar estudando' })).not.toBeInTheDocument();
  });

  it('prioriza dados locais e retoma a unidade pendente da disciplina correta', async () => {
    const now = new Date();
    const createdAt = now.toISOString();
    const startsAt = new Date(now.getTime() + 3_600_000).toISOString();
    const endsAt = new Date(now.getTime() + 7_200_000).toISOString();
    await Promise.all([
      appointmentRepository.save({ id: 'event', title: 'Seminário de teste', type: 'class', status: 'scheduled', startsAt, endsAt, createdAt }),
      taskRepository.save({ id: 'urgent', title: 'Revisar fichamento', status: 'pending', priority: 'high', dueDate: '2000-01-01', projectId: 'project', createdAt }),
      taskRepository.save({ id: 'low', title: 'Tarefa de baixa prioridade', status: 'pending', priority: 'low', createdAt }),
      projectRepository.save({ id: 'project', name: 'Pesquisa sintética', status: 'active', createdAt }),
      disciplineRepository.save({ id: 'first', name: 'Anatomia', createdAt }),
      disciplineRepository.save({ id: 'study', name: 'Ecologia', createdAt }),
      studyTopicRepository.save({ id: 'unit', title: 'Ecossistemas', disciplineId: 'study', status: 'pending', sourceFileId: 'material', createdAt }),
    ]);

    render(<App />);
    expect(await screen.findByText('Seminário de teste')).toBeVisible();
    expect(screen.getByText('Revisar fichamento')).toBeVisible();
    expect(screen.queryByText('Tarefa de baixa prioridade')).not.toBeInTheDocument();
    expect(screen.queryByText('Pesquisa sintética')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Retomar estudo' }));
    expect(await screen.findByRole('heading', { name: 'Ecologia' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Materiais' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByLabelText('Unidade de estudo')).toHaveValue('unit');
  });

  it('abre na data de uma sugestão de prazo sem repeti-la nas prioridades', async () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const date = [tomorrow.getFullYear(), String(tomorrow.getMonth() + 1).padStart(2, '0'), String(tomorrow.getDate()).padStart(2, '0')].join('-');
    await taskRepository.save({ id: 'deadline', title: 'Entregar trabalho de teste', dueDate: date, createdAt: new Date().toISOString(), status: 'pending', priority: 'high' });
    render(<App />);
    expect(await screen.findByRole('heading', { name: 'Sugestões do Alfred' })).toBeVisible();
    expect(screen.queryByRole('heading', { name: 'Prioridades' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Ver tarefas do prazo' }));
    expect(screen.getByLabelText('Data')).toHaveValue(date);
    expect(await screen.findByRole('button', { name: 'Entregar trabalho de teste' })).toBeVisible();
  });

  it('apresenta uma única ação quando um estudo pendente vira sugestão', async () => {
    const previous = new Date(Date.now() - 7 * 86_400_000).toISOString();
    await disciplineRepository.save({ id: 'study', name: 'Ecologia', createdAt: previous });
    await studyTopicRepository.save({ id: 'unit', title: 'Ecossistemas', disciplineId: 'study', status: 'pending', sourceFileId: 'material', createdAt: previous });
    render(<App />);
    expect(await screen.findByText('Retome um estudo em andamento')).toBeVisible();
    expect(screen.queryByRole('heading', { name: 'Continuar estudando' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Retomar estudo' }));
    expect(await screen.findByLabelText('Unidade de estudo')).toHaveValue('unit');
  });

  it('exibe o mascote do designer no Assistente com estado acessível', () => {
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: /^alfred$/i }));
    expect(screen.getByRole('img', { name: 'Alfred: Disponível' })).toBeInTheDocument();
  });

  it('permite navegar entre as áreas principais', () => {
    render(<App />);

    fireEvent.click(screen.getByRole('button', { name: /^organização$/i }));
    expect(screen.getByRole('heading', { name: 'Organização' })).toBeInTheDocument();
    expect(screen.getByRole('grid', { name: 'Calendário semanal' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /^aprender$/i }));
    expect(screen.getByRole('heading', { name: 'Aprender' })).toBeInTheDocument();
  });

  it('abre a Agenda funcional e permite iniciar um novo compromisso', async () => {
    render(<App />);

    fireEvent.click(screen.getByRole('button', { name: /^organização$/i }));

    expect(await screen.findByText('CALENDÁRIO CENTRAL')).toBeInTheDocument();
    expect(screen.getByRole('grid', { name: 'Calendário semanal' })).toBeInTheDocument();
    create('Novo compromisso');
    expect(screen.getByRole('heading', { name: 'Novo compromisso' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Salvar compromisso' })).toBeInTheDocument();
  });

  it('abre Organização diretamente no calendário e mantém integrações em Configurações', async () => {
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: /^organização$/i }));
    expect(await screen.findByText('CALENDÁRIO CENTRAL')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Configurações' }));
    fireEvent.click(screen.getByRole('button', { name: 'Conexões de calendário' }));
    expect(screen.getByRole('heading', { name: 'Google Calendar' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Conectar Calendário Apple' })).toBeInTheDocument();
  });

  it('abre a área funcional de tarefas', async () => {
    render(<App />);

    fireEvent.click(screen.getByRole('button', { name: /^organização$/i }));
    expect(await screen.findByRole('heading', { name: 'Tarefas da data selecionada' })).toBeInTheDocument();
    create('Nova tarefa');
    expect(screen.getByRole('button', { name: 'Salvar tarefa' })).toBeInTheDocument();
  });

  it('abre a área funcional de projetos', async () => {
    render(<App />);

    fireEvent.click(screen.getByRole('button', { name: 'Alfred' }));
    fireEvent.click(screen.getByRole('button', { name: 'Projetos' }));
    expect(await screen.findByRole('heading', { name: 'Seus projetos' })).toBeInTheDocument();
    create('Novo projeto');
    expect(screen.getByRole('button', { name: 'Salvar projeto' })).toBeInTheDocument();
  });

  it('permite cadastrar disciplina e conteúdo em Estudos', async () => {
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: /^aprender$/i }));

    await screen.findByRole('heading', { name: 'Disciplinas' });
    create('Nova disciplina');
    fireEvent.change(screen.getByLabelText('Nome'), { target: { value: 'Estrutura de Dados' } });
    fireEvent.click(screen.getByRole('button', { name: 'Salvar disciplina' }));
    expect(await screen.findByRole('heading', { name: 'Estrutura de Dados' })).toBeInTheDocument();

    create('Nova unidade');
    fireEvent.change(screen.getByLabelText('Nome da unidade'), { target: { value: 'Listas encadeadas' } });
    fireEvent.click(screen.getByRole('button', { name: 'Salvar unidade' }));
    expect(await screen.findByText('Listas encadeadas', { selector: 'strong' })).toBeInTheDocument();
  });
  it('permite editar o nome e a descrição de uma disciplina', async () => {
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: /^aprender$/i }));
    await screen.findByRole('heading', { name: 'Disciplinas' });
    create('Nova disciplina');
    fireEvent.change(screen.getByLabelText('Nome'), { target: { value: 'Matemática para edição' } });
    fireEvent.change(screen.getByLabelText(/Descrição/), { target: { value: 'Estudo inicial' } });
    fireEvent.click(screen.getByRole('button', { name: 'Salvar disciplina' }));
    await screen.findByRole('heading', { name: 'Matemática para edição' });
    fireEvent.click(screen.getByText('Gerenciar disciplina'));
    fireEvent.click(screen.getByRole('button', { name: 'Editar disciplina' }));

    fireEvent.change(screen.getByLabelText('Nome'), { target: { value: 'Matemática Discreta' } });
    fireEvent.change(screen.getByLabelText(/Descrição/), { target: { value: '' } });
    fireEvent.click(screen.getByRole('button', { name: 'Salvar disciplina' }));

    expect(await screen.findByRole('heading', { name: 'Matemática Discreta' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Matemática' })).not.toBeInTheDocument();
  });

  it('permite editar um conteúdo de estudo sem duplicá-lo', async () => {
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: /^aprender$/i }));
    await screen.findByRole('heading', { name: 'Disciplinas' });
    create('Nova disciplina');
    fireEvent.change(screen.getByLabelText('Nome'), { target: { value: 'Matemática tópicos' } });
    fireEvent.click(screen.getByRole('button', { name: 'Salvar disciplina' }));
    await screen.findByRole('heading', { name: 'Matemática tópicos' });
    create('Nova unidade');
    fireEvent.change(screen.getByLabelText('Nome da unidade'), { target: { value: 'Funções' } });
    fireEvent.click(screen.getByRole('button', { name: 'Salvar unidade' }));
    expect(await screen.findByText('Funções', { selector: 'strong' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Editar' }));
    fireEvent.change(screen.getByLabelText('Nome da unidade'), { target: { value: 'Funções quadráticas' } });
    fireEvent.click(screen.getByRole('button', { name: 'Salvar unidade' }));

    expect(await screen.findByText('Funções quadráticas', { selector: 'strong' })).toBeInTheDocument();
    expect(screen.queryByText('Funções', { selector: 'strong', exact: true })).not.toBeInTheDocument();
  });

  it('impede envio da Agenda com data inválida sem lançar erro', async () => {
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: /^organização$/i }));
    create('Novo compromisso');

    fireEvent.change(screen.getByLabelText('Início'), { target: { value: '' } });
    fireEvent.submit(screen.getByRole('button', { name: 'Salvar compromisso' }).closest('form')!);

    expect(await screen.findByRole('alert')).toHaveTextContent('Informe datas e horários válidos');
  });

  it('permite editar um compromisso existente sem criar um segundo registro', async () => {
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: /^organização$/i }));
    create('Novo compromisso');

    fireEvent.change(screen.getByLabelText('Título'), { target: { value: 'Revisão de algoritmos' } });
    // Use a date in the currently displayed week; a fixed date becomes invisible over time.
    const today = new Date();
    const localDay = [today.getFullYear(), String(today.getMonth() + 1).padStart(2, '0'), String(today.getDate()).padStart(2, '0')].join('-');
    fireEvent.change(screen.getByLabelText('Início'), { target: { value: `${localDay}T08:00` } });
    fireEvent.change(screen.getByLabelText('Término'), { target: { value: `${localDay}T09:00` } });
    fireEvent.click(screen.getByRole('button', { name: 'Salvar compromisso' }));

    expect(await screen.findByRole('heading', { name: 'Revisão de algoritmos' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Editar' }));
    fireEvent.change(screen.getByLabelText('Título'), { target: { value: 'Revisão final de algoritmos' } });
    fireEvent.click(screen.getByRole('button', { name: 'Salvar alterações' }));

    expect(await screen.findByRole('heading', { name: 'Revisão final de algoritmos' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Revisão de algoritmos' })).not.toBeInTheDocument();
  });

  it('abre a biblioteca de arquivos', async () => {
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: /^aprender$/i }));
    await screen.findByRole('heading', { name: 'Disciplinas' });
    create('Nova disciplina');
    fireEvent.change(screen.getByLabelText('Nome'), { target: { value: 'Disciplina da biblioteca' } });
    fireEvent.click(screen.getByRole('button', { name: 'Salvar disciplina' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Unidades e materiais' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Materiais' }));
    expect(await screen.findByText('Sua biblioteca está vazia.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Materiais' })).toHaveAttribute('aria-current', 'page');
  });
  it('abre as configurações de backup e restauração', async () => {
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: /^configurações$/i }));
    expect(await screen.findByRole('heading', { name: 'Backup local' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Exportar backup JSON' })).toBeInTheDocument();
    expect(screen.getByLabelText('Selecionar arquivo de backup')).toHaveAttribute('type', 'file');
  });

});

