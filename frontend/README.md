# GestãoLoja — Frontend

Interface web (HTML/CSS/JS puro, sem build step) que consome a API do
backend. Veja `../backend/README.md` para subir a API primeiro.

## Rodando localmente

Abra `index.html` com a extensão **Live Server** do VS Code (ou qualquer
servidor estático — não pode ser aberto direto como `file://` porque o
navegador bloqueia `fetch` de origem `file://`).

Por padrão, em `localhost`/`127.0.0.1` o app já aponta para
`http://localhost:3000/api` (o backend rodando localmente).

## Deploy grátis (Vercel ou Netlify)

1. Suba a pasta `frontend/` para um repositório no GitHub.
2. Em [vercel.com](https://vercel.com) (ou [netlify.com](https://netlify.com)),
   importe o repositório apontando o **Root Directory** para `frontend`.
   Não precisa de build command — é site estático puro.
3. Depois do deploy, copie a URL pública (ex: `https://gestaoloja.vercel.app`).
4. Volte no backend (Render) e atualize a variável `CORS_ORIGIN` com essa
   URL exata, senão a API vai bloquear as requisições do frontend.
5. Antes de fazer o deploy, confirme que `js/api.js` já aponta para a URL
   certa do seu backend (veja `../backend/README.md`, passo 3).

## Estrutura

```
frontend/
├── index.html
├── manifest.json     ← PWA
├── sw.js             ← Service Worker (cache do "esqueleto" do app)
├── css/
│   └── styles.css
├── js/
│   ├── api.js         ← cliente HTTP que fala com o backend
│   └── app.js          ← lógica da aplicação
└── icons/
    ├── icon-192.png
    └── icon-512.png
```
