import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import App from './App';

describe('App', () => {
  it('exibe a identidade e a mensagem inicial do Alfred', async () => {
    render(<App />);

    expect(screen.getByRole('link', { name: /alfred, início/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /alfred, início/i }).querySelector('img')).toHaveAttribute('src', expect.stringContaining('brand/alfred-mark.svg'));
    expect(screen.getByRole('heading', { name: /bom dia\.|boa tarde\.|boa noite\./i })).toBeInTheDocument();
    expect(await screen.findByText('PENDENTES')).toBeInTheDocument();
    expect(await screen.findByText('EM ATRASO')).toBeInTheDocument();
    expect(await screen.findByText('COMPROMISSOS HOJE')).toBeInTheDocument();
  });

  it('exibe o mascote do designer no Assistente com estado acessível', () => {
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: /^alfred$/i }));
    expect(screen.getByRole('img', { name: 'Alfred: Disponível' })).toBeInTheDocument();
  });

  it('permite navegar entre as áreas principais', () => {
    render(<App />);

    fireEvent.click(screen.getByRole('button', { name: /^organização$/i }));
    fireEvent.click(screen.getByRole('button', { name: /^calendário$/i }));
    expect(screen.getByRole('heading', { name: 'Organização' })).toBeInTheDocument();
    expect(screen.getByText(/compromissos, eventos e prazos/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /^estudos$/i }));
    expect(screen.getByRole('heading', { name: 'Estudos' })).toBeInTheDocument();
  });

  it('abre a Agenda funcional e permite iniciar um novo compromisso', async () => {
    render(<App />);

    fireEvent.click(screen.getByRole('button', { name: /^organização$/i }));
    fireEvent.click(screen.getByRole('button', { name: /^calendário$/i }));

    expect(await screen.findByText('CALENDÁRIO CENTRAL')).toBeInTheDocument();
    expect(screen.getByRole('grid', { name: 'Calendário semanal' })).toBeInTheDocument();
    expect(await screen.findByRole('button', { name: /novo compromisso/i })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /novo compromisso/i }));
    expect(screen.getByRole('heading', { name: 'O que está marcado?' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Salvar compromisso' })).toBeInTheDocument();
  });

  it('abre a área funcional de tarefas', async () => {
    render(<App />);

    fireEvent.click(screen.getByRole('button', { name: /^organização$/i }));
    fireEvent.click(screen.getByRole('button', { name: /^tarefas$/i }));

    expect(await screen.findByRole('heading', { name: 'O que precisa ser feito?' })).toBeInTheDocument();
    expect(await screen.findByRole('button', { name: 'Adicionar tarefa' })).toBeInTheDocument();
  });

  it('abre a área funcional de projetos', async () => {
    render(<App />);

    fireEvent.click(screen.getByRole('button', { name: /^projetos$/i }));

    expect(await screen.findByRole('heading', { name: 'Um objetivo de cada vez.' })).toBeInTheDocument();
    expect(await screen.findByRole('button', { name: 'Criar projeto' })).toBeInTheDocument();
  });

  it('permite cadastrar disciplina e conteúdo em Estudos', async () => {
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: /^estudos$/i }));

    fireEvent.change(await screen.findByLabelText('Nome'), { target: { value: 'Estrutura de Dados' } });
    fireEvent.click(screen.getByRole('button', { name: 'Criar disciplina' }));
    expect(await screen.findByRole('button', { name: /Estrutura de Dados/ })).toBeInTheDocument();

    fireEvent.change(await screen.findByLabelText('Novo conteúdo ou tópico'), { target: { value: 'Listas encadeadas' } });
    fireEvent.click(screen.getByRole('button', { name: 'Adicionar conteúdo' }));
    expect(await screen.findByText('Listas encadeadas', { selector: 'strong' })).toBeInTheDocument();
  });
  it('permite editar o nome e a descrição de uma disciplina', async () => {
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: /^estudos$/i }));
    fireEvent.change(await screen.findByLabelText('Nome'), { target: { value: 'Matemática para edição' } });
    fireEvent.change(screen.getByLabelText(/Descrição/), { target: { value: 'Estudo inicial' } });
    fireEvent.click(screen.getByRole('button', { name: 'Criar disciplina' }));
    fireEvent.click(await screen.findByRole('button', { name: /Matemática para edição/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Editar disciplina' }));

    fireEvent.change(screen.getByLabelText('Nome'), { target: { value: 'Matemática Discreta' } });
    fireEvent.change(screen.getByLabelText(/Descrição/), { target: { value: '' } });
    fireEvent.click(screen.getByRole('button', { name: 'Salvar disciplina' }));

    expect(await screen.findByRole('heading', { name: 'Matemática Discreta' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Matemática' })).not.toBeInTheDocument();
  });

  it('permite editar um conteúdo de estudo sem duplicá-lo', async () => {
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: /^estudos$/i }));
    fireEvent.change(await screen.findByLabelText('Nome'), { target: { value: 'Matemática tópicos' } });
    fireEvent.click(screen.getByRole('button', { name: 'Criar disciplina' }));
    fireEvent.click(await screen.findByRole('button', { name: /Matemática tópicos/ }));
    fireEvent.change(await screen.findByLabelText('Novo conteúdo ou tópico'), { target: { value: 'Funções' } });
    fireEvent.click(screen.getByRole('button', { name: 'Adicionar conteúdo' }));
    expect(await screen.findByText('Funções', { selector: 'strong' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Editar' }));
    fireEvent.change(screen.getByLabelText('Editar conteúdo ou tópico'), { target: { value: 'Funções quadráticas' } });
    fireEvent.click(screen.getByRole('button', { name: 'Salvar alterações' }));

    expect(await screen.findByText('Funções quadráticas', { selector: 'strong' })).toBeInTheDocument();
    expect(screen.queryByText('Funções', { selector: 'strong', exact: true })).not.toBeInTheDocument();
  });

  it('impede envio da Agenda com data inválida sem lançar erro', async () => {
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: /^organização$/i }));
    fireEvent.click(screen.getByRole('button', { name: /^calendário$/i }));
    fireEvent.click(await screen.findByRole('button', { name: /novo compromisso/i }));

    fireEvent.change(screen.getByLabelText('Início'), { target: { value: '' } });
    fireEvent.submit(screen.getByRole('button', { name: 'Salvar compromisso' }).closest('form')!);

    expect(await screen.findByRole('alert')).toHaveTextContent('Informe datas e horários válidos');
  });

  it('permite editar um compromisso existente sem criar um segundo registro', async () => {
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: /^organização$/i }));
    fireEvent.click(screen.getByRole('button', { name: /^calendário$/i }));
    fireEvent.click(await screen.findByRole('button', { name: /novo compromisso/i }));

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
    fireEvent.click(screen.getByRole('button', { name: /^estudos$/i }));
    fireEvent.change(await screen.findByLabelText('Nome'), { target: { value: 'Disciplina da biblioteca' } });
    fireEvent.click(screen.getByRole('button', { name: 'Criar disciplina' }));
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

