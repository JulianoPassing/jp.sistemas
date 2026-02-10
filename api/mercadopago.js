/**
 * API Mercado Pago - Criação de preferência de pagamento (Checkout Pro)
 * Suporta PIX, cartão de crédito e boleto - redireciona para o ambiente do Mercado Pago
 * Envia email "Pedido Pendente" ao criar o pedido
 */
const express = require('express');
const router = express.Router();
const mysql = require('mysql2/promise');
const crypto = require('crypto');
const nodemailer = require('nodemailer');
const { getPrecosDatabaseConfig } = require('../database-config');

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

// Envia email "Pedido Pendente" para julianosalm@gmail.com
async function enviarEmailPedidoPendente(dados) {
  const smtpUser = (process.env.SMTP_USER || process.env.BACKUP_EMAIL_USER || 'suporte.jpsistemas@gmail.com').trim();
  const smtpPass = (process.env.SMTP_PASS || process.env.BACKUP_EMAIL_APP_PASSWORD || '').trim();

  if (!smtpPass) {
    console.warn('[MP] SMTP não configurado - email Pedido Pendente não enviado');
    return;
  }

  function escapeHtml(s) {
    if (!s) return '';
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  const dataHora = new Date().toLocaleString('pt-BR', { dateStyle: 'long', timeStyle: 'medium' });
  const formatarMoeda = (v) => Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  const valorTotal = formatarMoeda(dados.valor);
  const valorOriginal = formatarMoeda(dados.valorOriginal);
  const valorDesconto = formatarMoeda(dados.valorDesconto);
  const nomeCompleto = [dados.nome, dados.sobrenome].filter(Boolean).join(' ').trim() || dados.email || 'Cliente';
  const tel = String(dados.telefone || '').replace(/\D/g, '');
  const telefoneFormatado = tel.length >= 10 ? tel.replace(/(\d{2})(\d{4,5})(\d{4})/, '($1) $2-$3') : (dados.telefone || 'Não informado');
  const cpf = (dados.cpf || '').replace(/\D/g, '');
  const cpfFormatado = cpf.length === 11 ? cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4') : (dados.cpf || 'Não informado');
  const temCupom = dados.cupomCodigo && (dados.valorDesconto || 0) > 0;

  const htmlBody = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Pedido Pendente - JP Sistemas</title>
</head>
<body style="margin:0; padding:0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background: linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%);">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background: linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%); min-height: 100vh;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table role="presentation" width="600" cellspacing="0" cellpadding="0" style="background: #fff; border-radius: 16px; box-shadow: 0 10px 40px rgba(0,47,75,0.12); overflow: hidden; border: 1px solid rgba(0,230,255,0.2);">
          <tr>
            <td style="background: linear-gradient(135deg, #002f4b 0%, #001425 100%); padding: 36px 40px; text-align: center;">
              <img src="https://i.imgur.com/6N82fk2.png" alt="JP Sistemas" width="140" height="auto" style="max-height: 55px; object-fit: contain; display: block; margin: 0 auto;" />
              <div style="display: inline-block; background: rgba(245,158,11,0.95); color: #1a1a1a; padding: 8px 20px; border-radius: 24px; font-size: 13px; font-weight: 700; letter-spacing: 0.5px; margin-top: 20px;">PEDIDO PENDENTE</div>
              <h1 style="margin: 16px 0 0 0; color: #fff; font-size: 24px; font-weight: 700;">Novo pedido aguardando pagamento</h1>
              <p style="margin: 8px 0 0 0; color: rgba(255,255,255,0.9); font-size: 15px;">Cliente foi redirecionado ao Mercado Pago</p>
            </td>
          </tr>
          <tr>
            <td style="padding: 36px 40px;">
              <p style="margin: 0 0 24px 0; color: #374151; font-size: 15px; line-height: 1.7;">Um cliente iniciou o processo de compra. Todos os dados abaixo foram registrados e o pagamento está em andamento.</p>
              
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%); border-radius: 12px; border: 1px solid #e2e8f0; overflow: hidden; margin-bottom: 20px;">
                <tr><td style="padding: 18px 24px; border-bottom: 1px solid #e2e8f0;"><strong style="color: #002f4b; font-size: 14px;">📋 Dados do Cliente</strong></td></tr>
                <tr>
                  <td style="padding: 20px 24px;">
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                      <tr><td style="padding: 4px 0;"><span style="color: #64748b; font-size: 11px; text-transform: uppercase;">Nome completo</span></td></tr>
                      <tr><td style="padding: 2px 0 12px 0; color: #002f4b; font-size: 15px; font-weight: 600;">${escapeHtml(nomeCompleto)}</td></tr>
                      <tr><td style="padding: 4px 0;"><span style="color: #64748b; font-size: 11px; text-transform: uppercase;">E-mail</span></td></tr>
                      <tr><td style="padding: 2px 0 12px 0; color: #002f4b; font-size: 14px;">${escapeHtml(dados.email || 'Não informado')}</td></tr>
                      <tr><td style="padding: 4px 0;"><span style="color: #64748b; font-size: 11px; text-transform: uppercase;">Telefone</span></td></tr>
                      <tr><td style="padding: 2px 0 12px 0; color: #002f4b; font-size: 14px;">${escapeHtml(telefoneFormatado)}</td></tr>
                      <tr><td style="padding: 4px 0;"><span style="color: #64748b; font-size: 11px; text-transform: uppercase;">CPF</span></td></tr>
                      <tr><td style="padding: 2px 0 0 0; color: #002f4b; font-size: 14px;">${escapeHtml(cpfFormatado)}</td></tr>
                    </table>
                  </td>
                </tr>
              </table>

              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%); border-radius: 12px; border: 1px solid #e2e8f0; overflow: hidden;">
                <tr><td style="padding: 18px 24px; border-bottom: 1px solid #e2e8f0;"><strong style="color: #002f4b; font-size: 14px;">🛒 Resumo do Pedido</strong></td></tr>
                <tr>
                  <td style="padding: 20px 24px;">
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                      <tr><td style="padding: 4px 0;"><span style="color: #64748b; font-size: 11px; text-transform: uppercase;">Plano</span></td></tr>
                      <tr><td style="padding: 2px 0 12px 0; color: #002f4b; font-size: 16px; font-weight: 600;">${escapeHtml(dados.plano)}</td></tr>
                      <tr><td style="padding: 4px 0;"><span style="color: #64748b; font-size: 11px; text-transform: uppercase;">Subtotal</span></td></tr>
                      <tr><td style="padding: 2px 0 12px 0; color: #002f4b; font-size: 14px;">${valorOriginal}</td></tr>
                      ${temCupom ? `
                      <tr><td style="padding: 4px 0;"><span style="color: #64748b; font-size: 11px; text-transform: uppercase;">Cupom aplicado</span></td></tr>
                      <tr><td style="padding: 2px 0 4px 0; color: #059669; font-size: 14px; font-weight: 600;">${escapeHtml(dados.cupomCodigo)} (${dados.cupomPercent}% de desconto)</td></tr>
                      <tr><td style="padding: 4px 0;"><span style="color: #64748b; font-size: 11px; text-transform: uppercase;">Valor do desconto</span></td></tr>
                      <tr><td style="padding: 2px 0 12px 0; color: #059669; font-size: 14px;">- ${valorDesconto}</td></tr>
                      ` : ''}
                      <tr><td style="padding: 8px 0 4px 0; border-top: 1px solid #e2e8f0;"><span style="color: #64748b; font-size: 11px; text-transform: uppercase;">Valor total do pedido</span></td></tr>
                      <tr><td style="padding: 2px 0 0 0; color: #059669; font-size: 20px; font-weight: 800;">${valorTotal}</td></tr>
                    </table>
                  </td>
                </tr>
              </table>
              <div style="margin-top: 24px; padding: 16px 20px; background: #fffbeb; border-radius: 10px; border-left: 4px solid #f59e0b;">
                <p style="margin: 0; color: #92400e; font-size: 14px; line-height: 1.6;"><strong>Aguardando pagamento:</strong> O cliente foi redirecionado ao Mercado Pago. Quando o pagamento for aprovado, ele retornará ao site automaticamente.</p>
              </div>
              <p style="margin: 24px 0 0 0; color: #94a3b8; font-size: 12px;">Pedido registrado em ${dataHora}</p>
            </td>
          </tr>
          <tr>
            <td style="padding: 24px 40px; background: #f8fafc; border-top: 1px solid #e2e8f0; text-align: center;">
              <img src="https://i.imgur.com/6N82fk2.png" alt="JP Sistemas" width="80" height="auto" style="opacity: 0.6; margin-bottom: 8px;" />
              <p style="margin: 0; color: #94a3b8; font-size: 12px;">© ${new Date().getFullYear()} JP. Sistemas · jp-sistemas.com</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`;

  try {
    const transporter = nodemailer.createTransport({
      host: (process.env.SMTP_HOST || 'smtp.gmail.com').trim(),
      port: parseInt(process.env.SMTP_PORT || '587', 10),
      secure: false,
      auth: { user: smtpUser, pass: smtpPass }
    });

    await transporter.sendMail({
      from: `"JP Sistemas" <${smtpUser}>`,
      to: 'julianosalm@gmail.com',
      subject: `Pedido Pendente: ${dados.plano} - ${valorTotal} - ${escapeHtml(nomeCompleto)}`,
      html: htmlBody
    });

    console.log('[MP] Email Pedido Pendente enviado para julianosalm@gmail.com');
  } catch (err) {
    console.error('[MP] Erro ao enviar email Pedido Pendente:', err.message);
  }
}

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
    const { planName, amount, quantity = 1, payer, valorOriginal, valorDesconto, cupomCodigo, cupomPercent } = req.body;

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

    // Enviar email "Pedido Pendente" (não bloqueia o redirect)
    enviarEmailPedidoPendente({
      nome: payer?.name || '',
      sobrenome: payer?.surname || '',
      email: payer?.email || '',
      telefone: payer?.phone || '',
      cpf: payer?.cpf || '',
      plano: planName,
      valor: amountClean,
      valorOriginal: valorOriginal != null ? parseFloat(valorOriginal) : amountClean,
      valorDesconto: valorDesconto != null ? parseFloat(valorDesconto) : 0,
      cupomCodigo: cupomCodigo || null,
      cupomPercent: cupomPercent != null ? parseFloat(cupomPercent) : null
    }).catch(() => {});

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
