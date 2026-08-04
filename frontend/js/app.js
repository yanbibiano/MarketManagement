/* ═══════════════════════════════════════════
   HELPERS
═══════════════════════════════════════════ */
function $(id){ return document.getElementById(id); }
function escH(s){ var d=document.createElement('div');d.appendChild(document.createTextNode(String(s)));return d.innerHTML; }
function fmt(v){ return 'R$ '+Number(v).toFixed(2).replace('.',',').replace(/\B(?=(\d{3})+(?!\d))/g,'.'); }
function pct(v){ return (+v).toFixed(1)+'%'; }
function uid(){ return 'p'+Date.now().toString(36)+Math.random().toString(36).slice(2,6); }
function dateStr(){ return new Date().toLocaleString('pt-BR',{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'}); }

function showToast(msg,isErr){
  var t=$('toast');
  t.textContent=msg;
  t.className='toast'+(isErr?' err':'')+' show';
  clearTimeout(t._t);
  t._t=setTimeout(function(){ t.classList.remove('show'); },3000);
}

/* ═══════════════════════════════════════════
   TEMA CLARO / ESCURO
═══════════════════════════════════════════ */
var currentTheme = localStorage.getItem('gloja_theme') || 'dark';

function updateThemeBtn(){
  var btn = $('btn-theme-toggle');
  if(btn) btn.textContent = currentTheme === 'dark' ? '☀️ Tema claro' : '🌙 Tema escuro';
}

function applyTheme(theme) {
  currentTheme = theme;
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem('gloja_theme', theme);
  updateThemeBtn();
  // Rebuild chart with new colors if visible
  if(salesChartInstance) renderSalesChart();
}

function toggleTheme() {
  applyTheme(currentTheme === 'dark' ? 'light' : 'dark');
}

// Aplica o tema salvo assim que o DOM estiver pronto
document.addEventListener('DOMContentLoaded', function(){ applyTheme(currentTheme); });

/* ═══════════════════════════════════════════
   AUTH / MULTI-STORE / ROLES
═══════════════════════════════════════════ */
var STORES_KEY='gloja_stores';
var currentStoreId=null, currentStoreName=null, loginTargetId=null;
var currentRole=null;    // 'boss' | 'emp'
var currentEmpId=null;   // id of logged employee
var empLoginTargetId=null;

// Cache local (em memória) da lista de lojas vinda da API — evita refazer
// a requisição toda vez que precisamos só do nome/id de uma loja já listada.
var cachedStores = [];
function findCachedStore(id){ return cachedStores.find(function(s){return s.id===id;}) || null; }
function clearLErr(){ ['lerr','ns-err','slp-err','boss-err','emp-err','emp-pass-err'].forEach(function(id){ var e=$(id);if(e)e.textContent=''; }); }

/* ── STORE LIST ── */
function showLStores(){
  $('login-screen').style.display='flex';
  $('role-screen').style.display='none';
  $('app-screen').style.display='none';
  $('lp-stores').style.display='block';
  $('lp-new').style.display='none';
  $('lp-login').style.display='none';
  renderStoresList();
}
function showNewStore(){
  $('lp-stores').style.display='none';
  $('lp-new').style.display='block';
  $('lp-login').style.display='none';
  setTimeout(function(){$('ns-name').focus();},100);
}
function showStoreLogin(id){
  loginTargetId=id;
  var s=findCachedStore(id);
  if(!s) return;
  $('lp-stores').style.display='none';
  $('lp-new').style.display='none';
  $('lp-login').style.display='block';
  $('slp-name').textContent=s.name;
  $('slp-pass').value=''; $('slp-err').textContent='';
  setTimeout(function(){$('slp-pass').focus();},100);
}
async function renderStoresList(){
  var el=$('stores-list');
  el.innerHTML='<div style="text-align:center;padding:18px;font-size:13px;color:var(--text3)">Carregando...</div>';
  var stores;
  try{
    stores = await Api.listStores();
  }catch(err){
    el.innerHTML='<div style="text-align:center;padding:18px;font-size:13px;color:var(--red)">⚠️ '+escH(err.message)+'</div>';
    return;
  }
  cachedStores = stores;
  if(!stores.length){ el.innerHTML='<div style="text-align:center;padding:18px;font-size:13px;color:var(--text3)">Nenhuma loja cadastrada.</div>'; return; }
  el.innerHTML=stores.map(function(s){
    var cnt=s.productCount||0;
    return '<div class="store-card" onclick="showStoreLogin(\''+s.id+'\')">'+
      '<div class="store-icon">🏪</div>'+
      '<div class="store-info"><div class="store-name">'+escH(s.name)+'</div>'+
      '<div class="store-meta">'+cnt+' produto'+(cnt!==1?'s':'')+' · '+escH(s.created)+'</div></div>'+
      '<div style="color:var(--text3);font-size:20px">›</div></div>';
  }).join('');
}
async function createStore(){
  var name=$('ns-name').value.trim(), pass=$('ns-pass').value, pass2=$('ns-pass2').value;
  var err=$('ns-err');
  if(!name){err.textContent='Digite o nome.';return;}
  if(pass.length<4){err.textContent='Senha mínimo 4 caracteres.';return;}
  if(pass!==pass2){err.textContent='Senhas não coincidem.';return;}
  var store;
  try{
    store = await Api.createStore(name, pass);
  }catch(e){ err.textContent=e.message; return; }
  setSessionToken(store.token);
  cachedStores.push({id:store.id,name:store.name,created:store.created,productCount:0});
  $('ns-name').value='';$('ns-pass').value='';$('ns-pass2').value='';
  showToast('✅ Loja "'+name+'" criada!');
  showStoreLogin(store.id);
}
async function doLogin(){
  var pass=$('slp-pass').value;
  var s=findCachedStore(loginTargetId);
  if(!s) return;
  var login;
  try{
    login = await Api.loginStore(loginTargetId, pass);
  }catch(e){ $('slp-err').textContent=e.message; $('slp-pass').value=''; $('slp-pass').focus(); return; }
  setSessionToken(login.token);
  currentStoreId=loginTargetId;
  currentStoreName=login.name;
  await loadStoreData(loginTargetId);
  showRoleScreen(login.name);
}

/* ── ROLE SCREEN ── */
function showRoleScreen(storeName){
  $('login-screen').style.display='none';
  $('role-screen').style.display='flex';
  $('app-screen').style.display='none';
  $('role-store-name').textContent=storeName;
  showRoleChoose();
}
function showRoleChoose(){
  $('rp-choose').style.display='block';
  $('rp-boss').style.display='none';
  $('rp-emp').style.display='none';
  $('rp-emp-pass').style.display='none';
  var hasEmps=employees&&employees.length>0;
  $('role-opt-emp').style.opacity=hasEmps?'1':'0.45';
  $('role-opt-emp').style.pointerEvents=hasEmps?'auto':'none';
  $('role-opt-emp').querySelector('.role-opt-desc').textContent=hasEmps?'Apenas vendas e consulta de estoque':'Nenhum funcionário cadastrado ainda';
}
function showRoleLogin(role){
  $('rp-choose').style.display='none';
  if(role==='boss'){
    $('rp-boss').style.display='block';
    $('boss-pass').value=''; $('boss-err').textContent='';
    setTimeout(function(){$('boss-pass').focus();},100);
  } else {
    $('rp-emp').style.display='block';
    renderEmpLoginList();
  }
}
function renderEmpLoginList(){
  var el=$('emp-list-login');
  if(!employees.length){el.innerHTML='<div style="text-align:center;padding:14px;font-size:13px;color:var(--text3)">Nenhum funcionário.</div>';return;}
  el.innerHTML=employees.map(function(e){
    return '<div class="store-card" onclick="selectEmpLogin(\''+e.id+'\')">'+
      '<div class="emp-avatar">👤</div>'+
      '<div class="emp-info"><div class="emp-name">'+escH(e.name)+'</div><div class="emp-meta">Funcionário</div></div>'+
      '<div style="color:var(--text3);font-size:20px">›</div></div>';
  }).join('');
}
function selectEmpLogin(empId){
  empLoginTargetId=empId;
  var emp=employees.find(function(e){return e.id===empId;});
  if(!emp) return;
  $('rp-emp').style.display='none';
  $('rp-emp-pass').style.display='block';
  $('emp-login-name').textContent=emp.name;
  $('emp-pass-input').value=''; $('emp-pass-err').textContent='';
  setTimeout(function(){$('emp-pass-input').focus();},100);
}
async function doBossLogin(){
  var pass=$('boss-pass').value;
  if(!currentStoreId){$('boss-err').textContent='Erro interno.';return;}
  try{
    await Api.verifyStorePassword(currentStoreId, pass);
  }catch(e){ $('boss-err').textContent=e.message; $('boss-pass').value=''; $('boss-pass').focus(); return; }
  enterApp('boss', null, currentStoreName||'Loja');
}
async function doEmpLogin(){
  var pass=$('emp-pass-input').value;
  var emp=employees.find(function(e){return e.id===empLoginTargetId;});
  if(!emp){$('emp-pass-err').textContent='Funcionário não encontrado.';return;}
  try{
    await Api.employeeLogin(currentStoreId, emp.id, pass);
  }catch(e){ $('emp-pass-err').textContent=e.message; $('emp-pass-input').value=''; $('emp-pass-input').focus(); return; }
  enterApp('emp', emp.id, currentStoreName||'Loja');
}
function enterApp(role, empId, storeName){
  currentRole=role; currentEmpId=empId||null;
  $('role-screen').style.display='none';
  $('app-screen').style.display='block';
  $('store-name-display').textContent=storeName;
  var ind=$('role-indicator');
  if(role==='boss'){
    ind.className='role-indicator boss'; ind.textContent='👑 Chefe';
  } else {
    var emp=employees.find(function(e){return e.id===empId;});
    ind.className='role-indicator emp'; ind.textContent='👤 '+(emp?emp.name:'Funcionário');
  }
  ind.style.display='flex';
  applyRoleRestrictions();
  setModule('vendas');
  render(); updateHeaderStats();
}
function applyRoleRestrictions(){
  var isBoss=currentRole==='boss';
  // Hide admin module for employees
  $('mnav-admin').style.display=isBoss?'':'none';
  // Hide estoque edit buttons
  var np=$('btn-new-product'); if(np) np.style.display=isBoss?'':'none';
  var nc=$('btn-newcat-estoque'); if(nc) nc.style.display=isBoss?'':'none';
}
function canEdit(){ return currentRole==='boss'; }
function enterStore(id,name){ /* legacy stub */ }
function goToLogin(){
  currentStoreId=null; currentStoreName=null; currentRole=null; currentEmpId=null;
  setSessionToken(null);
  $('app-screen').style.display='none';
  $('role-screen').style.display='none';
  $('login-screen').style.display='flex';
  showLStores();
}

/* ═══════════════════════════════════════════
   DATA LAYER
═══════════════════════════════════════════ */
var products=[], customCats=[], saleHistory=[], config={lowStock:3}, employees=[];
var editId=null, deleteId=null, activeCatEstoque='Todas', activeCatPrecos='Todas';
var DEFAULT_CATS=['Geral','Roupas','Calçados','Acessórios','Eletrônicos','Alimentos','Beleza','Casa','Outros'];
function allCats(){ return DEFAULT_CATS.concat(customCats); }

/**
 * Salva o estado atual (products/customCats/saleHistory/config/employees)
 * no backend. Roda em segundo plano (não bloqueia a UI); o estado local
 * já foi atualizado antes de chamar saveData(), então a tela responde na
 * hora e a persistência acontece de forma otimista.
 */
function saveData(){
  if(!currentStoreId) return;
  Api.saveStoreData(currentStoreId, {
    products:products, customCats:customCats, saleHistory:saleHistory,
    config:config, employees:employees
  }).then(function(saved){
    // Funcionários recém-criados/editados voltam sem passPlain (já hasheado no servidor).
    if(saved && Array.isArray(saved.employees)) employees = saved.employees;
  }).catch(function(err){
    showToast('⚠️ Falha ao salvar: '+err.message, true);
  });
}
async function loadStoreData(id){
  var d;
  try{
    d = await Api.getStoreData(id);
  }catch(err){
    showToast('⚠️ Erro ao carregar dados da loja: '+err.message, true);
    d = null;
  }
  products = d&&d.products?d.products:[];
  customCats = d&&d.customCats?d.customCats:[];
  var rawHistory = d&&d.saleHistory?d.saleHistory:(d&&d.history?d.history:[]);
  saleHistory = Array.isArray(rawHistory)?rawHistory:[];
  config = d&&d.config?d.config:{lowStock:3};
  employees = Array.isArray(d&&d.employees)?d.employees:[];
  activeCatEstoque='Todas'; activeCatPrecos='Todas'; precSelectedIds={};
  $('cfg-low-stock').value=config.lowStock||3;
}
function askResetData(){
  if(confirm('⚠️ Apagar TODOS os dados desta loja? Essa ação não pode ser desfeita.')){
    products=[]; customCats=[]; saleHistory=[]; config={lowStock:3}; employees=[];
    saveData(); closeModal('overlay-cat'); refreshAll();
    showToast('🗑 Dados apagados.');
  }
}

function askDeleteStore(){
  if(!currentStoreId) return;
  var store = findCachedStore(currentStoreId) || {name:currentStoreName};
  if(!store) return;
  $('delete-store-name-label').textContent = store.name;
  $('delete-store-confirm-input').value = '';
  $('delete-store-err').textContent = '';
  $('btn-confirm-delete-store').disabled = true;
  $('overlay-delete-store').classList.add('open');
  setTimeout(function(){ $('delete-store-confirm-input').focus(); }, 100);
}

function checkDeleteStoreInput(){
  var store = findCachedStore(currentStoreId) || {name:currentStoreName};
  var typed = ($('delete-store-confirm-input')||{value:''}).value.trim();
  var match = store && typed.toLowerCase() === store.name.toLowerCase();
  $('btn-confirm-delete-store').disabled = !match;
  $('delete-store-err').textContent = typed && !match ? 'Nome não corresponde.' : '';
}

async function confirmDeleteStore(){
  if(!currentStoreId) return;
  var store = findCachedStore(currentStoreId) || {name:currentStoreName};
  if(!store) return;

  try{
    await Api.deleteStore(currentStoreId);
  }catch(e){
    showToast('⚠️ Erro ao apagar loja: '+e.message, true);
    return;
  }
  cachedStores = cachedStores.filter(function(s){ return s.id !== currentStoreId; });

  closeModal('overlay-delete-store');
  showToast('🗑 Loja "' + store.name + '" apagada.');
  setSessionToken(null);
  goToLogin();
}
function saveCfgLowStock(){
  var v=parseInt($('cfg-low-stock').value)||3;
  if(v<1)v=1;
  config.lowStock=v;
  saveData(); render();
  showToast('✅ Limite de alerta: '+v+' unidades.');
}
function findById(id){ return products.find(function(p){return p.id===id;})||null; }

/* ═══════════════════════════════════════════
   TABS & MODULES
═══════════════════════════════════════════ */
var ALL_TABS=['estoque','vendas','historico','precos','precificacao','relatorio','importexport','funcionarios','configuracoes'];
var MODULE_MAP={
  vendas:  ['vendas','historico'],
  estoque: ['estoque','precos'],
  admin:   ['precificacao','relatorio','importexport','funcionarios','configuracoes']
};
var activeModule='vendas';

function setModule(mod){
  activeModule=mod;
  // Update module buttons
  document.querySelectorAll('.module-btn').forEach(function(b){
    b.classList.toggle('active', b.id==='mnav-'+mod);
  });
  // Show/hide subtabs
  ['vendas','estoque','admin'].forEach(function(m){
    $('subtabs-'+m).style.display=(m===mod)?'flex':'none';
  });
  // Go to first tab of module
  var firstTab=MODULE_MAP[mod][0];
  setTab(firstTab, true);
}

function setModileMobile(mod){
  setModule(mod);
  // Update mobile nav
  document.querySelectorAll('.bnav-btn').forEach(function(b){
    b.classList.toggle('active', b.dataset.module===mod);
  });
}

function setTab(t, skipModuleSwitch){
  ALL_TABS.forEach(function(tab){ $('tab-'+tab).style.display=tab===t?'block':'none'; });
  // Update subtab active state
  document.querySelectorAll('.subtab').forEach(function(el){
    el.classList.toggle('active', el.getAttribute('data-tab')===t);
  });
  if(t==='precos'){renderCatPills('cat-pills-precos','precos');renderPrecos();}
  if(t==='precificacao') renderPrecificacao();
  if(t==='relatorio') renderRelatorio();
  if(t==='historico') renderHistorico();
  if(t==='funcionarios') renderEmpListAdmin();
  if(t==='configuracoes') updateThemeBtn();
  if(t==='vendas'){ setTimeout(function(){var s=$('sale-search');if(s)s.focus();},100); }
}

function enterStore(id,name){
  currentStoreId=id;
  loadStoreData(id);
  $('store-name-display').textContent=name;
  $('login-screen').style.display='none';
  $('app-screen').style.display='block';
  setModule('vendas');
  render(); updateHeaderStats();
}

/* ═══════════════════════════════════════════
   CATEGORY PILLS
═══════════════════════════════════════════ */
function renderCatPills(cid,which){
  var cats=['Todas'].concat(allCats());
  var active=which==='estoque'?activeCatEstoque:activeCatPrecos;
  $( cid).innerHTML=cats.map(function(c){
    return '<button class="cpill'+(c===active?' active':'')+'" data-cat="'+escH(c)+'" data-which="'+which+'">'+escH(c)+'</button>';
  }).join('');
  $(cid).querySelectorAll('.cpill').forEach(function(btn){
    btn.addEventListener('click',function(){
      var cat=this.getAttribute('data-cat'),w=this.getAttribute('data-which');
      if(w==='estoque'){activeCatEstoque=cat;renderCatPills('cat-pills-estoque','estoque');render();}
      else{activeCatPrecos=cat;renderCatPills('cat-pills-precos','precos');renderPrecos();}
    });
  });
}

/* ═══════════════════════════════════════════
   CATEGORIES MODAL
═══════════════════════════════════════════ */
function openCatModal(){
  renderCatList(); $('new-cat-input').value=''; $('cat-err').textContent='';
  $('overlay-cat').classList.add('open');
  setTimeout(function(){$('new-cat-input').focus();},100);
}
function renderCatList(){
  var html=DEFAULT_CATS.map(function(c){ return '<div class="cat-item"><div class="cat-item-top"><span>'+escH(c)+'</span><span class="cat-def-tag">padrão</span></div></div>'; }).join('');
  html+=customCats.map(function(c,idx){
    return '<div class="cat-item" id="ci-'+idx+'">'+
      '<div class="cat-item-top"><span>'+escH(c)+'</span>'+
      '<div style="display:flex;gap:4px">'+
        '<button class="btn btn-blue btn-sm" onclick="startEditCat('+idx+')">Editar</button>'+
        '<button class="btn btn-red btn-sm" data-idx="'+idx+'">Remover</button>'+
      '</div></div>'+
      '<div class="cat-edit-row" id="cer-'+idx+'">'+
        '<input type="text" id="cei-'+idx+'" value="'+escH(c)+'" onkeydown="if(event.key===\'Enter\')saveEditCat('+idx+')">'+
        '<button class="btn btn-accent btn-sm" onclick="saveEditCat('+idx+')">Salvar</button>'+
        '<button class="btn btn-ghost btn-sm" onclick="cancelEditCat('+idx+')">✕</button>'+
      '</div></div>';
  }).join('');
  $('cat-list').innerHTML=html;
  $('cat-list').querySelectorAll('[data-idx]').forEach(function(btn){
    btn.addEventListener('click',function(){
      var idx=parseInt(this.getAttribute('data-idx')), cat=customCats[idx];
      customCats.splice(idx,1);
      products.forEach(function(p){if(p.cat===cat)p.cat='Geral';});
      if(activeCatEstoque===cat)activeCatEstoque='Todas';
      if(activeCatPrecos===cat)activeCatPrecos='Todas';
      renderCatList(); refreshAfterCatChange(); saveData();
    });
  });
}
function startEditCat(idx){ $('cer-'+idx).style.display='flex'; $('cei-'+idx).focus(); $('cei-'+idx).select(); }
function cancelEditCat(idx){ $('cer-'+idx).style.display='none'; }
function saveEditCat(idx){
  var newName=$('cei-'+idx).value.trim(), oldName=customCats[idx], err=$('cat-err');
  if(!newName){err.textContent='Nome inválido.';return;}
  if(allCats().filter(function(c){return c!==oldName;}).some(function(c){return c.toLowerCase()===newName.toLowerCase();})){err.textContent='Já existe.';return;}
  err.textContent='';
  products.forEach(function(p){if(p.cat===oldName)p.cat=newName;});
  if(activeCatEstoque===oldName)activeCatEstoque=newName;
  if(activeCatPrecos===oldName)activeCatPrecos=newName;
  customCats[idx]=newName; renderCatList(); refreshAfterCatChange(); saveData();
  showToast('✏️ Renomeada para "'+newName+'".');
}
function addCategory(){
  var val=$('new-cat-input').value.trim(), err=$('cat-err');
  if(!val){err.textContent='Digite um nome.';return;}
  if(allCats().some(function(c){return c.toLowerCase()===val.toLowerCase();})){err.textContent='Já existe.';return;}
  customCats.push(val); $('new-cat-input').value=''; err.textContent='';
  renderCatList(); refreshAfterCatChange(); saveData();
}
function refreshAfterCatChange(){
  renderCatPills('cat-pills-estoque','estoque');
  renderCatPills('cat-pills-precos','precos');
  populateCatSelect(); render();
}
function populateCatSelect(){
  var sel=$('f-cat'), cur=sel.value;
  sel.innerHTML=allCats().map(function(c){return '<option value="'+escH(c)+'">'+escH(c)+'</option>';}).join('');
  if(cur&&allCats().indexOf(cur)>=0) sel.value=cur;
}

/* ═══════════════════════════════════════════
   PRODUCT MODAL + VARIATIONS
═══════════════════════════════════════════ */
var tempVariations=[];
function openModal(id){
  editId=id||null; populateCatSelect();
  tempVariations=[];
  if(id){
    var p=findById(id);
    $('modal-title-text').textContent='Editar produto';
    $('f-nome').value=p.nome;
    $('f-cat').value=p.cat;
    $('f-barcode').value=p.barcode||'';
    $('f-qty').value=p.qty;
    $('f-custo').value=p.custo;
    $('f-venda').value=p.venda;
    tempVariations=(p.variations||[]).map(function(v){return Object.assign({},v);});
    $('btn-delete-prod').style.display='inline-flex';
  } else {
    $('modal-title-text').textContent='Novo produto';
    ['f-nome','f-barcode','f-qty','f-custo','f-venda'].forEach(function(x){$(x).value='';});
    $('f-cat').value='Geral';
    $('btn-delete-prod').style.display='none';
  }
  renderVarList();
  $('overlay-form').classList.add('open');
  setTimeout(function(){$('f-nome').focus();},100);
}
function renderVarList(){
  $('var-name').value=''; $('var-qty').value='';
  if(!tempVariations.length){ $('var-list').innerHTML=''; return; }
  $('var-list').innerHTML=tempVariations.map(function(v,i){
    return '<div class="var-item">'+
      '<div style="flex:1"><div class="var-item-name">'+escH(v.name)+'</div>'+
      '<div class="var-item-detail">'+v.qty+' un.</div></div>'+
      '<button class="btn btn-red btn-sm" onclick="removeVar('+i+')">✕</button></div>';
  }).join('');
}
function addVariation(){
  var name=$('var-name').value.trim(), qty=parseInt($('var-qty').value)||0;
  if(!name){showToast('Digite o nome da variação.',true);return;}
  if(tempVariations.some(function(v){return v.name.toLowerCase()===name.toLowerCase();})){showToast('Variação já existe.',true);return;}
  tempVariations.push({name:name,qty:qty});
  renderVarList();
}
function removeVar(i){ tempVariations.splice(i,1); renderVarList(); }

function saveProduct(){
  var nome=$('f-nome').value.trim();
  if(!nome){$('f-nome').focus();return;}
  var cat=$('f-cat').value;
  var barcode=$('f-barcode').value.trim();
  var qty=parseInt($('f-qty').value)||0;
  var custo=parseFloat($('f-custo').value)||0;
  var venda=parseFloat($('f-venda').value)||0;
  var variations=tempVariations.slice();
  // If has variations, total qty = sum of variations
  if(variations.length) qty=variations.reduce(function(a,v){return a+v.qty;},0);

  if(editId){
    var p=findById(editId);
    p.nome=nome;p.cat=cat;p.barcode=barcode;p.qty=qty;p.custo=custo;p.venda=venda;p.variations=variations;
  } else {
    products.push({id:uid(),nome:nome,cat:cat,barcode:barcode,qty:qty,custo:custo,venda:venda,variations:variations});
  }
  closeModal('overlay-form'); render(); updateHeaderStats(); saveData();
}

function askDeleteFromModal(){
  if(!editId) return;
  closeModal('overlay-form');
  askDelete(editId);
}
function askDelete(id){
  deleteId=id;
  $('delete-name-msg').textContent=findById(id).nome;
  $('overlay-delete').classList.add('open');
}
function confirmDelete(){
  if(deleteId){
    var p=findById(deleteId);
    addHistory({type:'remove',label:'Produto removido: '+p.nome,detail:'',qty:0,total:0});
    products=products.filter(function(x){return x.id!==deleteId;});
  }
  deleteId=null; closeModal('overlay-delete'); render(); updateHeaderStats(); saveData();
}

/* ═══════════════════════════════════════════
   MODAL UTILS
═══════════════════════════════════════════ */
function closeModal(id){ $(id).classList.remove('open'); }

function formHasData(){
  var nome=($('f-nome')||{value:''}).value.trim();
  var barcode=($('f-barcode')||{value:''}).value.trim();
  var qty=($('f-qty')||{value:''}).value;
  var custo=($('f-custo')||{value:''}).value;
  var venda=($('f-venda')||{value:''}).value;
  // On new product: any field filled = has data
  // On edit: always warn (user might have changed something)
  if(editId) return true;
  return !!(nome||barcode||qty||custo||venda||tempVariations.length);
}

function tryCloseForm(){
  if(formHasData()){
    $('overlay-unsaved').classList.add('open');
  } else {
    closeModal('overlay-form');
  }
}

function forceCloseForm(){
  closeModal('overlay-unsaved');
  closeModal('overlay-form');
}

// overlay-form: clicking outside triggers unsaved-changes check
$('overlay-form').addEventListener('click',function(e){
  if(e.target===this) tryCloseForm();
});

// Other overlays: click outside to close directly
['overlay-delete','overlay-cat','overlay-import','overlay-emp','overlay-unsaved','overlay-delete-store','overlay-edit-hist-date','overlay-global-backup','overlay-discount'].forEach(function(id){
  $(id).addEventListener('click',function(e){if(e.target===this)closeModal(id);});
});

/* ═══════════════════════════════════════════
   FILTER & RENDER ESTOQUE
═══════════════════════════════════════════ */
function getFiltered(q,activeCat){
  var qL=q.toLowerCase();
  return products.filter(function(p){
    var matchQ=!qL||p.nome.toLowerCase().indexOf(qL)>=0||(p.barcode&&p.barcode.indexOf(qL)>=0);
    return matchQ&&(activeCat==='Todas'||p.cat===activeCat);
  }).slice().sort(function(a,b){ return a.nome.localeCompare(b.nome,'pt-BR',{sensitivity:'base'}); });
}

function render(){
  var q=($('search-input')||{value:''}).value;
  var list=getFiltered(q,activeCatEstoque);
  var tq=0,tc=0,tv=0;
  products.forEach(function(p){tq+=p.qty;tc+=p.custo*p.qty;tv+=p.venda*p.qty;});
  $('sum-total').textContent=tq;
  $('sum-custo').textContent=fmt(tc);
  $('sum-venda').textContent=fmt(tv);
  var low=config.lowStock||3;
  var lowProds=products.filter(function(p){return p.qty>0&&p.qty<=low;});
  var alertEl=$('low-alert');
  if(lowProds.length){alertEl.style.display='block';alertEl.textContent='⚠️ Estoque baixo (≤'+low+'): '+lowProds.map(function(p){return p.nome;}).join(', ');}
  else alertEl.style.display='none';
  $('result-count').textContent=list.length===products.length?'':list.length+' resultado'+(list.length!==1?'s':'');
  var tbody=$('tbody-estoque');
  if(!list.length){
    tbody.innerHTML='<tr><td colspan="9" class="empty">'+(products.length?'Nenhum produto encontrado.':'Nenhum produto cadastrado. Clique em "+ Novo produto" para começar.')+'</td></tr>';
    return;
  }
  tbody.innerHTML=list.map(function(p){
    var margem=p.venda>0?((p.venda-p.custo)/p.venda*100):0;
    var lucro=p.venda-p.custo;
    var qtyClass=p.qty===0?'td-low':p.qty<=(config.lowStock||3)?'td-warn':'td-ok';
    var varsHtml='';
    if(p.variations&&p.variations.length){
      varsHtml=p.variations.map(function(v){ return '<span class="td-badge" style="margin:1px">'+escH(v.name)+' ('+v.qty+')</span>'; }).join(' ');
    } else { varsHtml='<span style="color:var(--text3);font-size:11px">—</span>'; }

    // Inline qty adjust (only for boss, products without variations)
    var qtyCell;
    if(canEdit() && (!p.variations || !p.variations.length)){
      qtyCell='<td>'+
        '<div class="qty-inline" data-pid="'+p.id+'">'+
          '<span class="qty-inline-val td-mono '+qtyClass+'" title="Clique para editar">'+p.qty+'</span>'+
          '<div class="qty-inline-edit" style="display:none">'+
            '<input type="number" class="qty-inline-input" value="'+p.qty+'" min="0" style="width:60px">'+
            '<button class="btn btn-accent btn-sm qty-inline-save">✓</button>'+
            '<button class="btn btn-ghost btn-sm qty-inline-cancel">✕</button>'+
          '</div>'+
        '</div>'+
      '</td>';
    } else {
      qtyCell='<td class="td-mono '+qtyClass+'">'+p.qty+'</td>';
    }

    return '<tr>'+
      '<td class="td-name">'+escH(p.nome)+'</td>'+
      '<td class="td-mono" style="font-size:11px;color:var(--text3)">'+(p.barcode?escH(p.barcode):'—')+'</td>'+
      '<td><span class="td-badge td-cat" data-cat="'+escH(p.cat)+'">'+escH(p.cat)+'</span></td>'+
      '<td>'+varsHtml+'</td>'+
      qtyCell+
      '<td class="td-mono" style="color:var(--text2)">'+fmt(p.custo)+'</td>'+
      '<td class="td-mono" style="color:var(--accent)">'+fmt(p.venda)+'</td>'+
      '<td class="td-mono '+(lucro>=0?'td-pos':'td-neg')+'">'+pct(margem)+'</td>'+
      '<td><div class="td-actions">'+
        (canEdit()?'<button class="btn btn-blue btn-sm" data-id="'+p.id+'">Editar</button>':'') +
        (canEdit()?'<button class="btn btn-red btn-sm" data-del="'+p.id+'">Remover</button>':'')+
      '</div></td></tr>';
  }).join('');
  tbody.querySelectorAll('[data-id]').forEach(function(b){b.addEventListener('click',function(){openModal(this.dataset.id);});});
  tbody.querySelectorAll('[data-del]').forEach(function(b){b.addEventListener('click',function(){askDelete(this.dataset.del);});});
  tbody.querySelectorAll('.td-cat').forEach(function(b){b.addEventListener('click',function(){activeCatEstoque=this.dataset.cat;renderCatPills('cat-pills-estoque','estoque');render();});});

  // Inline qty edit wiring
  tbody.querySelectorAll('.qty-inline').forEach(function(wrap){
    var pid=wrap.dataset.pid;
    var valEl=wrap.querySelector('.qty-inline-val');
    var editEl=wrap.querySelector('.qty-inline-edit');
    var input=wrap.querySelector('.qty-inline-input');

    valEl.style.cursor='pointer';
    valEl.addEventListener('click',function(){
      valEl.style.display='none';
      editEl.style.display='flex';
      input.focus(); input.select();
    });
    wrap.querySelector('.qty-inline-cancel').addEventListener('click',function(){
      editEl.style.display='none'; valEl.style.display='';
    });
    function saveInlineQty(){
      var newQty=Math.max(0,parseInt(input.value)||0);
      var p=findById(pid); if(!p) return;
      var oldQty=p.qty;
      if(newQty===oldQty){ editEl.style.display='none'; valEl.style.display=''; return; }
      var diff=newQty-oldQty;
      p.qty=newQty;
      addHistory({type:'adjust',label:'Ajuste de estoque: '+p.nome,detail:(diff>0?'+':'')+diff+' un. ('+oldQty+' → '+newQty+')',qty:Math.abs(diff),total:0});
      saveData(); render(); updateHeaderStats();
      showToast('✅ Estoque de "'+p.nome+'" atualizado para '+newQty+'.');
    }
    wrap.querySelector('.qty-inline-save').addEventListener('click',saveInlineQty);
    input.addEventListener('keydown',function(e){
      if(e.key==='Enter') saveInlineQty();
      if(e.key==='Escape'){ editEl.style.display='none'; valEl.style.display=''; }
    });
  });
}

/* ═══════════════════════════════════════════
   RENDER PREÇOS
═══════════════════════════════════════════ */
function renderPrecos(){
  var q=($('search-precos')||{value:''}).value;
  var list=getFiltered(q,activeCatPrecos); // already sorted by getFiltered
  var tbody=$('tbody-precos');
  if(!list.length){tbody.innerHTML='<tr><td colspan="6" class="empty">Nenhum produto encontrado.</td></tr>';return;}
  tbody.innerHTML=list.map(function(p){
    var lucro=p.venda-p.custo,margem=p.venda>0?(lucro/p.venda*100):0;
    var fill=Math.min(100,Math.max(0,margem)),cor=margem>=30?'var(--green)':margem>=10?'var(--accent)':'var(--red)';
    return '<tr>'+
      '<td class="td-name">'+escH(p.nome)+'</td>'+
      '<td><span class="td-badge td-cat" data-cat="'+escH(p.cat)+'">'+escH(p.cat)+'</span></td>'+
      '<td class="td-mono" style="color:var(--text2)">'+fmt(p.custo)+'</td>'+
      '<td class="td-mono" style="color:var(--accent)">'+fmt(p.venda)+'</td>'+
      '<td class="td-mono '+(lucro>=0?'td-pos':'td-neg')+'">'+fmt(lucro)+'</td>'+
      '<td style="min-width:90px"><div class="td-mono" style="font-size:12px;color:'+cor+'">'+pct(margem)+'</div>'+
      '<div class="progress-bar"><div class="progress-fill" style="width:'+fill+'%;background:'+cor+'"></div></div></td></tr>';
  }).join('');
  tbody.querySelectorAll('.td-cat').forEach(function(b){b.addEventListener('click',function(){activeCatPrecos=this.dataset.cat;renderCatPills('cat-pills-precos','precos');renderPrecos();});});
}

/* ═══════════════════════════════════════════
   RELATÓRIO
═══════════════════════════════════════════ */
/* ═══════════════════════════════════════════
   RELATÓRIO — PERÍODO
═══════════════════════════════════════════ */
var activePeriod='day'; var customPeriodFrom=null, customPeriodTo=null;
function setPeriod(p){
  activePeriod=p;
  ['day','week','month','all','custom'].forEach(function(k){
    var b=$('period-btn-'+k);
    if(b) b.classList.toggle('active',k===p);
  });
  var cRow=$('period-custom-row');
  if(cRow) cRow.style.display=(p==='custom'?'flex':'none');
  renderPeriodSales();
}
function applyCustomPeriod(){
  var from=$('period-custom-from').value;
  var to=$('period-custom-to').value;
  if(!from&&!to){showToast('⚠️ Informe ao menos uma data.',true);return;}
  customPeriodFrom=from||null;
  customPeriodTo=to||null;
  renderPeriodSales();
}
function renderPeriodSales(){
  var now=new Date();
  var sales=saleHistory.filter(function(h){ return h.type==='sale'; });

  // Parse dd/mm/yyyy hh:mm from dateStr
  function parseDate(ds){
    if(!ds) return null;
    var m=ds.match(/(\d{2})\/(\d{2})\/(\d{4})[,\s]+(\d{2}):(\d{2})/);
    if(!m) return null;
    return new Date(+m[3],+m[2]-1,+m[1],+m[4],+m[5]);
  }

  // Filter by period
  var filtered=sales.filter(function(h){
    var d=parseDate(h.date);
    if(!d) return activePeriod==='all';
    if(activePeriod==='all') return true;
    if(activePeriod==='day'){
      return d.getFullYear()===now.getFullYear()&&d.getMonth()===now.getMonth()&&d.getDate()===now.getDate();
    }
    if(activePeriod==='week'){
      var diff=(now-d)/(1000*60*60*24);
      return diff>=0&&diff<7;
    }
    if(activePeriod==='month'){
      return d.getFullYear()===now.getFullYear()&&d.getMonth()===now.getMonth();
    }
    if(activePeriod==='custom'){
      var entryKey=d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
      if(customPeriodFrom&&entryKey<customPeriodFrom) return false;
      if(customPeriodTo&&entryKey>customPeriodTo)     return false;
      return true;
    }
    return false;
  });

  var count=filtered.length;
  var items=filtered.reduce(function(a,h){return a+(h.qty||0);},0);
  var totalBruto=filtered.reduce(function(a,h){return a+(h.subtotal||h.total||0);},0);
  var totalDesconto=filtered.reduce(function(a,h){return a+(h.discount||0);},0);
  var total=filtered.reduce(function(a,h){return a+(h.total||0);},0);

  $('p-count').textContent=count;
  $('p-items').textContent=items;
  $('p-total').textContent=fmt(total);
  var brutRow=$('p-bruto-row'); var discRow=$('p-desconto-row');
  if(brutRow) brutRow.style.display=totalDesconto>0?'flex':'none';
  if(discRow) discRow.style.display=totalDesconto>0?'flex':'none';
  var brutEl=$('p-bruto'); var discEl=$('p-desconto');
  if(brutEl) brutEl.textContent=fmt(totalBruto);
  if(discEl) discEl.textContent='− '+fmt(totalDesconto);

  // Payment breakdown
  var payMap={};
  filtered.forEach(function(h){
    var p=h.payment||'Não informado';
    payMap[p]=(payMap[p]||0)+(h.total||0);
  });
  var payIcons={Dinheiro:'💵',Pix:'📲','Cartão de Crédito':'💳','Cartão de Débito':'💳',Fiado:'📝','Não informado':'❓'};
  var breakdown=$('p-pay-breakdown');
  if(!Object.keys(payMap).length){
    breakdown.innerHTML='<span style="font-size:12px;color:var(--text3)">Nenhuma venda no período.</span>';
    return;
  }
  breakdown.innerHTML=Object.keys(payMap).map(function(k){
    return '<div style="background:var(--bg3);border:1px solid var(--border);border-radius:var(--rsm);padding:6px 12px;font-size:12px;display:flex;flex-direction:column;gap:2px;min-width:110px">'+
      '<div style="color:var(--text3);font-size:10px;text-transform:uppercase;letter-spacing:.4px">'+(payIcons[k]||'💳')+' '+escH(k)+'</div>'+
      '<div style="font-family:\'DM Mono\',monospace;font-weight:600;color:var(--green)">'+fmt(payMap[k])+'</div>'+
    '</div>';
  }).join('');
}

function renderRelatorio(){
  renderPeriodSales();
  renderSalesChart();

  if(!products.length){
    ['r-custo','r-venda','r-lucro','r-margem','r-prods','r-units','r-low','r-zero','r-vendido'].forEach(function(id){$(id).textContent='—';});
    $('r-top').innerHTML='<tr><td colspan="3" class="empty" style="padding:16px;color:var(--text3)">Nenhum produto.</td></tr>';
    return;
  }
  var custo=0,venda=0;
  products.forEach(function(p){custo+=p.custo*p.qty;venda+=p.venda*p.qty;});
  var margens=products.filter(function(p){return p.venda>0;}).map(function(p){return(p.venda-p.custo)/p.venda*100;});
  var avg=margens.length?margens.reduce(function(a,b){return a+b;},0)/margens.length:0;
  var low=config.lowStock||3;
  var totalVendido=saleHistory.filter(function(h){return h.type==='sale';}).reduce(function(a,h){return a+(h.total||0);},0);
  var totalDescontos=saleHistory.filter(function(h){return h.type==='sale'&&h.discount;}).reduce(function(a,h){return a+(h.discount||0);},0);
  var totalBrutoGeral=saleHistory.filter(function(h){return h.type==='sale';}).reduce(function(a,h){return a+(h.subtotal||h.total||0);},0);
  $('r-custo').textContent=fmt(custo); $('r-venda').textContent=fmt(venda);
  $('r-lucro').textContent=fmt(venda-custo); $('r-margem').textContent=pct(avg);
  $('r-prods').textContent=products.length;
  $('r-units').textContent=products.reduce(function(a,p){return a+p.qty;},0);
  $('r-low').textContent=products.filter(function(p){return p.qty>0&&p.qty<=low;}).length;
  $('r-zero').textContent=products.filter(function(p){return p.qty===0;}).length;
  $('r-vendido').textContent=fmt(totalVendido);
  var rdEl=$('r-descontos'); if(rdEl) rdEl.textContent=fmt(totalDescontos);
  var rbEl=$('r-bruto'); if(rbEl) rbEl.textContent=fmt(totalBrutoGeral);
  var top=products.filter(function(p){return p.venda>0;}).slice().sort(function(a,b){return((b.venda-b.custo)/b.venda)-((a.venda-a.custo)/a.venda);}).slice(0,5);
  var medals=['🥇','🥈','🥉','4º','5º'];
  $('r-top').innerHTML=top.length?top.map(function(p,i){
    var m=(p.venda-p.custo)/p.venda*100,l=p.venda-p.custo;
    var cor=m>=30?'var(--green)':m>=10?'var(--accent)':'var(--red)';
    return '<tr>'+
      '<td style="padding:8px 4px 8px 0;font-size:13px;border-bottom:1px solid var(--border);word-break:break-word;max-width:120px">'+medals[i]+' '+escH(p.nome)+'</td>'+
      '<td style="padding:8px 4px;font-size:13px;border-bottom:1px solid var(--border);text-align:right;font-family:\'DM Mono\',monospace;color:'+cor+';white-space:nowrap">'+pct(m)+'</td>'+
      '<td style="padding:8px 0 8px 4px;font-size:13px;border-bottom:1px solid var(--border);text-align:right;font-family:\'DM Mono\',monospace;color:var(--green);white-space:nowrap">'+fmt(l)+'</td></tr>';
  }).join(''):'<tr><td colspan="3" style="padding:14px;color:var(--text3);text-align:center;font-size:13px">Nenhum produto com preço de venda cadastrado.</td></tr>';
}

function updateHeaderStats(){
  $('hstat-produtos').textContent=products.length;
  $('hstat-estoque').textContent=products.reduce(function(a,p){return a+p.qty;},0);
}
function refreshAll(){
  renderCatPills('cat-pills-estoque','estoque');
  renderCatPills('cat-pills-precos','precos');
  render(); updateHeaderStats();
}

/* ═══════════════════════════════════════════
   SALES (VENDAS)
═══════════════════════════════════════════ */
var cart=[]; // [{productId, varName (optional), name, qty, price}]
var cartDiscount = 0; // desconto em R$ aplicado à venda atual

// Returns flat list of sellable units (product + each variation separately)
function getSellableUnits(){
  var units=[];
  products.forEach(function(p){
    if(p.variations&&p.variations.length){
      p.variations.forEach(function(v){
        units.push({pid:p.id,varName:v.name,name:p.nome+' — '+v.name,cat:p.cat,barcode:p.barcode||'',price:p.venda,availQty:v.qty});
      });
    } else {
      units.push({pid:p.id,varName:null,name:p.nome,cat:p.cat,barcode:p.barcode||'',price:p.venda,availQty:p.qty});
    }
  });
  return units;
}

function searchSale(){
  var q=$('sale-search').value.trim().toLowerCase();
  var res=$('sale-results');
  if(!q){res.style.display='none';return;}
  var units=getSellableUnits().filter(function(u){
    return u.name.toLowerCase().indexOf(q)>=0||u.cat.toLowerCase().indexOf(q)>=0||u.barcode.indexOf(q)>=0;
  }).slice(0,8);
  if(!units.length){res.style.display='none';return;}
  res.innerHTML=units.map(function(u){
    var inCart=cart.find(function(c){return c.pid===u.pid&&c.varName===u.varName;});
    var stock=u.availQty-(inCart?inCart.qty:0);
    return '<div class="search-result-item" data-pid="'+escH(u.pid)+'" data-var="'+(u.varName?escH(u.varName):'')+'">'+
      '<div style="flex:1;min-width:0">'+
        '<div class="sri-name">'+escH(u.name)+'</div>'+
        '<div class="sri-sub">'+escH(u.cat)+(u.barcode?' · '+escH(u.barcode):'')+' · <span style="color:'+(stock>0?'var(--green)':'var(--red)')+'">'+stock+' disponível'+(stock!==1?'is':'')+'</span></div>'+
      '</div>'+
      '<div class="sri-price">'+fmt(u.price)+'</div>'+
    '</div>';
  }).join('');
  res.style.display='block';
  res.querySelectorAll('.search-result-item').forEach(function(el){
    el.addEventListener('click',function(){
      addToCart(this.getAttribute('data-pid'),this.getAttribute('data-var')||null);
      $('sale-search').value='';
      res.style.display='none';
      $('sale-search').focus();
    });
  });
}

function addToCart(pid,varName){
  var p=findById(pid);
  if(!p) return;
  var availQty;
  if(varName){
    var v=p.variations.find(function(x){return x.name===varName;});
    availQty=v?v.qty:0;
  } else { availQty=p.qty; }
  var existing=cart.find(function(c){return c.pid===pid&&c.varName===varName;});
  if(existing){
    if(existing.qty>=availQty){showToast('⚠️ Estoque insuficiente.',true);return;}
    existing.qty++;
  } else {
    if(availQty<=0){showToast('⚠️ Produto sem estoque.',true);return;}
    var displayName=varName?p.nome+' — '+varName:p.nome;
    cart.push({pid:pid,varName:varName,name:displayName,qty:1,price:p.venda});
  }
  renderCart();
}

function renderCart(){
  if(!cart.length){
    $('cart-empty').style.display='block';
    $('cart-items').innerHTML='';
    $('cart-total').style.display='none';
    $('btn-finish-sale').disabled=true;
    return;
  }
  $('cart-empty').style.display='none';
  $('btn-finish-sale').disabled=false;
  $('cart-items').innerHTML=cart.map(function(item,i){
    var p=findById(item.pid);
    var maxQty=p?(item.varName?((p.variations||[]).find(function(v){return v.name===item.varName;})||{qty:0}).qty:p.qty):0;
    return '<div class="cart-item">'+
      '<div style="flex:1;min-width:0">'+
        '<div class="cart-item-name">'+escH(item.name)+'</div>'+
        '<div class="cart-item-sub">'+fmt(item.price)+' cada</div>'+
      '</div>'+
      '<div class="cart-qty-ctrl">'+
        '<button class="cart-qty-btn" onclick="cartQty('+i+',-1)">−</button>'+
        '<span class="cart-qty-num">'+item.qty+'</span>'+
        '<button class="cart-qty-btn" onclick="cartQty('+i+',1)" '+(item.qty>=maxQty?'disabled style="opacity:.4"':'')+'>+</button>'+
      '</div>'+
      '<div class="cart-item-price">'+fmt(item.price*item.qty)+'</div>'+
      '<button style="background:none;border:none;color:var(--text3);font-size:18px;padding:0 4px" onclick="removeCartItem('+i+')">✕</button>'+
    '</div>';
  }).join('');
  var subtotal=cart.reduce(function(a,c){return a+c.qty*c.price;},0);
  var totalItems=cart.reduce(function(a,c){return a+c.qty;},0);
  var discountVal = Math.min(cartDiscount, subtotal);
  var total = subtotal - discountVal;
  $('cart-total').style.display='flex';
  $('cart-total-val').textContent=fmt(total);
  $('cart-items-count').textContent=totalItems+' item'+(totalItems!==1?'s':'');
  // Linha de desconto
  var discRow = $('cart-discount-row');
  if(discRow){
    if(discountVal > 0){
      discRow.style.display='flex';
      var discDisplay = $('cart-discount-display');
      if(discDisplay) discDisplay.textContent='− '+fmt(discountVal);
    } else {
      discRow.style.display='none';
    }
  }
}
function cartQty(i,delta){
  var item=cart[i];
  var p=findById(item.pid);
  var maxQty=p?(item.varName?((p.variations||[]).find(function(v){return v.name===item.varName;})||{qty:0}).qty:p.qty):0;
  item.qty+=delta;
  if(item.qty<=0){cart.splice(i,1);}
  else if(item.qty>maxQty){item.qty=maxQty;showToast('⚠️ Limite de estoque atingido.',true);}
  renderCart();
}
function removeCartItem(i){ cart.splice(i,1); renderCart(); }
function clearCart(){ cart=[]; cartDiscount=0; renderCart(); }

function applyDiscount(val){
  if(val===null||val===undefined) return;
  var str = String(val).replace(',','.').trim();
  var n = parseFloat(str);
  cartDiscount = isNaN(n)||n<0 ? 0 : n;
  renderCart();
}
function openDiscountModal(){
  var sub = cart.reduce(function(a,c){return a+c.qty*c.price;},0);
  $('disc-subtotal').textContent = fmt(sub);
  $('disc-input').value = cartDiscount > 0 ? cartDiscount.toFixed(2).replace('.',',') : '';
  $('disc-err').textContent='';
  $('overlay-discount').classList.add('open');
  setTimeout(function(){$('disc-input').focus();$('disc-input').select();},100);
}
function confirmDiscount(){
  var sub = cart.reduce(function(a,c){return a+c.qty*c.price;},0);
  var str = $('disc-input').value.replace(',','.').trim();
  var n = parseFloat(str);
  if(isNaN(n)||n<0){$('disc-err').textContent='Valor inválido.';return;}
  if(n>=sub){$('disc-err').textContent='Desconto não pode ser igual ou maior que o total.';return;}
  cartDiscount = n;
  closeModal('overlay-discount');
  renderCart();
  showToast('🏷️ Desconto de '+fmt(n)+' aplicado.');
}
/* Payment selection */
var selectedPayment = 'Dinheiro';
function selectPayment(btn){
  selectedPayment = btn.getAttribute('data-pay');
  document.querySelectorAll('#payment-row .pay-btn').forEach(function(b){ b.classList.remove('sel'); });
  btn.classList.add('sel');
}

function finalizeSale(){
  if(!cart.length) return;

  // Snapshot cart BEFORE clearing
  var cartSnapshot = cart.map(function(c){ return {name:c.name, qty:c.qty, price:c.price, pid:c.pid, varName:c.varName||null}; });
  var subtotal = cartSnapshot.reduce(function(a,c){return a+c.qty*c.price;},0);
  var discountApplied = Math.min(cartDiscount, subtotal);
  var total = subtotal - discountApplied;
  var totalItems = cartSnapshot.reduce(function(a,c){return a+c.qty;},0);
  var payLabel = selectedPayment;

  // Deduct stock
  cartSnapshot.forEach(function(item){
    var p = findById(item.pid);
    if(!p) return;
    if(item.varName){
      var v = (p.variations||[]).find(function(x){return x.name===item.varName;});
      if(v) v.qty = Math.max(0, v.qty - item.qty);
      // Recalculate total product qty from variations
      p.qty = (p.variations||[]).reduce(function(a,vv){return a+vv.qty;},0);
    } else {
      p.qty = Math.max(0, p.qty - item.qty);
    }
  });

  // Record saleHistory with full item list
  var operatorName = '';
  if (currentRole === 'emp' && currentEmpId) {
    var op = employees.find(function(e){ return e.id === currentEmpId; });
    if (op) operatorName = op.name;
  } else if (currentRole === 'boss') {
    operatorName = 'Chefe';
  }

  addHistory({
    type: 'sale',
    label: 'Venda — ' + totalItems + ' item' + (totalItems!==1?'s':''),
    detail: cartSnapshot.map(function(c){return c.qty+'× '+c.name+' ('+fmt(c.price)+')';}).join(', '),
    items: cartSnapshot,
    qty: totalItems,
    subtotal: subtotal,
    discount: discountApplied > 0 ? discountApplied : undefined,
    total: total,
    payment: payLabel,
    operator: operatorName
  });

  // Clear cart AFTER recording
  cart = [];
  cartDiscount = 0;

  saveData(); render(); updateHeaderStats();

  // Show popup
  $('sale-done-total').textContent = fmt(total);
  $('sale-done-items').textContent = totalItems+' item'+(totalItems!==1?'s':'')+' · estoque atualizado';
  var payIcons = {Dinheiro:'💵',Pix:'📲','Cartão de Crédito':'💳','Cartão de Débito':'💳',Fiado:'📝'};
  $('sale-done-pay').textContent = (payIcons[payLabel]||'💳')+' '+payLabel;
  $('overlay-sale-done').classList.add('open');
}
function closeSaleDone(){
  $('overlay-sale-done').classList.remove('open');
  renderCart();
}
$('overlay-sale-done').addEventListener('click',function(e){if(e.target===this)closeSaleDone();});
// Close search results on outside click
document.addEventListener('click',function(e){
  var ss=$('sale-search'), sr=$('sale-results');
  if(ss&&sr&&!ss.contains(e.target)&&!sr.contains(e.target))
    sr.style.display='none';
});

/* ═══════════════════════════════════════════
   HISTORY
═══════════════════════════════════════════ */
function addHistory(entry){
  if(!Array.isArray(saleHistory)) saleHistory=[];
  entry.id=uid(); entry.date=dateStr();
  saleHistory.unshift(entry);
  if(saleHistory.length>500) saleHistory=saleHistory.slice(0,500);
}
function clearHistDateFilter(){
  var df=$('hist-date-from'), dt=$('hist-date-to');
  if(df) df.value='';
  if(dt) dt.value='';
  renderHistorico();
}

function renderHistorico(){
  var typeF=$('hist-type-filter').value;
  var q=($('hist-search')||{value:''}).value.toLowerCase();
  var dateFrom=($('hist-date-from')||{value:''}).value;
  var dateTo=($('hist-date-to')||{value:''}).value;

  var list=saleHistory.filter(function(h){
    var matchType=!typeF||h.type===typeF;
    var matchQ=!q||h.label.toLowerCase().indexOf(q)>=0||(h.detail&&h.detail.toLowerCase().indexOf(q)>=0);

    // Date filter: parse "dd/mm/yyyy, hh:mm" → Date
    var matchDate=true;
    if((dateFrom||dateTo)&&h.date){
      var m=h.date.match(/(\d{2})\/(\d{2})\/(\d{4})/);
      if(m){
        var entryDate=m[3]+'-'+m[2]+'-'+m[1]; // yyyy-mm-dd for comparison
        if(dateFrom&&entryDate<dateFrom) matchDate=false;
        if(dateTo&&entryDate>dateTo)     matchDate=false;
      }
    }
    return matchType&&matchQ&&matchDate;
  });

  var container=$('hist-container');
  if(!list.length){container.innerHTML='<div class="empty">Nenhuma movimentação encontrada.</div>';return;}
  container.innerHTML=list.map(function(h){
    var dotClass=h.type==='sale'?'sale':h.type==='adjust'?'adjust':'remove';
    var valHtml='';
    if(h.total){valHtml='<div class="hist-val pos">'+fmt(h.total)+'</div>';}
    var payIcons={Dinheiro:'💵',Pix:'📲','Cartão de Crédito':'💳','Cartão de Débito':'💳',Fiado:'📝'};
    var payTag=h.payment?'<span style="font-size:10px;background:var(--green-dim);border:1px solid var(--green);color:var(--green);padding:1px 8px;border-radius:10px;margin-left:6px;font-weight:600">'+(payIcons[h.payment]||'💳')+' '+escH(h.payment)+'</span>':'';

    // Operador
    var operatorTag=h.operator?'<span style="font-size:10px;background:var(--blue-dim);border:1px solid var(--blue);color:var(--blue);padding:1px 8px;border-radius:10px;margin-left:4px;font-weight:500">👤 '+escH(h.operator)+'</span>':'';

    // Build itemized list for sales
    var itemsHtml='';
    if(h.type==='sale' && h.items && h.items.length){
      itemsHtml='<div style="margin-top:6px;display:flex;flex-direction:column;gap:3px">';
      h.items.forEach(function(it){
        itemsHtml+='<div style="display:flex;justify-content:space-between;align-items:center;font-size:11px;color:var(--text2);background:var(--bg3);border-radius:4px;padding:3px 8px;gap:8px">'+
          '<span style="flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+escH(it.name)+'</span>'+
          '<span style="color:var(--text3);white-space:nowrap">×'+it.qty+'</span>'+
          '<span style="font-family:\'DM Mono\',monospace;color:var(--accent);white-space:nowrap">'+fmt(it.price*it.qty)+'</span>'+
        '</div>';
      });
      itemsHtml+='</div>';
    } else if(h.detail && h.type==='sale'){
      itemsHtml='<div style="font-size:11px;color:var(--text3);margin-top:3px">'+escH(h.detail.slice(0,120))+(h.detail.length>120?'…':'')+'</div>';
    }

    var discountTag='';
    if(h.type==='sale'&&h.discount&&h.discount>0){
      discountTag='<span style="font-size:10px;background:var(--accent-dim);border:1px solid var(--accent);color:var(--accent);padding:1px 8px;border-radius:10px;margin-left:4px;font-weight:600">🏷️ −'+fmt(h.discount)+'</span>';
    }
    if(h.total&&h.discount&&h.discount>0){
      valHtml='<div style="text-align:right"><div style="font-size:10px;color:var(--text3);text-decoration:line-through">'+fmt(h.subtotal||h.total+h.discount)+'</div><div class="hist-val pos">'+fmt(h.total)+'</div></div>';
    }
    return '<div class="hist-item">'+
      '<div class="hist-dot '+dotClass+'"></div>'+
      '<div class="hist-body" style="flex:1;min-width:0">'+
        '<div class="hist-title" style="display:flex;align-items:center;flex-wrap:wrap;gap:2px">'+escH(h.label)+payTag+operatorTag+discountTag+'</div>'+
        '<div style="font-size:11px;color:var(--text3);margin-top:2px">'+escH(h.date)+'</div>'+
        itemsHtml+
      '</div>'+
      '<div style="padding-left:8px">'+valHtml+'</div>'+
    '</div>';
  }).join('');
}
function clearHistory(){
  if(!saleHistory.length) return;
  if(confirm('Apagar todo o histórico de movimentações?')){
    saleHistory=[]; saveData(); renderHistorico();
    showToast('🗑 Histórico apagado.');
  }
}

/* ═══════════════════════════════════════════
   PRECIFICAÇÃO
═══════════════════════════════════════════ */
var precSelectedIds={};
function setPreset(val){
  $('prec-margem').value=val;
  document.querySelectorAll('.prec-preset').forEach(function(b){b.classList.toggle('active',parseFloat(b.dataset.val)===val);});
  updatePrecCalculatedCells(); updatePrecSummary();
}
function onPrecMargemChange(){
  var val=parseFloat($('prec-margem').value)||0;
  document.querySelectorAll('.prec-preset').forEach(function(b){b.classList.toggle('active',parseFloat(b.dataset.val)===val);});
  updatePrecCalculatedCells(); updatePrecSummary();
}
function updatePrecCalculatedCells(){
  var m=parseFloat($('prec-margem').value)||0;
  document.querySelectorAll('#tbody-precificacao tr[data-pid]').forEach(function(tr){
    var p=findById(tr.dataset.pid); if(!p) return;
    var nv=m>=100?0:p.custo/(1-m/100);
    var diff=nv-p.venda, diffc=diff>0.005?'td-pos':diff<-0.005?'td-neg':'';
    var difft=Math.abs(diff)<0.005?'—':(diff>0?'+':'')+fmt(diff);
    tr.querySelector('.pn').textContent=fmt(nv);
    var dc=tr.querySelector('.pd'); dc.textContent=difft; dc.className='td-mono pd '+diffc;
  });
}
function toggleAllPrec(checked){
  products.forEach(function(p){precSelectedIds[p.id]=checked;});
  document.querySelectorAll('#tbody-precificacao tr[data-pid]').forEach(function(tr){
    var cb=tr.querySelector('.pcb'); if(cb)cb.checked=!!precSelectedIds[tr.dataset.pid];
    tr.style.background=precSelectedIds[tr.dataset.pid]?'var(--accent-dim)':'';
  });
  updatePrecApplyBtn(); updatePrecSummary();
}
function clearPrecSelection(){
  precSelectedIds={}; $('prec-check-all').checked=false;
  document.querySelectorAll('#tbody-precificacao tr[data-pid]').forEach(function(tr){
    var cb=tr.querySelector('.pcb');if(cb)cb.checked=false;tr.style.background='';
  });
  updatePrecApplyBtn(); updatePrecSummary();
}
function togglePrecRow(id,checked){
  precSelectedIds[id]=checked;
  var tr=document.querySelector('#tbody-precificacao tr[data-pid="'+id+'"]');
  if(tr)tr.style.background=checked?'var(--accent-dim)':'';
  $('prec-check-all').checked=products.every(function(p){return !!precSelectedIds[p.id];});
  updatePrecApplyBtn(); updatePrecSummary();
}
function updatePrecApplyBtn(){
  var cnt=products.filter(function(p){return !!precSelectedIds[p.id];}).length;
  $('prec-apply-btn').disabled=cnt===0;
  $('prec-apply-btn').textContent=cnt>0?'Aplicar aos '+cnt+' selecionados':'Aplicar selecionados';
  $('prec-sel-count').textContent=cnt+' selecionado'+(cnt!==1?'s':'');
  $('prec-summary').style.display=cnt>0?'flex':'none';
}
function updatePrecSummary(){
  var m=parseFloat($('prec-margem').value)||0;
  var sel=products.filter(function(p){return !!precSelectedIds[p.id];});
  $('prec-s-count').textContent=sel.length;
  $('prec-s-margem').textContent=pct(m);
  $('prec-s-receita').textContent=fmt(sel.reduce(function(a,p){return a+(m>=100?0:p.custo/(1-m/100))*p.qty;},0));
}
function renderPrecificacao(){
  var m=parseFloat($('prec-margem').value)||0;
  var tbody=$('tbody-precificacao');
  var sortedProducts=products.slice().sort(function(a,b){ return a.nome.localeCompare(b.nome,'pt-BR',{sensitivity:'base'}); });
  if(!sortedProducts.length){tbody.innerHTML='<tr><td colspan="8" class="empty">Nenhum produto.</td></tr>';updatePrecApplyBtn();updatePrecSummary();return;}
  tbody.innerHTML=sortedProducts.map(function(p){
    var sel=!!precSelectedIds[p.id];
    var nv=m>=100?0:p.custo/(1-m/100);
    var ma=p.venda>0?(p.venda-p.custo)/p.venda*100:0;
    var diff=nv-p.venda,diffc=diff>0.005?'td-pos':diff<-0.005?'td-neg':'';
    var difft=Math.abs(diff)<0.005?'—':(diff>0?'+':'')+fmt(diff);
    var corc=ma>=30?'var(--green)':ma>=10?'var(--accent)':'var(--red)';
    return '<tr data-pid="'+p.id+'" style="'+(sel?'background:var(--accent-dim)':'')+'">' +
      '<td><input type="checkbox" class="prec-check pcb" '+(sel?'checked':'')+' onchange="togglePrecRow(\''+p.id+'\',this.checked)"></td>'+
      '<td class="td-name">'+escH(p.nome)+'</td>'+
      '<td><span class="td-badge">'+escH(p.cat)+'</span></td>'+
      '<td class="td-mono" style="color:var(--text2)">'+fmt(p.custo)+'</td>'+
      '<td class="td-mono" style="color:var(--text2)">'+fmt(p.venda)+'</td>'+
      '<td class="td-mono" style="font-size:12px;color:'+corc+'">'+pct(ma)+'</td>'+
      '<td class="td-mono pn" style="color:var(--accent);font-weight:600">'+fmt(nv)+'</td>'+
      '<td class="td-mono pd '+diffc+'">'+difft+'</td></tr>';
  }).join('');
  updatePrecApplyBtn(); updatePrecSummary();
}
function applyPrecificacao(){
  var m=parseFloat($('prec-margem').value)||0;
  if(m<=0||m>=100){showToast('⚠️ Margem deve ser entre 1% e 99%.',true);return;}
  var sel=products.filter(function(p){return !!precSelectedIds[p.id];});
  if(!sel.length) return;
  sel.forEach(function(p){p.venda=parseFloat((p.custo/(1-m/100)).toFixed(2));});
  precSelectedIds={}; $('prec-check-all').checked=false;
  saveData(); renderPrecificacao(); render();
  showToast('✅ Preços de '+sel.length+' produto(s) atualizados para '+pct(m)+' de margem.');
}

/* ═══════════════════════════════════════════
   EXPORT EXCEL
═══════════════════════════════════════════ */
function exportExcel(){
  if(!products.length){showToast('⚠️ Nenhum produto.',true);return;}
  var btn=$('btn-export'); btn.textContent='…';
  try{
    var wb=XLSX.utils.book_new();
    var estH=['Produto','Cód. Barras','Categoria','Variações','Quantidade','Custo (R$)','Venda (R$)','Lucro (R$)','Margem (%)'];
    var sortedProds=products.slice().sort(function(a,b){ return a.nome.localeCompare(b.nome,'pt-BR',{sensitivity:'base'}); });
    var wsE=XLSX.utils.aoa_to_sheet([estH].concat(sortedProds.map(function(p){
      var l=p.venda-p.custo,m=p.venda>0?(l/p.venda*100):0;
      var vars=(p.variations&&p.variations.length)?p.variations.map(function(v){return v.name+'('+v.qty+')';}).join(', '):'';
      return [p.nome,p.barcode||'',p.cat,vars,p.qty,p.custo,p.venda,+l.toFixed(2),+m.toFixed(2)];
    })));
    wsE['!cols']=[{wch:26},{wch:16},{wch:14},{wch:20},{wch:10},{wch:14},{wch:14},{wch:14},{wch:10}];
    XLSX.utils.book_append_sheet(wb,wsE,'Estoque');
    var histH=['Data','Tipo','Descrição','Itens','Total (R$)'];
    var wsH=XLSX.utils.aoa_to_sheet([histH].concat(saleHistory.map(function(h){return [h.date,h.type,h.label,h.qty||0,h.total||0];})));
    wsH['!cols']=[{wch:18},{wch:10},{wch:36},{wch:8},{wch:14}];
    XLSX.utils.book_append_sheet(wb,wsH,'Histórico');
    XLSX.writeFile(wb,'loja-'+new Date().toISOString().slice(0,10)+'.xlsx');
    showToast('✅ Exportado com sucesso!');
  }catch(e){showToast('❌ Erro ao exportar.',true);}
  btn.textContent='⬇ Exportar';
}

/* ═══════════════════════════════════════════
   IMPORT EXCEL
═══════════════════════════════════════════ */
var importedProducts=[], importMode='add';
function openImportModal(){
  importedProducts=[];importMode='add';
  $('import-preview').style.display='none';$('btn-confirm-import').style.display='none';
  $('import-err').style.display='none';$('import-file').value='';
  setIMode('add');
  var dz=$('import-drop');
  dz.querySelector('.drop-icon').textContent='📂';
  dz.querySelector('.drop-title').textContent='Arraste ou clique para selecionar';
  dz.querySelector('.drop-sub').textContent='.xlsx · .xls · .csv';
  $('overlay-import').classList.add('open');
}
function setIMode(m){
  importMode=m;
  $('imode-add').classList.toggle('sel',m==='add');
  $('imode-replace').classList.toggle('sel',m==='replace');
}
(function(){
  var dz=$('import-drop');
  dz.addEventListener('dragover',function(e){e.preventDefault();dz.classList.add('drag');});
  dz.addEventListener('dragleave',function(){dz.classList.remove('drag');});
  dz.addEventListener('drop',function(e){e.preventDefault();dz.classList.remove('drag');var f=e.dataTransfer.files[0];if(f)handleImportFile(f);});
})();
function handleImportFile(file){
  if(!file) return;
  var ext=file.name.split('.').pop().toLowerCase();
  if(['xlsx','xls','csv'].indexOf(ext)<0){showImportErr('Formato inválido.');return;}
  $('import-err').style.display='none';
  var dz=$('import-drop');
  dz.querySelector('.drop-icon').textContent='⏳';
  dz.querySelector('.drop-title').textContent='Lendo…';
  var reader=new FileReader();
  reader.onload=function(e){
    try{
      var wb=XLSX.read(new Uint8Array(e.target.result),{type:'array'});
      var sn=wb.SheetNames.indexOf('Estoque')>=0?'Estoque':wb.SheetNames[0];
      var rows=XLSX.utils.sheet_to_json(wb.Sheets[sn],{header:1,defval:''});
      if(!rows||rows.length<2){showImportErr('Planilha vazia.');resetDZ(file.name);return;}
      var hdr=rows[0].map(function(h){return String(h).toLowerCase().trim();});
      function ci(cands){for(var i=0;i<cands.length;i++){var x=hdr.findIndex(function(h){return h.indexOf(cands[i])>=0;});if(x>=0)return x;}return -1;}
      var iN=ci(['produto','nome','product','name']);
      var iC=ci(['categoria','categ','cat','tipo']);
      var iQ=ci(['quant','qty','estoque','qtd']);
      var iCu=ci(['custo','cost']);
      var iV=ci(['venda','sell','price','preço']);
      var iB=ci(['barras','barcode','codigo','ean','gtin']);
      if(iN<0){showImportErr('Coluna "Produto" não encontrada.');resetDZ(file.name);return;}
      var parsed=[];
      for(var r=1;r<rows.length;r++){
        var row=rows[r];
        var nome=String(row[iN]||'').trim();
        if(!nome||nome.toLowerCase()==='total') continue;
        parsed.push({id:uid(),nome:nome,cat:iC>=0?String(row[iC]||'Geral').trim():'Geral',barcode:iB>=0?String(row[iB]||'').trim():'',qty:Math.max(0,Math.round(iQ>=0?parseFloat(row[iQ])||0:0)),custo:Math.max(0,iCu>=0?parseFloat(row[iCu])||0:0),venda:Math.max(0,iV>=0?parseFloat(row[iV])||0:0),variations:[]});
      }
      if(!parsed.length){showImportErr('Nenhum produto válido.');return;}
      importedProducts=parsed;
      var preview=parsed.slice(0,5);
      $('import-preview-table').innerHTML='<thead><tr><th>Produto</th><th>Cat.</th><th>Qtd</th><th>Custo</th><th>Venda</th></tr></thead><tbody>'+
        preview.map(function(p){return '<tr><td>'+escH(p.nome)+'</td><td>'+escH(p.cat)+'</td><td>'+p.qty+'</td><td>'+fmt(p.custo)+'</td><td>'+fmt(p.venda)+'</td></tr>';}).join('')+
        (parsed.length>5?'<tr><td colspan="5" style="color:var(--text3);text-align:center;font-style:italic">…e mais '+(parsed.length-5)+'</td></tr>':'')+
      '</tbody>';
      $('import-preview-label').textContent='Pré-visualização · '+parsed.length+' produto(s)';
      $('import-preview').style.display='block';
      $('btn-confirm-import').style.display='inline-flex';
      dz.querySelector('.drop-icon').textContent='✅';
      dz.querySelector('.drop-title').textContent=file.name;
      dz.querySelector('.drop-sub').textContent=parsed.length+' produtos detectados';
    }catch(err){showImportErr('Erro ao ler o arquivo.');resetDZ(file.name);}
  };
  reader.readAsArrayBuffer(file);
}
function showImportErr(m){var el=$('import-err');el.textContent=m;el.style.display='block';}
function resetDZ(fname){var dz=$('import-drop');dz.querySelector('.drop-icon').textContent='⚠️';dz.querySelector('.drop-title').textContent='Erro';dz.querySelector('.drop-sub').textContent=fname||'';}
function confirmImport(){
  if(!importedProducts.length) return;
  importedProducts.forEach(function(p){if(!allCats().some(function(c){return c.toLowerCase()===p.cat.toLowerCase();}))customCats.push(p.cat);});
  if(importMode==='replace') products=importedProducts;
  else importedProducts.forEach(function(p){products.push(p);});
  closeModal('overlay-import'); refreshAll(); saveData();
  showToast('✅ '+importedProducts.length+' produtos importados.');
  importedProducts=[];
}

/* ═══════════════════════════════════════════
   EMPLOYEE MANAGEMENT
═══════════════════════════════════════════ */
var editEmpId=null;
function renderEmpListAdmin(){
  var el=$('emp-list-admin');
  if(!employees.length){
    el.innerHTML='<div class="empty" style="padding:20px;color:var(--text3);font-size:13px">Nenhum funcionário cadastrado.</div>';
    return;
  }
  el.innerHTML=employees.map(function(emp){
    return '<div class="emp-item">'+
      '<div class="emp-avatar">👤</div>'+
      '<div class="emp-info">'+
        '<div class="emp-name">'+escH(emp.name)+'</div>'+
        '<div class="emp-meta">Funcionário · cadastrado em '+escH(emp.created||'—')+'</div>'+
      '</div>'+
      '<div style="display:flex;gap:6px">'+
        '<button class="btn btn-blue btn-sm" onclick="openEditEmpModal(\''+emp.id+'\')">Editar</button>'+
        '<button class="btn btn-red btn-sm" onclick="deleteEmployee(\''+emp.id+'\')">Remover</button>'+
      '</div>'+
    '</div>';
  }).join('');
}
function openAddEmpModal(){
  editEmpId=null;
  $('emp-modal-title').textContent='Cadastrar funcionário';
  $('emp-f-name').value=''; $('emp-f-pass').value=''; $('emp-f-pass2').value=''; $('emp-f-err').textContent='';
  $('overlay-emp').classList.add('open');
  setTimeout(function(){$('emp-f-name').focus();},100);
}
function openEditEmpModal(id){
  editEmpId=id;
  var emp=employees.find(function(e){return e.id===id;});
  if(!emp) return;
  $('emp-modal-title').textContent='Editar funcionário';
  $('emp-f-name').value=emp.name; $('emp-f-pass').value=''; $('emp-f-pass2').value=''; $('emp-f-err').textContent='';
  $('overlay-emp').classList.add('open');
  setTimeout(function(){$('emp-f-name').focus();},100);
}
function saveEmployee(){
  var name=$('emp-f-name').value.trim();
  var pass=$('emp-f-pass').value;
  var pass2=$('emp-f-pass2').value;
  var err=$('emp-f-err');
  if(!name){err.textContent='Digite o nome.';return;}
  if(editEmpId){
    // Edit: password is optional
    if(pass&&pass.length<4){err.textContent='Senha mínimo 4 caracteres.';return;}
    if(pass&&pass!==pass2){err.textContent='Senhas não coincidem.';return;}
    var emp=employees.find(function(e){return e.id===editEmpId;});
    if(!emp){err.textContent='Funcionário não encontrado.';return;}
    emp.name=name;
    if(pass) emp.passPlain=pass; // enviado só nesta requisição; o backend faz o hash e nunca devolve a senha
    saveData(); closeModal('overlay-emp');
    renderEmpListAdmin();
    showToast('✅ Funcionário atualizado.');
  } else {
    // New
    if(pass.length<4){err.textContent='Senha mínimo 4 caracteres.';return;}
    if(pass!==pass2){err.textContent='Senhas não coincidem.';return;}
    if(employees.some(function(e){return e.name.toLowerCase()===name.toLowerCase();})){err.textContent='Já existe um funcionário com esse nome.';return;}
    employees.push({id:uid(),name:name,passPlain:pass,created:new Date().toLocaleDateString('pt-BR')});
    saveData(); closeModal('overlay-emp');
    renderEmpListAdmin();
    showToast('✅ Funcionário "'+name+'" cadastrado!');
  }
}
function deleteEmployee(id){
  var emp=employees.find(function(e){return e.id===id;});
  if(!emp) return;
  if(!confirm('Remover funcionário "'+emp.name+'"?')) return;
  employees=employees.filter(function(e){return e.id!==id;});
  saveData(); renderEmpListAdmin();
  showToast('🗑 Funcionário removido.');
}

/* ═══════════════════════════════════════════
   BACKUP / RESTORE
═══════════════════════════════════════════ */

/**
 * Exporta um backup completo da loja atual em JSON.
 * O arquivo inclui: produtos, categorias, histórico, config e funcionários.
 */
function exportBackup() {
  if (!currentStoreId) { showToast('⚠️ Nenhuma loja ativa.', true); return; }

  var store = findCachedStore(currentStoreId) || {id:currentStoreId, name:currentStoreName, created:null};

  var backup = {
    _version:  2,
    _app:      'GestaoLoja',
    _exported: new Date().toLocaleString('pt-BR'),
    // Por segurança, a senha NUNCA é incluída no backup.
    store: store ? { id: store.id, name: store.name, created: store.created } : null,
    data: {
      products:    products,
      customCats:  customCats,
      saleHistory: saleHistory,
      config:      config,
      employees:   employees
    }
  };

  var json = JSON.stringify(backup, null, 2);
  var blob = new Blob([json], { type: 'application/json' });
  var url  = URL.createObjectURL(blob);
  var a    = document.createElement('a');
  var storeName = (store ? store.name : 'loja').replace(/[^a-zA-Z0-9À-ú ]/g, '').replace(/ /g, '-').toLowerCase();
  var date      = new Date().toISOString().slice(0, 10);

  a.href     = url;
  a.download = 'backup-' + storeName + '-' + date + '.json';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);

  showToast('✅ Backup exportado com sucesso!');
}

/**
 * Importa um backup .json e restaura os dados da loja atual.
 * Confirma antes de sobrescrever.
 */
function importBackup(input) {
  var file = input.files[0];
  if (!file) return;

  // Reseta o input para permitir importar o mesmo arquivo duas vezes
  input.value = '';

  if (!currentStoreId) { showToast('⚠️ Nenhuma loja ativa.', true); return; }

  var status = $('backup-status');

  var reader = new FileReader();
  reader.onload = function(e) {
    try {
      var backup = JSON.parse(e.target.result);

      // Validação básica do arquivo
      if (!backup._app || backup._app !== 'GestaoLoja' || !backup.data) {
        showBackupStatus('❌ Arquivo inválido ou incompatível.', true);
        return;
      }

      var d = backup.data;
      var prodCount = (d.products || []).length;
      var histCount = (d.saleHistory || []).length;
      var empCount  = (d.employees  || []).length;
      var storeName = backup.store ? backup.store.name : 'desconhecida';
      var exported  = backup._exported || '—';

      var msg = 'Restaurar backup da loja "' + storeName + '"?\n\n'
        + '📦 ' + prodCount + ' produto(s)\n'
        + '📋 ' + histCount + ' registro(s) no histórico\n'
        + '👥 ' + empCount  + ' funcionário(s)\n'
        + '📅 Exportado em: ' + exported + '\n\n'
        + '⚠️ Os dados atuais desta loja serão SUBSTITUÍDOS.';

      if (!confirm(msg)) return;

      // Restaura os dados
      products    = Array.isArray(d.products)    ? d.products    : [];
      customCats  = Array.isArray(d.customCats)  ? d.customCats  : [];
      saleHistory = Array.isArray(d.saleHistory) ? d.saleHistory : [];
      config      = d.config && typeof d.config === 'object' ? d.config : { lowStock: 3 };
      employees   = Array.isArray(d.employees)   ? d.employees   : [];

      saveData();
      refreshAll();
      $('cfg-low-stock').value = config.lowStock || 3;

      showBackupStatus('✅ Backup restaurado: ' + prodCount + ' produto(s), ' + histCount + ' movimentação(ões).', false);
      showToast('✅ Backup restaurado com sucesso!');

    } catch (err) {
      showBackupStatus('❌ Erro ao ler o arquivo. Verifique se é um backup válido.', true);
    }
  };
  reader.readAsText(file);
}

function showBackupStatus(msg, isErr) {
  var el = $('backup-status');
  el.textContent = msg;
  el.style.display = 'block';
  el.style.color = isErr ? 'var(--red)' : 'var(--green)';
  clearTimeout(el._t);
  el._t = setTimeout(function(){ el.style.display = 'none'; }, 6000);
}

/* ═══════════════════════════════════════════
   GRÁFICO DE VENDAS
═══════════════════════════════════════════ */
var salesChartInstance = null;

function renderSalesChart(){
  var canvas = $('sales-chart');
  var emptyEl = $('chart-empty');
  if(!canvas) return;

  var days = parseInt(($('chart-period-select')||{value:'30'}).value) || 30;

  // Gera array dos últimos N dias
  var labels = [], dataMap = {};
  var now = new Date();
  for(var i = days-1; i >= 0; i--){
    var d = new Date(now);
    d.setDate(d.getDate() - i);
    var key = d.toISOString().slice(0,10); // yyyy-mm-dd
    var label = d.toLocaleDateString('pt-BR',{day:'2-digit',month:'2-digit'});
    labels.push(label);
    dataMap[key] = 0;
  }

  // Soma vendas por dia
  saleHistory.forEach(function(h){
    if(h.type !== 'sale' || !h.date || !h.total) return;
    var m = h.date.match(/(\d{2})\/(\d{2})\/(\d{4})/);
    if(!m) return;
    var key = m[3]+'-'+m[2]+'-'+m[1];
    if(dataMap.hasOwnProperty(key)) dataMap[key] += h.total;
  });

  var values = Object.values(dataMap);
  var hasData = values.some(function(v){ return v > 0; });

  if(!hasData){
    canvas.style.display = 'none';
    if(emptyEl) emptyEl.style.display = 'block';
    return;
  }
  canvas.style.display = 'block';
  if(emptyEl) emptyEl.style.display = 'none';

  // Detecta cores do tema atual
  var isDark = currentTheme !== 'light';
  var gridColor  = isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.07)';
  var labelColor = isDark ? '#6a6762' : '#888';
  var lineColor  = '#e8c84a';
  var fillColor  = 'rgba(232,200,74,0.12)';

  if(salesChartInstance){ salesChartInstance.destroy(); salesChartInstance = null; }

  salesChartInstance = new Chart(canvas, {
    type: 'line',
    data: {
      labels: labels,
      datasets: [{
        label: 'Vendas (R$)',
        data: values,
        borderColor: lineColor,
        backgroundColor: fillColor,
        borderWidth: 2,
        pointRadius: days <= 14 ? 4 : 2,
        pointBackgroundColor: lineColor,
        fill: true,
        tension: 0.3
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: function(ctx){
              return ' ' + fmt(ctx.parsed.y);
            }
          }
        }
      },
      scales: {
        x: {
          ticks: { color: labelColor, font: { size: 10 }, maxTicksLimit: days <= 14 ? days : 10 },
          grid: { color: gridColor }
        },
        y: {
          ticks: {
            color: labelColor, font: { size: 10 },
            callback: function(v){ return 'R$'+Number(v).toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g,'.'); }
          },
          grid: { color: gridColor },
          beginAtZero: true
        }
      }
    }
  });
}

/* ═══════════════════════════════════════════
   INIT
═══════════════════════════════════════════ */
// Init module nav visual state
(function(){
  $('subtabs-vendas').style.display='flex';
  $('subtabs-estoque').style.display='none';
  $('subtabs-admin').style.display='none';
})();
showLStores();