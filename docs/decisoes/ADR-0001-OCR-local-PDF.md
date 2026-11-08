# ADR-0001 — OCR local para PDFs digitalizados

- **Data:** 2026-11-04
- **Estado:** aceita como direção arquitetural; implementação pendente de validação de tamanho e desempenho.
- **Escopo:** leitura de PDFs escaneados na Central de Estudos.

## Contexto

O Alfred já extrai texto selecionável de PDFs usando PDF.js e persiste a extração no IndexedDB. Quando um PDF é composto por imagens, a extração atual não encontra texto e informa que OCR é necessário.

O requisito do produto é manter os documentos no dispositivo. Não é aceitável enviar PDFs acadêmicos para um serviço remoto nem introduzir downloads silenciosos de modelos de terceiros.

## Opções consideradas

1. **OCR remoto:** descartado. Exigiria enviar o documento para um servidor e criaria dependência externa, custo e risco de privacidade.
2. **Tesseract.js com CDN padrão:** descartado como configuração padrão. A documentação informa que worker, núcleo WebAssembly e dados de idioma podem ser carregados de CDNs; isso viola a exigência de operação local previsível.
3. **Tesseract.js com assets locais:** direção escolhida para protótipo. PDF.js renderiza cada página em canvas; Tesseract.js reconhece a imagem no navegador, usando worker, núcleo WebAssembly e modelo de idioma hospedados no próprio Alfred.
4. **OCR nativo do navegador:** não adotado, pois não existe uma API web interoperável e confiável que possa ser assumida em todos os navegadores-alvo.

## Decisão

Adotar Tesseract.js com assets locais e carregamento sob demanda, condicionado à validação do tamanho final e do desempenho em iPhone/Safari.

Requisitos obrigatórios:

- Nenhuma chamada a CDN, API de OCR ou servidor remoto durante o reconhecimento.
- Worker, arquivos WebAssembly e modelos de idioma devem ser servidos pelo próprio Alfred.
- OCR só começa após ação explícita do usuário; não executar automaticamente ao importar ou abrir um PDF.
- A interface deve informar idioma, páginas selecionadas, estimativa de esforço e espaço necessário quando conhecido.
- Processar páginas sequencialmente, com progresso visível, possibilidade de cancelar e liberação do worker/canvas ao terminar.
- Começar com português (por); inglês poderá ser opção explícita. Não combinar idiomas por padrão sem medir impacto.
- Limitar páginas por operação para proteger memória e bateria em dispositivos móveis. O limite final deve ser definido após teste real; não reutilizar automaticamente o teto de 300 páginas da extração de texto.
- Preservar a extração original e salvar o resultado OCR como texto por página no IndexedDB, identificando método, idioma, data e confiança quando disponível.
- Permitir revisão do texto antes de utilizá-lo para gerar material de estudo.
- Reconhecimento de baixa confiança deve ser apresentado como possível erro, nunca como transcrição garantida.
- O app deve continuar utilizável offline depois que os assets locais necessários estiverem disponíveis e armazenados pelo cache da PWA.
- Não aumentar o download inicial da aplicação: carregar o módulo e os assets OCR apenas quando solicitados.

## Consequências e riscos

- Os assets WebAssembly e o modelo de português aumentam o tamanho publicado. O build deve medir e reportar esses arquivos separadamente antes de liberar a funcionalidade.
- A primeira utilização poderá exigir baixar os assets do próprio domínio do Alfred; isso deve ser informado e só ocorrer após o usuário iniciar o OCR.
- A qualidade depende da resolução, orientação, contraste, fonte e idioma do documento. Fórmulas, tabelas, manuscritos e layouts complexos podem exigir correção manual.
- iPhone/Safari tem restrições de memória e bateria; o limite de páginas e a resolução de renderização precisam ser ajustados por testes reais.
- A licença Apache-2.0 do Tesseract.js não substitui a verificação das licenças dos modelos e de cada asset distribuído.

## Critérios para considerar concluído

1. Testes unitários para seleção de páginas, cancelamento, erro, persistência e metadados de OCR.
2. Teste de integração com PDF digitalizado de amostra, sem rede externa durante o reconhecimento.
3. Verificação automatizada de que o fluxo OCR não faz requisições para hosts externos.
4. Build Pages com medição explícita do peso dos assets OCR.
5. Teste manual em iPhone/Safari: PDF de 1, 5 e 20 páginas, cancelamento, retomada do app, modo offline e persistência após fechar/reabrir.
6. Revisão humana da transcrição em português, incluindo documento com duas colunas e tabelas.

## Referências técnicas

- Tesseract.js: https://github.com/naptha/tesseract.js
- Instalação local do Tesseract.js: https://github.com/naptha/tesseract.js/blob/master/docs/local-installation.md
- Dados de idioma e distribuição local: https://github.com/naptha/tessdata
- PDF.js: https://github.com/mozilla/pdf.js
