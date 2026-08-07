const express = require('express');
const bcrypt = require('bcryptjs');
const pool = require('../db');
const { signStoreToken, requireStoreAuth, requireBoss } = require('../auth');

const router = express.Router();

const EMPTY_DATA = {
  products: [],
  customCats: [],
  saleHistory: [],
  config: { lowStock: 3 },
  employees: [],
};

/** Remove passHash/passPlain de cada funcionário antes de enviar ao cliente. */
function sanitizeData(data) {
  const d = data || EMPTY_DATA;
  return {
    products: d.products || [],
    customCats: d.customCats || [],
    saleHistory: d.saleHistory || [],
    config: d.config || { lowStock: 3 },
    employees: (d.employees || []).map(function (e) {
      return { id: e.id, name: e.name, created: e.created };
    }),
  };
}

/* ── GET /api/stores — lista pública de lojas (sem senha) ── */
router.get('/', async function (req, res) {
  try {
    const result = await pool.query(
      "SELECT id, name, to_char(created_at,'DD/MM/YYYY') as created, jsonb_array_length(coalesce(data->'products','[]'::jsonb)) as product_count FROM stores ORDER BY created_at ASC"
    );
    res.json(
      result.rows.map(function (r) {
        return { id: r.id, name: r.name, created: r.created, productCount: r.product_count };
      })
    );
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao listar lojas.' });
  }
});

/* ── POST /api/stores — cria loja nova ── */
router.post('/', async function (req, res) {
  try {
    const name = (req.body.name || '').trim();
    const password = req.body.password || '';
    const bossPassword = req.body.bossPassword || '';
    if (!name) return res.status(400).json({ error: 'Nome é obrigatório.' });
    if (password.length < 4) return res.status(400).json({ error: 'Senha da loja mínimo 4 caracteres.' });
    if (bossPassword.length < 4) return res.status(400).json({ error: 'Senha do Chefe mínimo 4 caracteres.' });
    if (bossPassword === password) return res.status(400).json({ error: 'A senha do Chefe precisa ser diferente da senha da loja.' });

    const existing = await pool.query('SELECT id FROM stores WHERE lower(name) = lower($1)', [name]);
    if (existing.rows.length) return res.status(409).json({ error: 'Já existe uma loja com esse nome.' });

    const id = 's' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    const passHash = await bcrypt.hash(password, 10);
    const bossPassHash = await bcrypt.hash(bossPassword, 10);

    const result = await pool.query(
      "INSERT INTO stores (id, name, pass_hash, boss_pass_hash) VALUES ($1,$2,$3,$4) RETURNING id, name, to_char(created_at,'DD/MM/YYYY') as created",
      [id, name, passHash, bossPassHash]
    );
    const store = result.rows[0];
    const token = signStoreToken(store.id);
    res.status(201).json({ id: store.id, name: store.name, created: store.created, token: token });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao criar loja.' });
  }
});

/* ── POST /api/stores/:id/login — valida senha da loja ── */
router.post('/:id/login', async function (req, res) {
  try {
    const password = req.body.password || '';
    const result = await pool.query('SELECT id, name, pass_hash FROM stores WHERE id = $1', [req.params.id]);
    if (!result.rows.length) return res.status(404).json({ error: 'Loja não encontrada.' });

    const store = result.rows[0];
    const ok = await bcrypt.compare(password, store.pass_hash);
    if (!ok) return res.status(401).json({ error: 'Senha incorreta.' });

    const token = signStoreToken(store.id);
    res.json({ token: token, name: store.name });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao autenticar.' });
  }
});

/* ── GET /api/stores/:id/data — dados da loja (protegido) ── */
router.get('/:id/data', requireStoreAuth, async function (req, res) {
  try {
    const result = await pool.query('SELECT data FROM stores WHERE id = $1', [req.params.id]);
    if (!result.rows.length) return res.status(404).json({ error: 'Loja não encontrada.' });
    res.json(sanitizeData(result.rows[0].data));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao carregar dados.' });
  }
});

/* ── PUT /api/stores/:id/data — salva dados da loja (protegido) ── */
router.put('/:id/data', requireStoreAuth, async function (req, res) {
  try {
    const current = await pool.query('SELECT data FROM stores WHERE id = $1', [req.params.id]);
    if (!current.rows.length) return res.status(404).json({ error: 'Loja não encontrada.' });
    const currentEmployees = (current.rows[0].data && current.rows[0].data.employees) || [];

    const incoming = req.body || {};
    const incomingEmployees = Array.isArray(incoming.employees) ? incoming.employees : [];

    // Funde funcionários: se veio passPlain, gera novo hash; senão mantém o hash já salvo.
    const mergedEmployees = [];
    for (const emp of incomingEmployees) {
      let passHash = null;
      if (emp.passPlain) {
        passHash = await bcrypt.hash(emp.passPlain, 10);
      } else {
        const prev = currentEmployees.find(function (e) { return e.id === emp.id; });
        passHash = prev ? prev.passHash : null;
      }
      mergedEmployees.push({ id: emp.id, name: emp.name, created: emp.created, passHash: passHash });
    }

    const newData = {
      products: Array.isArray(incoming.products) ? incoming.products : [],
      customCats: Array.isArray(incoming.customCats) ? incoming.customCats : [],
      saleHistory: Array.isArray(incoming.saleHistory) ? incoming.saleHistory : [],
      config: incoming.config && typeof incoming.config === 'object' ? incoming.config : { lowStock: 3 },
      employees: mergedEmployees,
    };

    await pool.query('UPDATE stores SET data = $1 WHERE id = $2', [JSON.stringify(newData), req.params.id]);
    res.json(sanitizeData(newData));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao salvar dados.' });
  }
});

