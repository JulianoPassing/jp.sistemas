/**
 * Etiquetas Mercado Livre — pedidos com pagamento aprovado: baixa PDF e impressão opcional.
 */
const path = require('path');
const fs = require('fs').promises;
const { execFile } = require('child_process');
const util = require('util');
const execFileP = util.promisify(execFile);

const { getPool, ensureDatabase, encryptSecret, decryptSecret } = require('./autopecasrg-db');
const ml = require('./ml-mercadolibre');

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

function pagamentoAprovado(order) {
  if (!order) return false;
  if (order.status === 'paid') return true;
  const payments = order.payments || [];
  return payments.some((p) => p.status === 'approved');
}

async function carregarConfigEtiquetas(usuarioId) {
  const pool = getPool();
  const [rows] = await pool.execute('SELECT * FROM config_etiquetas WHERE usuario_id = ?', [usuarioId]);
  if (!rows.length) {
    return {
      intervalo_segundos: 300,
      impressora_nome: null,
      impressora_ml: null,
      impressora_shopee: null,
      formato_ml: 'pdf_a4',
      formato_shopee: 'pdf_a4',
      pasta_download: null,
      baixar_pdf_automatico: 1,
      imprimir_automatico: 0,
      baixa_estoque_auto: 1,
      imprimir_auto_ml: 1,
      imprimir_auto_shopee: 1
    };
  }
  return rows[0];
}

