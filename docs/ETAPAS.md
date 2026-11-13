# Como construímos o Hora Marcada

Este guia acompanha a agenda e a etapa de acesso privado. O objetivo é entender o caminho de um agendamento, não decorar nomes de ferramentas.

## 1. Escolher a linguagem e limitar o projeto

**Linguagem: TypeScript.** Usamos a mesma linguagem nas telas e no servidor. Um tipo funciona como um contrato: `start: number` significa que o início precisa ser um número; `customerName: string` representa texto.

O primeiro recorte é uma barbearia fictícia, com uma agenda web que também funciona no navegador do celular. Não começamos por pagamentos ou WhatsApp porque exigiriam integrações que não ajudam a provar a regra principal: reservar um horário sem conflitos.

## 2. Organizar o código e a aparência

**TypeScript + React nas telas; CSS no visual.** React divide a interface em componentes. Um modal de agendamento é um componente; a página que reúne a agenda é outro. CSS define espaçamento, cores e o comportamento do layout em telas pequenas.

A imagem escolhida guiou apenas o visual: branco, tipografia preta grande, espaço entre seções e laranja em destaque. O nome, conteúdo e elementos do projeto são próprios. `design.md` registra essas decisões para manter consistência nas próximas etapas.

## 3. Criar o banco

**TypeScript com Drizzle descreve tabelas; SQL cria as estruturas no banco SQLite/libSQL.** Um banco é onde os dados permanecem depois que a página fecha.

- `services`: nome, preço e duração de cada serviço.
- `professionals`: profissionais da equipe.
- `appointments`: cliente, serviço, profissional, data, horário e status.
- `occupied_slots`: blocos de tempo que cada atendimento ocupa.
- `settings`: marcador técnico que indica se os dados fictícios já foram criados.

Exemplo: um corte às 10h com duração de 45 minutos ocupa os blocos 10h, 10h15 e 10h30. Um índice único impede que o mesmo profissional tenha dois registros para o mesmo dia e bloco. Não basta esconder horários na tela: o banco também precisa garantir a regra.

Os preços são guardados em centavos: R$ 45 vira `4500`. Isso evita problemas de arredondamento comuns em valores monetários decimais.

## 4. Escrever as regras e a API

**Linguagem: TypeScript.** `scheduling.ts` contém funções que não dependem da interface nem do banco. Elas calculam datas, horários, blocos e disponibilidade. Esse isolamento permite testar as regras com facilidade.

A API é o ponto de entrada do servidor. A interface pede uma ação; o servidor verifica a entrada e altera o banco. Hono recebe as requisições; oRPC organiza as operações; Zod valida os dados enviados.

Operações implementadas em `routes/agenda.ts`:

| Operação | Responsabilidade |
|---|---|
| `catalog` | Listar serviços, profissionais e limites de data |
| `list` | Consultar reservas de um dia |
| `availability` | Calcular horários livres de um profissional para um serviço |
| `create` | Validar e gravar reserva + blocos |
| `reschedule` | Alterar a reserva sem perder a antiga se ocorrer erro |
| `cancel` | Cancelar e liberar os blocos, preservando o histórico |

Uma **transação** é um conjunto de alterações que precisa funcionar inteiro ou não funcionar. Se o reagendamento falhar ao ocupar o novo horário, o banco desfaz a troca e mantém a reserva antiga.

Mesmo quando dois visitantes clicam simultaneamente, uma tela desatualizada não pode confirmar duas reservas sobrepostas. A restrição do banco continua valendo. Um bloqueio temporário do SQLite retorna um erro recuperável, não uma confirmação falsa.

## 5. Conectar a interface ao servidor

**TypeScript + React; CSS para apresentação.** Os hooks em `queries/agenda.ts` conectam a tela à API. Um hook reúne comportamento reutilizável. TanStack Query controla carregamento, resultado e erro.

Fluxo completo de uma reserva:

1. O visitante abre o formulário e escolhe serviço, profissional e data.
2. A interface consulta `availability` e mostra apenas horários livres.
3. O visitante escolhe o início e informa um nome fictício.
4. A API valida novamente, porque qualquer requisição pode chegar com dados incorretos.
5. O banco salva a reserva e os blocos na mesma transação.
6. A interface atualiza as consultas, mostra a confirmação e exibe a reserva na agenda.

Não usamos chamadas HTTP escritas manualmente nos componentes. O cliente tipado ajuda a detectar erros de contrato durante o build.

