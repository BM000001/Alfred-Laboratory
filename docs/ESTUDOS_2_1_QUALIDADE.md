# Central de Estudos 2.1

## Linha de base

A main `6d81030` tinha os PRs #76 e #78 integrados. O motor convertia trechos com formato de definição em cartões mesmo quando o assunto era uma instrução ou um estado. Usava respostas de perguntas diferentes como opções de múltipla escolha. As aulas genéricas repetiam a resposta no conceito, na analogia e na ligação com a matéria. Termos repetidos com definições diferentes exigiam revisão mesmo em cenários de execução ou versões distintas.

## Comportamento atual

- Candidatos de geração futura passam por filtros de conceito, contexto, evidência literal, confiança de extração e duplicidade. Pares explícitos de pergunta e resposta permanecem como recordação ativa, sem combinar respostas como alternativas. Questões por definição continuam no simulado quando há quatro opções distintas e rastreáveis a definições inequívocas do próprio material. A adequação semântica das opções ainda pode requerer conferência humana.
- Estados tabulares e instruções ficam fora da geração. Diferenças complementares ou de versão são sinalizadas de forma informativa, com acesso aos trechos e sem exigir uma escolha. Predicados opostos no mesmo contexto ainda abrem revisão. A opção de continuar preserva ambos os trechos e exclui o termo em disputa da geração automática. O mecanismo local não deduz linha do tempo nem resolve contradições semânticas entre arquivos.
- Uma aula curta sobre referências compartilhadas fica disponível quando o trecho salvo sustenta a relação. Inclui mecanismo, exemplo didático identificado, aplicação, erro comum e autoverificação. O exemplo em Python exige a identificação da linguagem no trecho. Outros conteúdos aparecem como explicações extrativas ou respostas de cartões; o texto de origem fica em uma seção expansível sem repetição. As analogias específicas permanecem nos contextos em que foram escritas.
- Cartões antigos continuam no repertório com o histórico intacto. Ao abrir uma aula de um assunto antigo que hoje seria rejeitado, a interface recomenda revisão. O checkpoint pode guardar a escolha de continuar sem usar as definições em disputa em um campo opcional, compatível com backups anteriores.

## Corpus reproduzível

O corpus em `src/modules/studies/__fixtures__/pedagogicalCorpus.json` contém 12 exemplos sintéticos. Cada texto foi avaliado com `validateMaterialResources(text, assessMaterial(text).score, 'printed')`. Um grupo falso de revisão é um grupo de `relevantAmbiguities(text)` em um caso sem oposição no mesmo contexto. O caso `oposicao` é o controle positivo.

| Medida | 6d81030 | 2.1 |
| --- | ---: | ---: |
| Candidatos contabilizados (aceitos + rejeitados) | 22 | 25 |
| Atividades aceitas com trecho literal verificável | 14 | 12 |
| Candidatos rejeitados | 8 | 13 |
| Grupos de revisão indevida | 3 | 0 |
| Grupo sinalizado no controle de oposição | 1 | 1 |

A contagem antiga de rejeições omitia itens eliminados antes da validação, como duplicatas e rótulos de contexto. A versão nova registra 6 exclusões por contexto, 6 por evidência insuficiente ou ambiguidade de uma definição e 1 por duplicidade. Os números descrevem este corpus pequeno. Eles não estimam precisão em materiais novos.

Para reproduzir a avaliação, exporte os dois arquivos do motor na referência anterior, empacote as duas versões e execute o mesmo corpus.

```sh
dir=$(mktemp -d)
for file in materialReliability studyMaterialGeneration; do
  git show "6d81030:src/modules/studies/$file.ts" > "$dir/$file.ts"
done
node_modules/.bin/esbuild "$dir/materialReliability.ts" --bundle --platform=node --outfile="$dir/before.cjs"
node_modules/.bin/esbuild src/modules/studies/materialReliability.ts --bundle --platform=node --outfile="$dir/after.cjs"
node - "$dir" <<'JS'
const corpus = require('./src/modules/studies/__fixtures__/pedagogicalCorpus.json');
for (const variant of ['before', 'after']) {
  const engine = require(process.argv[2] + '/' + variant + '.cjs');
  for (const [name, source] of Object.entries(corpus)) {
    const output = engine.validateMaterialResources(source, engine.assessMaterial(source).score, 'printed');
    const accepted = [...output.flashcards, ...output.questions];
    console.log(variant, name, accepted.length, output.rejected,
      accepted.filter(item => source.includes(item.sourceExcerpt)).length,
      engine.relevantAmbiguities(source).length, output.reasons);
  }
}
JS
```

## Homologação

No PC e no iPhone, importe as instruções, estados, definições e referências do corpus como arquivos TXT separados. Verifique que os originais permanecem disponíveis e que os dois primeiros casos não geram cartões. Abra a aula de referências, confira o exemplo e responda à autoverificação. Importe o caso de oposição, escolha continuar sem usar as definições em disputa e confira os dois trechos na fonte. Em **Praticar**, inicie um simulado, corrija uma questão, feche e retome offline. Confira o histórico depois de concluir. Repita no Safari e na PWA instalada e verifique rótulos e alternativas longas.
