# Hora Marcada — direção visual

Agenda web responsiva para uma barbearia fictícia. Versão 0.1.0: área privada com login; /demo permanece pública e isolada, apenas com dados fictícios.

## Acesso seguro
- / e /entrar: tela editorial entrar/cadastrar, Google gerenciado e e-mail/senha. Card branco à direita, mensagem preta grande à esquerda e faixa laranja para demo.
- /agenda: protegida, retorna após login. Cliente consulta apenas suas reservas; administrador consulta agenda privada completa.
- /demo: mesma linguagem visual, faixa explícita de demonstração pública. Nenhum botão ou credencial faz o visitante virar administrador.
- Alternar conta/modo limpa cache de reservas para não exibir dados de outra sessão.
- Administrador provisionado por comando local autenticado ao banco, não por formulário ou parâmetro da API.

## Referência

Imagem enviada pelo usuário: portfólio editorial branco, tipografia preta muito grande e compacta, alinhamentos assimétricos, navegação compacta e cartões laranja sobrepostos. Usar somente a linguagem visual, nunca seus textos ou identidade.

## Paleta e tipografia

- Fundo #FAFAF8, superfícies #FFFFFF, texto #161713, secundário #73746C, linhas #E4E5DD.
- Destaque laranja #F15B35; preto para ação principal; verde #34704D para status confirmado.
- Títulos: Arial/Helvetica sans-serif, peso 800–900, tracking -0.065em, caixa alta na abertura. Corpo: Arial/Helvetica, tamanho 14–16px e altura 1.5. Esta escolha segue a referência em vez do default Poppins.
- Borda 1px e cantos 8–16px. Sem sombras em todos os cartões; apenas nos cartões sobrepostos e modal.

## Layout

- Largura máxima 1280px; margens 48px desktop, 20px mobile.
- Cabeçalho: marca à esquerda, navegação em grupo ao centro, botão preto à direita.
- Hero: título editorial em três linhas à esquerda; composição tipográfica de ticket laranja e cartão branco à direita.
- Área funcional: coluna principal de agenda e coluna lateral com resumo e informações da barbearia. Dias selecionáveis, linhas de reservas, filtros por profissional e busca.
- Serviços e equipe são vistas reais acessíveis pela navegação, não links decorativos.
- Mobile: empilhar hero e conteúdo; navegação visível; modal adaptado sem overflow.

## Fluxos

1. Agendar → serviço → profissional → data/horário livre → nome fictício e telefone opcional → confirmação persistida no banco.
2. Navegar dias, filtrar por profissional e buscar reservas.
3. Reagendar com formulário pré-preenchido; preservar a reserva antiga se novo horário estiver ocupado.
4. Cancelar após confirmação; liberar os intervalos ocupados.

## Engenharia

- TypeScript na interface React e API Hono/oRPC; CSS para aparência; Drizzle e SQLite/Turso para persistência.
- Tabelas: serviços, profissionais, reservas e intervalos ocupados. Índice único impede sobreposição inclusive em requisições concorrentes.
- UI sempre mostra carregamento, erro, ausência de dados e sucesso. Modal com foco preso, Escape e retorno de foco.
- Animação curta de entrada; respeitar prefers-reduced-motion.
