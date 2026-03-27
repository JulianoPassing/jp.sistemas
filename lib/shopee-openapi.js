/**
 * Shopee Open Platform API v2
 * Documentação: https://open.shopee.com/
 */
const crypto = require('crypto');

const HOST = (process.env.SHOPEE_API_HOST || 'https://partner.shopeemobile.com').replace(/\/$/, '');

function signPublic(partnerKey, partnerId, path, timestamp) {
  const base = `${partnerId}${path}${timestamp}`;
  return crypto.createHmac('sha256', partnerKey).update(base).digest('hex');
}

function signShop(partnerKey, partnerId, path, timestamp, accessToken, shopId) {
  const base = `${partnerId}${path}${timestamp}${accessToken || ''}${shopId != null ? String(shopId) : ''}`;
  return crypto.createHmac('sha256', partnerKey).update(base).digest('hex');
}

async function authRefreshAccessToken({ partnerId, partnerKey, refreshToken, shopId }) {
  const path = '/api/v2/auth/access_token/get';
  const ts = Math.floor(Date.now() / 1000);
  const sign = signPublic(partnerKey, partnerId, path, ts);
  const url = `${HOST}${path}?partner_id=${encodeURIComponent(partnerId)}&timestamp=${ts}&sign=${sign}`;
  const r = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      refresh_token: refreshToken,
      partner_id: Number(partnerId),
      shop_id: Number(shopId)
    })
  });
  const data = await r.json().catch(() => ({}));
  if (data.error != null && String(data.error) !== '') {
    const err = new Error(data.message || data.error || `Shopee auth ${r.status}`);
    err.detail = data;
    throw err;
  }
  const res = data.response || data;
  if (!res.access_token) {
    const err = new Error('Resposta Shopee sem access_token');
    err.detail = data;
    throw err;
  }
  return res;
}

async function shopRequest(path, { partnerId, partnerKey, shopId, accessToken, body }) {
  const ts = Math.floor(Date.now() / 1000);
  const sign = signShop(partnerKey, partnerId, path, ts, accessToken, shopId);
  const q = new URLSearchParams({
    partner_id: String(partnerId),
    timestamp: String(ts),
    sign,
    access_token: accessToken,
    shop_id: String(shopId)
  });
  const url = `${HOST}${path}?${q.toString()}`;
  const r = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body || {})
  });
  const data = await r.json().catch(() => ({}));
  if (data.error != null && String(data.error) !== '') {
    const err = new Error(data.message || data.error || `Shopee ${r.status}`);
    err.detail = data;
    throw err;
  }
  return data.response != null ? data.response : data;
}

async function addItem(ctx, payload) {
  return shopRequest('/api/v2/product/add_item', {
    partnerId: ctx.partnerId,
    partnerKey: ctx.partnerKey,
    shopId: ctx.shopId,
    accessToken: ctx.accessToken,
    body: payload
  });
}

async function getOrderDetail(ctx, orderSn) {
  return shopRequest('/api/v2/order/get_order_detail', {
    partnerId: ctx.partnerId,
    partnerKey: ctx.partnerKey,
    shopId: ctx.shopId,
    accessToken: ctx.accessToken,
    body: { order_sn_list: [String(orderSn)] }
  });
}

/** Documento de envio (waybill) — estrutura varia; ver response.file_list / document_url na doc Shopee. */
async function getShippingDocumentResult(ctx, orderSn) {
  return shopRequest('/api/v2/logistics/get_shipping_document_result', {
    partnerId: ctx.partnerId,
    partnerKey: ctx.partnerKey,
    shopId: ctx.shopId,
    accessToken: ctx.accessToken,
    body: { order_sn: String(orderSn) }
  });
}

/** Árvore de categorias do produto (folhas para `add_item`). `parent_category_id` 0 = raiz. */
async function getProductCategory(ctx, { parentCategoryId = 0, language = 'pt' } = {}) {
  return shopRequest('/api/v2/product/get_category', {
    partnerId: ctx.partnerId,
    partnerKey: ctx.partnerKey,
    shopId: ctx.shopId,
    accessToken: ctx.accessToken,
    body: { parent_category_id: parentCategoryId, language }
  });
}

async function updateStock(ctx, itemId, stock) {
  const n = Math.max(0, parseInt(stock, 10));
  return shopRequest('/api/v2/product/update_stock', {
    partnerId: ctx.partnerId,
    partnerKey: ctx.partnerKey,
    shopId: ctx.shopId,
    accessToken: ctx.accessToken,
    body: {
      item_id: Number(itemId),
      stock_list: [
        {
          model_id: 0,
          seller_stock: [
            {
              location_id: '',
              stock: n
            }
          ]
        }
      ]
    }
  });
}

/** URL para o vendedor autorizar a loja (Partner API v2). `redirect` deve estar cadastrado no app Open Platform. */
function buildAuthPartnerUrl({ partnerId, partnerKey, redirectUri }) {
  const path = '/api/v2/shop/auth_partner';
  const ts = Math.floor(Date.now() / 1000);
  const sign = signPublic(partnerKey, partnerId, path, ts);
  const u = new URL(`${HOST}${path}`);
  u.searchParams.set('partner_id', String(partnerId));
  u.searchParams.set('timestamp', String(ts));
  u.searchParams.set('sign', sign);
  u.searchParams.set('redirect', redirectUri);
  return u.toString();
}

/** Troca `code` + `shop_id` (retorno do auth_partner) por access_token e refresh_token. */
async function exchangeAuthCode({ partnerId, partnerKey, code, shopId }) {
  const path = '/api/v2/auth/token/get';
  const ts = Math.floor(Date.now() / 1000);
  const sign = signPublic(partnerKey, partnerId, path, ts);
  const url = `${HOST}${path}?partner_id=${encodeURIComponent(String(partnerId))}&timestamp=${ts}&sign=${sign}`;
  const r = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      code,
      partner_id: Number(partnerId),
      shop_id: Number(shopId)
    })
  });
  const data = await r.json().catch(() => ({}));
  if (data.error != null && String(data.error) !== '') {
    const err = new Error(data.message || data.error || `Shopee token/get ${r.status}`);
    err.detail = data;
    throw err;
  }
  const res = data.response != null ? data.response : data;
  if (!res.access_token) {
    const err = new Error('Resposta Shopee sem access_token');
    err.detail = data;
    throw err;
  }
  return res;
}

module.exports = {
  HOST,
  signPublic,
  signShop,
  authRefreshAccessToken,
  buildAuthPartnerUrl,
  exchangeAuthCode,
  addItem,
  getProductCategory,
  getOrderDetail,
  getShippingDocumentResult,
  updateStock
};
