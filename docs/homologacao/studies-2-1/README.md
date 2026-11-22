# Estudos 2.1 · Homologação

## Navegação

Na prévia, abra Aprender, escolha a disciplina e toque no nome da unidade. Cada construção abre sua atividade na área principal. A Biblioteca reúne materiais e acesso às aulas. O Baú também oferece o desafio de três cartões e o Castelo dá acesso ao desempenho. Voltar à ilha mantém a unidade; a rota da mesma aba é recuperada após recarregar. Os questionários continuam usando seus rascunhos e o histórico IndexedDB existentes.

## Diagnóstico do conteúdo

Markdown é lido como texto local, com limite de arquivo de 10 MB. Antes da mudança, a preparação recortava cada parágrafo a 1.200 caracteres e selecionava somente os três primeiros trechos com pelo menos 40 caracteres. O Worker pedia fatos explícitos, resposta literal e explicação curta. Esses limites são verificáveis no código. O grau de profundidade de um arquivo pessoal e o efeito do modelo sobre ele exigem avaliação do seu conteúdo e das sugestões retornadas.

A seleção agora percorre parágrafos e seções, aceita foco por assunto e permite revisar lotes seguintes. Cada chamada transmite até três trechos literais de até 1.200 caracteres, com consentimento, e solicita de uma a três questões. Dificuldade, objetivo e tipo são validados no servidor antes de reservar cota. O tópico digitado serve para seleção local. O modelo recebe os trechos e as opções pedagógicas. As opções de conteúdo são questão conceitual e atividade prática objetiva. Explicações acompanham as questões. Flashcards continuam no módulo local. Não há gerador remoto independente de flashcards ou de aulas.

O prompt pede justificativa fundamentada, análise de um distrator e identificação explícita de complementos ou exemplos da IA. A validação rejeita citações incompatíveis, respostas sem apoio literal e duplicatas. Revisão humana precede o salvamento. O limite segue em 800 tokens de saída por lote, duas chamadas por minuto, dez por usuário por dia e vinte globais por dia. Não há continuação automática que consuma cotas.

## Verificação

Markdown sintético com nome de 193 caracteres, quarenta seções repetidas, tabela, código, URL extensa e marcação de imagem. Antes da correção, após importação, a largura chegou a 2.860 px nos três tamanhos testados. Após a correção, seleção, importação e leitura mantiveram a largura de 320, 390 e 430 px em Chromium e WebKit Linux. A tentativa de vincular um segundo arquivo exibiu erro na mesma largura e preservou o primeiro. O percurso verificou retorno das atividades e recuperação da unidade e do material ao recarregar. Em WebKit foi usado perfil persistente e arquivo real em disco.

[Ilha](ilha.jpg) · [Leitura no Chromium](leitura.jpg) · [Leitura no WebKit](leitura-webkit.jpg). Capturas do pacote local. O proprietário já havia validado a geração real e a persistência da versão anterior no Safari. A avaliação pedagógica do novo prompt depende de inferência autenticada e revisão das questões.
