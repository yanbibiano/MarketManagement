/* ═══════════════════════════════════════════
   VENDAS — carrinho, busca de produto, checkout
   Extraído de app.js para facilitar manutenção.
   Compartilha o escopo global com os outros scripts
   (não é um módulo ES — é um <script> comum, carregado
   depois de app.js no index.html).
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

