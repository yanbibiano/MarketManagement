const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET;
const TOKEN_TTL = '12h';

if (!JWT_SECRET) {
  console.error('❌ Variável JWT_SECRET não definida. Configure o arquivo .env (veja .env.example).');
  process.exit(1);
}

function signStoreToken(storeId) {
  return jwt.sign({ storeId }, JWT_SECRET, { expiresIn: TOKEN_TTL });
}

/**
 * Middleware: exige um Bearer token válido cujo storeId bata com
 * o :id da rota (ex: /api/stores/:id/data). Garante que uma loja
 * não consiga ler/escrever dados de outra loja.
 */
function requireStoreAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;

  if (!token) {
    return res.status(401).json({ error: 'Token de autenticação ausente.' });
  }

  try {
    const payload = jwt.verify(token, JWT_SECRET);
    if (payload.storeId !== req.params.id) {
      return res.status(403).json({ error: 'Token não corresponde a esta loja.' });
    }
    req.storeId = payload.storeId;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Token inválido ou expirado. Faça login novamente.' });
  }
}

module.exports = { signStoreToken, requireStoreAuth };