async function imprimirPdf(pdfPath, impressoraNome) {
  const isWin = process.platform === 'win32';
  if (isWin) {
    const lit = pdfPath.replace(/'/g, "''");
    const ps = `Start-Process -LiteralPath '${lit}' -Verb Print -WindowStyle Hidden`;
    await execFileP('powershell.exe', ['-NoProfile', '-Command', ps], {
      windowsHide: true,
      timeout: 90000
    });
  } else {
    const args = impressoraNome ? ['-d', impressoraNome, pdfPath] : [pdfPath];
    await execFileP('lp', args, { timeout: 90000 });
  }
}

/**
 * Encontra a conta ML que tem acesso ao pedido e retorna order + token.
 */
async function resolverContaPedido(orderId) {
  const pool = getPool();
  const [contas] = await pool.execute(
    `SELECT * FROM contas_mercadolivre WHERE ativo = 1 AND refresh_token_enc IS NOT NULL`
  );
  for (const c of contas) {
    try {
      const token = await ensureMlAccessToken(c);
      const order = await ml.getOrder(token, orderId);
      const sellerId = order.seller?.id;
      if (!sellerId) continue;
      if (c.seller_id && String(c.seller_id) !== String(sellerId)) continue;
      if (!c.seller_id) {
        await pool.execute(`UPDATE contas_mercadolivre SET seller_id = ? WHERE id = ?`, [sellerId, c.id]);
        c.seller_id = sellerId;
      }
      return { conta: c, order, token };
    } catch {
      /* próxima conta */
    }
  }
  return null;
}

async function baixarEtiquetaPedido(conta, order, token, cfg) {
  const pool = getPool();
  const orderId = order.id;
  const shipmentId = order.shipping?.id;
  if (!shipmentId) {
    throw new Error('Pedido sem envio (shipping) ainda — aguarde ou verifique Mercado Envios.');
  }
  if (!pagamentoAprovado(order)) {
    throw new Error('Pagamento ainda não aprovado.');
  }

  const baseDir =
    (cfg.pasta_download && String(cfg.pasta_download).trim()) ||
    path.join(process.cwd(), 'storage', 'autopecasrg', 'etiquetas');
  await fs.mkdir(baseDir, { recursive: true });

  const buf = await ml.getShipmentLabelsPdfBuffer(token, shipmentId, cfg.formato_ml || 'pdf_a4');
  const fname = `ML_pedido_${orderId}_envio_${shipmentId}.pdf`;
  const pdfPath = path.join(baseDir, fname);
  await fs.writeFile(pdfPath, buf);

  const [ex] = await pool.execute(
    `SELECT id, status FROM etiquetas_ml WHERE conta_ml_id = ? AND ml_order_id = ?`,
    [conta.id, orderId]
  );
  if (ex.length) {
    await pool.execute(
      `UPDATE etiquetas_ml SET status = 'baixado', shipment_id = ?, pdf_path = ?, erro_msg = NULL, updated_at = NOW() WHERE id = ?`,
      [shipmentId, pdfPath, ex[0].id]
    );
  } else {
    await pool.execute(
      `INSERT INTO etiquetas_ml (usuario_id, conta_ml_id, ml_order_id, shipment_id, status, pdf_path)
       VALUES (?,?,?,?, 'baixado', ?)`,
      [conta.usuario_id, conta.id, orderId, shipmentId, pdfPath]
    );
  }

  const imprimir =
    cfg.imprimir_auto_ml != null ? !!cfg.imprimir_auto_ml : !!cfg.imprimir_automatico;
  const impressora = cfg.impressora_ml || cfg.impressora_nome;
  if (imprimir) {
    try {
      await imprimirPdf(pdfPath, impressora);
      await pool.execute(
        `UPDATE etiquetas_ml SET status = 'impresso' WHERE conta_ml_id = ? AND ml_order_id = ?`,
        [conta.id, orderId]
      );
    } catch (printErr) {
      console.error('[autopecasrg] impressão etiqueta:', printErr.message);
    }
  }

  return { pdfPath, orderId, shipmentId };
}

/**
 * Processa um pedido ML (webhook ou manual): só baixa se pagamento aprovado.
 */
async function processarEtiquetaPorOrderId(orderIdStr) {
  await ensureDatabase();
  const orderId = String(orderIdStr).replace(/\D/g, '');
  if (!orderId) return { ok: false, reason: 'order_id inválido' };

  const resolved = await resolverContaPedido(orderId);
  if (!resolved) {
    return { ok: false, reason: 'Nenhuma conta ML com acesso a este pedido' };
  }
  const { conta, order, token } = resolved;
  if (!pagamentoAprovado(order)) {
    return { ok: false, reason: 'Pagamento não aprovado ainda' };
  }

  const pool = getPool();
  const [ex] = await pool.execute(
    `SELECT id, status FROM etiquetas_ml WHERE conta_ml_id = ? AND ml_order_id = ?`,
    [conta.id, orderId]
  );
  if (ex.length && (ex[0].status === 'baixado' || ex[0].status === 'impresso')) {
    return { ok: true, skipped: true, reason: 'Etiqueta já processada' };
  }

  const cfg = await carregarConfigEtiquetas(conta.usuario_id);
  if (!cfg.baixar_pdf_automatico) {
    return { ok: false, reason: 'baixar_pdf_automatico desligado nas configurações' };
  }

  try {
    const r = await baixarEtiquetaPedido(conta, order, token, cfg);
    return { ok: true, ...r };
  } catch (e) {
    const msg = e.message || String(e);
    await pool.execute(
      `INSERT INTO etiquetas_ml (usuario_id, conta_ml_id, ml_order_id, status, erro_msg, tentativas)
       VALUES (?,?,?,'erro',?,1)
       ON DUPLICATE KEY UPDATE status = 'erro', erro_msg = VALUES(erro_msg), tentativas = tentativas + 1`,
      [conta.usuario_id, conta.id, orderId, msg.slice(0, 500)]
    );
    console.error('[autopecasrg] etiqueta ML', orderId, msg);
    return { ok: false, error: msg };
  }
}

/**
 * Varre pedidos pagos de todas as contas ML e baixa etiquetas novas.
 */
async function rodarVarreduraPedidosPagos(usuarioIdFiltro = null) {
  await ensureDatabase();
  const pool = getPool();
  let sql = `SELECT * FROM contas_mercadolivre WHERE ativo = 1 AND refresh_token_enc IS NOT NULL`;
  const params = [];
  if (usuarioIdFiltro != null) {
    sql += ` AND usuario_id = ?`;
    params.push(usuarioIdFiltro);
  }
  const [contas] = await pool.execute(sql, params);
  let n = 0;
  const vendas = require('./autopecasrg-vendas');
  for (const conta of contas) {
    const cfg = await carregarConfigEtiquetas(conta.usuario_id);
    if (!cfg.baixar_pdf_automatico) continue;

    try {
      const token = await ensureMlAccessToken(conta);
      const [sidRow] = await pool.execute('SELECT seller_id FROM contas_mercadolivre WHERE id = ?', [conta.id]);
      const sellerId = sidRow[0]?.seller_id;
      if (!sellerId) {
        console.warn('[autopecasrg] Conta ML sem seller_id — reautorize OAuth:', conta.id);
        continue;
      }
      let offset = 0;
      for (let page = 0; page < 5; page++) {
        const res = await ml.searchOrdersSeller(token, sellerId, { offset, limit: 50 });
        const results = res.results || res.orders || [];
        for (const row of results) {
          const oid = row.id;
          const [done] = await pool.execute(
            `SELECT status FROM etiquetas_ml WHERE conta_ml_id = ? AND ml_order_id = ?`,
            [conta.id, oid]
          );
          if (done.length && (done[0].status === 'baixado' || done[0].status === 'impresso')) continue;

          const order = await ml.getOrder(token, oid);
          if (!pagamentoAprovado(order)) continue;
          try {
            const r = await vendas.processarPedidoMercadoLivre(String(oid));
            if (r && r.ok) n++;
          } catch (e) {
            console.warn('[autopecasrg] pedido ML varredura', oid, e.message);
          }
        }
        if (!results.length || results.length < 50) break;
        offset += 50;
      }
    } catch (e) {
      console.warn('[autopecasrg] varredura conta', conta.id, e.message);
    }
  }
  return n;
}

function iniciarWorkerEtiquetas() {
  if (process.env.AUTOPECASRG_ETIQUETAS_ENABLED === '0') {
    console.log('[autopecasrg] Worker etiquetas ML desativado (AUTOPECASRG_ETIQUETAS_ENABLED=0)');
    return;
  }
  const ms = Math.max(60000, parseInt(process.env.AUTOPECASRG_ETIQUETAS_INTERVALO_MS || '300000', 10));
  console.log(`[autopecasrg] Worker etiquetas ML a cada ${ms / 1000}s`);
  setTimeout(() => {
    rodarVarreduraPedidosPagos().catch((e) => console.error('[autopecasrg] worker etiquetas:', e.message));
    setInterval(() => {
      rodarVarreduraPedidosPagos().catch((e) => console.error('[autopecasrg] worker etiquetas:', e.message));
    }, ms);
  }, 20000);
}

module.exports = {
  processarEtiquetaPorOrderId,
  rodarVarreduraPedidosPagos,
  iniciarWorkerEtiquetas,
  resolverContaPedido,
  imprimirPdf,
  carregarConfigEtiquetas
};
