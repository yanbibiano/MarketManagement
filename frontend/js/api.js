/* ═══════════════════════════════════════════
   API CLIENT — comunicação com o backend
   Troque API_BASE_URL pela URL do seu backend
   quando fizer o deploy (ex: Render).
═══════════════════════════════════════════ */
var API_BASE_URL = (function () {
  // Em desenvolvimento local (Live Server, file://, etc.) usa localhost:3000.
  // Em produção, troque a linha abaixo pela URL pública do seu backend
  // (ex: 'https://gestaoloja-api.onrender.com/api').
  var isLocal = ['localhost', '127.0.0.1', ''].indexOf(location.hostname) !== -1;
  return isLocal ? 'http://localhost:3000/api' : 'https://SUBSTITUA-PELA-URL-DO-SEU-BACKEND/api';
})();

var sessionToken = sessionStorage.getItem('gloja_token') || null;

function setSessionToken(token) {
  sessionToken = token;
  if (token) sessionStorage.setItem('gloja_token', token);
  else sessionStorage.removeItem('gloja_token');
}

/**
 * Wrapper de fetch: monta URL, injeta o token (se houver) e trata erros
 * de forma padronizada. Lança um Error com .message amigável em pt-BR.
 */
async function apiFetch(path, options) {
  options = options || {};
  var headers = Object.assign({ 'Content-Type': 'application/json' }, options.headers || {});
  if (sessionToken) headers['Authorization'] = 'Bearer ' + sessionToken;

  var res;
  try {
    res = await fetch(API_BASE_URL + path, {
      method: options.method || 'GET',
      headers: headers,
      body: options.body ? JSON.stringify(options.body) : undefined,
    });
  } catch (networkErr) {
    throw new Error('Não foi possível conectar ao servidor. Verifique sua internet.');
  }

  var payload = null;
  try { payload = await res.json(); } catch (e) { /* corpo vazio */ }

  if (!res.ok) {
    throw new Error((payload && payload.error) || 'Erro ao comunicar com o servidor (' + res.status + ').');
  }
  return payload;
}

var Api = {
  listStores: function () {
    return apiFetch('/stores', { method: 'GET' });
  },
  createStore: function (name, password) {
    return apiFetch('/stores', { method: 'POST', body: { name: name, password: password } });
  },
  loginStore: function (id, password) {
    return apiFetch('/stores/' + id + '/login', { method: 'POST', body: { password: password } });
  },
  verifyStorePassword: function (id, password) {
    return apiFetch('/stores/' + id + '/verify', { method: 'POST', body: { password: password } });
  },
  getStoreData: function (id) {
    return apiFetch('/stores/' + id + '/data', { method: 'GET' });
  },
  saveStoreData: function (id, data) {
    return apiFetch('/stores/' + id + '/data', { method: 'PUT', body: data });
  },
  deleteStore: function (id) {
    return apiFetch('/stores/' + id, { method: 'DELETE' });
  },
  employeeLogin: function (storeId, empId, password) {
    return apiFetch('/stores/' + storeId + '/employees/' + empId + '/login', {
      method: 'POST',
      body: { password: password },
    });
  },
};