/* ── POST /api/stores/:id/sales/:saleId/cancel — cancela uma venda (só Chefe): devolve estoque e marca no histórico ── */
router.post('/:id/sales/:saleId/cancel', requireStoreAuth, requireBoss, async function (req, res) {
  try {
    const current = await pool.query('SELECT data FROM stores WHERE id = $1', [req.params.id]);
    if (!current.rows.length) return res.status(404).json({ error: 'Loja não encontrada.' });

    const data = current.rows[0].data || EMPTY_DATA;
    const history = Array.isArray(data.saleHistory) ? data.saleHistory : [];
    const sale = history.find(function (h) { return h.id === req.params.saleId; });

    if (!sale || sale.type !== 'sale') return res.status(404).json({ error: 'Venda não encontrada.' });
    if (sale.canceled) return res.status(400).json({ error: 'Essa venda já foi cancelada.' });

    const products = Array.isArray(data.products) ? data.products : [];
    (sale.items || []).forEach(function (item) {
      const product = products.find(function (p) { return p.id === item.pid; });
      if (!product) return; // produto pode ter sido excluído depois da venda — segue sem quebrar
      if (item.varName && Array.isArray(product.variations)) {
        const variation = product.variations.find(function (v) { return v.name === item.varName; });
        if (variation) variation.qty = (variation.qty || 0) + item.qty;
      } else {
        product.qty = (product.qty || 0) + item.qty;
      }
    });

    sale.canceled = true;
    sale.canceledAt = new Date().toLocaleString('pt-BR');

    const newData = {
      products: products,
      customCats: data.customCats || [],
      saleHistory: history,
      config: data.config || { lowStock: 3 },
      employees: data.employees || [],
    };

    await pool.query('UPDATE stores SET data = $1 WHERE id = $2', [JSON.stringify(newData), req.params.id]);
    res.json(sanitizeData(newData));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao cancelar venda.' });
  }
});

/* ── POST /api/stores/:id/employees/:empId/login — valida senha do funcionário ── */
router.post('/:id/employees/:empId/login', requireStoreAuth, async function (req, res) {
  try {
    const password = req.body.password || '';
    const result = await pool.query('SELECT data FROM stores WHERE id = $1', [req.params.id]);
    if (!result.rows.length) return res.status(404).json({ error: 'Loja não encontrada.' });

    const employees = (result.rows[0].data && result.rows[0].data.employees) || [];
    const emp = employees.find(function (e) { return e.id === req.params.empId; });
    if (!emp || !emp.passHash) return res.status(404).json({ error: 'Funcionário não encontrado.' });

    const ok = await bcrypt.compare(password, emp.passHash);
    if (!ok) return res.status(401).json({ error: 'Senha incorreta.' });

    res.json({ ok: true, name: emp.name });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao autenticar funcionário.' });
  }
});

/* ── POST /api/stores/:id/verify-boss — confirma a senha do Chefe e emite um token com esse papel ── */
router.post('/:id/verify-boss', requireStoreAuth, async function (req, res) {
  try {
    const password = req.body.password || '';
    const result = await pool.query('SELECT pass_hash, boss_pass_hash FROM stores WHERE id = $1', [req.params.id]);
    if (!result.rows.length) return res.status(404).json({ error: 'Loja não encontrada.' });

    const row = result.rows[0];
    // Lojas criadas antes dessa funcionalidade não têm boss_pass_hash ainda —
    // por compatibilidade, aceitam a senha antiga da loja até o Chefe definir uma nova.
    const hashToCheck = row.boss_pass_hash || row.pass_hash;
    const ok = await bcrypt.compare(password, hashToCheck);
    if (!ok) return res.status(401).json({ error: 'Senha incorreta.' });

    const token = signStoreToken(req.params.id, 'boss');
    res.json({ ok: true, token: token, needsBossPasswordSetup: !row.boss_pass_hash });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao verificar senha.' });
  }
});

/* ── PUT /api/stores/:id/boss-password — define/troca a senha do Chefe (só o próprio Chefe) ── */
router.put('/:id/boss-password', requireStoreAuth, requireBoss, async function (req, res) {
  try {
    const newPassword = req.body.newPassword || '';
    if (newPassword.length < 4) return res.status(400).json({ error: 'Senha mínimo 4 caracteres.' });

    const storeResult = await pool.query('SELECT pass_hash FROM stores WHERE id = $1', [req.params.id]);
    if (!storeResult.rows.length) return res.status(404).json({ error: 'Loja não encontrada.' });
    const samePassCheck = await bcrypt.compare(newPassword, storeResult.rows[0].pass_hash);
    if (samePassCheck) return res.status(400).json({ error: 'A senha do Chefe precisa ser diferente da senha da loja.' });

    const newHash = await bcrypt.hash(newPassword, 10);
    await pool.query('UPDATE stores SET boss_pass_hash = $1 WHERE id = $2', [newHash, req.params.id]);
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao trocar senha do Chefe.' });
  }
});

/* ── DELETE /api/stores/:id — apaga a loja e todos os dados (protegido) ── */
router.delete('/:id', requireStoreAuth, async function (req, res) {
  try {
    await pool.query('DELETE FROM stores WHERE id = $1', [req.params.id]);
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao apagar loja.' });
  }
});

module.exports = router;
