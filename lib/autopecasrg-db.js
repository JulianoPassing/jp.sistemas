/**
 * Banco MySQL do módulo JP Auto Peças RG (VPS)
 */
const mysql = require('mysql2/promise');
const crypto = require('crypto');
const { getAutopecasrgDatabaseConfig, getRootConfig } = require('../database-config');

let pool = null;

function getPool() {
  if (!pool) {
    pool = mysql.createPool({
      ...getAutopecasrgDatabaseConfig(),
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0
    });
  }
  return pool;
}

function getCryptoKey() {
  const raw = process.env.AUTOPECASRG_CRYPTO_KEY || process.env.SESSION_SECRET || 'jp-autopecasrg-dev-key-change';
  return crypto.createHash('sha256').update(String(raw)).digest();
}

function encryptSecret(plain) {
  if (plain == null || plain === '') return null;
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', getCryptoKey(), iv);
  const enc = Buffer.concat([cipher.update(String(plain), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, enc]).toString('base64');
}

function decryptSecret(encB64) {
  if (!encB64) return null;
  try {
    const buf = Buffer.from(encB64, 'base64');
    const iv = buf.subarray(0, 12);
    const tag = buf.subarray(12, 28);
    const data = buf.subarray(28);
    const decipher = crypto.createDecipheriv('aes-256-gcm', getCryptoKey(), iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
  } catch {
    return null;
  }
}

async function ensureDatabase() {
  const cfg = getAutopecasrgDatabaseConfig();
  const dbName = cfg.database;
  const root = await mysql.createConnection(getRootConfig());
  await root.execute(
    `CREATE DATABASE IF NOT EXISTS \`${dbName.replace(/`/g, '``')}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`
  );
  await root.end();

  const p = getPool();
  await initSchema(p);
  await migrateProdutosExtras(p);
  await migrateEtiquetasMlTable(p);
  await migrateConfigEtiquetasVendas(p);
  await migrateVendasEstoqueEtiquetasShopee(p);
  return p;
}

async function migrateConfigEtiquetasVendas(p) {
  const tries = [
    'ALTER TABLE config_etiquetas ADD COLUMN impressora_ml VARCHAR(255) NULL',
    'ALTER TABLE config_etiquetas ADD COLUMN impressora_shopee VARCHAR(255) NULL',
    'ALTER TABLE config_etiquetas ADD COLUMN formato_ml VARCHAR(32) DEFAULT "pdf_a4"',
    'ALTER TABLE config_etiquetas ADD COLUMN formato_shopee VARCHAR(32) DEFAULT "pdf_a4"',
    'ALTER TABLE config_etiquetas ADD COLUMN baixa_estoque_auto TINYINT(1) DEFAULT 1',
    'ALTER TABLE config_etiquetas ADD COLUMN imprimir_auto_ml TINYINT(1) DEFAULT 1',
    'ALTER TABLE config_etiquetas ADD COLUMN imprimir_auto_shopee TINYINT(1) DEFAULT 1'
  ];
  for (const sql of tries) {
    try {
      await p.execute(sql);
    } catch (e) {
      if (e.code !== 'ER_DUP_FIELDNAME') {
        console.warn('[autopecasrg-db] migrate config_etiquetas:', e.message);
      }
    }
  }
}

async function migrateVendasEstoqueEtiquetasShopee(p) {
  try {
    await p.execute(`
      CREATE TABLE IF NOT EXISTS vendas_processadas (
        id BIGINT AUTO_INCREMENT PRIMARY KEY,
        usuario_id INT NOT NULL,
        plataforma ENUM('ml','shopee') NOT NULL,
        conta_id INT NOT NULL,
        pedido_externo VARCHAR(64) NOT NULL,
        processado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY uq_venda (plataforma, conta_id, pedido_externo),
        INDEX idx_usuario (usuario_id),
        FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
  } catch (e) {
    console.warn('[autopecasrg-db] migrate vendas_processadas:', e.message);
  }
  try {
    await p.execute(`
      CREATE TABLE IF NOT EXISTS etiquetas_shopee (
        id INT AUTO_INCREMENT PRIMARY KEY,
        usuario_id INT NOT NULL,
        conta_shopee_id INT NOT NULL,
        order_sn VARCHAR(64) NOT NULL,
        package_number VARCHAR(64) NULL,
        status ENUM('pendente','baixado','impresso','erro') DEFAULT 'pendente',
        pdf_path VARCHAR(768) NULL,
        erro_msg VARCHAR(512) NULL,
        tentativas INT DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY uq_pedido_conta (conta_shopee_id, order_sn),
        INDEX idx_status (status),
        FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
  } catch (e) {
    console.warn('[autopecasrg-db] migrate etiquetas_shopee:', e.message);
  }
}

async function migrateEtiquetasMlTable(p) {
  try {
    await p.execute(`
      CREATE TABLE IF NOT EXISTS etiquetas_ml (
        id INT AUTO_INCREMENT PRIMARY KEY,
        usuario_id INT NOT NULL,
        conta_ml_id INT NOT NULL,
        ml_order_id BIGINT NOT NULL,
        shipment_id BIGINT NULL,
        status ENUM('pendente','baixado','impresso','erro') DEFAULT 'pendente',
        pdf_path VARCHAR(768) NULL,
        erro_msg VARCHAR(512) NULL,
        tentativas INT DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY uq_pedido_conta (conta_ml_id, ml_order_id),
        INDEX idx_status (status),
        FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
  } catch (e) {
    console.warn('[autopecasrg-db] migrate etiquetas_ml:', e.message);
  }
}

/** Colunas novas em instalações antigas (preço por canal, Shopee, títulos). */
async function migrateProdutosExtras(p) {
  const tries = [
    'ALTER TABLE produtos ADD COLUMN preco_ml DECIMAL(12,2) NULL AFTER preco',
    'ALTER TABLE produtos ADD COLUMN preco_shopee DECIMAL(12,2) NULL AFTER preco_ml',
    'ALTER TABLE produtos ADD COLUMN titulo_ml VARCHAR(255) NULL',
    'ALTER TABLE produtos ADD COLUMN titulo_shopee VARCHAR(255) NULL',
    'ALTER TABLE produtos ADD COLUMN categoria_shopee BIGINT NULL',
    'ALTER TABLE produtos ADD COLUMN shopee_media_ids_json JSON NULL'
  ];
  for (const sql of tries) {
    try {
      await p.execute(sql);
    } catch (e) {
      if (e.code !== 'ER_DUP_FIELDNAME') {
        console.warn('[autopecasrg-db] migrate produtos:', e.message);
      }
    }
  }
}

async function initSchema(p) {
  await p.execute(`
    CREATE TABLE IF NOT EXISTS usuarios (
      id INT AUTO_INCREMENT PRIMARY KEY,
      username VARCHAR(64) NOT NULL UNIQUE,
      password_hash VARCHAR(255) NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_username (username)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await p.execute(`
    CREATE TABLE IF NOT EXISTS contas_mercadolivre (
      id INT AUTO_INCREMENT PRIMARY KEY,
      usuario_id INT NOT NULL,
      nome VARCHAR(120) NOT NULL,
      app_id VARCHAR(32) NOT NULL,
      client_secret_enc TEXT NOT NULL,
      refresh_token_enc TEXT,
      access_token_enc TEXT,
      token_expires_at DATETIME NULL,
      seller_id BIGINT NULL,
      nickname VARCHAR(255) NULL,
      ativo TINYINT(1) DEFAULT 1,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE,
      INDEX idx_usuario (usuario_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await p.execute(`
    CREATE TABLE IF NOT EXISTS contas_shopee (
      id INT AUTO_INCREMENT PRIMARY KEY,
      usuario_id INT NOT NULL,
      nome VARCHAR(120) NOT NULL,
      partner_id VARCHAR(32) NOT NULL,
      shop_id VARCHAR(32) NOT NULL,
      partner_key_enc TEXT NOT NULL,
      refresh_token_enc TEXT,
      access_token_enc TEXT,
      token_expires_at DATETIME NULL,
      ativo TINYINT(1) DEFAULT 1,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE,
      INDEX idx_usuario (usuario_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await p.execute(`
    CREATE TABLE IF NOT EXISTS produtos (
      id INT AUTO_INCREMENT PRIMARY KEY,
      usuario_id INT NOT NULL,
      sku_interno VARCHAR(64) NOT NULL,
      nome VARCHAR(255) NOT NULL,
      descricao TEXT,
      preco DECIMAL(12,2) NOT NULL DEFAULT 0,
      preco_ml DECIMAL(12,2) NULL,
      preco_shopee DECIMAL(12,2) NULL,
      titulo_ml VARCHAR(255) NULL,
      titulo_shopee VARCHAR(255) NULL,
      estoque INT NOT NULL DEFAULT 0,
      categoria_ml VARCHAR(32) NULL,
      categoria_shopee BIGINT NULL,
      shopee_media_ids_json JSON NULL,
      listing_type_ml VARCHAR(32) DEFAULT 'gold_special',
      condicao_ml VARCHAR(16) DEFAULT 'new',
      imagens_json JSON NULL,
      atributos_json JSON NULL,
      ativo TINYINT(1) DEFAULT 1,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE,
      UNIQUE KEY uq_usuario_sku (usuario_id, sku_interno),
      INDEX idx_usuario (usuario_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await p.execute(`
    CREATE TABLE IF NOT EXISTS publicacoes (
      id INT AUTO_INCREMENT PRIMARY KEY,
      produto_id INT NOT NULL,
      usuario_id INT NOT NULL,
      plataforma ENUM('ml','shopee') NOT NULL,
      conta_id INT NOT NULL,
      external_item_id VARCHAR(64) NULL,
      status VARCHAR(32) DEFAULT 'rascunho',
      ultimo_erro TEXT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (produto_id) REFERENCES produtos(id) ON DELETE CASCADE,
      FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE,
      UNIQUE KEY uq_pub_conta (produto_id, plataforma, conta_id),
      INDEX idx_produto (produto_id),
      INDEX idx_conta_plataforma (plataforma, conta_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await p.execute(`
    CREATE TABLE IF NOT EXISTS movimentos_estoque (
      id INT AUTO_INCREMENT PRIMARY KEY,
      produto_id INT NOT NULL,
      usuario_id INT NOT NULL,
      delta INT NOT NULL,
      saldo_apos INT NOT NULL,
      motivo VARCHAR(64) NOT NULL,
      ref_origem VARCHAR(128) NULL,
      plataforma VARCHAR(16) NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (produto_id) REFERENCES produtos(id) ON DELETE CASCADE,
      FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE,
      INDEX idx_produto (produto_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await p.execute(`
    CREATE TABLE IF NOT EXISTS config_etiquetas (
      usuario_id INT PRIMARY KEY,
      intervalo_segundos INT DEFAULT 300,
      impressora_nome VARCHAR(255) NULL,
      impressora_ml VARCHAR(255) NULL,
      impressora_shopee VARCHAR(255) NULL,
      formato_ml VARCHAR(32) DEFAULT 'pdf_a4',
      formato_shopee VARCHAR(32) DEFAULT 'pdf_a4',
      pasta_download VARCHAR(512) NULL,
      baixar_pdf_automatico TINYINT(1) DEFAULT 1,
      imprimir_automatico TINYINT(1) DEFAULT 0,
      baixa_estoque_auto TINYINT(1) DEFAULT 1,
      imprimir_auto_ml TINYINT(1) DEFAULT 1,
      imprimir_auto_shopee TINYINT(1) DEFAULT 1,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await p.execute(`
    CREATE TABLE IF NOT EXISTS webhook_eventos (
      id BIGINT AUTO_INCREMENT PRIMARY KEY,
      usuario_id INT NULL,
      plataforma VARCHAR(16) NOT NULL,
      payload_json JSON,
      processado TINYINT(1) DEFAULT 0,
      erro TEXT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_proc (processado)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await p.execute(`
    CREATE TABLE IF NOT EXISTS etiquetas_ml (
      id INT AUTO_INCREMENT PRIMARY KEY,
      usuario_id INT NOT NULL,
      conta_ml_id INT NOT NULL,
      ml_order_id BIGINT NOT NULL,
      shipment_id BIGINT NULL,
      status ENUM('pendente','baixado','impresso','erro') DEFAULT 'pendente',
      pdf_path VARCHAR(768) NULL,
      erro_msg VARCHAR(512) NULL,
      tentativas INT DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uq_pedido_conta (conta_ml_id, ml_order_id),
      INDEX idx_status (status),
      FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
}

module.exports = {
  getPool,
  ensureDatabase,
  encryptSecret,
  decryptSecret
};
