/**
 * Baixa de estoque automática ao confirmar pagamento (ML + Shopee) e disparo de etiquetas.
 */
const { getPool, ensureDatabase, encryptSecret, decryptSecret } = require('./autopecasrg-db');
const ml = require('./ml-mercadolibre');
const shopee = require('./shopee-openapi');
const etiquetasMl = require('./autopecasrg-etiquetas-ml');
const etiquetasShopee = require('./autopecasrg-etiquetas-shopee');

async function ensureMlAccessToken(conta) {
  const pool = getPool();
  const clientSecret = decryptSecret(conta.client_secret_enc);
  const refresh = decryptSecret(conta.refresh_token_enc);
  if (!refresh) throw new Error('Conta ML não autorizada');
  const expires = conta.token_expires_at ? new Date(conta.token_expires_at) : null;
  if (conta.access_token_enc && expires && expires > new Date(Date.now() + 120000)) {
    return decryptSecret(conta.access_token_enc);
  }
  const data = await ml.refreshAccessToken({
    refreshToken: refresh,
    clientId: conta.app_id,
    clientSecret
  });
  const newAccess = data.access_token;
  const newRefresh = data.refresh_token || refresh;
  const exp = new Date(Date.now() + (data.expires_in || 21600) * 1000);
  await pool.execute(
    `UPDATE contas_mercadolivre SET access_token_enc = ?, refresh_token_enc = ?, token_expires_at = ?, seller_id = COALESCE(seller_id, ?) WHERE id = ?`,
    [encryptSecret(newAccess), encryptSecret(newRefresh), exp, data.user_id || null, conta.id]
  );
  return newAccess;
}

async function ensureShopeeAccessToken(conta) {
  const pool = getPool();
  const partnerKey = decryptSecret(conta.partner_key_enc);
  const refresh = decryptSecret(conta.refresh_token_enc);
  if (!refresh) throw new Error('Conta Shopee sem refresh_token');
  const expires = conta.token_expires_at ? new Date(conta.token_expires_at) : null;
  if (conta.access_token_enc && expires && expires > new Date(Date.now() + 120000)) {
    return decryptSecret(conta.access_token_enc);
  }
  const data = await shopee.authRefreshAccessToken({
    partnerId: conta.partner_id,
    partnerKey,
    refreshToken: refresh,
    shopId: conta.shop_id
  });
  const newAccess = data.access_token;
  const newRefresh = data.refresh_token || refresh;
  const expSec = data.expire_in || data.expires_in || 14400;
  const exp = new Date(Date.now() + Number(expSec) * 1000);
  await pool.execute(
    `UPDATE contas_shopee SET access_token_enc = ?, refresh_token_enc = ?, token_expires_at = ? WHERE id = ?`,
    [encryptSecret(newAccess), encryptSecret(newRefresh), exp, conta.id]
  );
  return newAccess;
}

async function propagarEstoquePlataformas(usuarioId, produtoId, novoEstoque, ignorarPlataforma) {
  const pool = getPool();
  const [pubs] = await pool.execute(
    `SELECT p.* FROM publicacoes p WHERE p.produto_id = ? AND p.usuario_id = ? AND p.status = 'ativo' AND p.external_item_id IS NOT NULL`,
    [produtoId, usuarioId]
  );
  const erros = [];
  for (const pub of pubs) {
    if (ignorarPlataforma && pub.plataforma === ignorarPlataforma) continue;
    try {
      if (pub.plataforma === 'ml') {
        const [crows] = await pool.execute('SELECT * FROM contas_mercadolivre WHERE id = ?', [pub.conta_id]);
        if (!crows.length) continue;
        const token = await ensureMlAccessToken(crows[0]);
        await ml.updateItemStock(token, pub.external_item_id, novoEstoque);
      } else if (pub.plataforma === 'shopee') {
        const [crows] = await pool.execute('SELECT * FROM contas_shopee WHERE id = ?', [pub.conta_id]);
        if (!crows.length) continue;
        const c = crows[0];
        const token = await ensureShopeeAccessToken(c);
        const pk = decryptSecret(c.partner_key_enc);
        await shopee.updateStock(
          {
            partnerId: c.partner_id,
            partnerKey: pk,
            shopId: c.shop_id,
            accessToken: token
          },
          pub.external_item_id,
          novoEstoque
        );
      }
    } catch (e) {
      erros.push({ publicacao: pub.id, msg: e.message });
    }
  }
  return erros;
}

