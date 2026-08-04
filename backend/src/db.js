const { Pool } = require('pg');

if (!process.env.DATABASE_URL) {
  console.error('❌ Variável DATABASE_URL não definida. Configure o arquivo .env (veja .env.example).');
  process.exit(1);
}

// Supabase / Neon / Render exigem conexão SSL. rejectUnauthorized:false evita
// erro de certificado autoassinado em alguns provedores gratuitos.
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

pool.on('error', (err) => {
  console.error('Erro inesperado no pool do PostgreSQL:', err);
});

module.exports = pool;
