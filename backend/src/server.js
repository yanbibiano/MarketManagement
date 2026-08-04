require('dotenv').config();
const express = require('express');
const cors = require('cors');
const storesRouter = require('./routes/stores');

const app = express();

const allowedOrigins = (process.env.CORS_ORIGIN || '')
  .split(',')
  .map(function (s) { return s.trim(); })
  .filter(Boolean);

app.use(
  cors({
    origin: function (origin, callback) {
      // Permite chamadas sem origin (ex: apps mobile, curl/Postman) e origins da lista.
      if (!origin || allowedOrigins.length === 0 || allowedOrigins.indexOf(origin) !== -1) {
        return callback(null, true);
      }
      callback(new Error('Origem não permitida pelo CORS: ' + origin));
    },
  })
);
app.use(express.json({ limit: '5mb' }));

app.get('/api/health', function (req, res) {
  res.json({ ok: true, service: 'gestaoloja-backend', time: new Date().toISOString() });
});

app.use('/api/stores', storesRouter);

app.use(function (req, res) {
  res.status(404).json({ error: 'Rota não encontrada.' });
});

// eslint-disable-next-line no-unused-vars
app.use(function (err, req, res, next) {
  console.error(err);
  res.status(500).json({ error: 'Erro interno do servidor.' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, function () {
  console.log('🚀 GestãoLoja API rodando na porta ' + PORT);
});
