# Processo de desenvolvimento com IAs — Alfred
**Versão:** 2.2 · **Status:** processo documentado para adoção gradual; automações, proteções, CI/revisão e preview precisam de verificação individual.

## 1. Propósito e limites

Evitar retrabalho, trabalhos concorrentes duplicados, perda de contexto, loops de falha e branches esquecidas. A fonte compartilhada de **estado de tarefas** são Issues e Pull Requests do GitHub. O código no Git é a fonte da implementação; comentários de handoff registram o progresso. O histórico de chats não substitui nenhum deles.

- Nenhum agente inicia desenvolvimento por iniciativa própria: precisa de acionamento do proprietário ou automação previamente autorizada.
- Consultar primeiro o código existente, os PRs, as issues, as branches e os documentos relevantes; nunca tomar um checklist antigo como prova de implementação.
- O custo adicional deve permanecer zero, quando possível; evitar infraestrutura nova sem justificativa.
- `BM000001/Alfred-Laboratory` é um **repositório**, não uma branch do `BM000001/Alfred`. Uma integração no Laboratory **não** equivale a integração no principal.
- Para mudanças grandes, trabalho de validação primeiro no Laboratory com PR e teste no iPhone/Safari quando aplicável. A `main` do Alfred principal permanece protegida até aprovação explícita.
- Documentação define o processo; **não** habilita agentes autônomos, GitHub rulesets, Code Review, CI ou deploys por si só.

## 2. Estados e marcos

Use labels ou campos do Projects, se estiverem configurados; caso contrário registre o estado na issue.

| Estado | Significado |
| --- | --- |
| **Planejada** | Objetivo, base/destino e critérios de aceite definidos; execução ainda não acionada. |
| **Em execução** | Proprietário acionou a IA; execução reservada e trabalho em andamento. |
| **Bloqueada** | Dependência pendente, decisão necessária ou circuit breaker; handoff com próximo passo. |
| **Em revisão** | Código publicado em PR; verificações aplicáveis registradas, prévia quando existente; falta decisão. |
| **Integrada** | Merge confirmado no destino **registrado**. O encerramento administrativo é verificado em separado. |

**Marcos de entrega distintos**: código preparado → publicado → testes/CI verificados → homologado pelo proprietário → aprovado → integrado no Laboratory (quando aplicável) → promovido para o Alfred principal (se fizer parte do escopo) → encerrado. Não marque o projeto principal como concluído por merge no Lab. A exclusão da branch não é condição para considerar o código integrado.

Correções solicitadas durante revisão retornam à execução no **mesmo PR/branch**, salvo impedimento técnico documentado.

## 3. Recebimento e investigação obrigatória

Antes de editar:
1. Registrar na issue: objetivo, resultado esperado, critérios de aceite, repo e base/destino, áreas/arquivos, dependências, responsável e evidências de trabalho existente.
2. Checar `AGENTS.md`, PRs/issues abertas e fechadas relevantes, branches, commits, código e documentação específica.
3. Classificar: **reutilizar**, **continuar**, **adaptar**, **corrigir** ou **criar**; registrar por que não há duplicação.
4. Confirmar o acionamento e as permissões para alterar, publicar, mesclar ou excluir: uma autorização de implementação não implica permissão de merge/limpeza.

### Reserva e concorrência

- A issue declara `Responsável`, `Execução/Thread`, `Último checkpoint (UTC)`, `Áreas/arquivos reservados` e `Branch/PR`.
- A IA verifica e registra a reserva **antes de codificar** e consulta novamente imediatamente antes de iniciar; quando a ferramenta não puder editar a issue, o proprietário registra a reserva. Não inferir exclusividade de um comentário não publicado.
- Outras IAs podem **analisar/revisar** a mesma tarefa. Implementações simultâneas só quando o proprietário autorizar frentes independentes e não houver sobreposição/dependência não resolvida; por padrão, uma implementação ativa por área.
- Esse protocolo de Issue é **coordenação cooperativa, não lock atômico**. Se duas reservas conflitarem, interromper a segunda execução; não resolver com force-push. Uma automação futura poderá tornar a reserva mais forte.
- Reserva aparentemente abandonada **não** autoriza transferência automática: conferir PR/commit/checkpoint e solicitar autorização para reassumir.

## 4. Preparação e branch

- Divida por comportamento independente e revisão viável no iPhone. Mais de cerca de **400 linhas alteradas** é alerta de revisão, **não proibição**; registre justificativa quando não dividir.
- Mudanças de schema, migração de dados, contratos de API, permissões/segredos ou alteração de mais de cinco arquivos centrais exigem plano técnico breve e aprovação antes de implementar, salvo autorização prévia explícita já abrangendo o plano.
- A issue informa **repositório de trabalho, ref de origem e branch de PR/destino**. **Para novos trabalhos do Laboratory, o padrão aprovado em 15/11/2026 é base/destino `main` do Laboratory**, não a `main` do Alfred original.
  - Documentação e aplicativo: criar branch de trabalho a partir da `main` do **Laboratory**, com PR para a `main`.
  - Exceção: PR empilhado sobre dependência explícita ainda aberta, com base/destino documentados e integração ordenada.
  - Legado `develop-app`: preservar como referência. Não possui ancestral comum com `main`; portar somente diferenças úteis em novas branches de `main`, nunca tentar merge direto de históricos.
  - Promoção ao `BM000001/Alfred`: PR/autorização **separados**.
