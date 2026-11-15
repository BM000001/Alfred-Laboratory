# Agente de desenvolvimento Alfred 24/7 — preparação segura

**Estado em 2026-11-15:** somente desenho técnico e ferramentas de diagnóstico. **Nenhum agente 24h, servidor, conta, credencial, automação ou cobrança foi ativado.**
**Rastreamento:** Issue #56. **Repositório único:** `BM000001/Alfred-Laboratory`. Não alterar `BM000001/Alfred`.

## 1. O que será construído (e o que não será)
Uma VM gratuita seria o **computador remoto** que mantém o coordenador do Alfred ligado enquanto o usuário não está conectado. Não é a IA: o software precisa ainda de um provedor de modelos, autorização de uso e cota. A meta **24h/7d é disponibilidade do supervisor**, não garantia de geração de código ou inferência durante 24 horas sem limites. Se uma tarefa terminar, não inventar trabalho.

O estado atual é **Fase 0**: preparação sem conta Oracle. Não há Codex/ECC real operando em background: PR #20 prepara perfis; PRs #23 e #33 preparam acionadores/roteadores **sem executar um modelo**. Estes PRs não devem ser mesclados automaticamente nem duplicados.

## 2. Arquitetura proposta (requer aprovação antes de implementar)

```text
[VM Linux ARM64 Oracle Always Free] -- systemd (supervisor sempre vivo)
   |-- coordenação (um escritor; política de autorização)
   |-- fila local durável (SQLite WAL; checkpoints; leases com prazo)
   |-- controlador de orçamento e rate limits (fail closed)
   |-- adaptador do executor IA (não existe conectado hoje)
   |-- worktree/checkout descartável por tarefa
   +-- logs estruturados sem segredos
         |
         +--> [GitHub Issues/PRs: fonte compartilhada, reservas, handoff]
         +--> [GitHub Actions: npm test e npm run build:pages]
         +--> [Provedor IA: somente após autenticação e aprovação]
```

### Componentes
- **Oracle Always Free**: preferir uma instância ARM64 Ampere A1 com quota elegível; confirmar região home, estoque e limites no momento do cadastro. Referência gratuita para conta Always Free: **2 OCPUs e 12 GB RAM agregados**, sujeita à documentação e disponibilidade da região. Oracle pode recuperar instâncias com baixa utilização; não tentar simular carga para contornar o critério.
- **Processo supervisor**: `systemd` + reinício limitado + usuário Linux dedicado, sem privilégios administrativos para o runtime. Não abrir porta de painel/HTTP na primeira fase.
- **Executor de desenvolvimento**: avaliar OpenCode CLI em modo não interativo, ou Codex autenticado legitimamente, com compatibilidade Linux ARM64 **a comprovar**. Nenhuma integração considerada disponível só porque existe uma CLI instalada.
- **GitHub**: usar credencial de menor privilégio possível e apenas no Laboratory, nunca token pessoal amplo. Proibir push direto para main por política do executor **e**, quando suportado, proteção no servidor; repositório público implica proteção contra injeção de prompts em issues/PRs.
- **CI**: reusar workflow `.github/workflows/lab-iphone-preview.yml` existente; testes remotos NÃO comprovam Safari físico nem publicação da branch. Usar `npm test` e `npm run build:pages` conforme projeto.
- **Persistência**: armazenamento interno na VM para reiniciar checkpoints, e estado auditável em Issue/PR. Prever backup que não exponha credenciais e restauração em VM nova; o armazenamento local da VM não é eterno.

## 3. Máquina de estados mínima
`queued -> claimed -> running -> validating -> draft_pr -> awaiting_review -> done`.
Exceções: `paused_no_provider`, `paused_quota`, `blocked`, `retryable_failure`, `cancelled`.

Cada trabalho inclui: `issue_id`, branch `ia/<issue>-<assunto>`, base SHA, arquivos/reserva, tentativa, timestamp de checkpoint, lease com prazo, orçamento usado, PR se criado e status de CI. A retomada compara o estado local com GitHub antes de modificar código. **Nunca** criar PR ou commit duplicado apenas porque houve reinicialização.

