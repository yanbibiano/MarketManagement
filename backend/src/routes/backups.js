const express = require('express');
const pool = require('../db');

const router = express.Router();

const BACKUP_SECRET = process.env.BACKUP_SECRET;
const RETENTION_DAYS = 30; // quantos dias de backup manter por loja

/**
 * Middleware simples: exige um segredo compartilhado no header
 * 'x-backup-secret'. Não usa JWT porque essa ação não pertence a
 * uma sessão de loja — é uma tarefa automática (cron) que mexe em
 * TODAS as lojas de uma vez.
 */
function requireBackupSecret(req, res, next) {
  if (!BACKUP_SECRET) {
    return res.status(500).json({ error: 'BACKUP_SECRET não configurado no servidor.' });
  }
  const provided = req.headers['x-backup-secret'];
  if (provided !== BACKUP_SECRET) {
    return res.status(401).json({ error: 'Segredo de backup inválido.' });
  }
  next();
}

/* ── POST /api/admin/backup-all — tira uma "foto" de todas as lojas e apaga backups antigos ── */
router.post('/backup-all', requireBackupSecret, async function (req, res) {
  try {
    const stores = await pool.query('SELECT id, data FROM stores');

    for (const store of stores.rows) {
      await pool.query('INSERT INTO store_backups (store_id, data) VALUES ($1, $2)', [store.id, JSON.stringify(store.data)]);
    }

    const pruned = await pool.query(
      "DELETE FROM store_backups WHERE created_at < now() - ($1 || ' days')::interval",
      [RETENTION_DAYS]
    );

    res.json({ ok: true, storesBackedUp: stores.rows.length, oldBackupsRemoved: pruned.rowCount });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao gerar backups.' });
  }
});

module.exports = router;
