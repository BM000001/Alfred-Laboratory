# Processo de Desenvolvimento com IAs — Alfred

**Versão:** 2.2 — piloto operacional  
**Situação:** política proposta em branch e PR de revisão; só passa a valer após integração autorizada.  
**Objetivo:** reduzir retrabalho, disputas de código, perda de contexto, loops de erro e branches órfãs sem ampliar custos ou burocracia.

## 1. Fonte de verdade e limites
- **GitHub** é a fonte compartilhada das tarefas: Issue (intenção e estado), PR (código e revisão) e comentário padronizado de Handoff (continuidade). O histórico de chat não é uma fonte durável. O código só está publicado quando houver push/commit remoto confirmado.
- As IAs executam apenas tarefas **explicitamente acionadas** pelo proprietário ou por uma automação previamente autorizada e configurada; registrar uma Issue não dispara agente por si só.
- `AGENTS.md` é o mapa curto; este documento define o procedimento. `CLAUDE.md`, `docs/AI_WORKFLOW.md` e `docs/PROTOCOLO-SALVAMENTO.md` contêm orientações complementares. Regras de segurança mais restritivas continuam valendo.
- **Repositórios diferentes:** `BM000001/Alfred-Laboratory` é o ambiente de experimentação; `BM000001/Alfred` é o produto principal. `main`, `develop-app` e `baseline/alfred-main` são branches do Laboratório, não um repositório separado. Nunca escrever na baseline.
- **Não inferir implantação:** push, PR aberto, CI verde, prévia publicada, aprovação em Safari e merge são evidências distintas.

## 2. Estados (Issue)
- **Planejada:** escopo e critérios claros; ainda não há execução autorizada ativa.
- **Em execução:** agente acionado e reserva registrada; implementação ou correção em andamento.
- **Bloqueada:** dependência, decisão pendente, ambiente inacessível ou 3 tentativas sem progresso contra a mesma causa.
- **Em revisão:** PR publicado, testes obrigatórios efetivamente verificados e prévia disponível **quando aplicável**; aguarda decisão do proprietário. Se não há CI configurado, marcar essa limitação em vez de afirmar que passou.
- **Concluída:** objetivo da Issue entregue no seu destino **declarado**, com aprovação/merge aplicáveis e pendências documentadas. Não exige que uma branch tenha sido apagada.

Registrar os estados com labels **se existirem**, ou no corpo/comentários da Issue; não criar estados contraditórios. Uma solicitação de ajustes retorna de Em revisão para Em execução na mesma Issue e, preferencialmente, no mesmo PR. A Issue pode ser concluída pela entrega no Laboratório **se esse era seu escopo**; promoção ao Alfred principal precisa de rastreamento separado. A aprovação do proprietário nunca pode ser inferida de um status verde.

## 3. Fluxo de execução

### Etapa 1 — Acionamento, inspeção e prevenção de duplicação
O proprietário informa a tarefa ou Issue. Antes de tocar no código, o agente confere `AGENTS.md`, arquivos afetados, documentação necessária, Issues e PRs abertos, branches, dependências e status de Git. Reaproveita o que já existe. Se encontrar implementação equivalente, **não** abre outra: documenta e pede direcionamento ou retoma a entrega autorizada existente.

### Etapa 2 — Escopo e reserva da tarefa
A Issue contém: objetivo, resultado verificável, critérios de aceite, repositório, branch de origem, branch de destino, módulos previstos, dependências, pessoa/IA responsável e status.

Registrar uma **reserva de execução** com: Issue, agente, link/ID de sessão quando houver, início UTC, última atualização UTC, módulos afetados, branch e PR associado. Verificar novamente a Issue imediatamente antes de codificar. A reserva em comentários é **coordenação por convenção, não lock atômico**; em caso de disputa ou reserva recente de outro agente, parar e escalar. Não retomar uma reserva abandonada automaticamente sem confirmação. Agentes em áreas independentes podem trabalhar em paralelo somente com isolamento e sem compartilhar arquivos críticos.

**Gates de risco:** mudanças em schema/banco, contratos de API ou mais de cinco arquivos centrais exigem plano técnico e aprovação prévia. Mudanças acima de aproximadamente 400 linhas ou vários módulos independentes pedem avaliação de fatiamento, **não divisão mecânica**. Correções dentro de escopo já autorizado não precisam de aprovações repetidas.

### Etapa 3 — Preparação da branch e implementação
Criar a branch **antes** do código, a partir da base explicitada na Issue (não presumir `main`): `codex/<issue>-resumo` ou `ia/<issue>-resumo`. Mudanças do app no Laboratório podem usar `develop-app` ou `main` conforme integração existente e objetivo; nunca a baseline somente leitura.

Implementar de forma incremental, manter commits rastreáveis e não sobrepor alterações alheias. Executar comandos disponíveis no repositório (atualmente `npm test` e `npm run build` para o app; `lint` apenas se existir). Testes de CI e testes locais são registrados separadamente. Não inventar execução nem resultado de teste.

