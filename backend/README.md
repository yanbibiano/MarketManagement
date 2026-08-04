# GestãoLoja — Backend (API)

API REST em Node.js + Express que substitui o antigo armazenamento em
`localStorage` por um banco PostgreSQL de verdade. Senhas de loja e de
funcionário nunca ficam salvas no navegador — só um token de sessão (JWT)
com validade de 12h.

## Rodando localmente

```bash
cd backend
npm install
cp .env.example .env      # depois edite o .env com seus dados reais
npm start                 # roda em http://localhost:3000
```

Antes do primeiro `npm start`, crie a tabela no seu banco rodando o
conteúdo de `schema.sql` (veja abaixo como conseguir um banco grátis).

## Deploy 100% grátis (passo a passo)

### 1. Banco de dados — Supabase (PostgreSQL grátis para sempre)

1. Crie uma conta em [supabase.com](https://supabase.com) e um novo projeto.
2. No painel, vá em **SQL Editor → New query**, cole o conteúdo de
   `schema.sql` deste repositório e execute (▶ Run).
3. Vá em **Project Settings → Database → Connection string** (modo *URI*)
   e copie a string — é o valor de `DATABASE_URL`.
   > Alternativa: [neon.tech](https://neon.tech) também tem PostgreSQL
   > grátis permanente e funciona do mesmo jeito.

### 2. Backend — Render (free tier)

1. Suba a pasta `backend/` para um repositório no GitHub.
2. Em [render.com](https://render.com), crie um **New → Web Service**
   apontando para esse repositório.
3. Configure:
   - **Root Directory:** `backend`
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
   - **Instance Type:** Free
4. Em **Environment**, adicione as variáveis:
   - `DATABASE_URL` → a string do Supabase/Neon (passo 1)
   - `JWT_SECRET` → gere uma com `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`
   - `CORS_ORIGIN` → a URL do frontend (você vai preencher depois de fazer o deploy do frontend)
5. Deploy. Ao final, copie a URL pública (ex: `https://gestaoloja-api.onrender.com`).

> ⚠️ No plano free do Render, o serviço "dorme" após ~15 min sem uso e
> demora alguns segundos para acordar na próxima requisição. Normal para
> um projeto pessoal/estudo — só avise os usuários que a 1ª requisição do
> dia pode demorar um pouco.

### 3. Conectar o frontend a essa API

Edite `frontend/js/api.js` e troque a URL de produção:

```js
return isLocal ? 'http://localhost:3000/api' : 'https://SUA-URL-NO-RENDER.onrender.com/api';
```

Depois faça o deploy do frontend (veja `frontend/README` ou o README raiz)
e volte aqui para atualizar `CORS_ORIGIN` no Render com a URL final do
frontend (ex: `https://gestaoloja.vercel.app`).

## Endpoints

| Método | Rota                                        | Auth | Descrição |
|---|---|---|---|
| GET    | `/api/health`                               | não  | Verifica se a API está de pé |
| GET    | `/api/stores`                               | não  | Lista lojas (id, nome, data de criação, nº de produtos) |
| POST   | `/api/stores`                               | não  | Cria loja `{name, password}` → retorna `token` |
| POST   | `/api/stores/:id/login`                     | não  | Login da loja `{password}` → retorna `token` |
| POST   | `/api/stores/:id/verify`                    | sim  | Reconfirma a senha da loja (usado ao entrar como Chefe) |
| GET    | `/api/stores/:id/data`                      | sim  | Retorna produtos, categorias, histórico, config, funcionários |
| PUT    | `/api/stores/:id/data`                      | sim  | Salva o conjunto de dados da loja |
| POST   | `/api/stores/:id/employees/:empId/login`    | sim  | Valida a senha de um funcionário |
| DELETE | `/api/stores/:id`                           | sim  | Apaga a loja e todos os dados |

Rotas marcadas "sim" exigem header `Authorization: Bearer <token>`.
