const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET;
const TOKEN_TTL = '12h';

if (!JWT_SECRET) {
  console.error('❌ Variável JWT_SECRET não definida. Configure o arquivo .env (veja .env.example).');
  process.exit(1);
}

/**
 * @param {string} storeId
 * @param {string} [role] - 'boss' quando a senha de Chefe já foi confirmada.
 *   Sessões sem esse papel (recém-logadas na loja, ou de funcionário)
 *   não conseguem passar pelo requireBoss.
 */
function signStoreToken(storeId, role) {
  return jwt.sign({ storeId: storeId, role: role || null }, JWT_SECRET, { expiresIn: TOKEN_TTL });
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
    req.role = payload.role || null;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Token inválido ou expirado. Faça login novamente.' });
  }
}

/**
 * Middleware adicional (usar DEPOIS de requireStoreAuth): só deixa passar
 * se o token foi emitido após confirmar a senha de Chefe.
 */
function requireBoss(req, res, next) {
  if (req.role !== 'boss') {
    return res.status(403).json({ error: 'Essa ação é restrita ao Chefe da loja.' });
  }
  next();
}

module.exports = { signStoreToken, requireStoreAuth, requireBoss };
