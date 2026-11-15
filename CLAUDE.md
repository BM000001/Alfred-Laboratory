# Instruções de desenvolvimento — Alfred

## Missão
Desenvolver o Alfred, um assistente pessoal inteligente, elegante e proativo, que centraliza estudos, agenda, tarefas, projetos, arquivos e produtividade.

## Antes de começar qualquer sessão
1. Leia [AGENTS.md](AGENTS.md) e consulte [docs/PROCESSO_IAS.md](docs/PROCESSO_IAS.md) como política canônica.
2. Leia a Issue acionada, os PRs e branches relacionados; confirme repositório, base, destino, reserva e autorização.
3. Consulte `README.md`, `CONTINUIDADE.md` e apenas os documentos técnicos relevantes.
4. Preserve o estado do Git e o que já existe antes de editar.

## Princípios obrigatórios
- Preserve a visão do produto e as decisões documentadas.
- Prefira soluções simples, modulares, testáveis e acessíveis.
- Explique decisões técnicas relevantes em linguagem clara.
- Não invente funcionalidades como se já estivessem implementadas.
- Não apague nem substitua trabalho existente sem necessidade e autorização.
- Não exponha dados pessoais em logs, exemplos, commits ou documentação.
- Não envie dados pessoais para serviços externos sem consentimento explícito.
- Não adicione dependências sem justificar sua necessidade.
- Não use segredos, tokens ou chaves de API no código ou no Git.
- Mantenha a interface responsiva, com prioridade para dispositivos móveis.

## Autonomia e segurança
O Alfred pode analisar, recomendar e preparar ações. Não pode criar, editar, excluir, concluir ou adiar tarefas e compromissos do usuário sem aprovação explícita.
Antes de uma ação externa ou irreversível, apresente o que será feito e peça confirmação.
Nunca simule que uma integração ou ação foi concluída.

## Desenvolvimento
- Use TypeScript com tipagem explícita sempre que possível.
- Mantenha componentes de interface separados das regras de negócio e do armazenamento.
- Centralize acesso a dados em serviços/repositórios próprios.
- Prefira armazenamento local-first.
- Trate estados de carregamento, vazio e erro.
- Considere acessibilidade: semântica, foco, contraste e áreas de toque.
- Escreva testes para regras de negócio e comportamentos importantes.
- Não considere uma tarefa concluída sem executar os testes e verificações aplicáveis.

## Fluxo de trabalho
1. Consulte código, Issue, PRs e dependências para evitar duplicação.
2. Registre objetivo/resultado esperado, reserva, módulos, base/destino e critério de aceite.
3. Crie branch isolada antes da programação e produza mudanças pequenas e verificáveis.
4. Execute testes, lint **somente se configurado** e build disponíveis/aplicáveis; registre resultados reais.
5. Revise o diff, publique checkpoint remoto quando o ambiente permitir, e abra Draft PR no destino autorizado.
6. Preserve o handoff com SHA, branch, PR, testes, código publicado ou não e próxima ação.
7. Aguarde avaliação explícita antes de merge e limpeza; atualize somente documentação impactada.

## Comunicação de progresso
Ao finalizar, informe:
- O que foi implementado.
- Quais arquivos foram alterados.
- Testes executados e resultados reais.
- Limitações ou pendências.
- Próxima tarefa recomendada.

Se não conseguir executar um teste, declare isso claramente.

## Salvamento obrigatório e prevenção de perda de trabalho

**Regra crítica: nenhum trabalho pode depender exclusivamente da memória da sessão da IA.**

- Faça checkpoints coerentes e commits na branch de trabalho quando o ambiente permitir. Nunca trabalhe diretamente na `main`.
- Antes de cada commit, revise `git status`, `git diff` e `git diff --staged`; preserve alterações preexistentes e não inclua segredos nem dados pessoais.
- **Quando houver Git/push autorizado:** confirme que o push terminou com sucesso e que o SHA remoto corresponde ao trabalho antes de afirmar que o checkpoint está salvo no GitHub.
- **Quando a execução em nuvem não tiver push nem API GitHub:** mantenha a execução recuperável pela interface disponível, informe **não publicado** no handoff e use o fluxo de **Create PR** real se existir. Não confunda commit local, PR aberto e publicação remota.
- Se uma sessão tiver de ser interrompida sem publicação, forneça o identificador da sessão, branch, commit local e instrução de recuperação; gere um patch local quando isso for viável e registre explicitamente a fragilidade do ambiente temporário.
- Atualize `CONTINUIDADE.md` apenas quando uma mudança de estado relevante do projeto o exigir; o registro principal da tarefa fica na Issue/PR.
- Nunca descarte alterações para limpar a árvore de trabalho. Não use `git reset --hard`, `git clean -fd`, force-push ou exclusão sem autorização explícita.
- O CI valida código; não salva alterações locais. Só trate a implementação como **publicada** após evidência remota real.
- Ao encerrar, entregue o `## Handoff` padronizado de `docs/PROCESSO_IAS.md`; distinga código finalizado, aprovado, integrado e tarefa administrativamente encerrada.
