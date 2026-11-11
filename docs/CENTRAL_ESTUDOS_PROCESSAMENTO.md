# Processamento da Central de Estudos

## Fluxo atual

1. A pessoa escolhe uma disciplina e prepara um ou vários arquivos.
2. Um único botão **Salvar** confirma a seleção e inicia a fila automaticamente.
3. O original é persistido no IndexedDB antes da leitura. O texto extraído e os recursos gerados permanecem associados à disciplina, ao tópico criado para o arquivo e ao ID/nome do material de origem.
4. Cada arquivo é processado de forma isolada; erro ou formato incompatível não desfaz os materiais concluídos.

## Formatos e limites

- PDF com camada de texto selecionável, DOCX, PPTX, TXT, Markdown, CSV e JSON: leitura no navegador.
- Upload limitado a 10 MB por arquivo, conforme o serviço existente.
- OOXML DOCX/PPTX: expansão limitada a 25 MB e até 500 entradas de pacote; saída textual limitada a 5 MB.
- PDF digitalizado: o fluxo informa a necessidade de OCR. O OCR português local permanece uma ação explícita na área Arquivos. Depois de aplicar OCR e conferir a extração, selecionar o mesmo arquivo na Central de Estudos reutiliza o texto salvo, conferindo os bytes para evitar uma associação por nome apenas.
- Arquivos sem texto, corrompidos, com senha ou incompatíveis são informados individualmente; o original permanece preservado quando o limite de armazenamento é aceito.

## Geração e precisão

Não há provedor de IA conectado neste fluxo e nenhum documento é enviado pela rede. O gerador local é determinístico e conservador: só transforma declarações explícitas `termo: definição` ou `termo é/são/significa/...` em cartões; só cria questão objetiva se houver pelo menos quatro definições distintas e cada alternativa vier do texto extraído. A explicação registra o trecho de origem. Se o material não tiver esse formato, o texto fica disponível na biblioteca e a interface informa que nenhum recurso automático confiável foi encontrado. A geração semântica geral permanece dependente de um provedor de IA futuramente autorizado.

Flashcards, respostas, intervalos de revisão, questões e tentativas usam os repositórios IndexedDB atuais. Questões geradas ficam vinculadas ao tópico do arquivo, e materiais e cartões guardam metadados de origem.

## Validação e limites conhecidos

- Testes automatizados exercitam upload múltiplo, início automático em **Salvar**, extração DOCX/PPTX, geração baseada em definições, deduplicação, falha parcial, reaproveitamento de OCR salvo e fluxo de simulado com histórico persistente.
- Build para GitHub Pages e conjunto Vitest devem ser executados antes do PR.
- Não declarar validação em Safari real/iPhone sem executar no aparelho; a compatibilidade é coberta por APIs web comuns e por testes/build, mas OCR, memória, bateria e IndexedDB do iOS ainda precisam de homologação manual.
- O cache do IndexedDB continua no escopo do navegador/dispositivo. Sincronização entre dispositivos e separação autenticada multiusuário não fazem parte desta implementação.
