/**
 * Cabeçalho e rodapé padrão JP Sistemas (logo + navegação + rodapé).
 * body[data-page] = dashboard | estoque | config | guia
 */
(function () {
  const LOGO = 'https://i.imgur.com/6N82fk2.png';
  const PAGE = document.body.getAttribute('data-page') || '';

  function navLink(id, href, icon, label) {
    const active = PAGE === id ? ' active' : '';
    return (
      '<a href="' +
      href +
      '" class="nav-link' +
      active +
      '"><i class="fas ' +
      icon +
      '"></i> ' +
      label +
      '</a>'
    );
  }

  const header = document.getElementById('jpapg-header');
  if (header) {
    header.innerHTML =
      '<header class="sistema-header">' +
      '<div class="header-content">' +
      '<a href="dashboard.html" class="logo" style="display:flex;align-items:center;gap:0.75rem;text-decoration:none;color:#fff;">' +
      '<img src="' +
      LOGO +
      '" alt="JP Sistemas" width="120" height="48" style="height:2.65rem;width:auto;object-fit:contain;" />' +
      '<span style="display:flex;flex-direction:column;line-height:1.15;text-align:left;">' +
      '<span style="font-size:0.68rem;opacity:0.9;font-weight:500;">JP Sistemas</span>' +
      '<span style="font-weight:700;font-size:1rem;">Auto Peças RG</span>' +
      '</span></a>' +
      '<nav>' +
      navLink('dashboard', 'dashboard.html', 'fa-chart-pie', 'Painel') +
      navLink('estoque', 'estoque.html', 'fa-boxes-stacked', 'Estoque') +
      navLink('guia', 'guia.html', 'fa-book-open', 'Guia') +
      navLink('config', 'configuracoes.html', 'fa-sliders', 'Configurações') +
      '<a href="#" class="nav-link nav-sair" onclick="logout();return false;"><i class="fas fa-sign-out-alt"></i> Sair</a>' +
      '</nav></div></header>';
  }

  const footer = document.getElementById('jpapg-footer');
  if (footer) {
    footer.innerHTML =
      '<footer class="apm-footer">' +
      '<div class="sistema-container apm-footer-inner">' +
      '<div class="apm-footer-brand">' +
      '<img src="' +
      LOGO +
      '" alt="" width="100" height="40" style="height:2.25rem;width:auto;object-fit:contain;" />' +
      '<div><strong>JP Sistemas</strong><br><span class="apm-muted">Módulo Auto Peças RG · Estoque e marketplaces</span></div></div>' +
      '<p class="apm-footer-copy">© ' +
      new Date().getFullYear() +
      ' · <a href="/">jp-sistemas.com</a></p></div></footer>';
  }
})();