async function registrarMovimento(pool, { produtoId, usuarioId, delta, saldoApos, motivo, refOrigem, plataforma }) {
  await pool.execute(
    `INSERT INTO movimentos_estoque (produto_id, usuario_id, delta, saldo_apos, motivo, ref_origem, plataforma) VALUES (?,?,?,?,?,?,?)`,
    [produtoId, usuarioId, delta, saldoApos, motivo, refOrigem || null, plataforma || null]
  );
}

function pagamentoAprovadoML(order) {
  if (!order) return false;
  if (order.status === 'paid') return true;
  const payments = order.payments || [];
  return payments.some((p) => p.status === 'approved');
}

function pedidoShopeePago(orderDetail) {
  if (!orderDetail) return false;
  const st = orderDetail.order_status;
  if (st === 'UNPAID' || st === 'CANCELLED') return false;
  if (orderDetail.pay_time && Number(orderDetail.pay_time) > 0) return true;
  return ['READY_TO_SHIP', 'PROCESSED', 'SHIPPED', 'TO_CONFIRM_RECEIVE', 'COMPLETED'].includes(String(st));
}

async function baixarEstoquePedidoML(order, conta) {
  const pool = getPool();
  const items = order.order_items || [];
  for (const line of items) {
    const itemId = line.item?.id || line.item_id;
    const qty = Math.max(1, parseInt(line.quantity, 10) || 1);
    if (!itemId) continue;
    const [pubs] = await pool.execute(
      `SELECT produto_id FROM publicacoes WHERE usuario_id = ? AND plataforma = 'ml' AND conta_id = ? AND external_item_id = ? AND status = 'ativo'`,
      [conta.usuario_id, conta.id, String(itemId)]
    );
    if (!pubs.length) continue;
    const produtoId = pubs[0].produto_id;
    const [[row]] = await pool.execute('SELECT estoque FROM produtos WHERE id = ? AND usuario_id = ?', [
      produtoId,
      conta.usuario_id
    ]);
    if (!row) continue;
    const novo = Math.max(0, row.estoque - qty);
    await pool.execute('UPDATE produtos SET estoque = ? WHERE id = ?', [novo, produtoId]);
    await registrarMovimento(pool, {
      produtoId,
      usuarioId: conta.usuario_id,
      delta: -qty,
      saldoApos: novo,
      motivo: 'venda_ml',
      refOrigem: String(order.id),
      plataforma: 'ml'
    });
    await propagarEstoquePlataformas(conta.usuario_id, produtoId, novo, 'ml');
  }
}

async function baixarEstoquePedidoShopee(orderDetail, conta) {
  const pool = getPool();
  const list = orderDetail.item_list || orderDetail.items || [];
  for (const it of list) {
    const itemId = it.item_id != null ? String(it.item_id) : null;
    const qty = Math.max(1, parseInt(it.model_quantity || it.quantity || 1, 10));
    if (!itemId) continue;
    const [pubs] = await pool.execute(
      `SELECT produto_id FROM publicacoes WHERE usuario_id = ? AND plataforma = 'shopee' AND conta_id = ? AND external_item_id = ? AND status = 'ativo'`,
      [conta.usuario_id, conta.id, itemId]
    );
    if (!pubs.length) continue;
    const produtoId = pubs[0].produto_id;
    const [[row]] = await pool.execute('SELECT estoque FROM produtos WHERE id = ? AND usuario_id = ?', [
      produtoId,
      conta.usuario_id
    ]);
    if (!row) continue;
    const novo = Math.max(0, row.estoque - qty);
    await pool.execute('UPDATE produtos SET estoque = ? WHERE id = ?', [novo, produtoId]);
    await registrarMovimento(pool, {
      produtoId,
      usuarioId: conta.usuario_id,
      delta: -qty,
      saldoApos: novo,
      motivo: 'venda_shopee',
      refOrigem: String(orderDetail.order_sn || ''),
      plataforma: 'shopee'
    });
    await propagarEstoquePlataformas(conta.usuario_id, produtoId, novo, 'shopee');
  }
}

