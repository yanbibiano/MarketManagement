/* ═══════════════════════════════════════════
   BARCODE SCANNER — leitura de código de barras via câmera
   Usa a biblioteca html5-qrcode (carregada via CDN no index.html).
   Compartilha escopo global com os outros scripts (não é módulo ES).
═══════════════════════════════════════════ */
var _scannerInstance = null;
var _scannerTargetId = null;

/**
 * Abre o modal de leitura e liga a câmera traseira do aparelho.
 * @param {string} targetInputId - id do <input> que vai receber o código lido
 */
function openScanner(targetInputId){
  if (typeof Html5Qrcode === 'undefined') {
    showToast('⚠️ Leitor de código de barras indisponível. Verifique sua internet e tente de novo.', true);
    return;
  }
  _scannerTargetId = targetInputId;
  $('scanner-err').textContent = '';
  $('overlay-scanner').classList.add('open');

  _scannerInstance = new Html5Qrcode('scanner-view');
  var config = {
    fps: 10,
    qrbox: { width: 260, height: 130 },
    formatsToSupport: [
      Html5QrcodeSupportedFormats.EAN_13,
      Html5QrcodeSupportedFormats.EAN_8,
      Html5QrcodeSupportedFormats.UPC_A,
      Html5QrcodeSupportedFormats.UPC_E,
      Html5QrcodeSupportedFormats.CODE_128,
      Html5QrcodeSupportedFormats.CODE_39
    ]
  };

  _scannerInstance.start(
    { facingMode: 'environment' }, // câmera traseira — melhor pra ler código de barras
    config,
    function onScanSuccess(decodedText){ onBarcodeDetected(decodedText); },
    function onScanFailure(){ /* dispara a cada frame sem leitura — ignorado de propósito */ }
  ).catch(function(){
    $('scanner-err').textContent = 'Não foi possível acessar a câmera. Verifique se você deu permissão ao navegador.';
  });
}

/** Chamado quando a câmera lê um código com sucesso. */
function onBarcodeDetected(code){
  var input = $(_scannerTargetId);
  if(!input){ closeScanner(); return; }

  input.value = code;
  input.dispatchEvent(new Event('input', { bubbles: true }));

  // Na tela de Vendas: se o código bater com exatamente um produto,
  // já joga direto no carrinho — agiliza o caixa.
  if (_scannerTargetId === 'sale-search' && typeof getSellableUnits === 'function') {
    var matches = getSellableUnits().filter(function(u){ return u.barcode && u.barcode === code; });
    if (matches.length === 1) {
      addToCart(matches[0].pid, matches[0].varName);
      input.value = '';
      $('sale-results').style.display = 'none';
      showToast('✅ ' + matches[0].name + ' adicionado ao carrinho.');
    } else if (matches.length === 0) {
      showToast('⚠️ Nenhum produto com esse código de barras.', true);
    }
  } else {
    showToast('✅ Código lido: ' + code);
  }

  closeScanner();
}

/** Fecha o modal e desliga a câmera (importante: libera o hardware do aparelho). */
function closeScanner(){
  $('overlay-scanner').classList.remove('open');
  if (_scannerInstance) {
    var toStop = _scannerInstance;
    _scannerInstance = null;
    toStop.stop().then(function(){ toStop.clear(); }).catch(function(){ /* já parado */ });
  }
}

// Clique fora do modal fecha e desliga a câmera (não usa o closeModal()
// genérico de propósito, porque ele não sabe parar a câmera).
document.addEventListener('click', function(e){
  var overlay = $('overlay-scanner');
  if (overlay && e.target === overlay) closeScanner();
});
