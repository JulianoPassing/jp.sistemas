/**
 * Cliente HTTP Mercado Livre (OAuth + itens + estoque)
 * Documentação: https://developers.mercadolivre.com.br/
 */
const ML_AUTH = 'https://auth.mercadolivre.com.br/authorization';
const ML_TOKEN = 'https://api.mercadolibre.com/oauth/token';
const ML_API = 'https://api.mercadolibre.com';

function buildAuthUrl({ clientId, redirectUri, state }) {
  const p = new URLSearchParams({
    response_type: 'code',
    client_id: clientId,
    redirect_uri: redirectUri,
    state: state || 'jp',
    /** Sem escopo de acesso prolongado o ML pode não devolver refresh_token (fica só access_token). */
    scope: 'offline_access read write'
  });
  return `${ML_AUTH}?${p.toString()}`;
}

async function exchangeCode({ code, clientId, clientSecret, redirectUri }) {
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    client_id: clientId,
    client_secret: clientSecret,
    code,
    redirect_uri: redirectUri
  });
  const r = await fetch(ML_TOKEN, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
    body
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) {
    const err = new Error(data.message || data.error || `OAuth ML ${r.status}`);
    err.detail = data;
    throw err;
  }
  return data;
}

async function refreshAccessToken({ refreshToken, clientId, clientSecret }) {
  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: refreshToken
  });
  const r = await fetch(ML_TOKEN, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
    body
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) {
    const err = new Error(data.message || data.error || `Refresh ML ${r.status}`);
    err.detail = data;
    throw err;
  }
  return data;
}

async function mlFetch(path, accessToken, options = {}) {
  const url = path.startsWith('http') ? path : `${ML_API}${path.startsWith('/') ? '' : '/'}${path}`;
  const r = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/json',
      'Content-Type': 'application/json',
      ...options.headers
    }
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) {
    const err = new Error(data.message || data.error || `ML API ${r.status}`);
    err.status = r.status;
    err.detail = data;
    throw err;
  }
  return data;
}

/** Cria anúncio (buy_it_now). category_id obrigatório na API ML. */
async function createItem(accessToken, body) {
  return mlFetch('/items', accessToken, { method: 'POST', body: JSON.stringify(body) });
}

async function updateItemStock(accessToken, itemId, availableQuantity) {
  return mlFetch(`/items/${itemId}`, accessToken, {
    method: 'PUT',
    body: JSON.stringify({ available_quantity: availableQuantity })
  });
}

async function updateItemPrice(accessToken, itemId, price) {
  return mlFetch(`/items/${itemId}`, accessToken, {
    method: 'PUT',
    body: JSON.stringify({ price: Number(price) })
  });
}

/** Descrição em texto (anúncio mais completo). */
async function setItemDescription(accessToken, itemId, plainText) {
  if (!plainText || !String(plainText).trim()) return null;
  const body = JSON.stringify({ plain_text: String(plainText).slice(0, 50000) });
  try {
    return await mlFetch(`/items/${itemId}/description`, accessToken, {
      method: 'POST',
      body
    });
  } catch (e) {
    if (e.status === 404 || e.status === 405) {
      return mlFetch(`/items/${itemId}/description`, accessToken, { method: 'PUT', body });
    }
    throw e;
  }
}

async function getItem(accessToken, itemId) {
  return mlFetch(`/items/${itemId}`, accessToken, { method: 'GET' });
}

async function getOrder(accessToken, orderId) {
  return mlFetch(`/orders/${orderId}`, accessToken, { method: 'GET' });
}

/** Pedidos pagos do vendedor (paginação). */
async function searchOrdersSeller(accessToken, sellerId, { offset = 0, limit = 50 } = {}) {
  const qs = new URLSearchParams({
    'order.status': 'paid',
    offset: String(offset),
    limit: String(Math.min(limit, 50))
  });
  return mlFetch(`/users/${sellerId}/orders/search?${qs}`, accessToken, { method: 'GET' });
}

/** Etiqueta PDF (Mercado Envios). `response_type` comum: pdf_100x150 (10×15 cm), pdf_a4, pdf, zpl2. */
async function getShipmentLabelsPdfBuffer(accessToken, shipmentId, formato) {
  const f = formato && String(formato).trim() ? String(formato).trim() : 'pdf_100x150';
  const u = new URL(`${ML_API}/shipments/${shipmentId}/labels`);
  u.searchParams.set('response_type', f);
  const r = await fetch(u.toString(), {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/pdf'
    }
  });
  if (!r.ok) {
    const err = new Error(`Etiqueta ML HTTP ${r.status}`);
    err.status = r.status;
    err.body = await r.text();
    throw err;
  }
  const ct = (r.headers.get('content-type') || '').toLowerCase();
  if (ct.includes('application/json')) {
    const j = await r.json().catch(() => ({}));
    const err = new Error(j.message || 'Resposta JSON em vez de PDF (etiqueta indisponível?)');
    err.detail = j;
    throw err;
  }
  return Buffer.from(await r.arrayBuffer());
}

/** Etiqueta de envio (metadados JSON — legado) */
async function getShipmentLabelsPdfUrl(accessToken, shipmentId) {
  return mlFetch(`/shipments/${shipmentId}/labels`, accessToken, { method: 'GET' });
}

module.exports = {
  buildAuthUrl,
  exchangeCode,
  refreshAccessToken,
  createItem,
  updateItemStock,
  updateItemPrice,
  setItemDescription,
  getItem,
  getOrder,
  searchOrdersSeller,
  getShipmentLabelsPdfBuffer,
  getShipmentLabelsPdfUrl,
  ML_API
};
