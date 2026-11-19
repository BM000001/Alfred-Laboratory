# Auditoria da Central de Estudos 2.0

Bases verificadas no GitHub: Laboratory `89241c6`, Server `48addf9` e Laboratory #76 aberto. Os três documentos de auditoria e contrato do Server estavam no PR #2, em rascunho. As mudanças de interface posteriores no Laboratory mantiveram a entrada de materiais, o vínculo por unidade e os repositórios de estudos.

| Fluxo | Reaproveitado | Alteração ou limite |
| --- | --- | --- |
| Disciplinas, unidades, materiais | `Studies`, importador, repositórios e IndexedDB | O importador prepara e salva originais antes de extrair. A fila pode ser retomada após cancelamento. Falta de quota pode impedir a gravação de um arquivo e é reportada por arquivo. |
| Extração | `documentExtractor`, PDF.js, Tesseract.js, fflate e checkpoints em `files.processing` | Preserva PDF textual, PDFs digitalizados via OCR opcional, DOCX, PPTX, TXT, Markdown, CSV e JSON. Mantém limites e reutiliza extração disponível. OCR na primeira abertura depende de ativos disponíveis no cache. |
| Evidência e confiabilidade | `materialReliability`, `studyMaterialGeneration`, perfis e revisão de ambiguidades | Novas fontes literais incluem listas, passos, perguntas com resposta explícita, comparações, causas, exemplos e fórmulas rotuladas em material elegível. O texto precisa existir no original. Material ambíguo continua sujeito à revisão. Resumos são extrativos. |
| Flashcards | Serviço, interface, filtros, agendamento, cartões antigos e histórico de revisão | Criação/edição rejeita duplicata normalizada dentro do mesmo tópico. A importação continua usando a deduplicação existente por escopo. |
| Simulados | Banco por disciplina/unidade, dificuldade, correção, histórico e explicação | Quando há escolha, novos simulados priorizam questões menos vistas nas últimas cinco tentativas. Tentativas antigas continuam disponíveis. |
| Enriquecimento externo | Contrato do Laboratory #76 e backend atual | #76 verifica estrutura, escopo e citações literal e separa revisão semântica. O Server prepara o contrato v0 de forma isolada. Sem rota nova ou gravação automática de sugestões externas. |

## Dependências

- PDF.js 6.5.438, Tesseract.js 7 e fflate 0.8.3 já estavam no Laboratory. Permanecem nas versões instaladas.
- Avaliamos `ts-fsrs@6.0.0` no registro npm. A licença é MIT e a versão requer Node 24 ou superior, enquanto o CI do Laboratory usa Node 22. Os 860.894 bytes do pacote descompactado incluem arquivos fora do bundle e não estimam o custo no navegador. Adiamos a integração até medir bundle e navegador e definir migração verificável de agenda e histórico.
- OpenTutor foi considerado como referência da auditoria do Server. A integração exigiria uma estratégia de execução e revisão próprias e ficou fora desta entrega.

## Validação e limites

Os testes usam fixtures locais e incluem extração de PDF com e sem texto, Office, cancelamento, retomada e armazenamento local, histórico, atualização de cartões e limites do contrato. Uma falha no armazenamento local pode impedir que um arquivo seja salvo, inclusive se o navegador encerrar a aba durante a fase inicial de gravação. O estado de processamento persistido permite reabrir os materiais já gravados.

A homologação física deve testar Safari e PWA com um lote PDF textual + PDF digitalizado + DOCX, cancelamento e retomada após fechar, revisão de cartões, histórico de simulados e acesso em modo avião depois de carregar o aplicativo. Pressão de memória de OCR e primeira execução offline dependem dos ativos e do aparelho.
