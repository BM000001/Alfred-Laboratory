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

## Controlador confiável e retomável

A branch `feat/studies-intelligent-material-controller` continua o código do PR #42 em uma branch independente. O fluxo Salvar mantém todo o processamento no dispositivo, com Tesseract e ativos locais já usados pelo Alfred; não adiciona provedor externo.

Cada arquivo armazena `processing` no mesmo registro IndexedDB do original. Os checkpoints separam texto bruto, texto corrigido com trilha de alterações, conteúdo estruturado e recursos validados. Reiniciar o navegador e tocar em Retomar reutiliza as etapas concluídas. IDs determinísticos e deduplicação por disciplina evitam recursos repetidos durante uma interrupção na gravação. A fila preserva os originais antes de reconhecer texto. Falhas de um arquivo não removem resultados dos demais. O cancelamento encerra o worker de imagem e é observado entre checkpoints e gravações; documentos Office/PDF terminam a operação de extração já iniciada antes de observar o cancelamento.

Perfis: quadro manuscrito, impresso, slide, anotação, fórmula, diagrama e texto corrido. Alteram segmentação, número de versões e limiar mínimo. Extensões de documentos selecionam impresso/slide/texto; uma escolha explícita no seletor sobrescreve o perfil do lote. Fórmulas e diagramas preservam texto e fórmulas reconhecidas, mas não geram questões no modo local: faltam garantias de interpretação espacial/matemática.

A confiança é um índice heurístico, não uma probabilidade calibrada. Combina resolução/contraste, confiança OCR, integridade lexical, palavras incompletas, repetição excessiva, definições conflitantes e validade dos candidatos. Confiança OCR baixa, sinais de texto fragmentado e conflitos impõem tetos. OCR anterior sem qualidade de imagem recebe sinal conservador; páginas OCR sem confiança não são tratadas como texto confiável.

As únicas correções automáticas são tipográficas ou junções de palavras também encontradas completas na própria fonte. Cada alteração registra original, substituição, motivo, confiança, arquivo e offsets. Não há correção por adivinhação de dicionário. Definições conflitantes pedem confirmação apenas entre trechos do documento; a escolha é auditada e o texto bruto não muda. Outros tipos de ambiguidade sem evidência suficiente bloqueiam recursos em vez de completar lacunas.

O resumo é extrativo. Flashcards exigem definição explícita única com pontuação final, resposta literal e origem verificável. Continuações de linha em texto impresso podem ser reunidas com registro da alteração; fragmentos incompletos não viram cartões. Questões exigem um único termo sustentado pela definição, alternativas distintas, explicação literal e distratores relacionados da fonte. Candidatos abaixo do limiar ou ambíguos são descartados. Cada recurso salvo mantém disciplina, tópico, arquivo, trecho e confiança. A validação é aplicada à geração automática; recursos digitados manualmente continuam disponíveis nos fluxos existentes.

Limites: não há correção de perspectiva nem reconhecimento semântico de diagramas; manuscrito difícil pode não produzir recursos. O cache registra OCR completo por arquivo, não cada versão intermediária nem cada página PDF. O bloqueio contra processamento simultâneo cobre esta aba; múltiplas abas não possuem coordenação transacional da fila. Recarga exige Retomar para não reiniciar trabalho pesado sem interação.