**Circuit Breaker:** após **3 tentativas consecutivas, sem avanço verificável, para a mesma causa**, interromper tentativas repetitivas; guardar logs úteis sem segredos, descrever hipóteses e testes, registrar Handoff e mover para Bloqueada. Não contar três erros distintos como um único ciclo; é permitido corrigir causas diferentes de modo controlado.

**Persistência:** fazer checkpoint pequeno com commit e push confirmado quando o ambiente permitir. Se não puder publicar, registrar **Código remoto: não** e indicar como recuperar o workspace/patch; não prometer que outra sessão acessará dados não enviados.

### Etapa 4 — PR, revisão e homologação
Publicar branch e abrir **Draft PR** na base correta; incluir link da Issue, escopo, arquivos, testes reais, riscos, reversão e Handoff. Abertura de PR depende das permissões/ferramentas disponíveis; não presumir botão `Create PR` ou API acessível.

O GitHub Actions só comprova CI se houver workflow/checks ativos e concluídos. Code Review automático e URL de preview também são **opcionais e dependem de configuração**. Para app/PWA, disponibilizar URL acessível pelo iPhone/Safari **quando existir infraestrutura de publicação**; branch/PR isoladamente não gera site.

Revisar diffs e CI disponível, resolver conflitos e só então colocar `Ready for Review`. O proprietário pode aprovar, pedir correções (na mesma branch/PR), rejeitar ou adiar. Rejeição não implica apagar trabalho; o PR fechado mantém histórico, e tag de preservação é opcional quando necessária.

### Etapa 5 — Integração autorizada
Confirmar testes exigidos, dependências integradas, destino correto e **aprovação explícita**. Não fazer merge só porque CI está verde. Uma integração em `Alfred-Laboratory` **não autoriza nem realiza** promoção para `BM000001/Alfred`; essa promoção exige PR/decisão própria e teste no iPhone conforme aplicável.

O texto `Closes #XX` deve ser usado com cuidado: fechamento automático do GitHub depende das condições do PR, especialmente merge na branch padrão do repositório da Issue. Para etapas intermediárias, preferir `Refs #XX` e atualizar manualmente o estado após conferir o resultado; referenciar Issues entre repositórios por URL completa.

### Etapa 6 — Encerramento e manutenção
Após merge confirmado: registrar PR e SHA da integração, atualizar apenas a documentação afetada, conferir comportamento e eventuais pendências. Marcar a Issue como Concluída **somente** se seu objetivo/ambiente de destino foi atingido. Criar Issue Planejada para débitos técnicos não abrangidos.

A manutenção contínua pode auditar duplicidades, documentos defasados, branches e PRs sem responsável. **Apagar branch/arquivo exige checagem de dependências e autorização expressa**; configurar exclusão automática de head branches é decisão separada. Não presumir exclusão nem bloquear conclusão só porque a limpeza ficou pendente.

## 4. Modelo de Handoff

Adicionar à Issue ou PR a cada interrupção, bloqueio ou entrega; reproduzir na resposta final da sessão quando necessário:

```markdown
## Handoff — AAAA-MM-DD HH:MM UTC — IA / sessão
- Issue: URL completa ou #XX (se no mesmo repositório)
- Status: Planejada | Em execução | Bloqueada | Em revisão | Concluída
- Repositório de trabalho:
- Base de origem / destino:
- Branch de trabalho:
- Commit SHA confirmado (ou "não publicado"):
- PR: URL ou "ainda não criado"
- Sessão/execução: link ou ID, quando disponível
- Reserva: agente, módulos, último checkpoint UTC
- Código remoto: Sim | Não | Parcial (com explicação)
- Feito:
- Pendente:
- Arquivos alterados:
- Testes locais: comando e resultado real / não executado + motivo
- CI: link/status verificado / indisponível
- Preview Safari: URL verificada / não disponível
- Decisões e riscos:
- Próxima ação exata:
```

## 5. Definição de pronto e limites de automação
- **Código escrito** ≠ **código publicado** ≠ **PR revisável** ≠ **aprovado** ≠ **integrado** ≠ **promovido ao Alfred principal**.
- Nenhuma automação de reserva, revisão, limpeza, agente recorrente ou preview é considerada implementada apenas porque está descrita aqui.
- Iniciar com o processo manual, templates e verificação de um PR real; automatizar apenas gargalos medidos, sem dependências pagas nem apagar trabalho. Preferir ferramentas GitHub já disponíveis.

## 6. Checklist de um piloto
1. Criar Issue com escopo, destino, critérios, dependências e reserva.
2. Criar branch isolada antes do código, guardar um checkpoint e verificar se outra sessão identifica a versão remota.
3. Abrir Draft PR, executar verificações disponíveis e registrar o que **não** foi testado.
4. Solicitar aprovação do proprietário e validar no destino correto.
5. Encerrar a Issue somente após verificação do resultado, sem exclusões automáticas.
