# Candidata de integração de Estudos

Novembro de 2026 · Alfred-Laboratory · branch `codex/studies-integration-20261127`

## Handoff

- Destino proposto `main` do Laboratory, em [PR #93](https://github.com/BM000001/Alfred-Laboratory/pull/93).
- A base `5002d26` recebeu o histórico de #87 (`b386937`), #88 (`f8371df`), #90 (`4ce32f1`) e #92 (`4668b5c`). A integração funcional começou em `0896335`. Consulte o último commit e os checks do PR antes de retomar.
- A revisão de referência do backend privado é `fbb82e2`, no [Alfred-Server PR #8](https://github.com/BM000001/Alfred-Server/pull/8). Consulte também as issues [#86](https://github.com/BM000001/Alfred-Laboratory/issues/86) e [#89](https://github.com/BM000001/Alfred-Laboratory/issues/89).
- Próxima ação executável. Abra a última execução de WebKit e confirme a recarga offline em todos os tamanhos. Abra a prévia temporária de `studies-homologation-tunnel.yml` enquanto ativa e homologue no Safari físico com material sintético. Nenhum material pessoal deve entrar nos testes ou artefatos.

## Backlog e critérios de aceite

| Fase | Entregue na candidata | Pendência e evidência exigida |
| --- | --- | --- |
| A · Estudos | Importação, originais locais, extração e vínculo por disciplina/unidade, aulas preparadas, flashcards, questões e tentativas. Exclusão atômica dos dados acadêmicos conforme #87. Build de raiz e pipeline da prévia. | Homologar importadores, PWA instalada, OCR após preparação e recuperação de falhas no Safari físico. |
| B · Redesign | Tokens da paleta escura centralizados, Noto local para corpo, navegação lateral e inferior, Projetos e conversa do Alfred separados, Mais com Notas, Arquivos, Central de IA e Configurações. Mascote original preservado. | Revisão visual de todos os módulos nos dois temas e verificação com VoiceOver. A segunda família tipográfica distribuída localmente e a arte definitiva das construções seguem abertas. |
| C · Aprendizagem | Laboratório reaproveita o traço e o storyboard da #90. Na atividade autoral de ordenação, o aluno edita o vetor, prevê as trocas, navega entre passos e salva a rubrica. Blockly, Markmap e InkJS abrem sob demanda. TS-FSRS agenda cartões sem revisão anterior. Cartões já revisados e sem estado FSRS mantêm o agendamento existente. | Escolher o vínculo de práticas com outras disciplinas e unidades com o proprietário. Cobrir teclado no editor de blocos e disponibilidade dos recursos sob demanda em primeira carga offline. Storyboard integrado como roteiro textual de seis quadros. |
| D · Mapa | Cinco construções visíveis. A Biblioteca abre materiais e aulas sem nota. Campo de Alvos tem três níveis, 10 questões por nível, aprovação com 8 e acesso a níveis anteriores. Baú exige autoavaliação e 2 de 3 acertos. Laboratório aplica rubrica de 100 pontos, com 80 como mínimo. Castelo usa simulado variável e arredonda o mínimo de 80% para cima. Questões puladas ficam nas tentativas IndexedDB. | Os níveis do Campo de Alvos precisam de um banco com 10 itens distintos por dificuldade. O aluno pode cadastrá-los no banco. O adaptador atual devolve poucos itens por chamada e registra dificuldade média. Ampliar a cobertura com fontes reais, explorar seleção de trechos que preserve consentimento e testar desbloqueio com materiais homologados. |
| E · Integrações | Reutilizados Worker privado, Access, cota Durable Object e recursos existentes. O cliente mantém mesma origem HTTPS, consentimento, distinção de sessão expirada, ausência de rede e limites, e recusa seguir redirecionamentos da API com dados do material. | Conta proprietária do Cloudflare, aprovação para ativação privada, teste autenticado da política e inferência real. O Render oferece processamento autenticado de ping. O contrato experimental de enriquecimento ainda é isolado, sem rota de IA. |

## Integrações

| Componente | Nível | Evidência e dependência |
| --- | --- | --- |
| Alfred-Server e Worker de prévia | 2 · pronta para ativação | Testes Node e TypeScript passaram. O script verificado do PR #8 aceitou o build da candidata, compilou o Worker e reconheceu assets e bindings em dry-run com geração desativada. |
| Cloudflare Access | 2 · pronta para ativação | A URL privada respondeu com HTTP 302 sem sessão. Falta verificar política e manifestação das variáveis e do segredo na conta proprietária, com sessão autorizada e usuário sem acesso. |
| Workers AI e cotas | 2 · pronta para ativação | Binding `AI`, Durable Object e rotas validados em código e dry-run. Falta provar o modelo, o uso dentro da franquia gratuita e a cota em operação. |
| Adaptador de IA em Estudos | 2 · pronta para ativação | Testes de consentimento, origem, evidência e erros. O envio é acionado no contexto de importação e exige a prévia privada. |
| Render `alfred-processing-api` | 2 · pronta para ativação | O health público retornou `alfred-render` após uma tentativa expirar. Os 34 testes locais do Render passaram. Falta homologar o ping autenticado com o Worker existente. |
| `alfred-edge-api` | 2 · pronta para ativação | Contrato e dry-run do Worker passaram. O ping de ponta a ponta depende da configuração do serviço existente e de autenticação privada. |

A publicação temporária, quando ativa, serve somente o build local-first em outro hostname e não configura a geração remota. O pacote do CI para Access exige deploy separado. Em ambos os casos, a homologação em Safari físico ainda deve usar material sintético e verificar importação, recarga offline, fontes, navegação e persistência.

## Testes e retomada

- Execute `npm test`, `npm run build` e `npm run build:pages`. O workflow de WebKit usa o build de produção para exercitar o service worker.
- Para verificar a preparação privada, gere o build de raiz com `VITE_STUDIES_AI_ORIGIN` igual ao hostname existente. Execute o script `worker/scripts/prepare-studies-private-preview.sh` do Server PR #8 em dry-run, com o caminho absoluto de `dist`.
- Os módulos usam contratos TypeScript e os repositórios existentes. As tentativas, aulas e revisões continuam persistidas localmente. O Brain permanece fora da entrega.