## 4. Política obrigatória (fail closed)
1. Sem aprovação de implantação, sem conta Oracle e sem provedor autorizado: **nenhuma operação externa**.
2. Um único escritor por worktree/área. Priorizar trabalho já aberto; não abrir tarefa que sobreponha PR em progresso.
3. Aceitar somente Issues explicitamente autorizadas e com área livre; entrada de Issues/PRs é **dado não confiável** e não pode virar comando de sistema sem validação.
4. 3 tentativas sem progresso no mesmo erro -> bloquear, preservar estado, comunicar causa; sem laço infinito.
5. Falta de cotas, chave, conectividade ou budget -> pausar. **Sem fallback para endpoint pago** ou cobrança não aprovada.
6. Não mesclar, publicar, excluir branches, alterar segredos, fazer force-push, mudar `BM000001/Alfred` ou modificar `main` automaticamente.
7. Logs: metadados técnicos, SHA, números de Issues/PRs e métricas; **nunca** prompt com dados pessoais, tokens, .env ou conteúdo privado sem consentimento.
8. IA pode propor alterações em branch isolada e Draft PR; usuário aprova a integração. Builds automáticos não substituem homologação no iPhone.

## 5. Critérios e orçamento
| Indicador | Meta para o piloto de 24h |
| --- | --- |
| Supervisor disponível | >=99% do período observado (meta, não SLA) |
| Retomar após reinício manual | Sim, sem PR/commit duplicado |
| Simulação de indisponibilidade de provedor | Entra em `paused_no_provider`; nenhuma chamada paga |
| Mudanças fora do Laboratory/main protegida | 0 |
| Credenciais nos logs ou commits | 0 |
| Tarefas reais | Pelo menos uma autorizada em Draft PR + testes, **se** houver cota e acesso |
| Relatório do piloto | tempo online, tempo em IA, tokens/cotas, tarefas efetivas, falhas e bloqueios |

Custo objetivo de infraestrutura: **R$ 0/mês**, condicional a VM elegível e serviços gratuitos. Energia de dispositivo próprio, câmbio, cotas de terceiros ou modelos pagos são custos separados; não prometemos 24 horas de IA gratuita. Definir mecanismo de limite rígido antes de conectar qualquer modelo com cobrança.

## 6. Etapas pendentes (nenhuma iniciada)
- [x] Inventário inicial: workflow de CI, documentação e PRs #20/#23/#33; detalhar risco de duplicação.
- [x] Registrar Issue #56 e preparar documentação técnica.
- [x] Preparar script **somente leitura** de preflight, sem instalação nem credenciais, com teste local.
- [ ] **Usuário:** criar conta Oracle Cloud pela página oficial e confirmar que não houve upgrade para conta paga.
- [ ] **Usuário/operador:** criar VM elegível na região home com quota e armazenamento gratuitos; conferir disponibilidade e arquitetura.
- [ ] Configurar servidor e credenciais em canal seguro após aprovação específica; manter processo desativado por padrão.
- [ ] Escolher provedor de IA autorizado e comprovar cota, privacidade, custo, autenticação e compatibilidade.
- [ ] Construir controlador de tarefas, estado durável, limites e watchdog na branch isolada.
- [ ] Executar piloto supervisionado de 24 horas, testar recovery e reportar medição real.
- [ ] Decisão explícita de colocação em operação. Nenhuma implantação automática.

## 7. Preparação utilizável sem conta
O `scripts/agent-24h/preflight.sh` confirma localmente ferramentas, arquitetura e o repositório de checkout **sem acessar a rede e sem escrever arquivos**. Ele **não instala** OpenCode, Codex ou dependências e não valida quotas/nuvem. O teste `preflight.test.sh` cria repositórios temporários e verifica que checkout incorreto ou sem origem aprovada é rejeitado.

Quando houver VM e autorização, o primeiro operador deverá:
1. Verificar no painel da Oracle os recursos *Always Free* reais e definir proteção de custo; nunca fazer upgrade por padrão.
2. Preparar usuário de sistema dedicado e acesso SSH de chave (sem senha compartilhada).
3. Clonar apenas o Laboratory e executar o preflight; escolher ferramenta/modelo somente após validação de segurança/privacidade.
4. Instalar serviço systemd e agente apenas em PR separado aprovado; **não criar nem habilitar serviços apenas copiando este documento**.
5. Executar teste sem inferência (dry-run) e depois piloto com orçamento/cota explícitos.

