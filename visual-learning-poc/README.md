# Alfred Studies — Laboratório visual e interativo

POC experimental de três experiências sobre o mesmo conteúdo de Introdução a Algoritmos: ordenação por bolhas.

## Estado rastreável

- Issue #89: https://github.com/BM000001/Alfred-Laboratory/issues/89
- Branch: research/visual-learning-poc (base/destino main do Laboratory)
- Pasta reservada: visual-learning-poc/
- PR #88 / learning-engine-poc/, Alfred principal e Alfred-Server ficam fora do escopo.
- Nenhum merge está autorizado.
- A documentação e esta POC são separadas da implementação definitiva da Central.

## O que a POC implementa

1. Aula visual: vetor com edição por valor e reordenação por toque/botões, previsão de comparação/troca, explicação, avanço e retrocesso.
2. Blockly: blocos para inicialização de vetor, repetição e comparação. JavaScript/Python aparecem como texto. O executor valida uma estrutura permitida e roda apenas o interpretador didático com limites; não usa eval ou Function.
3. História: seis quadros SVG/CSS com Nina, personagem vetorial consistente, progressão problema → comparação → troca → passagem → critério de parada → desafio. A arte é procedural, não IA.

## Ambiente e validação

- A interface usa o tema escuro, verde e dourado do Alfred como estudo visual independente; não incorpora nem substitui o mascote.
- Blockly 13.3.0, licença Apache-2.0; Vite 6.4.5 e vite-plugin-pwa 1.3.0. Vite PWA é MIT e gera precache com Workbox.
- Build/CI verificados em 24/11/2026: 5 testes Node de lógica, build Vite/PWA e 4 testes Playwright 1.65.1 com WebKit em emulação mobile 390×844 passaram. Os E2E cobrem editar/reordenar vetor, prever, avançar/voltar, Blockly com JavaScript/Python como texto e interpretador restrito, seis quadros com feedback, e reload offline após cachear a aplicação e abrir Blockly.
- O app empacota localmente as mídias Blockly e inclui no precache o app e chunks lazy-loaded. O teste offline confirma a experiência após a primeira carga/cache; não mede sincronização nem primeira instalação sem rede.
- Bundle de produção: Blockly core 634.98 kB minificado / 177.56 kB gzip; catálogo pt-BR 80.98 / 18.74 kB gzip; demais chunks separados e lazy-loaded. Artifact estático do build anterior: ZIP 258,025 bytes (não é o tamanho descompactado total).
- O E2E usa Playwright WebKit 27.2 com viewport/touch declarados; isso não é Safari rodando em iPhone real. Não foi medido consumo de memória/CPU no aparelho, toque manual ou tempo frio de carregamento. Não houve geração de imagem com IA.
- package-lock.json não está versionado; versões diretas estão fixadas, mas a árvore transitiva é resolvida no CI e pode variar. Gerar e revisar lockfile antes da integração definitiva.

## Tangible: identidade, utilidade e limitação mobile

