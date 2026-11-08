# Roteiro de testes manuais no iPhone

Estes testes exigem um iPhone real e não são substituídos pelo CI. Registre o resultado de cada item na tabela ao final.

**Pré-requisitos:** iPhone com iOS atualizado, Safari e acesso a https://bm000001.github.io/Alfred/.

**Segurança do teste:** use apenas registros descartáveis. A restauração de backup substitui os dados atuais do Alfred neste dispositivo. Não use dados pessoais importantes como amostra.

## T1. Acesso por HTTPS

1. Abra o endereço do Alfred no Safari.
2. Esperado: a página carrega sem alerta de certificado e mostra o painel inicial, com a identidade Alfred e os cartões do dia.

## T2. Instalação na Tela de Início

1. No Safari, toque em Compartilhar → Adicionar à Tela de Início.
2. Confira o nome e o ícone apresentados antes de adicionar.
3. Abra o Alfred pelo ícone recém-criado.
4. Esperado: o app abre no modo standalone, sem a barra normal de navegação do Safari, e carrega o painel inicial.

## T3. Navegação e responsividade

1. Em modo retrato, use a navegação inferior: Início, Alfred, Tarefas e Agenda.
2. Abra o menu de áreas adicionais e visite Projetos, Estudos, Arquivos, Produtividade e Configurações.
3. Verifique formulários, listas, botões, títulos e rolagem em cada área.
4. Gire para paisagem e repita a navegação.
5. Esperado: nenhum conteúdo ou controle fica cortado; não há rolagem horizontal involuntária da página; o menu móvel abre e fecha corretamente.

## T4. Funcionamento offline

1. Abra o Alfred com conexão e navegue pelas principais áreas para permitir o cache dos recursos.
2. Ative o modo avião.
3. Feche completamente o app e reabra pelo ícone da Tela de Início.
4. Esperado: a interface carregada anteriormente abre a partir do cache e os dados locais continuam visíveis. Registre qualquer tela em branco, erro ou recurso essencial indisponível.

## T5. Persistência após fechar o app

1. Em Tarefas, crie uma tarefa descartável chamada "Teste persistência".
2. Em Estudos, crie uma disciplina descartável e um conteúdo vinculado a ela.
3. Feche completamente o app e reabra após cinco minutos.
4. Esperado: tarefa, disciplina e conteúdo continuam presentes.
5. Repita a conferência após dois dias sem abrir o app e registre a data.

## T6. Exportação de backup JSON

1. Abra Configurações.
2. Em Backup local, toque em "Exportar backup JSON".
3. Esperado: o Safari/iOS inicia o download do arquivo JSON com nome semelhante a `alfred-backup-AAAA-MM-DD.json`.
4. Salve o arquivo em Arquivos e confirme que ele pode ser localizado.

## T7. Exportação de backup criptografado

1. Em Backup criptografado, informe e confirme uma senha com pelo menos 12 caracteres.
2. Toque em "Exportar backup criptografado".
3. Esperado: o arquivo é baixado com nome semelhante a `alfred-backup-criptografado-AAAA-MM-DD.json`.
4. Abra uma cópia em um editor de texto. O conteúdo deve estar criptografado, sem títulos ou dados legíveis dos registros.
5. Guarde a senha separadamente. Sem ela, o arquivo não pode ser recuperado.

## T8. Importação e restauração

1. **Confirme que possui um backup dos dados que deseja preservar.** A restauração substitui todos os dados atuais do Alfred neste dispositivo.
2. Use um backup de teste criado com registros descartáveis.
3. Em Configurações → Restaurar backup, selecione o JSON sem senha.
4. Confira a prévia e a quantidade de registros; só confirme a restauração se estiver usando dados descartáveis.
5. Repita com o arquivo criptografado: senha incorreta deve falhar sem gravar dados; senha correta deve permitir visualizar a prévia.
6. Esperado: a restauração só ocorre após confirmação explícita e os registros do backup ficam disponíveis após recarregar a página.

## T9. Preparação manual para IA externa

1. Abra a área Alfred (Assistente).
2. No painel "Preparar conteúdo para uma IA externa", selecione uma tarefa descartável.
3. Marque a revisão "Revisei este conteúdo: não contém dados sensíveis".
4. Autorize a categoria Pessoal e gere a prévia.
5. Esperado: o texto exato aparece para revisão; nada é enviado automaticamente.
6. Use "Copiar texto" e cole em um campo de texto para verificar a área de transferência.
7. Gere uma nova prévia sem a revisão individual ou sem consentimento da categoria.
8. Esperado: a preparação é bloqueada com a justificativa correspondente.

## T10. Aparência no modo claro/escuro

1. Abra o Alfred com o modo claro do iOS e observe contraste e legibilidade.
2. Ative o modo escuro do iOS e reabra o Alfred.
3. Registre o comportamento observado. **A adaptação completa ao modo escuro ainda não está implementada; este item é uma verificação de limitação, não um critério de aprovação funcional nesta versão.**

## T11. Teclado e campos

1. Abra um formulário em Tarefas, Agenda ou Estudos.
2. Toque em cada campo e preencha dados de teste.
3. Com o teclado aberto, tente alcançar o botão de salvar/enviar rolando a tela.
4. Esperado: o teclado não impede o acesso aos campos nem ao botão principal; não há sobreposição que torne o formulário impossível de concluir.


## T12. OCR local em PDF digitalizado

1. Com internet, adicione um PDF digitalizado pequeno (1 a 3 páginas) sem texto selecionável.
2. Toque em "Aplicar OCR" e confirme que o progresso aparece em português.
3. Aguarde a conclusão e confira o texto página por página, incluindo a indicação de confiança.
4. Feche a leitura, abra novamente o arquivo e toque em "Ver texto salvo".
5. Ainda com internet, adicione um segundo PDF digitalizado sem aplicar OCR nele.
6. Ative o modo avião e aplique OCR ao segundo PDF. Esperado: os assets já carregados são reutilizados do cache local.
7. Opcionalmente, inicie OCR em um PDF maior e toque em "Cancelar OCR"; confirme que a interface volta ao estado normal e que nenhum texto parcial é apresentado como concluído.
8. Teste um PDF com mais de 20 páginas; o Alfred deve explicar o limite por operação sem travar.
9. Esperado: OCR usa assets do próprio domínio Alfred, não envia o PDF para serviços externos e reutiliza os assets em cache após a primeira execução. Registre tempo, modelo do iPhone e versão do iOS.

## Registro de resultados

| Teste | Resultado (OK / Falhou / Não testado) | Versão do iOS | Observações |
|---|---|---|---|
| T1 | | | |
| T2 | | | |
| T3 | | | |
| T4 | | | |
| T5 | | | |
| T6 | | | |
| T7 | | | |
| T8 | | | |
| T9 | | | |
| T10 | | | |
| T11 | | | |
| T12 | | | |
