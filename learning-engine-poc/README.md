# POC — cinco maneiras de aprender algoritmos

Protótipo isolado que usa um único conteúdo curto de Introdução aos Algoritmos para testar cinco formatos do mapa do Alfred. Não altera os repositórios do Alfred.

## Executar

O pacote `dist/` já foi compilado e funciona sem CDN ou API externa. Extraia o ZIP e sirva `dist/` por HTTP:

```sh
python3 -m http.server 4173 --directory dist
```

Abra `http://localhost:4173/`. Para desenvolver a partir do código-fonte, use Node.js 22 ou mais recente, depois execute `npm ci`, `npm test` e `npm run dev`.

## Tecnologias verificadas

- **Markmap** (`@markmap/parse` e `@markmap/view`): interpreta uma árvore Markdown, gera um mapa SVG interativo e foi renderizado num DOM emulado com viewport de 390 × 260 px.
- **InkJS** (`inkjs`): compila a história no próprio protótipo, apresenta escolhas e devolve feedback diferente para acerto e erro.
- **TS-FSRS** (`ts-fsrs`): gera e persiste localmente o estado de revisão, com uma data de próxima revisão. O protótipo usa o modelo FSRS-7 padrão com aleatoriedade desativada.
- **Simulação própria**: Bubble sort executado passo a passo, sem `eval`, WebAssembly ou execução de código do estudante.
- **Prática própria**: prioriza a habilidade com menor domínio observado e oferece dicas graduais. É uma regra demonstrativa, ainda não um modelo psicométrico ou uma adaptação de dificuldade validada.

## Resultado

- 11 testes passaram. Cobrem a estrutura do conteúdo, ramos Ink, parsing e renderização Markmap, escolha de objetivo, dicas, ordenação completa do vetor, intervalos legados do Alfred e revisão TS-FSRS sem mutar o cartão original.
- `npm run build` passou com Vite 6.4.5.
- O bundle principal tem 638 kB sem compressão (187 kB gzip); o Vite sinaliza chunk acima de 500 kB. Para produção, compilar histórias Ink na etapa de build, dividir os módulos e avaliar o tamanho no Safari antes de integrar.
- O Chromium headless deste ambiente não iniciou por uma restrição do processo do navegador. A POC não foi validada num browser gráfico nem num iPhone real. O teste de 390 × 260 px é DOM emulado, não prova de Safari/iOS.

## Limites pedagógicos e técnicos

O exemplo de ordenação é material autoral demonstrativo e inclui aviso para conferir a disciplina. Não usa um PDF acadêmico real, geração de IA, OCR, uma imagem gerada, nem conteúdo H5P. A figura SVG mostra uma operação e foi feita para ensinar a comparação; não é decoração.

O armazenamento usa `localStorage` e serve apenas para a POC. Uma implementação Alfred deveria salvar no IndexedDB existente, usar conceitos e respostas rastreáveis à fonte, e registrar cada formato como representação reutilizável do mesmo objetivo de aprendizagem.

Não há sincronização, conta, chamadas externas, modelo de IA, análise de lacunas confiável, certificação de resultados ou publicação pública. Para testar no iPhone, sirva o conteúdo por uma origem acessível ao aparelho e use dados fictícios.
