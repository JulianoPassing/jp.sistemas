/**
 * JP Auto Peças RG — login, estoque, Mercado Livre (OAuth + publicação + etiquetas base), Shopee (credenciais)
 */
const express = require('express');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { getPool, ensureDatabase, encryptSecret, decryptSecret } = require('../lib/autopecasrg-db');
const ml = require('../lib/ml-mercadolibre');
const shopee = require('../lib/shopee-openapi');
const etiquetasMl = require('../lib/autopecasrg-etiquetas-ml');
const autopecasrgVendas = require('../lib/autopecasrg-vendas');

const router = express.Router();

function precoMl(prod) {
  return prod.preco_ml != null ? Number(prod.preco_ml) : Number(prod.preco);
}

function precoShopee(prod) {
  return prod.preco_shopee != null ? Number(prod.preco_shopee) : Number(prod.preco);
}

let dbReady = false;
async function withDb(req, res, next) {
  try {
    if (!dbReady) {
      await ensureDatabase();
      dbReady = true;
    }
    next();
  } catch (e) {
    console.error('[autopecasrg] DB:', e);
    res.status(500).json({ error: 'Erro ao conectar ao banco' });
  }
}

router.use(withDb);

function requireAuth(req, res, next) {
  const uid = req.session && req.session.autopecasrgUsuarioId;
  if (!uid) {
    return res.status(401).json({ error: 'Não autenticado' });
  }
  req.autopecasrgUsuarioId = uid;
  next();
}

const uploadAutopecasDir = path.join(__dirname, '..', 'public', 'uploads', 'autopecasrg');

function ensureAutopecasUploadDir(usuarioId) {
  const dir = path.join(uploadAutopecasDir, String(usuarioId));
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

const storageAutopecasImg = multer.diskStorage({
  destination(req, file, cb) {
    try {
      const dir = ensureAutopecasUploadDir(req.autopecasrgUsuarioId);
      cb(null, dir);
    } catch (e) {
      cb(e);
    }
  },
  filename(req, file, cb) {
    const ext = path.extname(file.originalname || '').toLowerCase();
    const safe = ['.jpg', '.jpeg', '.png', '.webp'].includes(ext) ? ext : '.jpg';
    cb(null, `${Date.now()}-${crypto.randomBytes(6).toString('hex')}${safe}`);
  }
});

const uploadAutopecasMulter = multer({
  storage: storageAutopecasImg,
  limits: { fileSize: 8 * 1024 * 1024, files: 12 },
  fileFilter(req, file, cb) {
    const ok = /^image\/(jpeg|png|webp)$/i.test(file.mimetype);
    if (ok) cb(null, true);
    else cb(new Error('Use apenas imagens JPG, PNG ou WebP.'));
  }
});

function configuracoesHtmlUrl() {
  const base = (process.env.AUTOPECASRG_PUBLIC_URL || '').replace(/\/$/, '');
  if (base) return `${base}/configuracoes.html`;
  return '/jp.autopecasrg/configuracoes.html';
}

async function ensureMlAccessToken(conta) {
  const pool = getPool();
  const clientSecret = decryptSecret(conta.client_secret_enc);
  const refresh = decryptSecret(conta.refresh_token_enc);
  if (!refresh) throw new Error('Autorize a conta no Mercado Livre (OAuth).');
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
    [
      encryptSecret(newAccess),
      encryptSecret(newRefresh),
      exp,
      data.user_id || null,
      conta.id
    ]
  );
  return newAccess;
}

async function ensureShopeeAccessToken(conta) {
  const pool = getPool();
  const partnerKey = decryptSecret(conta.partner_key_enc);
  const refresh = decryptSecret(conta.refresh_token_enc);
  if (!refresh) throw new Error('Cadastre o refresh_token da Shopee (Partner Center) na conta.');
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

// ——— Auth ———
router.post('/login', async (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) {
    return res.status(400).json({ success: false, message: 'Usuário e senha obrigatórios.' });
  }
  try {
    const pool = getPool();
    const [rows] = await pool.execute('SELECT id, username, password_hash FROM usuarios WHERE username = ?', [
      String(username).trim()
    ]);
    if (!rows.length) {
      return res.status(401).json({ success: false, message: 'Usuário ou senha inválidos.' });
    }
    const u = rows[0];
    const ok = await bcrypt.compare(password, u.password_hash);
    if (!ok) {
      return res.status(401).json({ success: false, message: 'Usuário ou senha inválidos.' });
    }
    req.session.autopecasrgUsuarioId = u.id;
    req.session.autopecasrgUser = u.username;
    res.json({ success: true });
  } catch (e) {
    console.error('[autopecasrg] login', e);
    res.status(500).json({ success: false, message: 'Erro interno.' });
  }
});

router.post('/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) return res.status(500).json({ success: false });
    res.json({ success: true });
  });
});

router.get('/session', (req, res) => {
  if (req.session && req.session.autopecasrgUsuarioId) {
    res.json({
      authenticated: true,
      user: req.session.autopecasrgUser,
      usuarioId: req.session.autopecasrgUsuarioId
    });
  } else {
    res.json({ authenticated: false });
  }
});

