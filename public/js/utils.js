/**
 * Utilitários globais - J.P Sistemas
 * Formatação de moeda, loading e confirmação
 */
(function(global) {
  'use strict';

  /** Formata valor em reais (pt-BR): R$ 25.706,00 */
  function formatarMoeda(valor) {
    const num = parseFloat(valor) || 0;
    return 'R$ ' + num.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  /** Mostra overlay de loading */
  function showLoading(mensagem) {
    let el = document.getElementById('jp-loading-overlay');
    if (!el) {
      el = document.createElement('div');
      el.id = 'jp-loading-overlay';
      el.innerHTML = '<div class="jp-loading-content"><div class="jp-loading-spinner"></div><span class="jp-loading-text">Carregando...</span></div>';
      el.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.4);display:flex;align-items:center;justify-content:center;z-index:9999;backdrop-filter:blur(2px);';
      const style = document.createElement('style');
      style.textContent = '.jp-loading-content{background:#fff;padding:24px 32px;border-radius:12px;box-shadow:0 10px 40px rgba(0,0,0,0.2);display:flex;flex-direction:column;align-items:center;gap:16px;}.jp-loading-spinner{width:40px;height:40px;border:3px solid #e5e7eb;border-top-color:#002f4b;border-radius:50%;animation:jp-spin 0.8s linear infinite;}.jp-loading-text{color:#374151;font-size:0.95rem;}@keyframes jp-spin{to{transform:rotate(360deg);}}';
      document.head.appendChild(style);
      document.body.appendChild(el);
    }
    const txt = el.querySelector('.jp-loading-text');
    if (txt) txt.textContent = mensagem || 'Carregando...';
    el.style.display = 'flex';
  }

  /** Esconde overlay de loading */
  function hideLoading() {
    const el = document.getElementById('jp-loading-overlay');
    if (el) el.style.display = 'none';
  }

  /** Confirmação antes de ação destrutiva */
  function confirmar(mensagem, titulo) {
    return window.confirm((titulo ? titulo + '\n\n' : '') + mensagem);
  }

  /** Exibe mensagem de sucesso (toast simples) */
  function mostrarSucesso(mensagem) {
    let el = document.getElementById('jp-toast');
    if (!el) {
      el = document.createElement('div');
      el.id = 'jp-toast';
      el.style.cssText = 'position:fixed;bottom:24px;right:24px;background:#059669;color:#fff;padding:14px 20px;border-radius:8px;box-shadow:0 4px 12px rgba(0,0,0,0.15);z-index:10000;font-size:0.95rem;animation:jp-toast-in 0.3s ease;max-width:360px;';
      const style = document.createElement('style');
      style.textContent = '@keyframes jp-toast-in{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:translateY(0)}}';
      document.head.appendChild(style);
      document.body.appendChild(el);
    }
    el.textContent = mensagem;
    el.style.display = 'block';
    clearTimeout(el._toastTimer);
    el._toastTimer = setTimeout(function() {
      el.style.display = 'none';
    }, 3000);
  }

  global.formatarMoeda = formatarMoeda;
  global.showLoading = showLoading;
  global.hideLoading = hideLoading;
  global.confirmar = confirmar;
  global.mostrarSucesso = mostrarSucesso;
})(typeof window !== 'undefined' ? window : this);
