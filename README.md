# GestãoLoja

Sistema de gestão de estoque e vendas para pequenas lojas.

Agora com **backend próprio (Node.js + Express) e banco de dados
PostgreSQL** — os dados deixaram de ficar presos ao `localStorage` do
navegador e passam a viver num banco de verdade, acessível de qualquer
dispositivo, com autenticação por senha (hash bcrypt) + sessão JWT.

## Estrutura do projeto

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

## Como colocar no ar (grátis)

Siga nesta ordem — cada passo depende do anterior:

1. **Banco de dados** — crie um projeto Postgres grátis no
   [Supabase](https://supabase.com) ou [Neon](https://neon.tech) e rode
   `backend/schema.sql` nele.
2. **Backend** — suba `backend/` no [Render](https://render.com) (free
   tier), configurando as variáveis de ambiente (`DATABASE_URL`,
   `JWT_SECRET`, `CORS_ORIGIN`). Detalhes em `backend/README.md`.
3. **Frontend** — suba `frontend/` no [Vercel](https://vercel.com) ou
   [Netlify](https://netlify.com) (site estático, sem build). Antes,
   aponte `frontend/js/api.js` para a URL do backend. Detalhes em
   `frontend/README.md`.
4. Volte no Render e atualize `CORS_ORIGIN` com a URL final do frontend.

Todos os serviços acima têm camada gratuita permanente — sem cartão de
crédito. A única limitação prática é que o backend no Render "dorme"
depois de ficar um tempo sem uso e leva alguns segundos para acordar na
próxima requisição.

## O que mudou em relação à versão anterior (100% localStorage)

-  Dados salvos em PostgreSQL, acessíveis de qualquer navegador/dispositivo — não dependem mais de um único computador/navegador.
-  Senhas de loja e de funcionário protegidas com **bcrypt** no servidor (antes eram um hash fraco calculado e comparado no navegador).
-  Sessão via **JWT** (token expira em 12h) em vez de ficar tudo aberto no `localStorage`.
-  Estrutura de pastas separando claramente `backend/` (API) de `frontend/` (interface).
-  Exige internet: sem conexão com o backend, o app não carrega dados (diferente da versão anterior, que era 100% offline).
-  Restaurar um backup antigo (`.json` exportado antes) não traz de volta as senhas de funcionários — é preciso recadastrar as senhas depois de importar.

## Funcionalidades

- Multi-lojas com senha individual por loja
- Perfis de acesso: Chefe (acesso total) e Funcionário (só vendas)
- Estoque com variações, código de barras, categorias
- Vendas com carrinho, formas de pagamento, baixa automática de estoque
- Histórico de vendas e movimentações com filtros
- Precificação em lote por margem de lucro
- Relatórios com gráfico de vendas (Chart.js)
- Import/export de planilhas `.xlsx`/`.xls`/`.csv`
- Backup/restauração manual em `.json`
- PWA — instalável, com ícone e tema