// ——— Dashboard ———
router.get('/dashboard/resumo', requireAuth, async (req, res) => {
  try {
    const pool = getPool();
    const uid = req.autopecasrgUsuarioId;
    const [[s]] = await pool.execute(
      'SELECT COUNT(*) AS n FROM publicacoes WHERE usuario_id = ? AND status = ?',
      [uid, 'ativo']
    );
    const [[e]] = await pool.execute(
      'SELECT COALESCE(SUM(estoque),0) AS t FROM produtos WHERE usuario_id = ? AND ativo = 1',
      [uid]
    );
    const [[v]] = await pool.execute(
      'SELECT COUNT(*) AS n FROM vendas_processadas WHERE usuario_id = ?',
      [uid]
    );
    const [[m]] = await pool.execute(
      `SELECT COALESCE(SUM(ABS(m.delta) * COALESCE(p.preco, 0)), 0) AS t
       FROM movimentos_estoque m
       INNER JOIN produtos p ON p.id = m.produto_id AND p.usuario_id = m.usuario_id
       WHERE m.usuario_id = ?
         AND m.motivo IN ('venda_ml','venda_shopee')
         AND m.delta < 0
         AND YEAR(m.created_at) = YEAR(CURDATE()) AND MONTH(m.created_at) = MONTH(CURDATE())`,
      [uid]
    );
    res.json({
      unidadesEstoque: Number(e.t),
      publicacoesAtivas: s.n,
      totalVendasPedidos: v.n,
      valorVendasMes: Number(m.t)
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Erro ao carregar resumo' });
  }
});

/** Fotos do produto — salvas em /public/uploads/autopecasrg/{usuarioId}/ (URLs absolutas para o ML). */
router.post(
  '/upload/imagens',
  requireAuth,
  (req, res, next) => {
    uploadAutopecasMulter.array('imagens', 12)(req, res, (err) => {
      if (err) return res.status(400).json({ error: err.message || 'Upload inválido' });
      next();
    });
  },
  (req, res) => {
    try {
      const publicRoot = path.join(__dirname, '..', 'public');
      const host = req.get('host') || 'localhost';
      const proto = req.protocol || 'http';
      const base = `${proto}://${host}`;
      const urls = (req.files || []).map((f) => {
        const rel = path.relative(publicRoot, f.path).replace(/\\/g, '/');
        const pathUrl = '/' + rel.replace(/^\/+/, '');
        return `${base}${pathUrl}`;
      });
      res.json({ ok: true, urls });
    } catch (e) {
      res.status(500).json({ error: e.message || 'Erro no upload' });
    }
  }
);

// ——— Produtos ———
router.get('/produtos', requireAuth, async (req, res) => {
  try {
    const pool = getPool();
    const [rows] = await pool.execute(
      `SELECT id, sku_interno, nome, descricao, preco, preco_ml, preco_shopee, titulo_ml, titulo_shopee, estoque,
              categoria_ml, categoria_shopee, listing_type_ml, condicao_ml, imagens_json, shopee_media_ids_json, atributos_json, ativo, created_at, updated_at
       FROM produtos WHERE usuario_id = ? ORDER BY updated_at DESC`,
      [req.autopecasrgUsuarioId]
    );
    res.json(rows);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Erro ao listar produtos' });
  }
});

router.post('/produtos', requireAuth, async (req, res) => {
  const b = req.body || {};
  if (!b.sku_interno || !b.nome) {
    return res.status(400).json({ error: 'sku_interno e nome são obrigatórios.' });
  }
  try {
    const pool = getPool();
    const imagensVal =
      b.imagens_json != null
        ? typeof b.imagens_json === 'string'
          ? b.imagens_json
          : JSON.stringify(b.imagens_json)
        : null;
    const attrVal =
      b.atributos_json != null
        ? typeof b.atributos_json === 'string'
          ? b.atributos_json
          : JSON.stringify(b.atributos_json)
        : null;
    const [r] = await pool.execute(
      `INSERT INTO produtos (usuario_id, sku_interno, nome, descricao, preco, preco_ml, preco_shopee, titulo_ml, titulo_shopee, estoque, categoria_ml, categoria_shopee, listing_type_ml, condicao_ml, imagens_json, shopee_media_ids_json, atributos_json, ativo)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [
        req.autopecasrgUsuarioId,
        String(b.sku_interno).trim(),
        String(b.nome).trim(),
        b.descricao || null,
        Number(b.preco) || 0,
        b.preco_ml != null ? Number(b.preco_ml) : null,
        b.preco_shopee != null ? Number(b.preco_shopee) : null,
        b.titulo_ml ? String(b.titulo_ml).slice(0, 255) : null,
        b.titulo_shopee ? String(b.titulo_shopee).slice(0, 255) : null,
        parseInt(b.estoque, 10) || 0,
        b.categoria_ml || null,
        b.categoria_shopee != null ? parseInt(b.categoria_shopee, 10) : null,
        b.listing_type_ml || 'gold_special',
        b.condicao_ml || 'new',
        imagensVal,
        b.shopee_media_ids_json != null
          ? typeof b.shopee_media_ids_json === 'string'
            ? b.shopee_media_ids_json
            : JSON.stringify(b.shopee_media_ids_json)
          : null,
        attrVal,
        b.ativo !== false ? 1 : 0
      ]
    );
    res.json({ id: r.insertId });
  } catch (e) {
    if (e.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: 'Já existe produto com este SKU interno.' });
    }
    console.error(e);
    res.status(500).json({ error: 'Erro ao salvar produto' });
  }
});

router.put('/produtos/:id', requireAuth, async (req, res) => {
  const id = parseInt(req.params.id, 10);
  const b = req.body || {};
  try {
    const pool = getPool();
    const [ex] = await pool.execute('SELECT estoque FROM produtos WHERE id = ? AND usuario_id = ?', [
      id,
      req.autopecasrgUsuarioId
    ]);
    if (!ex.length) return res.status(404).json({ error: 'Produto não encontrado' });

    const fields = [];
    const vals = [];
    const push = (col, v) => {
      fields.push(`${col} = ?`);
      vals.push(v);
    };
    if (b.sku_interno != null) push('sku_interno', String(b.sku_interno).trim());
    if (b.nome != null) push('nome', String(b.nome).trim());
    if (b.descricao !== undefined) push('descricao', b.descricao);
    if (b.preco != null) push('preco', Number(b.preco));
    if (b.preco_ml !== undefined) push('preco_ml', b.preco_ml != null ? Number(b.preco_ml) : null);
    if (b.preco_shopee !== undefined) push('preco_shopee', b.preco_shopee != null ? Number(b.preco_shopee) : null);
    if (b.titulo_ml !== undefined) push('titulo_ml', b.titulo_ml ? String(b.titulo_ml).slice(0, 255) : null);
    if (b.titulo_shopee !== undefined) push('titulo_shopee', b.titulo_shopee ? String(b.titulo_shopee).slice(0, 255) : null);
    if (b.estoque != null) push('estoque', parseInt(b.estoque, 10));
    if (b.categoria_ml !== undefined) push('categoria_ml', b.categoria_ml || null);
    if (b.categoria_shopee !== undefined) push('categoria_shopee', b.categoria_shopee != null ? parseInt(b.categoria_shopee, 10) : null);
    if (b.listing_type_ml != null) push('listing_type_ml', b.listing_type_ml);
    if (b.condicao_ml != null) push('condicao_ml', b.condicao_ml);
    if (b.imagens_json !== undefined) {
      push(
        'imagens_json',
        b.imagens_json == null
          ? null
          : typeof b.imagens_json === 'string'
            ? b.imagens_json
            : JSON.stringify(b.imagens_json)
      );
    }
    if (b.shopee_media_ids_json !== undefined) {
      push(
        'shopee_media_ids_json',
        b.shopee_media_ids_json == null
          ? null
          : typeof b.shopee_media_ids_json === 'string'
            ? b.shopee_media_ids_json
            : JSON.stringify(b.shopee_media_ids_json)
      );
    }
    if (b.atributos_json !== undefined) {
      push(
        'atributos_json',
        b.atributos_json == null
          ? null
          : typeof b.atributos_json === 'string'
            ? b.atributos_json
            : JSON.stringify(b.atributos_json)
      );
    }
    if (b.ativo !== undefined) push('ativo', b.ativo ? 1 : 0);

    if (fields.length) {
      vals.push(id, req.autopecasrgUsuarioId);
      await pool.execute(`UPDATE produtos SET ${fields.join(', ')} WHERE id = ? AND usuario_id = ?`, vals);
    }

    if (b.estoque != null && parseInt(b.estoque, 10) !== ex[0].estoque) {
      const novo = parseInt(b.estoque, 10);
      await registrarMovimento(pool, {
        produtoId: id,
        usuarioId: req.autopecasrgUsuarioId,
        delta: novo - ex[0].estoque,
        saldoApos: novo,
        motivo: 'ajuste_manual'
      });
      const erros = await propagarEstoquePlataformas(req.autopecasrgUsuarioId, id, novo, null);
      if (erros.length) {
        return res.json({ ok: true, avisos: erros });
      }
    }
    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Erro ao atualizar produto' });
  }
});

router.get('/publicacoes', requireAuth, async (req, res) => {
  try {
    const pool = getPool();
    const [rows] = await pool.execute(
      `SELECT pub.*, pr.sku_interno, pr.nome AS produto_nome
       FROM publicacoes pub
       JOIN produtos pr ON pr.id = pub.produto_id
       WHERE pub.usuario_id = ?
       ORDER BY pub.updated_at DESC`,
      [req.autopecasrgUsuarioId]
    );
    res.json(rows);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Erro ao listar publicações' });
  }
});

// ——— Contas Mercado Livre ———
router.get('/contas-ml', requireAuth, async (req, res) => {
  try {
    const pool = getPool();
    const [rows] = await pool.execute(
      `SELECT id, nome, app_id, ativo, seller_id, nickname, token_expires_at,
              (refresh_token_enc IS NOT NULL) AS autorizado
       FROM contas_mercadolivre WHERE usuario_id = ? ORDER BY id`,
      [req.autopecasrgUsuarioId]
    );
    res.json(rows);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Erro ao listar contas' });
  }
});

router.post('/contas-ml', requireAuth, async (req, res) => {
  const b = req.body || {};
  if (!b.nome || !b.app_id || !b.client_secret) {
    return res.status(400).json({ error: 'nome, app_id e client_secret são obrigatórios.' });
  }
  try {
    const pool = getPool();
    const [r] = await pool.execute(
      `INSERT INTO contas_mercadolivre (usuario_id, nome, app_id, client_secret_enc) VALUES (?,?,?,?)`,
      [req.autopecasrgUsuarioId, String(b.nome).trim(), String(b.app_id).trim(), encryptSecret(b.client_secret)]
    );
    res.json({ id: r.insertId });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Erro ao salvar conta' });
  }
});

router.put('/contas-ml/:id', requireAuth, async (req, res) => {
  const id = parseInt(req.params.id, 10);
  const b = req.body || {};
  try {
    const pool = getPool();
    const [ex] = await pool.execute('SELECT id FROM contas_mercadolivre WHERE id = ? AND usuario_id = ?', [
      id,
      req.autopecasrgUsuarioId
    ]);
    if (!ex.length) return res.status(404).json({ error: 'Conta não encontrada' });
    const parts = [];
    const vals = [];
    if (b.nome != null) {
      parts.push('nome = ?');
      vals.push(String(b.nome).trim());
    }
    if (b.app_id != null) {
      parts.push('app_id = ?');
      vals.push(String(b.app_id).trim());
    }
    if (b.client_secret) {
      parts.push('client_secret_enc = ?');
      vals.push(encryptSecret(b.client_secret));
    }
    if (b.ativo !== undefined) {
      parts.push('ativo = ?');
      vals.push(b.ativo ? 1 : 0);
    }
    if (parts.length) {
      vals.push(id);
      await pool.execute(`UPDATE contas_mercadolivre SET ${parts.join(', ')} WHERE id = ?`, vals);
    }
    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Erro ao atualizar conta' });
  }
});

router.delete('/contas-ml/:id', requireAuth, async (req, res) => {
  const id = parseInt(req.params.id, 10);
  try {
    const pool = getPool();
    await pool.execute('DELETE FROM contas_mercadolivre WHERE id = ? AND usuario_id = ?', [id, req.autopecasrgUsuarioId]);
    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Erro ao remover' });
  }
});

// OAuth ML
router.get('/oauth/ml/start', requireAuth, async (req, res) => {
  const contaId = parseInt(req.query.contaId, 10);
  const redirectUri = process.env.AUTOPECASRG_ML_REDIRECT_URI;
  if (!redirectUri) {
    return res.status(500).send('Defina AUTOPECASRG_ML_REDIRECT_URI no servidor (URL de callback cadastrada no app ML).');
  }
  try {
    const pool = getPool();
    const [rows] = await pool.execute(
      'SELECT * FROM contas_mercadolivre WHERE id = ? AND usuario_id = ?',
      [contaId, req.autopecasrgUsuarioId]
    );
    if (!rows.length) return res.status(404).send('Conta não encontrada');
    const c = rows[0];
    const state = crypto.randomBytes(16).toString('hex');
    req.session.mlOauthState = state;
    req.session.mlOauthContaId = contaId;
    const url = ml.buildAuthUrl({ clientId: c.app_id, redirectUri, state });
    res.redirect(url);
  } catch (e) {
    console.error(e);
    res.status(500).send('Erro ao iniciar OAuth');
  }
});

router.get('/oauth/ml/callback', async (req, res) => {
  const { code, state, error } = req.query;
  const cfgUrl = configuracoesHtmlUrl();
  if (error) {
    return res.redirect(`${cfgUrl}?ml=denied`);
  }
  if (!req.session || state !== req.session.mlOauthState || !req.session.mlOauthContaId) {
    return res.status(400).send('Sessão inválida. Abra o login em jp.autopecasrg e tente de novo.');
  }
  const contaId = req.session.mlOauthContaId;
  const redirectUri = process.env.AUTOPECASRG_ML_REDIRECT_URI;
  if (!code || !redirectUri) {
    return res.redirect(`${cfgUrl}?ml=erro`);
  }
  try {
    const pool = getPool();
    const [rows] = await pool.execute('SELECT * FROM contas_mercadolivre WHERE id = ?', [contaId]);
    if (!rows.length) return res.redirect(`${cfgUrl}?ml=404`);
    const c = rows[0];
    const clientSecret = decryptSecret(c.client_secret_enc);
    const data = await ml.exchangeCode({
      code,
      clientId: c.app_id,
      clientSecret,
      redirectUri
    });
    const exp = new Date(Date.now() + (data.expires_in || 21600) * 1000);
    await pool.execute(
      `UPDATE contas_mercadolivre SET refresh_token_enc = ?, access_token_enc = ?, token_expires_at = ?, seller_id = ? WHERE id = ?`,
      [encryptSecret(data.refresh_token), encryptSecret(data.access_token), exp, data.user_id || null, contaId]
    );
    delete req.session.mlOauthState;
    delete req.session.mlOauthContaId;
    res.redirect(`${cfgUrl}?ml=ok`);
  } catch (e) {
    console.error('[autopecasrg] oauth callback', e);
    res.redirect(`${cfgUrl}?ml=erro`);
  }
});

// OAuth Shopee (Partner): login do vendedor na loja → code + shop_id → tokens
router.get('/oauth/shopee/start', requireAuth, async (req, res) => {
  const contaId = parseInt(req.query.contaId, 10);
  const redirectUri = process.env.AUTOPECASRG_SHOPEE_REDIRECT_URI;
  if (!redirectUri) {
    return res.status(500).send('Defina AUTOPECASRG_SHOPEE_REDIRECT_URI (URL de callback cadastrada no app Open Platform Shopee).');
  }
  try {
    const pool = getPool();
    const [rows] = await pool.execute(
      'SELECT * FROM contas_shopee WHERE id = ? AND usuario_id = ?',
      [contaId, req.autopecasrgUsuarioId]
    );
    if (!rows.length) return res.status(404).send('Conta não encontrada');
    const c = rows[0];
    const partnerKey = decryptSecret(c.partner_key_enc);
    const state = crypto.randomBytes(16).toString('hex');
    req.session.shopeeOauthState = state;
    req.session.shopeeOauthContaId = contaId;
    const url = shopee.buildAuthPartnerUrl({
      partnerId: c.partner_id,
      partnerKey,
      redirectUri
    });
    res.redirect(url);
  } catch (e) {
    console.error(e);
    res.status(500).send('Erro ao iniciar OAuth Shopee');
  }
});

router.get('/oauth/shopee/callback', async (req, res) => {
  const cfgUrl = configuracoesHtmlUrl();
  const { code, shop_id: shopIdQ, error } = req.query;
  if (error) {
    return res.redirect(`${cfgUrl}?sh=denied`);
  }
  if (!req.session || !req.session.shopeeOauthContaId) {
    return res.status(400).send('Sessão inválida. Abra o módulo logado e use “Conectar com Shopee” de novo.');
  }
  const contaId = req.session.shopeeOauthContaId;
  const redirectUri = process.env.AUTOPECASRG_SHOPEE_REDIRECT_URI;
  if (!code || shopIdQ == null || shopIdQ === '' || !redirectUri) {
    return res.redirect(`${cfgUrl}?sh=erro`);
  }
  try {
    const pool = getPool();
    const [rows] = await pool.execute('SELECT * FROM contas_shopee WHERE id = ?', [contaId]);
    if (!rows.length) return res.redirect(`${cfgUrl}?sh=404`);
    const c = rows[0];
    const partnerKey = decryptSecret(c.partner_key_enc);
    const data = await shopee.exchangeAuthCode({
      partnerId: c.partner_id,
      partnerKey,
      code: String(code),
      shopId: shopIdQ
    });
    if (!data.refresh_token) {
      console.error('[autopecasrg] Shopee token/get sem refresh_token', data);
      return res.redirect(`${cfgUrl}?sh=erro`);
    }
    const expSec = data.expire_in || data.expires_in || 14400;
    const exp = new Date(Date.now() + Number(expSec) * 1000);
    const shopIdFinal = data.shop_id != null ? String(data.shop_id) : String(shopIdQ);
    await pool.execute(
      `UPDATE contas_shopee SET shop_id = ?, refresh_token_enc = ?, access_token_enc = ?, token_expires_at = ? WHERE id = ?`,
      [
        shopIdFinal,
        encryptSecret(data.refresh_token),
        encryptSecret(data.access_token),
        exp,
        contaId
      ]
    );
    delete req.session.shopeeOauthState;
    delete req.session.shopeeOauthContaId;
    res.redirect(`${cfgUrl}?sh=ok`);
  } catch (e) {
    console.error('[autopecasrg] oauth shopee callback', e);
    res.redirect(`${cfgUrl}?sh=erro`);
  }
});

// ——— Publicar ML ———
router.post('/produtos/:id/publicar-ml', requireAuth, async (req, res) => {
  const produtoId = parseInt(req.params.id, 10);
  const { conta_ml_id: contaMlId } = req.body || {};
  if (!contaMlId) return res.status(400).json({ error: 'Informe conta_ml_id.' });
  try {
    const pool = getPool();
    const [prows] = await pool.execute('SELECT * FROM produtos WHERE id = ? AND usuario_id = ?', [
      produtoId,
      req.autopecasrgUsuarioId
    ]);
    if (!prows.length) return res.status(404).json({ error: 'Produto não encontrado' });
    const prod = prows[0];
    if (!prod.categoria_ml) {
      return res.status(400).json({ error: 'Defina categoria_ml no produto (ex.: MLB5672 — use o preditor de categorias do ML).' });
    }
    const [crows] = await pool.execute(
      'SELECT * FROM contas_mercadolivre WHERE id = ? AND usuario_id = ? AND ativo = 1',
      [contaMlId, req.autopecasrgUsuarioId]
    );
    if (!crows.length) return res.status(404).json({ error: 'Conta Mercado Livre não encontrada' });
    const conta = crows[0];
    const token = await ensureMlAccessToken(conta);
    let imagens = [];
    try {
      if (prod.imagens_json) {
        const parsed = typeof prod.imagens_json === 'string' ? JSON.parse(prod.imagens_json) : prod.imagens_json;
        if (Array.isArray(parsed)) {
          imagens = parsed.map((u) => (typeof u === 'string' ? { source: u } : u));
        }
      }
    } catch {
      imagens = [];
    }
    if (!imagens.length) {
      return res.status(400).json({ error: 'Cadastre imagens_json com URLs públicas (array JSON).' });
    }
    const titulo = (prod.titulo_ml || prod.nome).trim().slice(0, 60);
    const body = {
      title: titulo,
      category_id: prod.categoria_ml,
      price: precoMl(prod),
      currency_id: 'BRL',
      available_quantity: Math.max(0, parseInt(prod.estoque, 10)),
      buying_mode: 'buy_it_now',
      listing_type_id: prod.listing_type_ml || 'gold_special',
      condition: prod.condicao_ml || 'new',
      pictures: imagens
    };
    const created = await ml.createItem(token, body);
    const itemId = created.id;
    if (prod.descricao && String(prod.descricao).trim()) {
      try {
        await ml.setItemDescription(token, itemId, prod.descricao);
      } catch (descErr) {
        console.warn('[autopecasrg] descrição ML:', descErr.message);
      }
    }
    await pool.execute(
      `INSERT INTO publicacoes (produto_id, usuario_id, plataforma, conta_id, external_item_id, status, ultimo_erro)
       VALUES (?,?,?,?,?,?,NULL)
       ON DUPLICATE KEY UPDATE external_item_id = VALUES(external_item_id), status = VALUES(status), ultimo_erro = NULL`,
      [produtoId, req.autopecasrgUsuarioId, 'ml', contaMlId, String(itemId), 'ativo']
    );
    res.json({ ok: true, mercadolivre_item_id: itemId, permalink: created.permalink });
  } catch (e) {
    console.error('[autopecasrg] publicar-ml', e);
    res.status(500).json({ error: e.message || 'Falha ao publicar', detail: e.detail });
  }
});

// ——— Contas Shopee (armazenamento; API em evolução) ———
router.get('/contas-shopee', requireAuth, async (req, res) => {
  try {
    const pool = getPool();
    const [rows] = await pool.execute(
      `SELECT id, nome, partner_id, shop_id, ativo, token_expires_at,
              (refresh_token_enc IS NOT NULL) AS tem_token
       FROM contas_shopee WHERE usuario_id = ? ORDER BY id`,
      [req.autopecasrgUsuarioId]
    );
    res.json(rows);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Erro ao listar contas Shopee' });
  }
});

router.post('/contas-shopee', requireAuth, async (req, res) => {
  const b = req.body || {};
  if (!b.nome || !b.partner_id || !b.partner_key) {
    return res.status(400).json({ error: 'nome, partner_id e partner_key são obrigatórios.' });
  }
  try {
    const pool = getPool();
    const rt = b.refresh_token ? encryptSecret(String(b.refresh_token).trim()) : null;
    const shopId =
      b.shop_id != null && String(b.shop_id).trim() !== '' ? String(b.shop_id).trim() : '0';
    const [r] = await pool.execute(
      `INSERT INTO contas_shopee (usuario_id, nome, partner_id, shop_id, partner_key_enc, refresh_token_enc) VALUES (?,?,?,?,?,?)`,
      [
        req.autopecasrgUsuarioId,
        String(b.nome).trim(),
        String(b.partner_id).trim(),
        shopId,
        encryptSecret(b.partner_key),
        rt
      ]
    );
    res.json({
      id: r.insertId,
      aviso: rt
        ? 'Conta salva com refresh_token. Pode publicar produtos na Shopee.'
        : 'Use “Conectar com Shopee” na tabela ou informe refresh_token manualmente.'
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Erro ao salvar conta Shopee' });
  }
});

router.put('/contas-shopee/:id', requireAuth, async (req, res) => {
  const id = parseInt(req.params.id, 10);
  const b = req.body || {};
  try {
    const pool = getPool();
    const [ex] = await pool.execute('SELECT id FROM contas_shopee WHERE id = ? AND usuario_id = ?', [
      id,
      req.autopecasrgUsuarioId
    ]);
    if (!ex.length) return res.status(404).json({ error: 'Conta não encontrada' });
    const parts = [];
    const vals = [];
    if (b.nome != null) {
      parts.push('nome = ?');
      vals.push(String(b.nome).trim());
    }
    if (b.partner_id != null) {
      parts.push('partner_id = ?');
      vals.push(String(b.partner_id).trim());
    }
    if (b.shop_id != null) {
      parts.push('shop_id = ?');
      vals.push(String(b.shop_id).trim());
    }
    if (b.partner_key) {
      parts.push('partner_key_enc = ?');
      vals.push(encryptSecret(b.partner_key));
    }
    if (b.refresh_token) {
      parts.push('refresh_token_enc = ?');
      vals.push(encryptSecret(String(b.refresh_token).trim()));
    }
    if (b.ativo !== undefined) {
      parts.push('ativo = ?');
      vals.push(b.ativo ? 1 : 0);
    }
    if (parts.length) {
      vals.push(id);
      await pool.execute(`UPDATE contas_shopee SET ${parts.join(', ')} WHERE id = ?`, vals);
    }
    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Erro ao atualizar' });
  }
});

router.post('/produtos/:id/publicar-shopee', requireAuth, async (req, res) => {
  const produtoId = parseInt(req.params.id, 10);
  const { conta_shopee_id: contaShopeeId } = req.body || {};
  if (!contaShopeeId) return res.status(400).json({ error: 'Informe conta_shopee_id.' });
  try {
    const pool = getPool();
    const [prows] = await pool.execute('SELECT * FROM produtos WHERE id = ? AND usuario_id = ?', [
      produtoId,
      req.autopecasrgUsuarioId
    ]);
    if (!prows.length) return res.status(404).json({ error: 'Produto não encontrado' });
    const prod = prows[0];
    if (!prod.categoria_shopee) {
      return res.status(400).json({
        error: 'Defina categoria_shopee (ID de categoria folha na Shopee — use API de categorias ou o centro de vendedor).'
      });
    }
    let mediaIds = [];
    try {
      if (prod.shopee_media_ids_json) {
        const parsed =
          typeof prod.shopee_media_ids_json === 'string'
            ? JSON.parse(prod.shopee_media_ids_json)
            : prod.shopee_media_ids_json;
        if (Array.isArray(parsed)) mediaIds = parsed.map((x) => parseInt(x, 10)).filter((n) => !Number.isNaN(n));
      }
    } catch {
      mediaIds = [];
    }
    if (!mediaIds.length) {
      return res.status(400).json({
        error:
          'A Shopee exige image_id de fotos enviadas pela API de mídia. Preencha shopee_media_ids_json com os IDs (ex.: [12345,12346]) após upload no painel Partner ou via media_space.'
      });
    }
    const [crows] = await pool.execute(
      'SELECT * FROM contas_shopee WHERE id = ? AND usuario_id = ? AND ativo = 1',
      [contaShopeeId, req.autopecasrgUsuarioId]
    );
    if (!crows.length) return res.status(404).json({ error: 'Conta Shopee não encontrada' });
    const conta = crows[0];
    if (!conta.shop_id || String(conta.shop_id) === '0') {
      return res.status(400).json({
        error: 'Conecte a loja com “Conectar com Shopee” em Configurações ou informe um Shop ID válido.'
      });
    }
    const token = await ensureShopeeAccessToken(conta);
    const pk = decryptSecret(conta.partner_key_enc);
    const nome = (prod.titulo_shopee || prod.nome).trim().slice(0, 255);
    const desc = (prod.descricao || prod.nome).trim().slice(0, 5000);
    const payload = {
      item_name: nome,
      description: desc,
      item_status: 'NORMAL',
      category_id: parseInt(prod.categoria_shopee, 10),
      image: { image_id_list: mediaIds },
      item_sku: String(prod.sku_interno).slice(0, 100),
      weight: 0.1,
      dimension: { package_length: 10, package_width: 10, package_height: 10 },
      seller_stock: [{ stock: Math.max(0, parseInt(prod.estoque, 10)) }],
      price_info: [{ original_price: precoShopee(prod) }]
    };
    const created = await shopee.addItem(
      {
        partnerId: conta.partner_id,
        partnerKey: pk,
        shopId: conta.shop_id,
        accessToken: token
      },
      payload
    );
    const itemId = created.item_id != null ? created.item_id : created.item?.item_id;
    if (itemId == null) {
      return res.status(500).json({ error: 'Resposta Shopee sem item_id', detail: created });
    }
    await pool.execute(
      `INSERT INTO publicacoes (produto_id, usuario_id, plataforma, conta_id, external_item_id, status, ultimo_erro)
       VALUES (?,?,?,?,?,?,NULL)
       ON DUPLICATE KEY UPDATE external_item_id = VALUES(external_item_id), status = VALUES(status), ultimo_erro = NULL`,
      [produtoId, req.autopecasrgUsuarioId, 'shopee', contaShopeeId, String(itemId), 'ativo']
    );
    res.json({ ok: true, shopee_item_id: itemId });
  } catch (e) {
    console.error('[autopecasrg] publicar-shopee', e);
    res.status(500).json({ error: e.message || 'Falha na Shopee', detail: e.detail });
  }
});

/** Publica em várias contas ML e/ou Shopee de uma vez (não é “automático” sem ação — evita erros em lote). */
router.post('/produtos/:id/publicar-todos', requireAuth, async (req, res) => {
  const produtoId = parseInt(req.params.id, 10);
  const { contas_ml_ids: mlIds = [], contas_shopee_ids: shIds = [] } = req.body || {};
  const resultados = [];
  const erros = [];

  try {
    for (const cid of mlIds) {
      try {
        const pool = getPool();
        const [prows] = await pool.execute('SELECT * FROM produtos WHERE id = ? AND usuario_id = ?', [
          produtoId,
          req.autopecasrgUsuarioId
        ]);
        if (!prows.length) throw new Error('Produto não encontrado');
        const prod = prows[0];
        if (!prod.categoria_ml) throw new Error('Sem categoria_ml');
        const [crows] = await pool.execute(
          'SELECT * FROM contas_mercadolivre WHERE id = ? AND usuario_id = ? AND ativo = 1',
          [cid, req.autopecasrgUsuarioId]
        );
        if (!crows.length) throw new Error('Conta ML ' + cid);
        const conta = crows[0];
        const token = await ensureMlAccessToken(conta);
        let imagens = [];
        try {
          if (prod.imagens_json) {
            const parsed = typeof prod.imagens_json === 'string' ? JSON.parse(prod.imagens_json) : prod.imagens_json;
            if (Array.isArray(parsed)) {
              imagens = parsed.map((u) => (typeof u === 'string' ? { source: u } : u));
            }
          }
        } catch {
          imagens = [];
        }
        if (!imagens.length) throw new Error('Sem imagens_json');
        const titulo = (prod.titulo_ml || prod.nome).trim().slice(0, 60);
        const body = {
          title: titulo,
          category_id: prod.categoria_ml,
          price: precoMl(prod),
          currency_id: 'BRL',
          available_quantity: Math.max(0, parseInt(prod.estoque, 10)),
          buying_mode: 'buy_it_now',
          listing_type_id: prod.listing_type_ml || 'gold_special',
          condition: prod.condicao_ml || 'new',
          pictures: imagens
        };
        const created = await ml.createItem(token, body);
        const itemId = created.id;
        if (prod.descricao && String(prod.descricao).trim()) {
          try {
            await ml.setItemDescription(token, itemId, prod.descricao);
          } catch (e) {
            console.warn(e.message);
          }
        }
        await pool.execute(
          `INSERT INTO publicacoes (produto_id, usuario_id, plataforma, conta_id, external_item_id, status, ultimo_erro)
           VALUES (?,?,?,?,?,?,NULL)
           ON DUPLICATE KEY UPDATE external_item_id = VALUES(external_item_id), status = VALUES(status), ultimo_erro = NULL`,
          [produtoId, req.autopecasrgUsuarioId, 'ml', cid, String(itemId), 'ativo']
        );
        resultados.push({ plataforma: 'ml', conta_id: cid, ok: true, item_id: itemId, permalink: created.permalink });
      } catch (e) {
        erros.push({ plataforma: 'ml', conta_id: cid, erro: e.message });
      }
    }

    for (const cid of shIds) {
      try {
        const pool = getPool();
        const [prows] = await pool.execute('SELECT * FROM produtos WHERE id = ? AND usuario_id = ?', [
          produtoId,
          req.autopecasrgUsuarioId
        ]);
        if (!prows.length) throw new Error('Produto não encontrado');
        const prod = prows[0];
        if (!prod.categoria_shopee) throw new Error('Sem categoria_shopee');
        let mediaIds = [];
        try {
          if (prod.shopee_media_ids_json) {
            const parsed =
              typeof prod.shopee_media_ids_json === 'string'
                ? JSON.parse(prod.shopee_media_ids_json)
                : prod.shopee_media_ids_json;
            if (Array.isArray(parsed)) mediaIds = parsed.map((x) => parseInt(x, 10)).filter((n) => !Number.isNaN(n));
          }
        } catch {
          mediaIds = [];
        }
        if (!mediaIds.length) throw new Error('Sem shopee_media_ids_json');
        const [crows] = await pool.execute(
          'SELECT * FROM contas_shopee WHERE id = ? AND usuario_id = ? AND ativo = 1',
          [cid, req.autopecasrgUsuarioId]
        );
        if (!crows.length) throw new Error('Conta Shopee ' + cid);
        const conta = crows[0];
        if (!conta.shop_id || String(conta.shop_id) === '0') {
          throw new Error('Conecte a loja Shopee (OAuth) em Configurações antes de publicar');
        }
        const token = await ensureShopeeAccessToken(conta);
        const pk = decryptSecret(conta.partner_key_enc);
        const nome = (prod.titulo_shopee || prod.nome).trim().slice(0, 255);
        const desc = (prod.descricao || prod.nome).trim().slice(0, 5000);
        const payload = {
          item_name: nome,
          description: desc,
          item_status: 'NORMAL',
          category_id: parseInt(prod.categoria_shopee, 10),
          image: { image_id_list: mediaIds },
          item_sku: String(prod.sku_interno).slice(0, 100),
          weight: 0.1,
          dimension: { package_length: 10, package_width: 10, package_height: 10 },
          seller_stock: [{ stock: Math.max(0, parseInt(prod.estoque, 10)) }],
          price_info: [{ original_price: precoShopee(prod) }]
        };
        const created = await shopee.addItem(
          {
            partnerId: conta.partner_id,
            partnerKey: pk,
            shopId: conta.shop_id,
            accessToken: token
          },
          payload
        );
        const itemId = created.item_id != null ? created.item_id : created.item?.item_id;
        if (itemId == null) throw new Error('Shopee sem item_id');
        await pool.execute(
          `INSERT INTO publicacoes (produto_id, usuario_id, plataforma, conta_id, external_item_id, status, ultimo_erro)
           VALUES (?,?,?,?,?,?,NULL)
           ON DUPLICATE KEY UPDATE external_item_id = VALUES(external_item_id), status = VALUES(status), ultimo_erro = NULL`,
          [produtoId, req.autopecasrgUsuarioId, 'shopee', cid, String(itemId), 'ativo']
        );
        resultados.push({ plataforma: 'shopee', conta_id: cid, ok: true, item_id: itemId });
      } catch (e) {
        erros.push({ plataforma: 'shopee', conta_id: cid, erro: e.message });
      }
    }

    res.json({ ok: true, resultados, erros });
  } catch (e) {
    console.error('[autopecasrg] publicar-todos', e);
    res.status(500).json({ error: e.message });
  }
});

// ——— Config etiquetas ———
router.get('/config/etiquetas', requireAuth, async (req, res) => {
  try {
    const pool = getPool();
    const [rows] = await pool.execute('SELECT * FROM config_etiquetas WHERE usuario_id = ?', [req.autopecasrgUsuarioId]);
    if (!rows.length) {
      return res.json({
        intervalo_segundos: 300,
        impressora_nome: null,
        impressora_ml: null,
        impressora_shopee: null,
        formato_ml: 'pdf_100x150',
        formato_shopee: 'pdf_100x150',
        pasta_download: null,
        baixar_pdf_automatico: 1,
        imprimir_automatico: 0,
        baixa_estoque_auto: 1,
        imprimir_auto_ml: 1,
        imprimir_auto_shopee: 1
      });
    }
    res.json(rows[0]);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Erro' });
  }
});

router.put('/config/etiquetas', requireAuth, async (req, res) => {
  const b = req.body || {};
  try {
    const pool = getPool();
    await pool.execute(
      `INSERT INTO config_etiquetas (
        usuario_id, intervalo_segundos, impressora_nome, impressora_ml, impressora_shopee,
        formato_ml, formato_shopee, pasta_download, baixar_pdf_automatico, imprimir_automatico,
        baixa_estoque_auto, imprimir_auto_ml, imprimir_auto_shopee
      ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)
       ON DUPLICATE KEY UPDATE
         intervalo_segundos = VALUES(intervalo_segundos),
         impressora_nome = VALUES(impressora_nome),
         impressora_ml = VALUES(impressora_ml),
         impressora_shopee = VALUES(impressora_shopee),
         formato_ml = VALUES(formato_ml),
         formato_shopee = VALUES(formato_shopee),
         pasta_download = VALUES(pasta_download),
         baixar_pdf_automatico = VALUES(baixar_pdf_automatico),
         imprimir_automatico = VALUES(imprimir_automatico),
         baixa_estoque_auto = VALUES(baixa_estoque_auto),
         imprimir_auto_ml = VALUES(imprimir_auto_ml),
         imprimir_auto_shopee = VALUES(imprimir_auto_shopee)`,
      [
        req.autopecasrgUsuarioId,
        parseInt(b.intervalo_segundos, 10) || 300,
        b.impressora_nome || null,
        b.impressora_ml || null,
        b.impressora_shopee || null,
        (b.formato_ml && String(b.formato_ml).trim()) || 'pdf_100x150',
        (b.formato_shopee && String(b.formato_shopee).trim()) || 'pdf_100x150',
        b.pasta_download || null,
        b.baixar_pdf_automatico ? 1 : 0,
        b.imprimir_automatico ? 1 : 0,
        b.baixa_estoque_auto !== false && b.baixa_estoque_auto !== 0 ? 1 : 0,
        b.imprimir_auto_ml !== false && b.imprimir_auto_ml !== 0 ? 1 : 0,
        b.imprimir_auto_shopee !== false && b.imprimir_auto_shopee !== 0 ? 1 : 0
      ]
    );
    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Erro ao salvar' });
  }
});

// ——— Estoque / movimentos ———
router.get('/estoque/movimentos', requireAuth, async (req, res) => {
  try {
    const pool = getPool();
    const lim = Math.min(parseInt(req.query.limit, 10) || 100, 500);
    const [rows] = await pool.execute(
      `SELECT m.*, p.sku_interno, p.nome AS produto_nome
       FROM movimentos_estoque m
       JOIN produtos p ON p.id = m.produto_id
       WHERE m.usuario_id = ?
       ORDER BY m.created_at DESC
       LIMIT ${lim}`,
      [req.autopecasrgUsuarioId]
    );
    res.json(rows);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Erro ao listar movimentos' });
  }
});

// ——— Etiquetas ML (pedidos pagos) ———
router.get('/etiquetas/ml', requireAuth, async (req, res) => {
  try {
    const pool = getPool();
    const [rows] = await pool.execute(
      `SELECT id, conta_ml_id, ml_order_id, shipment_id, status, pdf_path, erro_msg, tentativas, created_at, updated_at
       FROM etiquetas_ml WHERE usuario_id = ? ORDER BY updated_at DESC LIMIT 200`,
      [req.autopecasrgUsuarioId]
    );
    res.json(rows);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Erro ao listar etiquetas' });
  }
});

router.get('/etiquetas/shopee', requireAuth, async (req, res) => {
  try {
    const pool = getPool();
    const [rows] = await pool.execute(
      `SELECT id, conta_shopee_id, order_sn, status, pdf_path, erro_msg, tentativas, created_at, updated_at
       FROM etiquetas_shopee WHERE usuario_id = ? ORDER BY updated_at DESC LIMIT 200`,
      [req.autopecasrgUsuarioId]
    );
    res.json(rows);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Erro ao listar etiquetas Shopee' });
  }
});

router.post('/etiquetas/processar-ml', requireAuth, async (req, res) => {
  try {
    const n = await etiquetasMl.rodarVarreduraPedidosPagos(req.autopecasrgUsuarioId);
    res.json({ ok: true, processados: n });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message || 'Erro' });
  }
});

router.post('/estoque/sincronizar-plataformas', requireAuth, async (req, res) => {
  const { produto_id: produtoId } = req.body || {};
  if (!produtoId) return res.status(400).json({ error: 'produto_id obrigatório' });
  try {
    const pool = getPool();
    const [rows] = await pool.execute('SELECT estoque FROM produtos WHERE id = ? AND usuario_id = ?', [
      produtoId,
      req.autopecasrgUsuarioId
    ]);
    if (!rows.length) return res.status(404).json({ error: 'Produto não encontrado' });
    const novo = rows[0].estoque;
    const avisos = await propagarEstoquePlataformas(req.autopecasrgUsuarioId, produtoId, novo, null);
    res.json({ ok: true, avisos });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
});

// ——— Webhook Mercado Livre (notificações; processamento de pedido/estoque pode ser ampliado) ———
router.post('/webhooks/ml', express.json({ type: '*/*' }), async (req, res) => {
  res.status(200).json({ ok: true });
  try {
    const pool = getPool();
    const payload = req.body || {};
    await pool.execute(`INSERT INTO webhook_eventos (plataforma, payload_json, processado) VALUES ('ml', ?, 0)`, [
      JSON.stringify(payload)
    ]);
    const topic = payload.topic;
    const resource = payload.resource;
    if ((topic === 'orders_v2' || topic === 'orders') && resource) {
      const orderId = String(resource).replace(/\D/g, '');
      if (orderId) {
        setImmediate(() => {
          autopecasrgVendas.processarPedidoMercadoLivre(orderId).catch((err) => {
            console.error('[autopecasrg] webhook pedido ML', orderId, err.message);
          });
        });
      }
    }
  } catch (e) {
    console.error('[autopecasrg] webhook ml', e);
  }
});

/** Shopee push (Partner Center → URL de callback). Ajuste o corpo conforme o tipo de notificação. */
router.post('/webhooks/shopee', express.json({ type: '*/*' }), async (req, res) => {
  res.status(200).json({ ok: true });
  try {
    const pool = getPool();
    const payload = req.body || {};
    await pool.execute(`INSERT INTO webhook_eventos (plataforma, payload_json, processado) VALUES ('shopee', ?, 0)`, [
      JSON.stringify(payload)
    ]);
    const shopId =
      payload.shop_id != null
        ? String(payload.shop_id)
        : payload.shopid != null
          ? String(payload.shopid)
          : payload.data?.shop_id != null
            ? String(payload.data.shop_id)
            : null;
    const orderSn =
      payload.order_sn ||
      payload.ordersn ||
      payload.data?.order_sn ||
      payload.data?.ordersn ||
      (Array.isArray(payload.data?.ordersn_list) ? payload.data.ordersn_list[0] : null);
    if (shopId && orderSn) {
      setImmediate(() => {
        autopecasrgVendas.processarPedidoShopee(String(orderSn).trim(), shopId).catch((err) => {
          console.error('[autopecasrg] webhook Shopee', orderSn, err.message);
        });
      });
    }
  } catch (e) {
    console.error('[autopecasrg] webhook shopee', e);
  }
});

module.exports = router;
