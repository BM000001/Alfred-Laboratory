# Fluxo de trabalho para agentes de IA

**Política canônica:** [PROCESSO_IAS.md](PROCESSO_IAS.md), com instruções rápidas em [AGENTS.md](../AGENTS.md). Este arquivo contém detalhes complementares do Laboratory; em caso de conflito, prevalece o processo v2.2. Concorrência de implementações exige autorização e reserva verificável, não apenas consulta às branches.

## Objetivo
Coordenar desenvolvimento no Laboratory sem retrabalho e sem colocar `BM000001/Alfred` em risco.

## Branches
- `main`: base padrão de código, testes, regras e documentação do Laboratório.
- `develop-app`: branch legada de integração antiga; manter para referência e migração seletiva, não iniciar novos PRs a partir dela por padrão.
- `baseline/alfred-main`: snapshot de referência, somente leitura.
- `experiment/<assunto>`: trabalho isolado por tarefa ou agente.
- `fix/<assunto>`: correções isoladas.

## Regras
- Confirme repositório, branch e escopo antes de editar.
- Trabalhe somente no escopo solicitado.
- Preserve APIs, componentes, rotas, estilos, dados e integrações existentes.
- Não substitua arquivos inteiros quando uma alteração localizada for suficiente.
- Não faça merge, rebase destrutivo, force-push ou exclusão de branches sem autorização explícita.
- Não altere o repositório original `BM000001/Alfred`.
- Não inclua tokens, chaves, certificados, cookies ou dados pessoais reais.
- Se encontrar conflito arquitetural, documente e peça revisão em vez de apagar código.
- Não trate a branch `baseline/alfred-main` como destino de commits ou PRs.
- Não promova alterações de `develop-app` para `main` automaticamente; seus históricos não têm ancestral comum. Porte mudanças úteis por novos PRs derivados da `main`.

## Validação obrigatória
Antes de abrir PR:
1. Execute os testes e build aplicáveis disponíveis (lint somente quando configurado; `package.json` atual não define `npm run lint`).
2. Informe os comandos executados e resultados reais.
3. Liste os arquivos alterados.
4. Explique impacto visual e funcional.
5. Registre riscos, limitações e plano de reversão.
6. Confirme que nenhuma funcionalidade não relacionada foi removida.

Se algum teste não puder ser executado, declare isso. Nunca informe que passou sem executar.

## Integração

1. Registre na Issue o repositório, a base real e o destino do PR. Para novos trabalhos de app e documentação, o padrão é `main` do Laboratory como base e destino; exceções, como PR empilhado em dependência ainda aberta, exigem justificativa e revisão explícitas.
2. Abra branch isolada antes de editar; não use `baseline/alfred-main` como destino de alterações.
3. Abra Draft PR para a branch de destino definida na Issue, registrando SHA, testes, CI e `## Handoff`.
4. Aguarde revisão e aprovação do proprietário; resolva ajustes preferencialmente no mesmo PR.
5. Faça merge somente após aprovação explícita, verificações aplicáveis e checagem de dependências.
6. Mudanças ainda úteis de `develop-app` devem ser comparadas ao código atual e **portadas seletivamente** em novas branches derivadas da `main`, com PR separado por comportamento; não mesclar os históricos inteiros.
7. A integração no `BM000001/Alfred` exige PR e autorização próprios. Nenhuma regra aqui a executa automaticamente.
8. Limpeza de branches/arquivos somente após auditoria de dependências e aprovação para ações destrutivas.

## Proteção recomendada para `main` do Laboratory
Configure uma regra de branch no GitHub em **Settings → Rules → Rulesets** (ou **Settings → Branches**, conforme a interface disponível).

- Nome sugerido: `Protect Laboratory main`.
- Alvo: branch `main` do `BM000001/Alfred-Laboratory`.
- Exigir pull request antes de mesclar.
- Exigir que as verificações passem antes de mesclar.
- Selecionar as verificações realmente presentes no CI atual; exemplo verificado: workflow **Laboratory iPhone homologation build**, job **validate-and-package**. Confirmar o nome exato antes de tornar obrigatório.
- Bloquear force-push.
- Bloquear exclusão da branch.
- Não exigir quantidade de aprovações maior que zero sem antes garantir que haverá outro revisor; em repositório individual isso pode impedir o próprio autor de integrar PRs.

Depois de salvar, abra a regra novamente e confirme que o padrão de branch e a verificação obrigatória estão selecionados. A branch `baseline/alfred-main` deve continuar sendo tratada como referência somente leitura.

> Observação: a documentação não significa que a proteção já esteja ativa. A configuração precisa ser salva por uma conta com permissão administrativa no GitHub e verificada na interface do repositório.

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
