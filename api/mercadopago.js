/**
 * API Mercado Pago - Criação de preferência de pagamento (Checkout Pro)
 * Suporta PIX, cartão de crédito e boleto - redireciona para o ambiente do Mercado Pago
 */
const express = require('express');
const router = express.Router();
const mysql = require('mysql2/promise');
const crypto = require('crypto');
const { getPrecosDatabaseConfig } = require('../database-config');

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

async function ensurePrecosDatabase() {
  const precosConn = await mysql.createConnection(getPrecosDatabaseConfig());
  await precosConn.execute(`
    CREATE TABLE IF NOT EXISTS pagamentos_precos (
      id INT AUTO_INCREMENT PRIMARY KEY,
      ref_id VARCHAR(36) UNIQUE NOT NULL,
      nome VARCHAR(255) NOT NULL,
      email VARCHAR(255) NOT NULL,
      telefone VARCHAR(20),
      cpf VARCHAR(20),
      plano VARCHAR(100) NOT NULL,
      valor_original DECIMAL(10,2) NOT NULL,
      valor_final DECIMAL(10,2) NOT NULL,
      desconto_cupom VARCHAR(50),
      status ENUM('pending','approved','failed','email_sent') DEFAULT 'pending',
      payment_id VARCHAR(50),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_ref_id (ref_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
  await precosConn.end();
}

// POST /api/mercadopago/preference - Cria preferência e retorna init_point
router.post('/preference', async (req, res) => {
  try {
    const { planName, amount, quantity = 1, payer } = req.body;

    if (!planName || !amount || amount <= 0) {
      return res.status(400).json({ error: 'planName e amount são obrigatórios' });
    }

    // Garantir precisão de 2 casas decimais e valor mínimo R$ 1,00 (MP pode rejeitar valores menores)
    let amountClean = Math.round(parseFloat(amount) * 100) / 100;
    if (amountClean > 0 && amountClean < 1) amountClean = 1;

    const accessToken = process.env.MP_ACCESS_TOKEN;
    if (!accessToken) {
      console.error('MP_ACCESS_TOKEN não configurado no .env');
      return res.status(500).json({
        error: 'Pagamento via Mercado Pago não configurado. Configure MP_ACCESS_TOKEN no servidor.',
        code: 'MP_NOT_CONFIGURED'
      });
    }

    // Gerar ref_id para rastrear pagamento e enviar email após sucesso
    const refId = crypto.randomUUID();
    const nome = (payer?.name || '') + ' ' + (payer?.surname || '').trim() || payer?.email || 'Cliente';

    await ensurePrecosDatabase();
    const conn = await mysql.createConnection(getPrecosDatabaseConfig());
    await conn.execute(
      `INSERT INTO pagamentos_precos (ref_id, nome, email, telefone, cpf, plano, valor_original, valor_final, desconto_cupom, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')`,
      [
        refId,
        nome.trim() || 'Cliente',
        payer?.email || '',
        payer?.phone || null,
        payer?.cpf || null,
        planName,
        amountClean,
        amountClean,
        payer?.cupom || null
      ]
    );
    await conn.end();

    const { MercadoPagoConfig, Preference } = require('mercadopago');
    const client = new MercadoPagoConfig({ accessToken, options: { timeout: 5000 } });
    const preference = new Preference(client);

    const baseUrl = process.env.MP_BASE_URL || `${req.protocol}://${req.get('host')}`.replace(/\/$/, '');
    const successUrl = `${baseUrl}/precos.html?status=success&ref=${refId}`;
    const failureUrl = `${baseUrl}/precos.html?status=failure`;
    const pendingUrl = `${baseUrl}/precos.html?status=pending`;

    const preferenceData = {
      body: {
        items: [
          {
            id: planName.replace(/\s/g, '_').toLowerCase(),
            title: planName,
            quantity: parseInt(quantity) || 1,
            unit_price: amountClean,
            currency_id: 'BRL'
          }
        ],
        back_urls: {
          success: successUrl,
          failure: failureUrl,
          pending: pendingUrl
        },
        auto_return: 'approved',
        external_reference: refId
      }
    };

    if (payer) {
      preferenceData.body.payer = {
        email: payer.email || undefined,
        name: payer.name || undefined,
        surname: payer.surname || undefined,
        phone: payer.phone ? { number: payer.phone.replace(/\D/g, '').slice(-11) } : undefined
      };
    }

    const result = await preference.create(preferenceData);

    if (!result || !result.init_point) {
      return res.status(500).json({ error: 'Erro ao criar preferência do Mercado Pago' });
    }

    res.json({
      init_point: result.init_point,
      preference_id: result.id,
      ref_id: refId
    });

  } catch (error) {
    console.error('Erro Mercado Pago:', error);
    const msg = error.message || 'Erro ao processar pagamento';
    res.status(500).json({
      error: msg,
      code: error.body?.error || 'MP_ERROR'
    });
  }
});

module.exports = router;