O modal também trata navegação por teclado, Escape, foco dentro do formulário e devolução do foco ao fechar. Isso melhora o uso sem mouse; não substitui uma auditoria completa de acessibilidade.

## 6. Testar em camadas

**Testes em TypeScript com Bun; teste de navegador em Python com Playwright.** Python aqui é apenas uma ferramenta auxiliar de verificação — não mudou a linguagem principal da aplicação.

- 20 testes unitários verificam as funções de horário e data.
- 16 testes de integração verificam API + SQLite temporário, incluindo rollback, duplicatas e concorrência.
- 24 testes adicionais verificam autenticação real, autorização por dono/papel, sessão expirada, logout, limite de login e isolamento da demo. Total: **60 testes**.
- O teste de navegador exercita criar, recarregar, reagendar, cancelar, consultar catálogo, filtrar equipe, pesquisar e usar telas de tamanhos diferentes.
- `bun run build` verifica TypeScript e gera o pacote da aplicação.
- `bun run lint` verifica convenções e problemas estáticos de acessibilidade.

Testar o banco e a interface são atividades diferentes. Uma regra correta no servidor não garante que um botão esteja conectado; um botão que parece funcionar não garante que os dados persistam.

## 7. Adicionar contas e permissões

**A linguagem continua TypeScript. Better Auth é uma biblioteca de autenticação.** Autenticação responde “quem está fazendo a requisição?”. Autorização responde “essa pessoa pode fazer isso?”. São verificações diferentes.

- `/entrar`: entrar ou cadastrar na mesma tela; novas contas são sempre clientes.
- `/agenda`: exige sessão válida; cliente vê suas reservas e administrador vê a agenda privada completa.
- `/demo`: pública e separada, com dados fictícios, sem coleta de telefone.

As tabelas `user`, `account` e `session` guardam contas, credenciais e sessões. A senha é transformada em hash; não guardamos a senha original. `appointments.userId` identifica o dono. `scope` separa demo de privado também no índice dos blocos de horário.

O servidor define dono e escopo a partir da sessão/namespace, não de campos enviados pela tela. Cancelar, reagendar ou usar `excludeId` exige verificar a propriedade da reserva. O papel é relido do banco em toda requisição privada: revogar administração não exige esperar a sessão vencer.

Para conceder administração, usamos `tools/set-role.ts`, uma ferramenta de terminal com acesso ao banco; não existe botão público de promoção. O README mostra os comandos. Nunca promover automaticamente o primeiro usuário cadastrado.

No SQLite local, `database/connection.ts` organiza as transações numa fila: a mesma conexão não inicia dois conjuntos de commit/rollback ao mesmo tempo. A restrição única do banco ainda é responsável por impedir duplicatas.

**React continua sendo a biblioteca de interface; CSS define a aparência; Bun executa o código e os testes.** A página de acesso usa o mesmo visual da agenda. O cache é separado por conta/escopo e limpo ao entrar/sair. Proteção da rota na tela melhora a experiência, mas não substitui as verificações na API.

O teste de navegador adicional verificou cadastro, persistência da sessão, isolamento de duas contas e demo, promoção por CLI, visão administrativa, logout, senha incorreta e login. Google gerenciado está configurado, mas o fluxo completo com uma conta Google real ainda precisa de validação manual.

## 8. Preparar para o GitHub

Criamos README em português com capturas e diagrama de arquitetura, guia de etapas, migrações do banco, configuração de exemplo sem credenciais, licença MIT e workflow de verificação. O código foi formatado para facilitar o estudo. Para rodar localmente, é necessário gerar um `BETTER_AUTH_SECRET` exclusivo — siga o README.

O download e o repositório excluem `.env`, dependências, bancos e arquivos de build. O repositório público é [GuiNascimento77/hora-marcada](https://github.com/GuiNascimento77/hora-marcada). Publicar o código no GitHub não equivale a colocar a aplicação em produção.

## O que ainda falta para uso real

Agora existem autenticação e permissões, mas isso não torna o projeto pronto para clientes reais. Ainda faltam verificação de e-mail, recuperação de senha, validação manual do Google, gestão do expediente, proteção contra abuso da demo, auditoria, backups e políticas para tratamento dos dados. Use somente contas e nomes fictícios, com senhas de teste não reutilizadas.

Não confunda aparência finalizada ou testes aprovados com produto completo. Esta entrega valida o núcleo da agenda e o controle de acesso; a operação real exige revisão de segurança e gestão do negócio.