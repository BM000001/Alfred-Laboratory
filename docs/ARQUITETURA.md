# Arquitetura inicial — Alfred

## 1. Direção técnica
Stack inicial planejada:
- React para interface.
- TypeScript para tipagem.
- Vite para desenvolvimento e build.
- CSS para estilos e design responsivo.
- IndexedDB para persistência local estruturada.
- Vitest para testes.
- PWA em etapa posterior.

As versões concretas das dependências serão definidas no momento da configuração do projeto e registradas no arquivo de lock.

## 2. Princípios
- Local-first: a aplicação deve funcionar sem depender de servidor próprio.
- Modularidade: cada área de negócio deve ter limites claros.
- Separação de responsabilidades: interface não deve conter regras de persistência.
- Testabilidade: regras de negócio devem poder ser testadas sem renderizar a interface.
- Privacidade: integrações externas serão opcionais e explícitas.
- Evolução incremental: evitar arquitetura complexa antes de existir necessidade real.

## 3. Organização pretendida
```text
src/
├── app/          # Inicialização, rotas e composição da aplicação
├── components/   # Componentes reutilizáveis de interface
├── modules/      # Funcionalidades por domínio
├── services/     # Integrações e serviços de aplicação
├── storage/      # Persistência, repositórios e migrações
├── styles/       # Tokens, temas e estilos globais
└── types/        # Tipos compartilhados, se necessário
```

Cada módulo poderá conter componentes, tipos, serviços e testes próprios quando crescer.

## 4. Domínios iniciais
- Tarefas.
- Projetos.
- Agenda.
- Estudos.
- Arquivos.
- Preferências.

Os domínios devem evitar dependências circulares. Regras importantes devem ficar em funções ou serviços independentes da interface.

## 5. Persistência
IndexedDB é a opção prevista para dados estruturados no navegador. A implementação deverá:
- Centralizar operações em uma camada de armazenamento.
- Versionar o banco e prever migrações.
- Tratar falhas de leitura e gravação.
- Permitir exportação e importação em formato documentado.
- Evitar guardar segredos ou credenciais no armazenamento comum.

Não introduzir sincronização em nuvem no MVP sem decisão explícita.

## 6. Inteligência artificial e integrações
A camada de IA deverá ser independente de fornecedor. Não acoplar componentes React diretamente a uma API específica.

Antes de habilitar qualquer provedor:
- Explicar quais dados serão enviados.
- Solicitar consentimento.
- Minimizar os dados compartilhados.
- Tratar indisponibilidade, erros e limites.
- Nunca expor chaves privadas no frontend.

## 7. Segurança e ações
Separar sugestões de execução. Operações que criem, editem, excluam, concluam ou adiem dados exigem aprovação explícita do usuário. Registrar claramente o resultado das ações.

## 8. Qualidade
- TypeScript com verificações estritas.
- Testes unitários para regras de negócio.
- Testes de interface para fluxos críticos.
- Build de produção como verificação obrigatória.
- Acessibilidade e responsividade verificadas desde o início.

## 9. Decisões em aberto
- Biblioteca de roteamento.
- Biblioteca de componentes ou abordagem própria.
- Estratégia de calendário e recorrência.
- Formato e experiência de backup.
- Estratégia de notificações.
- Provedor de IA e modelo de consentimento.
- Sincronização entre dispositivos.

Decisões só devem ser fechadas quando uma necessidade concreta surgir.