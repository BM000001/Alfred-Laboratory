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

Não há provedor de IA conectado neste fluxo e nenhum documento é enviado pela rede. O gerador local é determinístico, baseado em regras e conservador: só transforma declarações explícitas `termo: definição` ou `termo é/são/significa/...` em cartões; ignora rótulos genéricos de seção; só cria questão objetiva se houver pelo menos quatro definições distintas e usa como alternativas conceitos explícitos do mesmo material. A questão apresenta a definição extraída, pede o conceito correspondente e registra o trecho de origem. Isso é geração extrativa por regras, não compreensão semântica de IA. Se o material não tiver estrutura adequada, o texto fica disponível na biblioteca e nenhum recurso automático confiável é anunciado. Geração semântica mais ampla requer um provedor de IA intercambiável, com consentimento antes de qualquer envio externo.

Flashcards, respostas, intervalos de revisão, questões e tentativas usam os repositórios IndexedDB atuais. Questões geradas ficam vinculadas ao tópico do arquivo, e materiais e cartões guardam metadados de origem.

## Validação e limites conhecidos

- Testes automatizados exercitam upload múltiplo, início automático em **Salvar**, extração DOCX/PPTX, geração baseada em definições, deduplicação, falha parcial, reaproveitamento de OCR salvo e fluxo de simulado com histórico persistente.
- Build para GitHub Pages e conjunto Vitest devem ser executados antes do PR.
- Não declarar validação em Safari real/iPhone sem executar no aparelho; a compatibilidade é coberta por APIs web comuns e por testes/build, mas OCR, memória, bateria e IndexedDB do iOS ainda precisam de homologação manual.
- O cache do IndexedDB continua no escopo do navegador/dispositivo. Sincronização entre dispositivos e separação autenticada multiusuário não fazem parte desta implementação.
