# Instruções compartilhadas para agentes — Alfred Laboratory

Este arquivo é o ponto de entrada. A política canônica está em [docs/PROCESSO_IAS.md](docs/PROCESSO_IAS.md); detalhes históricos e regras do ambiente estão em [docs/AI_WORKFLOW.md](docs/AI_WORKFLOW.md) e [CLAUDE.md](CLAUDE.md).

## Antes de escrever código
1. Identifique **repositório, issue, branch de origem, branch de destino e autorização**. `BM000001/Alfred-Laboratory` e `BM000001/Alfred` são repositórios diferentes.
2. Consulte a issue, os PRs/branches relacionados, a documentação relevante e o código existente. Parta do que já está implementado; não duplique trabalho.
3. Registre escopo, critérios de aceite, dependências, módulos e responsável na issue. Confira reserva/conflitos de execução conforme `docs/PROCESSO_IAS.md`; sem reserva confirmada, não inicie trabalho concorrente.
4. Crie/use branch isolada **antes** da primeira edição. Para app, verifique se a base correta é `develop-app` ou outra indicada; para documentação estável, geralmente `main`. Não use `baseline/alfred-main` como destino.
5. Mudanças estruturais de alto risco exigem plano técnico aprovado antes de codificar.

## Durante a execução
- Limite-se ao escopo autorizado; preserve funcionalidades e dados existentes. Commits pequenos, reversíveis e com mensagem clara.
- Nunca publique segredos, tokens, dados reais, conteúdo pessoal ou credenciais. Mantenha privacidade local-first e confirmação antes de ações externas.
- Execute os comandos **disponíveis e aplicáveis**: `npm test`, `npm run build` e `npm run build:pages`, conforme a área e o ambiente. O repositório **não possui script npm lint** no `package.json` atual; não invente execução de lint.
- Após três tentativas **sem progresso no mesmo erro**, interrompa esse caminho, documente evidências e bloqueio; não repita comandos sem mudança de hipótese.
- Preserve checkpoints remotos quando possível. **Commit local, execução em nuvem e PR publicado são estados diferentes.** Se não houver push/API, informe claramente o que não foi publicado.
- Ao encerrar ou interromper, entregue um `## Handoff` conforme o processo, com links/SHAs confirmados, testes reais e próximo passo.

## Revisão e integração
- Prepare Draft PR, CI e prévia quando configurados; não confunda PR com site implantado nem build com homologação em Safari físico.
- **Não faça merge na `main` de `BM000001/Alfred` sem aprovação explícita.** Grandes mudanças passam primeiro pelo Laboratory para teste do proprietário.
- Não faça merge, force-push, reset destrutivo, exclusão de arquivos/branches ou limpeza de trabalhos dependentes sem autorização aplicável.
- Não declare tarefa concluída após apenas escrever código. Registre se houve revisão, teste, autorização, integração no destino correto e encerramento.