[Tangible](https://github.com/scienceetonnante/tangible) é o repositório oficial identificado na pesquisa anterior e rechecado nesta missão. Licença Apache-2.0. Cada aula junta cena TypeScript manipulável, roteiro Markdown e configuração YAML. Roteiro controla cues sincronizados a mudanças visuais; cenas podem usar DOM, SVG, Canvas ou WebGL/Three.js. O projeto tem aula demonstrável sobre otimizadores e círculo unitário.

A prévia silenciosa de autoria precisa de Node 22, Git e pnpm, sem modelo/FFmpeg/chave. Áudio local offline usa Supertonic, com download inicial documentado de 123 MB; áudio hosted e assistente LLM são opcionais e podem ter custos. O README declara suporte desktop/tablet; retrato de telefone pede rotação/tela maior. Por isso, Tangible é aprovado para autoria de aulas e benchmark de sincronização, mas não para runtime obrigatório no Alfred iPhone portrait. Nesta POC, a aula é uma implementação web nativa pequena com o padrão pedagógico cena/explicação sincronizadas; não é port do Tangible.

## Catálogo, licenças e decisão

| Tecnologia | Função documentada e licença verificada | Limites/custo/encaixe | Decisão |
|---|---|---|---|
| Tangible | Cena manipulável + roteiro e áudio sincronizados; Apache-2.0. Preview silencioso local; voice local opcional. | Atual documentação sinaliza telefone portrait como layout não suportado; build/author Node 22 + pnpm. Não precisa de serviço para preview, mas voz/modelo pesa e hosted options podem custar. | Promissora para autoria desktop/tablet; não selecionada como runtime iPhone portrait sem POC mobile. |
| Blockly 13.3.0 | Editor web de blocos; licencia Apache-2.0. Geradores oficiais para JS ES5, Python 3, Lua 5.1, Dart 2 e PHP 7. | Geração não executa código. O app deve validar/sandbox; workspace móvel pode ser denso. Integrado nesta POC; toque real não testado. | Selecionado para Laboratório com DSL/interpretador restrito. |
| Scratch Blocks | Biblioteca inspirada em blocos Scratch, Apache-2.0 no repositório oficial de Scratch Foundation. | O repositório público teve ciclo/organização histórica próprio; avaliar API e manutenção antes de trocar Blockly; não foi instalado. | Adiado; Blockly oferece release/documentação/generators mantidos pela Raspberry Pi Foundation. |
| Pyodide | Python CPython em WebAssembly, MPL-2.0. | Download, memória e CPU relevantes para telefone; sandbox de WebAssembly não substitui limites de tempo/memória e APIs. Não necessário quando o exercício é DSL. | Adiado para futura aula Python; não usar nesta POC. |
| Skulpt | Python executável em navegador via JavaScript; MIT no repositório Skulpt, com trechos do CPython/PyPy sob seus notices; verificar pacote/release e dependências antes de incorporar. | Não foi executado; limitações de implementação de Python e desempenho precisam comparação empírica. | Promissora para aulas Python simples, pendente de licença e compatibilidade atual. |
| Brython | Implementação de Python 3 no navegador e ponte DOM; licença BSD-style própria no LICENSE upstream. | Runtime/stdlib acrescentam bytes; sem execução nesta missão. Sandboxing e limites exigem projeto explícito. | Alternativa a testar em curso Python, não necessária para bloco visual. |
| Mafs | Componentes React para visualização matemática; MIT. | Específico para gráficos matemáticos, não é tutor/engine de execução; testes Safari/iOS upstream requerem Mac. | Aprovado para disciplina de matemática se necessidade concreta; fora de ordenação. |
| JSXGraph | Gráficos e geometria interativos; licença dual LGPL-3.0/MIT. | Selecionar a via MIT e cumprir aviso, ou avaliar obrigações LGPL. Não encaixa em ordenação vetorial. | Aprovado tecnicamente para gráficos; fora desta POC. |
| GeoGebra | Código fonte EUPL-1.2; software/material e linguagem têm condições não comerciais/CC BY-NC-SA; confirmar uso com direitos autorais. | Fonte disponível não torna todos os componentes livres de restrição comercial; serviço web não é dependência offline local-first. | Não importar. Considerar embed educativo só após análise de termos e utilização específica. |
| PhET | Simulações interativas; overview recomenda licença GPLv3 para novas sims e MIT para bibliotecas de reutilização; sim/asset individual requer inspeção. | Forte em ciências e matemática; não fornece simulação de ordenação. Multi-repositório pesado para portar. | Reutilizar simulação existente e atribuir por unidade quando houver conteúdo adequado. |
| H5P Standalone | Player isolado MIT; consome pacotes .h5p, bibliotecas e assets com licenças individuais. | Não é editor nem coleção gratuita de conteúdo; offline exige empacotar dependências e conteúdo. | Aprovado para avaliar pacote H5P selecionado, não como motor central. |
| Motion Canvas | Produção programada de animações com player; MIT. | Não produz automaticamente explicações; processo de criação/export exige tooling e assets. | Útil para assets preparados, não experiência adaptativa do estudante. |
| ComfyUI | Grafo de criação e inferência local; GPL-3.0 (community repo). Pode integrar vários checkpoinst/local models. | Requer PC/hardware compatível; modelo e custom nodes têm termos próprios. O serviço Cloud oficial é pago, por isso fora do budget. Não roda no PWA/iPhone. | Aprovada só como estação de autoria opcional offline, não dependência do produto. |
| Stable Diffusion 1.5 | Código e pesos devem ser considerados separadamente; pesos sob CreativeML OpenRAIL-M, com restrições de uso. | Mais leve que modelos 12B; sem modelo/teste verificados nesta sessão e sem geração factual garantida. | Adiada para criação editorial offline com model card e checkpoint fixos. |
| FLUX.1 dev | Página oficial anuncia modelo 12B sob Non-Commercial License. | Não é licença de open source permissiva; qualidade de fatos não garantida; VRAM alta. | Incompatível com uso futuro comercial sem autorização; descartada para integração automática. |
| FLUX.1 schnell | Model card oficial indica Apache-2.0 para a versão snelI consultada. | Ainda é modelo pesado; checkpoint específico, derivado, requisitos e output não testados. | Promissora para geração pré-produzida em desktop autorizado, não no iPhone. |
| StoryDiffusion | Código Apache-2.0 para projeto; usa PyTorch/Diffusers. README recomenda >20 GB VRAM; reporta teste low-memory em NVIDIA A10 24 GB e 30 GB RAM. | Pesos/modelos e assets requerem licença separada; repo atualizado por último em 2024 nos metadados consultados; recurso não cabe em Safari. | Adiada por custo/hardware/licença de pesos e atividade. |
| Comic Drama | MIT no repositório, descrito como experimental; transforma script em cenas em fluxo de produção. | Dependência/modelo/asset não cobertos pela licença MIT; baixa maturidade e sem execução. | Promissor, precisa de avaliação e inventário de pesos/recursos. |

Skulpt: o repositório principal declara MIT; a distribuição contém notices de terceiros que devem ser preservados e verificados para a versão empacotada. No uso de qualquer modelo, verificar em conjunto código, checkpoint, VAE, LoRA, fonte de personagens, imagens e condições de publicação.

## Três abordagens de quadrinhos

- **Geração IA real:** não executada. StoryDiffusion declara modelo GPU >20 GB VRAM testado em A10 24 GB; FLUX.1 dev é 12B, com licença não comercial. ComfyUI consegue rodar modelos localmente, mas não fornece hardware gratuito. Este ambiente não ofereceu GPU nem cota gratuita confirmada. Não há custo por execução estimável sem hardware; portanto não se declara nenhuma imagem de IA validada.
- **Composição procedural:** implementada como seis quadros SVG/CSS com personagem reutilizada, cenários, números e balões. Zero custo de inferência, offline após cachear arquivos, consistente e explicável; menos diversa e escrita por autor, não pelo modelo.
- **Híbrida:** recomendada para produto: roteiro e conceito ligados à fonte; diagrama SVG determinístico; imagem generativa opcional criada em estação local com pesos licenciados, revisão humana e armazenada em cache. SVG fornece fallback quando modelo/rede indisponível. Imagem não deve carregar fatos críticos sem validação.

## Arquitetura educacional

Contrato futuro, sem banco novo: materialId + trecho/página → conceito → objetivo → atividade/modalidade → interação/evento → feedback e gabarito → evidência/desempenho → versão.

- Biblioteca recebe aula e história com referências ao conteúdo.
- Campo de Alvos recebe quiz e prática com dificuldade explicável.
- Flashcards armazenam ilustrações e fonte no modelo já existente.
- Laboratório recebe Blockly, código gerado como texto e interpretador limitado.
- Castelo recebe desafios/histórias contextualizadas e progresso baseado em evidência.
- Nenhuma experiência cria um storage paralelo. Esta POC não toca nos stores atuais do Alfred.

## Matriz ponderada

Notas 0–10 são estimativas técnicas/pedagógicas deste agente, não benchmarks. Peso: pedagógico 20%, interação 15%, mobile 15%, custo 15%, integração 10%, licença 10%, offline 5%, desempenho 5%, maturidade/manutenção 5%. Cada resultado abaixo é uma estimativa de encaixe no Alfred, condicionada pelas evidências citadas. Critério de eliminação sobre licença/custo/risco não é compensado por pontuação.

| Candidato | Ped | Int | Mob | Custo | Integr. | Licença | Off | Perf | Matur. | Peso |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| Aula SVG/DOM, esta POC | 8 | 9 | 9 | 10 | 10 | 10 | 10 | 9 | 5 | 8,40 |
| Blockly + interpretador DSL | 8 | 9 | 5 | 10 | 7 | 10 | 9 | 6 | 9 | 7,80 |
| Tangible como autor de aula | 9 | 9 | 4 | 8 | 5 | 9 | 7 | 6 | 7 | 7,15 |
| Quadrinho procedural SVG | 7 | 7 | 9 | 10 | 9 | 10 | 10 | 9 | 8 | 8,25 |
| ComfyUI + modelo local | 6 | 5 | 2 | 3 | 3 | 5 | 8 | 3 | 8 | 4,45 |
| StoryDiffusion | 6 | 7 | 1 | 2 | 2 | 3 | 5 | 2 | 4 | 3,75 |
| PhET (em ciência/matemática) | 9 | 9 | 8 | 10 | 5 | 7 | 7 | 8 | 10 | 8,30 |
| Mafs (em matemática React) | 8 | 8 | 8 | 10 | 7 | 10 | 10 | 9 | 8 | 8,55 |

A nota alta para PhET/Mafs não os torna candidatos a algoritmos: domínio de conteúdo decide após o filtro quantitativo. A nota de mobile para Tangible é reduzida com base na própria declaração de suporte. Pontos que dependem de teste nesta POC ainda são estimativas.

## Ranking e roadmap Fase 2

| Estado | Próxima missão |
|---|---|
| Validada em CI | 5 testes Node, build PWA e 4 E2E WebKit mobile-sim passaram; captures de tela são produzidas no job para revisão. |
| Promissora, precisa de teste físico | Homologar toque e layout no Safari/iPhone real; conferir landscape/VoiceOver e desempenho/memória no aparelho. |
| Promissora, precisa de teste | Avaliar Tangible como autoria desktop/tablet e medir export/offline; não migrar player inteiro sem provar portrait. |
| Aprovada tecnicamente para POC | SVG/DOM determinístico para aula, quiz e quadrinho; seguir com modelo visual acessível, offline e com referências de fonte. |
| Validada ao vivo | Prévia estática no Render: https://alfred-visual-learning-poc.onrender.com/ , branch research/visual-learning-poc. Workspace My Workspace; nenhum backend, chave ou dado pessoal. Serviço estático usa cotas compartilhadas de banda/build. Serviço do PR #88 não foi alterado. |
| Adiada por custo/infraestrutura | Executar modelo real de imagem somente com pesos licenciados para uso pretendido, hardware/cota comprovadamente R$0 e revisão humana de conteúdo. |
| Rejeitada para automação | FLUX.1 dev sem licença comercial; execução de código arbitrário dos estudantes; imagem de IA como fonte factual sem revisão. |
| Ideia após Fase 1 | Conectar as experiências ao contrato acadêmico existente, sem banco paralelo, mantendo progresso e material na persistência atual. |

## Esforço estimado de integração

Estimativas de planejamento para um desenvolvedor familiarizado com o app, excluindo escrita/revisão do conteúdo acadêmico e homologação de iPhone. São intervalos, não medições:

| Solução | Escopo inicial | Esforço provável | Condição |
|---|---|---:|---|
| Aula SVG/DOM da ordenação | Migrar o protótipo para componente do Alfred e ligar conceito/fonte/progresso aos stores existentes | 2–4 dias | Contrato do conteúdo e persistência existentes confirmados; manter regra e feedback determinísticos. |
| Blockly com DSL restrita | Adaptar área e guardar workspace/resultado no modelo atual | 5–8 dias | Definir DSL por atividade e limites antes de habilitar mais blocos; testes de toque/iPhone. |
| Quadrinho procedural | Generalizar o template de seis quadros com storyboard ligado a conceitos e fontes | 3–5 dias | Revisão pedagógica/artística de cada template; imagens IA permanecem opcionais. |
| Runtime Tangible | Avaliação/adaptação, focada no player e telas portrait, não contada como aprovada | 1–2 semanas de experimento | Só avançar se a restrição de layout de telefone for superada ou houver uso tablet/desktop. |
| Geração real local por IA | Estação de autoria e fluxo de revisão; não runtime mobile | 2–4 semanas de investigação | Requer máquina/modelo licenciado disponível sem custo marginal; duração e qualidade não foram medidas nesta missão. |

## Capturas e artefatos

O job de CI guarda dist/ e as capturas Playwright (aula, Blockly e história em viewport 390×844) como artifact de 7 dias. A aba Actions do PR #90 contém os artefatos e logs. A prévia pública foi aberta e exercitada no navegador: aula avançou com feedback, Blockly gerou código/executou a DSL e a história mostrou seis quadros com respostas certa e errada. Esta inspeção é browser desktop e a emulação CI não equivale a Safari/iPhone físico.

## Próximos passos do Codex

1. Revalidar a reserva na issue #89 e trabalhar somente em visual-learning-poc/**.
2. Gerar/revisar package-lock.json com um executor local e repetir npm ci, tests e build.
3. Revisar tamanho PWA/caches, mídia Blockly local, teclado, screen reader e acessibilidade dos blocos.
4. Executar browser, teclado, leitura por screen reader, touch responsivo e WebKit; separar simulação de telefone e iPhone físico.
5. Homologar a prévia estática no Safari/iPhone real e confirmar cotas de banda/build antes de compartilhar com mais usuários.
6. Considerar POC de IA real somente com modelo permissivo para uso pretendido, máquina apropriada e custo comprovado R$0; comparar consistência/fidelidade com a folha de personagem procedural.
7. Não fazer merge nem integrar ao Alfred principal antes da Fase 1 e autorização posterior do proprietário.

## Referências primárias consultadas

- Tangible, README/licença/requirements e limites mobile: https://github.com/scienceetonnante/tangible
- Blockly, licença/releases/codegen: https://github.com/RaspberryPiFoundation/blockly
- Mafs: https://github.com/stevenpetryk/mafs
- JSXGraph licenses: https://github.com/jsxgraph/jsxgraph
- GeoGebra terms: https://github.com/geogebra/legal
- PhET source/licensing: https://github.com/phetsims/phet-info
- H5P Standalone player and content packages: https://github.com/tunapanda/h5p-standalone
- Motion Canvas: https://github.com/motion-canvas/motion-canvas
- ComfyUI: https://github.com/Comfy-Org/ComfyUI
- StoryDiffusion and hardware guidance: https://github.com/HVision-NKU/StoryDiffusion
- Comic Drama: https://github.com/tccnnd/Comic-drama
- FLUX.1 dev model license: https://huggingface.co/black-forest-labs/FLUX.1-dev
- FLUX.1 schnell model card: https://huggingface.co/black-forest-labs/FLUX.1-schnell
- Stable Diffusion 1.5: https://huggingface.co/stable-diffusion-v1-5/stable-diffusion-v1-5
- vite-plugin-pwa: https://github.com/vite-pwa/vite-plugin-pwa