## Fontes e projetos existentes
- [Oracle Always Free](https://docs.oracle.com/pt-br/iaas/Content/FreeTier/freetier_topic-Always_Free_Resources.htm)
- [Oracle cadastro gratuito](https://docs.oracle.com/en-us/iaas/Content/GSG/Tasks/signingup_topic-Sign_Up_for_Free_Oracle_Cloud_Promotion.htm)
- [OpenCode CLI — execução não interativa](https://opencode.ai/docs/cli)
- [Processo interno](../docs/PROCESSO_IAS.md)
- [PR #20](https://github.com/BM000001/Alfred-Laboratory/pull/20), [PR #23](https://github.com/BM000001/Alfred-Laboratory/pull/23), [PR #33](https://github.com/BM000001/Alfred-Laboratory/pull/33)


## 8. Acionamento desacoplado: automação horária agora, Central de IA depois

**Decisão de 15/11/2026:** não esperar pela Oracle nem pela interface da Central de IA para melhorar as rodadas já agendadas. A automação existente **Equipe de desenvolvimento Alfred** continua executando de hora em hora e recebeu instruções de continuidade por objetivo, critérios de aceite, checkpoints e vedação de merge. **Isso modifica a instrução, não instala um executor persistente**: a execução real depende das ferramentas e permissões de cada rodada.

**Não confundir componentes existentes:**
- [PR #52](https://github.com/BM000001/Alfred-Laboratory/pull/52): fundação da Central de IAs para **Estudos** (`studies.analyze` e `studies.generate`, com fila IndexedDB no navegador). **Não é** um coordenador de agentes de desenvolvimento, não opera em background fora do navegador e ainda depende de PRs de Estudos.
- [Issue #44](https://github.com/BM000001/Alfred-Laboratory/issues/44): plano da Central de Comando, sem site de coordenação implementado.
- Esta Issue #56/PR #58: infraestrutura proposta para **executor de desenvolvimento** independente do navegador, ainda não instalado.

### Contrato de execução futura (a implementar e testar, não API já disponível)

Separar o **gatilho** do **processamento**. Gatilhos candidatos: agendamento atual, evento GitHub autorizado ou solicitação autenticada da Central de IA. Todos devem produzir a mesma entrada normalizada, sem permitir que texto externo vire comando de shell:

```json
{
  "version": 1,
  "trigger": "schedule|central|github_event",
  "repository": "BM000001/Alfred-Laboratory",
  "issue": 0,
  "approved_scope_id": "issue-or-approval-reference",
  "idempotency_key": "stable-nonsecret-work-identifier"
}
```

O futuro executor deve oferecer operações equivalentes a **consultar estado**, **iniciar/retomar uma tarefa aprovada** e **solicitar pausa**, com autorização conferida pelo servidor; nenhuma delas implica aprovar merge. Resposta/checkpoint padronizado: issue, objetivo, estado, branch/HEAD, PR, etapa e teste pendentes, prazo da reserva, cota consumida, erro/bloqueio e próxima ação. A fila durável e os locks pertencem ao executor, **não à página da Central**.

**Plano de transição sem trabalhos duplicados:**
1. **Agora:** manter uma única automação horária ativa; usar Issue/PR com handoff para retomar o mesmo objetivo; medir entregas com código + testes, não quantidade de execuções. Nunca abrir um segundo processo horário só para simular continuidade.
2. **Piloto sem nuvem:** provar por testes locais que o mesmo contrato aceita duas fontes de gatilho simuladas, mantém idempotência, recupera checkpoints e recusa tarefas sem aprovação; nenhuma inferência nem escrita no GitHub no dry-run.
3. **Quando houver servidor e provedor autorizados:** integrar um único executor real que recebe o gatilho da Central ou do agendador, mantendo limite de um escritor por área e sem fallback pago.
4. **Migração final:** só depois de validar autenticação, execução efetiva, entrega e recuperação, desativar o agendamento horário antigo. **Não manter dois disparadores capazes de iniciar a mesma tarefa sem chave de idempotência/lock comprovado.**

**Risco conhecido:** o PR [#60](https://github.com/BM000001/Alfred-Laboratory/pull/60) constava com restrição de aprovação antes de merge e aparece integrado à main do Laboratory. O executor não pode tratar CI verde, PR aberto, silêncio ou resultado de automação como aprovação de merge. Registrar anomalias e pedir avaliação humana; jamais reverter ou repetir integração automaticamente.

**Métricas para comparar antes/depois:** execuções com código validado, metas funcionais entregues para revisão, número de rodadas repetindo diagnóstico, tempo entre primeiro commit e PR testável, falhas e retomadas sem duplicata, alterações/merges não autorizados (=0). As métricas só são preenchidas quando houver evidência real, sem simular 24h produtivas.
