# Piloto ECC no desenvolvimento do Alfred

## Objetivo e escopo

Testar o ECC como conjunto opcional de ferramentas para quem desenvolve o Alfred. O piloto não altera o comportamento do aplicativo, não instala um modelo de IA e não cria agentes de execução contínua. O Alfred continua sem chamadas de IA remotas e sem backend obrigatório.

O ECC é uma dependência de ambiente de desenvolvimento, instalada no perfil do Codex usado no Codespace. Não copie o catálogo do ECC para o código do Alfred nem execute a instalação em `main`.

## Instalação no Codex CLI

No Codespace que contém este repositório, abra o terminal. Se o Codex CLI não estiver instalado, instale-o pelo pacote oficial e entre com sua conta ChatGPT quando iniciar `codex`:

```bash
npm install -g @openai/codex
codex --version
codex
```

Depois de autenticar, execute o caminho nativo documentado pelo ECC:

```bash
codex plugin marketplace add affaan-m/ECC
codex plugin add ecc@ecc
codex plugin list --json
```

Os comandos modificam a configuração do Codex no ambiente atual, não o Alfred. Comece uma nova sessão do Codex após a instalação. Para atualizar depois:

```bash
codex plugin marketplace upgrade ecc
codex plugin add ecc@ecc
```

Se o CLI pedir confiança para hooks, MCPs ou outras permissões, revise cada item antes de aceitar. O piloto pode ser avaliado sem habilitar hooks que não tenham sido revisados. Não use o fluxo legado de sincronização para `~/.codex` junto com o plugin nativo.

## Fluxo de avaliação

1. Escolha uma tarefa pequena e real do roadmap ou uma correção reproduzível, sem criar dados fictícios.
2. Peça ao Codex para planejar a mudança e selecionar somente os agentes/skills ECC necessários.
3. Para mudança de código, use o fluxo TDD: reproduza a falha ou escreva o teste, implemente o menor ajuste e rode `npm test`.
4. Peça uma revisão independente de segurança e diff; verifique as observações manualmente.
5. Rode `npm run build`, revise a branch e abra um PR para `develop-app`.
6. Compare o resultado com o fluxo atual: arquivos alterados, testes/build, problemas encontrados pela revisão e passos manuais que ainda ficaram para Brian.

## Critérios para continuar usando

- A instalação aparece no Codex (`codex plugin list --json`) e a sessão consegue carregar skills ECC.
- O fluxo ajuda a completar uma tarefa real, sem alterar o escopo ou as decisões do produto.
- Testes, build e revisão do diff continuam verificáveis pelo CI.
- Não exige permissões mais amplas do que as necessárias nem envia código/dados pessoais para serviços fora do fluxo de desenvolvimento autorizado.

Se algum requisito falhar, suspenda o plugin nessa sessão e continue com o fluxo documentado em `docs/AI_WORKFLOW.md`. Não conclua que ECC foi validado apenas porque a instalação terminou.

## Limitações conhecidas

- O plugin ECC não substitui os workflows agendados do GitHub nem faz o trabalho avançar sozinho em segundo plano.
- Os agentes e skills dependem do Codex CLI e do provedor/modelo disponíveis no Codespace; a licença aberta do ECC não fornece computação de IA.
- Os testes do GitHub Actions validam o Alfred. Eles não medem, por si só, a qualidade do ECC; essa avaliação exige uma tarefa real usando o plugin.
