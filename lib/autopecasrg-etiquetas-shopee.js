/**
 * Etiquetas Shopee — PDF de envio após pagamento (estrutura da API pode exigir ajuste por região).
 */
const path = require('path');
const fs = require('fs').promises;
const { getPool, ensureDatabase } = require('./autopecasrg-db');
const shopee = require('./shopee-openapi');
const { imprimirPdf, carregarConfigEtiquetas } = require('./autopecasrg-etiquetas-ml');

async function baixarBufferDeRespostaShopee(res) {
  if (!res || typeof res !== 'object') return null;
  const url =
    res.file_list?.[0]?.url ||
    res.document?.file_url ||
    res.file_url ||
    res.shipping_document?.url ||
    res.waybill_url;
  if (url && String(url).startsWith('http')) {
    const r = await fetch(url);
    if (!r.ok) throw new Error(`Download etiqueta Shopee HTTP ${r.status}`);
    return Buffer.from(await r.arrayBuffer());
  }
  const b64 =
    res.file_list?.[0]?.file_content ||
    res.file_list?.[0]?.base64_file ||
    res.shipping_document?.file_base64;
  if (b64) {
    return Buffer.from(String(b64), 'base64');
  }
  return null;
}

async function processarEtiquetaShopee(conta, orderDetail, ctx) {
  await ensureDatabase();
  const orderSn = orderDetail.order_sn || orderDetail.ordersn;
  if (!orderSn) return;

  const cfg = await carregarConfigEtiquetas(conta.usuario_id);
  if (!cfg.baixar_pdf_automatico) return;

  const pool = getPool();
  const [ex] = await pool.execute(
    `SELECT status FROM etiquetas_shopee WHERE conta_shopee_id = ? AND order_sn = ?`,
    [conta.id, orderSn]
  );
  if (ex.length && (ex[0].status === 'baixado' || ex[0].status === 'impresso')) return;

  const baseDir =
    (cfg.pasta_download && String(cfg.pasta_download).trim()) ||
    path.join(process.cwd(), 'storage', 'autopecasrg', 'etiquetas');
  await fs.mkdir(baseDir, { recursive: true });

  let buf;
  try {
    const res = await shopee.getShippingDocumentResult(ctx, orderSn);
    buf = await baixarBufferDeRespostaShopee(res);
    if (!buf) {
      throw new Error(
        'Resposta Shopee sem PDF reconhecido — confira logistics na documentação Open Platform para sua região.'
      );
    }
  } catch (e) {
    const msg = (e.message || String(e)).slice(0, 500);
    await pool.execute(
      `INSERT INTO etiquetas_shopee (usuario_id, conta_shopee_id, order_sn, status, erro_msg, tentativas)
       VALUES (?,?,?,'erro',?,1)
       ON DUPLICATE KEY UPDATE status='erro', erro_msg=VALUES(erro_msg), tentativas=tentativas+1`,
      [conta.usuario_id, conta.id, orderSn, msg]
    );
    console.error('[autopecasrg] etiqueta Shopee', orderSn, msg);
    return;
  }

  const ext = buf[0] === 0x25 && buf[1] === 0x50 ? 'pdf' : 'pdf';
  const fname = `SH_${orderSn}.${ext}`;
  const pdfPath = path.join(baseDir, fname);
  await fs.writeFile(pdfPath, buf);

  await pool.execute(
    `INSERT INTO etiquetas_shopee (usuario_id, conta_shopee_id, order_sn, status, pdf_path, erro_msg)
     VALUES (?,?,?,'baixado',?,NULL)
     ON DUPLICATE KEY UPDATE status='baixado', pdf_path=VALUES(pdf_path), erro_msg=NULL`,
    [conta.usuario_id, conta.id, orderSn, pdfPath]
  );

  const imprimir =
    cfg.imprimir_auto_shopee != null ? !!cfg.imprimir_auto_shopee : !!cfg.imprimir_automatico;
  const impressora = cfg.impressora_shopee || cfg.impressora_nome;
  if (imprimir) {
    try {
      await imprimirPdf(pdfPath, impressora);
      await pool.execute(
        `UPDATE etiquetas_shopee SET status='impresso' WHERE conta_shopee_id=? AND order_sn=?`,
        [conta.id, orderSn]
      );
    } catch (e) {
      console.error('[autopecasrg] impressão Shopee:', e.message);
    }
  }
}

module.exports = {
  processarEtiquetaShopee
};