/**
 * Webhook / worker: pedido ML pago → estoque → etiqueta.
 */
async function processarPedidoMercadoLivre(orderIdStr) {
  await ensureDatabase();
  const orderId = String(orderIdStr).replace(/\D/g, '');
  if (!orderId) return { ok: false };

  const resolved = await etiquetasMl.resolverContaPedido(orderId);
  if (!resolved) return { ok: false, reason: 'sem_conta' };
  const { conta, order } = resolved;
  if (!pagamentoAprovadoML(order)) {
    return { ok: false, reason: 'pagamento_pendente' };
  }

  const pool = getPool();
  const [vp] = await pool.execute(
    `SELECT id FROM vendas_processadas WHERE plataforma = 'ml' AND conta_id = ? AND pedido_externo = ?`,
    [conta.id, String(order.id)]
  );

  const [cfgRows] = await pool.execute('SELECT * FROM config_etiquetas WHERE usuario_id = ?', [conta.usuario_id]);
  const cfg = cfgRows[0] || { baixa_estoque_auto: 1 };

  if (!vp.length && cfg.baixa_estoque_auto !== 0) {
    try {
      await baixarEstoquePedidoML(order, conta);
      await pool.execute(
        `INSERT INTO vendas_processadas (usuario_id, plataforma, conta_id, pedido_externo) VALUES (?,?,?,?)`,
        [conta.usuario_id, 'ml', conta.id, String(order.id)]
      );
    } catch (e) {
      console.error('[autopecasrg] baixa estoque ML', orderId, e.message);
    }
  }

  await etiquetasMl.processarEtiquetaPorOrderId(orderId);
  return { ok: true };
}

async function resolverContaShopeePorShop(shopId) {
  const pool = getPool();
  const [rows] = await pool.execute(
    `SELECT * FROM contas_shopee WHERE ativo = 1 AND refresh_token_enc IS NOT NULL AND shop_id = ?`,
    [String(shopId)]
  );
  return rows[0] || null;
}

/**
 * Webhook Shopee: order_sn + shop_id
 */
async function processarPedidoShopee(orderSn, shopIdStr) {
  await ensureDatabase();
  const orderSnClean = String(orderSn || '').trim();
  if (!orderSnClean) return { ok: false, reason: 'order_sn' };

  const conta = await resolverContaShopeePorShop(shopIdStr);
  if (!conta) return { ok: false, reason: 'conta_shopee' };

  const token = await ensureShopeeAccessToken(conta);
  const pk = decryptSecret(conta.partner_key_enc);
  const ctx = {
    partnerId: conta.partner_id,
    partnerKey: pk,
    shopId: conta.shop_id,
    accessToken: token
  };

  let detail;
  try {
    const res = await shopee.getOrderDetail(ctx, orderSnClean);
    detail = res.order_list?.[0] || res;
  } catch (e) {
    console.error('[autopecasrg] Shopee get_order_detail', e.message);
    return { ok: false, error: e.message };
  }

  if (!pedidoShopeePago(detail)) {
    return { ok: false, reason: 'pagamento_pendente_shopee' };
  }

  const pool = getPool();
  const [vp] = await pool.execute(
    `SELECT id FROM vendas_processadas WHERE plataforma = 'shopee' AND conta_id = ? AND pedido_externo = ?`,
    [conta.id, orderSnClean]
  );

  const [cfgRows] = await pool.execute('SELECT * FROM config_etiquetas WHERE usuario_id = ?', [conta.usuario_id]);
  const cfg = cfgRows[0] || { baixa_estoque_auto: 1 };

  if (!vp.length && cfg.baixa_estoque_auto !== 0) {
    try {
      await baixarEstoquePedidoShopee(detail, conta);
      await pool.execute(
        `INSERT INTO vendas_processadas (usuario_id, plataforma, conta_id, pedido_externo) VALUES (?,?,?,?)`,
        [conta.usuario_id, 'shopee', conta.id, orderSnClean]
      );
    } catch (e) {
      console.error('[autopecasrg] baixa estoque Shopee', orderSnClean, e.message);
    }
  }

  await etiquetasShopee.processarEtiquetaShopee(conta, detail, ctx);
  return { ok: true };
}

module.exports = {
  processarPedidoMercadoLivre,
  processarPedidoShopee
};
