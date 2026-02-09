/**
 * API Mercado Pago - Criação de preferência de pagamento (Checkout Pro)
 * Para cartão de crédito e boleto - redireciona para o ambiente do Mercado Pago
 */
const express = require('express');
const router = express.Router();

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

// POST /api/mercadopago/preference - Cria preferência e retorna init_point
router.post('/preference', async (req, res) => {
  try {
    const { planName, amount, quantity = 1, payer } = req.body;

    if (!planName || !amount || amount <= 0) {
      return res.status(400).json({ error: 'planName e amount são obrigatórios' });
    }

    const accessToken = process.env.MP_ACCESS_TOKEN;
    if (!accessToken) {
      console.error('MP_ACCESS_TOKEN não configurado no .env');
      return res.status(500).json({
        error: 'Pagamento via cartão/boleto não configurado. Configure MP_ACCESS_TOKEN no servidor.',
        code: 'MP_NOT_CONFIGURED'
      });
    }

    const { MercadoPagoConfig, Preference } = require('mercadopago');

    const client = new MercadoPagoConfig({
      accessToken,
      options: { timeout: 5000 }
    });

    const preference = new Preference(client);

    const preferenceData = {
      body: {
        items: [
          {
            id: planName.replace(/\s/g, '_').toLowerCase(),
            title: planName,
            quantity: parseInt(quantity) || 1,
            unit_price: parseFloat(amount),
            currency_id: 'BRL'
          }
        ],
        auto_return: 'approved',
        back_urls: {
          success: `${req.protocol}://${req.get('host')}/precos.html?status=success`,
          failure: `${req.protocol}://${req.get('host')}/precos.html?status=failure`,
          pending: `${req.protocol}://${req.get('host')}/precos.html?status=pending`
        },
        // Excluir PIX - o usuário já tem opção PIX via QR code na página
        payment_methods: {
          excluded_payment_types: [{ id: 'bank_transfer' }]
        }
      }
    };

    // Adicionar dados do pagador se fornecidos
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
      preference_id: result.id
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
