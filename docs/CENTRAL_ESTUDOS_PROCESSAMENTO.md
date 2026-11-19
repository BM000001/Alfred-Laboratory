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

A importação em lote salva os originais e os checkpoints antes da extração. Uma interrupção deixa os materiais já gravados disponíveis para retomada. O processamento é local. Além das definições explícitas, o gerador usa listas e etapas sob um título, pares explícitos de pergunta/resposta e completamento literal de comparações, causas e exemplos. Fórmulas rotuladas podem produzir cartões em material elegível. Questões objetivas requerem pelo menos quatro respostas distintas no material. A explicação registra o trecho de origem. O resumo seleciona trechos do próprio material. Quando faltam evidências para criar atividades com segurança, o texto continua na biblioteca e a interface informa a limitação. A geração semântica geral depende de integração futura autorizada.

Consulte [a auditoria da Central de Estudos 2.0](AUDITORIA_ESTUDOS_2.md) para decisões sobre bibliotecas, riscos e homologação.

Flashcards, respostas, intervalos de revisão, questões e tentativas usam os repositórios IndexedDB atuais. Questões geradas ficam vinculadas ao tópico do arquivo, e materiais e cartões guardam metadados de origem.

## Validação e limites conhecidos

- Testes automatizados exercitam upload múltiplo, início automático em **Salvar**, extração DOCX/PPTX, geração baseada em definições, deduplicação, falha parcial, reaproveitamento de OCR salvo e fluxo de simulado com histórico persistente.
- Build para GitHub Pages e conjunto Vitest devem ser executados antes do PR.
- Não declarar validação em Safari real/iPhone sem executar no aparelho; a compatibilidade é coberta por APIs web comuns e por testes/build, mas OCR, memória, bateria e IndexedDB do iOS ainda precisam de homologação manual.
- O cache do IndexedDB continua no escopo do navegador/dispositivo. Sincronização entre dispositivos e separação autenticada multiusuário não fazem parte desta implementação.