- Criar a branch **antes** do primeiro código. Prefixo recomendado `codex/<issue>-resumo` ou `ia/<issue>-resumo`. Não editar diretamente `main` nem a `baseline/alfred-main`.

## 5. Implementação, testes e preservação

- Reaproveitar componentes válidos. Alterações incrementais; commits pequenos e com escopo rastreável. Nunca descartar trabalho não integrado para “limpar”.
- Executar os testes e build disponíveis **aplicáveis** ao escopo. Scripts confirmados no `package.json` do Laboratory: `npm test`, `npm run build`, `npm run build:pages`. Não existe `npm run lint` configurado no pacote atual.
- Relatar resultado real de cada verificação ou **não executado** + motivo. CI remoto é uma checagem adicional, não prova automática de teste físico no Safari.
- **Circuit breaker:** até três tentativas consecutivas *sem progresso* contra o mesmo problema técnico. Cada tentativa registra hipótese, alteração e resultado. Após a terceira, parar esse caminho, preservar o estado e informar `Bloqueada`. Um diagnóstico novo e fundamentado pode ser avaliado, mas não contorna o limite com repetições cosméticas.
- Produzir checkpoints após marcos relevantes; antes de interrupção salvar no Git remoto, **se a ferramenta permitir**. Se não permitir, discriminar entre código local, commit feito, push confirmado e PR criado. Não alegar “salvo no GitHub” sem evidência.
- O ambiente Codex Cloud pode ter fluxo de botão **Create PR**; quando disponível, seguir a interface real. Não pressupor que todo ambiente possua API GitHub ou que todo PR seja criado automaticamente.

## 6. Handoff obrigatório

Na resposta de cada sessão encerrada, interrompida ou bloqueada e, quando houver acesso, no corpo do PR/issue:

```markdown
## Handoff — AAAA-MM-DD HH:MM (fuso) — <agente/sessão>
- Issue: <link/numero e repositório>
- Estado: Planejada | Em execução | Bloqueada | Em revisão | Integrada
- Repositório / branch de origem / destino: <valores exatos>
- Branch de trabalho / HEAD SHA: <valor confirmado ou ausente>
- PR / URL da execução: <links confirmados ou não criado>
- Reserva e áreas afetadas: <responsável, área, último checkpoint>
- Feito: <entregas verificáveis>
- Pendente: <itens>
- Próximo passo: <uma ação exata e acionável>
- Código publicado no GitHub: Sim | Não | Não verificado
- Testes e CI: <comandos e saídas reais; status não verificado quando couber>
- Decisões/riscos/dependências: <objetivo e motivo>
- Arquivos alterados: <caminhos>
- Aprovação/merge/limpeza: <estados confirmados e permissões>
```

O handoff **não substitui** commits nem publicação. Quando não houver PR, informar onde o código realmente se encontra e como retomá-lo, sem garantir recuperação de ambiente temporário.

## 7. PR, revisão e homologação

1. Publicar branch e abrir **Draft PR** para o destino explicitamente definido; vincular a issue com link. Só usar `Closes #N` se o fechamento automático após merge **na branch padrão do repositório correto** for o comportamento desejado; caso contrário `Refs #N`.
2. Incluir escopo, diff, links, SHA, testes executados, riscos, dependências, forma de reversão e handoff.
3. Verificar **se existem** CI, Code Review e prévia configurados para esse PR. Não tratá-los como garantidos. Configurações ausentes devem ser relatadas.
4. Após verificações obrigatórias aprovadas, ausência de conflitos e requisitos de revisão cumpridos, colocar **Ready for Review** quando permitido. Não inferir aprovação do proprietário de um CI verde.
5. Quando houver interface, fornecer URL de prévia **da versão correta** para homologação no iPhone/Safari; um link genérico do Pages pode estar exibindo outra branch/commit.
6. Decisões do proprietário: aprovar, pedir correção, rejeitar ou adiar. Ajustes seguem no PR existente sempre que possível.

## 8. Merge e encerramento

- Antes de integrar: base e head atualizados, dependências, verificação obrigatória, aprovação explícita e **repositório/branch de destino** checados.
- Integrações estruturais devem passar primeiro pelo Laboratory; promoção ao principal exige aprovação **separada**. Não mesclar no principal sob o pretexto de aprovar o Laboratory.
- Confirmar resultado do merge e registrar SHA; verificar Issue e PR encerrados corretamente. **Não assumir** que `Closes #N` fechou uma issue quando o PR tem destino não padrão ou está em outro repositório.
- Atualizar somente docs afetados, resumir critérios de aceite cumpridos e abrir issue separada para débito técnico novo.
- **Limpeza:** inventariar branches/arquivos candidatos, conferir PRs dependentes, commits exclusivos, tags e backups; apresentar exclusões potencialmente destrutivas ao proprietário e aguardar autorização. A opção GitHub de apagar branches automaticamente **não deve ser ativada sem decisão específica**, especialmente com PRs empilhados.
- Encerrar o registro sem apagar evidências. Uma tarefa pode estar **integrada**, mas com teste móvel, promoção ou organização pendentes.

## 9. Implantação incremental

1. Aplicar esta documentação, templates e links **sem mudar o app**.
2. Executar um piloto em issue pequena de documentação ou correção isolada; verificar handoff, retomada, PR, CI e autorização.
3. Só depois considerar labels/Projects, regras de branch, reserva automatizada, relatórios de duplicação e limpeza assistida, medindo impacto no retrabalho.
4. Nenhuma automação de agentes, merge ou exclusão foi habilitada pela adoção documental.
