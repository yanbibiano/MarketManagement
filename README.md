GestãoLoja

Sistema full-stack de gestão de estoque e vendas para pequenas lojas — multi-loja, com controle de acesso por papel, leitura de código de barras e relatórios em tempo real.

Migrado de uma versão 100% localStorage para uma arquitetura cliente-servidor real: Node.js + Express + PostgreSQL, com autenticação via JWT e senhas protegidas por bcrypt.

Demo: [link do Vercel aqui] · API: [link do Render aqui]

<!-- Adicione aqui 2-3 screenshots ou um GIF do sistema em uso. Exemplo: ![Tela de vendas](./docs/screenshot-vendas.png) -->
Stack
Camada	Tecnologias
Backend	Node.js, Express, PostgreSQL, JWT, bcrypt
Frontend	HTML, CSS, JavaScript puro, PWA (Service Worker)
Infra	Render (API) + Supabase (banco) + Vercel (frontend)
Extras	html5-qrcode (scanner de código de barras), Chart.js (relatórios)

```
GestaoLoja/
├── backend/     ← API REST (Node.js + Express + PostgreSQL)
│   ├── src/
│   ├── schema.sql
│   └── README.md   ← como rodar e fazer deploy grátis
└── frontend/    ← Interface web (HTML/CSS/JS puro)
    ├── css/
    ├── js/
    └── README.md   ← como rodar e fazer deploy grátis
```

Funcionalidades
Multi-lojas com senha individual por loja
Perfis de acesso: Chefe (acesso total) e Funcionário (só vendas)
Estoque com variações, código de barras e categorias
Vendas com carrinho, formas de pagamento e baixa automática de estoque
Cancelamento de venda com restauração automática de estoque
Histórico de vendas e movimentações com filtros
Precificação em lote por margem de lucro
Relatórios com gráfico de vendas (Chart.js)
Import/export de planilhas .xlsx / .xls / .csv
Backup/restauração manual em .json
PWA — instalável, com ícone e tema próprio
Como colocar no ar (grátis)

Siga nesta ordem — cada passo depende do anterior:

Banco de dados — crie um projeto Postgres grátis no Supabase ou Neon e rode backend/schema.sql nele.
Backend — suba backend/ no Render (free tier), configurando as variáveis de ambiente (DATABASE_URL, JWT_SECRET, CORS_ORIGIN). Detalhes em backend/README.md.
Frontend — suba frontend/ no Vercel ou Netlify (site estático, sem build). Antes, aponte frontend/js/api.js para a URL do backend. Detalhes em frontend/README.md.
Volte no Render e atualize CORS_ORIGIN com a URL final do frontend.

Todos os serviços acima têm camada gratuita permanente — sem cartão de crédito. A única limitação prática é que o backend no Render "dorme" depois de ficar um tempo sem uso e leva alguns segundos para acordar na próxima requisição.
