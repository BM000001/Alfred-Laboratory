# Alfred Studies 2.2 — geração de questões com IA (integração privada)

Status: **adaptador preparado no PR #87; implantação same-origin ainda pendente**.

## Limites reais

- O serviço experimental já existente na Cloudflare aceita `POST /api/studies/questions` com até **3 questões** por requisição, mediante Cloudflare Access, IA configurada e cotas.
- **Não há endpoint de aulas nem de flashcards neste contrato.** Não marque essas etapas como geradas.
- O backend exige a origem e o cabeçalho `Origin` do próprio Worker, além da identidade permitida no Cloudflare Access. Um site servido por GitHub Pages **não pode** fazer a chamada protegida com segurança por CORS nem deve receber token de serviço.
- Este adaptador só é ativado quando `VITE_STUDIES_AI_ORIGIN` corresponde exatamente à origem HTTPS que hospeda **também o frontend**. Sem essa condição, o importador preserva o material e explica que a IA está indisponível.
- Não publicar `VITE_STUDIES_AI_ORIGIN` como solução de autenticação: é só uma origem pública, não uma credencial; não inserir chaves, JWTs ou secrets no Vite.

## Fluxo implementado

1. O aluno importa o material; o original e texto extraído ficam preservados no dispositivo.
2. Se o frontend estiver na origem privada autorizada, é exibida uma opção explícita de consentimento para enviar **até 3 trechos** de no máximo **1.200 caracteres** cada à IA.
3. Depois de salvar, a extração local roda normalmente e o progresso é exibido por etapa real.
4. Com consentimento, conexão disponível e material extraído, o cliente chama o Worker privado **pela mesma origem**.
5. O cliente aceita apenas questões com resposta explícita no trecho da fonte, alternativas distintas e identificador de trecho reconhecido. Explicações elaboradas pela IA são identificadas separadamente.
6. As questões aceitas são salvas com `disciplineId`, `topicId`, `sourceFileId`, nome e trecho de origem, evitando duplicação por identificador estável e enunciado.
7. Ao falhar a IA, o material original continua salvo. É possível tentar novamente na origem privada, respeitando autenticação, consentimento e cotas.

## Próxima etapa de infraestrutura (não executada aqui)

1. Servir o build do Laboratory como aplicativo HTTPS na **mesma origem do Worker de estudos**, protegido pelo Cloudflare Access, sem modificar a produção.
2. Configurar `VITE_STUDIES_AI_ORIGIN` no build **somente** para essa origem privada.
3. Validar que o Worker injeta/recebe identidade do Access, e que uma pessoa não autorizada não consegue chamar `/api/studies/questions`.
4. Homologar no Safari físico: autenticação, consentimento, estado de carregamento, resposta válida, indisponibilidade, cota, cancelamento, retorno à trilha e persistência.
5. Só após aprovação específica, expandir o backend para aulas e flashcards com validação, proveniência e limites de custo.

Nenhuma etapa local simula a IA, e o aplicativo não promete continuidade com o iPhone fechado sem infraestrutura de execução remota.
