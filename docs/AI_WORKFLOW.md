# Fluxo de trabalho para agentes de IA

## Objetivo

Permitir que várias IAs trabalhem em paralelo no Alfred-Laboratory sem colocar o repositório principal em risco.

## Branches

- `main`: base ativa e destino dos Pull Requests do laboratório.
- `develop-app`: branch legada; não use como base ou destino até ser reparada.
- `baseline/alfred-main`: snapshot de referência, somente leitura.
- `feat/<assunto>`, `fix/<assunto>` ou `experiment/<assunto>`: trabalho isolado por tarefa.

## Regras

- Confirme repositório, branch, estado do Git e PRs abertos antes de editar.
- Crie branches de trabalho a partir de `main` e abra PRs para `main`.
- Trabalhe somente no escopo solicitado.
- Preserve APIs, componentes, rotas, estilos, dados e integrações existentes.
- Não substitua arquivos inteiros quando uma alteração localizada for suficiente.
- Não faça merge, rebase destrutivo, force-push ou exclusão de branches sem autorização explícita.
- Não altere o repositório original `BM000001/Alfred`.
- Não inclua tokens, chaves, certificados, cookies ou dados pessoais reais.
- Se encontrar conflito arquitetural, documente e peça revisão em vez de apagar código.
- Não trate `baseline/alfred-main` como destino de commits ou PRs.
- Considere `develop-app` legada até ser reparada e validada.

## Uso de agentes

- A equipe possui oito papéis descritos em [EQUIPE-AGENTES.md](EQUIPE-AGENTES.md). Implementer pode editar e QA pode escrever testes sob atribuição; os demais recebem instruções de leitura.
- O agente principal coordena as decisões e atribui posse exclusiva da escrita a um agente por vez no checkout.
- Paralelize perguntas independentes; revise um SHA estável e execute implementação e escrita de testes em sequência.
- Use as skills ECC pertinentes quando o plugin estiver disponível; não afirme que foram usadas se a sessão não as carregou.
- Agentes do Codex só atuam durante uma sessão e uma tarefa. Não são serviços contínuos ou execução em segundo plano.
- Consulte [docs/ECC-SETUP.md](ECC-SETUP.md) para instalação e limites.

## Validação

Antes de abrir PR com mudanças de aplicação:
1. Execute os testes, lint e build disponíveis e pertinentes.
2. Informe comandos executados e resultados reais.
3. Liste os arquivos alterados.
4. Explique impacto visual e funcional.
5. Registre riscos, limitações e plano de reversão.
6. Confirme que nenhuma funcionalidade não relacionada foi removida.

Se algum teste não puder ser executado, declare isso. Nunca informe que passou sem executar.

Mudanças apenas de documentação e configuração devem receber revisão do diff e validação de sintaxe pertinente; não exigem executar a suíte inteira do Alfred sem motivo.

## Integração

1. Crie uma branch por tarefa a partir de `main`.
2. Abra um PR para `main`.
3. Aguarde revisão e resolva os comentários.
4. Faça merge somente após autorização explícita.
5. A promoção para o repositório original exige PR próprio e autorização explícita.

## Modelo de entrega

- Objetivo:
- Branch de origem:
- Branch de trabalho:
- Arquivos alterados:
- Funcionalidades preservadas:
- Testes executados:
- Resultado do build:
- Riscos conhecidos:
- Plano de reversão:
- PR:
