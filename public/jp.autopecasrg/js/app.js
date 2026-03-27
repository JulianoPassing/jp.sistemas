const API = '/api/autopecasrg';

async function checkAuth(requireLogin) {
  try {
    const r = await fetch(`${API}/session`, { credentials: 'include' });
    const d = await r.json();
    if (requireLogin && !d.authenticated) {
      window.location.href = 'login.html';
      return null;
    }
    return d;
  } catch {
    if (requireLogin) window.location.href = 'login.html';
    return null;
  }
}

async function logout() {
  await fetch(`${API}/logout`, { method: 'POST', credentials: 'include' });
  window.location.href = 'login.html';
}

function formatMoney(n) {
  return Number(n || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}
