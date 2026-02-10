/**
 * API Preços - Confirmação de pagamento e envio de email
 */
const express = require('express');
const router = express.Router();
const mysql = require('mysql2/promise');
const nodemailer = require('nodemailer');
const { getPrecosDatabaseConfig } = require('../database-config');

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

// GET /api/precos/testar-email - Testa se o SMTP está funcionando (enviar para julianosalm@gmail.com)
router.get('/testar-email', async (req, res) => {
  const smtpUser = (process.env.SMTP_USER || process.env.BACKUP_EMAIL_USER || 'suporte.jpsistemas@gmail.com').trim();
  const smtpPass = (process.env.SMTP_PASS || process.env.BACKUP_EMAIL_APP_PASSWORD || '').trim();

  if (!smtpPass) {
    return res.json({ ok: false, erro: 'SMTP_PASS não configurado no .env' });
  }

  try {
    const nodemailer = require('nodemailer');
    const transporter = nodemailer.createTransport({
      host: (process.env.SMTP_HOST || 'smtp.gmail.com').trim(),
      port: parseInt(process.env.SMTP_PORT || '587', 10),
      secure: false,
      auth: { user: smtpUser, pass: smtpPass }
    });
    await transporter.sendMail({
      from: `"JP Sistemas" <${smtpUser}>`,
      to: 'julianosalm@gmail.com',
      subject: 'Teste de email - JP Sistemas',
      html: '<p>Se você recebeu este email, o SMTP está funcionando corretamente.</p>'
    });
    res.json({ ok: true, msg: 'Email de teste enviado para julianosalm@gmail.com. Verifique a caixa de entrada.' });
  } catch (err) {
    console.error('[Precos] Erro no teste de email:', err.message);
    res.json({
      ok: false,
      erro: err.message,
      dica: err.code === 'EAUTH' ? 'Use Senha de app do Gmail, não a senha normal.' : ''
    });
  }
});

// GET /api/precos/confirmar - Busca dados e envia email (chamado na página de sucesso)
router.get('/confirmar', async (req, res) => {
  try {
    const { ref } = req.query;
    if (!ref) {
      return res.status(400).json({ error: 'Parâmetro ref é obrigatório' });
    }

    await ensurePrecosDatabase();
    const conn = await mysql.createConnection(getPrecosDatabaseConfig());
    const [rows] = await conn.execute(
      'SELECT * FROM pagamentos_precos WHERE ref_id = ? AND status IN ("pending","approved")',
      [ref]
    );
    await conn.end();

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Pagamento não encontrado ou já processado' });
    }

    const pag = rows[0];
    let envioEmail = false;
    try {
      envioEmail = await enviarEmailConfirmacao(pag);
      if (envioEmail) {
        const conn2 = await mysql.createConnection(getPrecosDatabaseConfig());
        await conn2.execute(
          "UPDATE pagamentos_precos SET status = 'email_sent' WHERE ref_id = ?",
          [ref]
        );
        await conn2.end();
      }
    } catch (emailErr) {
      console.error('[Precos] Falha no envio do email:', emailErr.message);
      res.json({
        success: true,
        plano: pag.plano,
        valor: pag.valor_final,
        emailEnviado: false,
        emailErro: 'Falha ao enviar. Verifique SMTP_PASS no servidor (use Senha de app do Gmail).'
      });
      return;
    }

    res.json({
      success: true,
      plano: pag.plano,
      valor: pag.valor_final,
      emailEnviado: envioEmail
    });
  } catch (err) {
    console.error('Erro ao confirmar pagamento:', err);
    res.status(500).json({ error: err.message });
  }
});

// Envia email de confirmação para julianosalm@gmail.com
async function enviarEmailConfirmacao(pag) {
  const smtpUser = (process.env.SMTP_USER || process.env.BACKUP_EMAIL_USER || 'suporte.jpsistemas@gmail.com').trim();
  const smtpPass = (process.env.SMTP_PASS || process.env.BACKUP_EMAIL_APP_PASSWORD || '').trim();

  if (!smtpPass) {
    console.warn('[Precos] SMTP não configurado - SMTP_PASS ou BACKUP_EMAIL_APP_PASSWORD ausente no .env');
    return false;
  }

  const dataHora = new Date().toLocaleString('pt-BR', { dateStyle: 'long', timeStyle: 'medium' });
  const valorFormatado = pag.valor_final.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  function escapeHtml(s) {
    if (!s) return '';
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  const htmlBody = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Novo Pagamento - JP Sistemas</title>
</head>
<body style="margin:0; padding:0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f5f7fa;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #f5f7fa;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table role="presentation" width="600" cellspacing="0" cellpadding="0" style="background-color: #ffffff; border-radius: 12px; box-shadow: 0 4px 20px rgba(0,0,0,0.08); overflow: hidden;">
          <tr>
            <td style="background: linear-gradient(135deg, #002f4b 0%, #001425 100%); padding: 32px 40px; text-align: center;">
              <img src="https://i.imgur.com/6N82fk2.png" alt="JP Sistemas" width="120" height="auto" style="max-height: 50px; object-fit: contain;" />
              <h1 style="margin: 16px 0 0 0; color: #ffffff; font-size: 22px; font-weight: 600;">Novo Pagamento Recebido</h1>
              <p style="margin: 8px 0 0 0; color: rgba(255,255,255,0.9); font-size: 14px;">Confirmação de compra no site JP. Sistemas</p>
            </td>
          </tr>
          <tr>
            <td style="padding: 32px 40px;">
              <p style="margin: 0 0 20px 0; color: #374151; font-size: 15px; line-height: 1.6;">Um novo pagamento foi efetuado com sucesso.</p>
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #f8fafc; border-radius: 8px; border: 1px solid #e2e8f0;">
                <tr>
                  <td style="padding: 20px;">
                    <p style="margin: 0 0 8px 0; color: #64748b; font-size: 12px; text-transform: uppercase;">Cliente</p>
                    <p style="margin: 0 0 16px 0; color: #002f4b; font-size: 16px; font-weight: 600;">${escapeHtml(pag.nome)}</p>
                    <p style="margin: 0 0 8px 0; color: #64748b; font-size: 12px; text-transform: uppercase;">E-mail</p>
                    <p style="margin: 0 0 16px 0; color: #002f4b; font-size: 15px;">${escapeHtml(pag.email)}</p>
                    <p style="margin: 0 0 8px 0; color: #64748b; font-size: 12px; text-transform: uppercase;">Telefone</p>
                    <p style="margin: 0 0 16px 0; color: #002f4b; font-size: 15px;">${escapeHtml(pag.telefone || 'Não informado')}</p>
                    <p style="margin: 0 0 8px 0; color: #64748b; font-size: 12px; text-transform: uppercase;">CPF</p>
                    <p style="margin: 0 0 16px 0; color: #002f4b; font-size: 15px;">${escapeHtml(pag.cpf || 'Não informado')}</p>
                    <p style="margin: 0 0 8px 0; color: #64748b; font-size: 12px; text-transform: uppercase;">Plano</p>
                    <p style="margin: 0 0 16px 0; color: #002f4b; font-size: 16px; font-weight: 600;">${escapeHtml(pag.plano)}</p>
                    <p style="margin: 0 0 8px 0; color: #64748b; font-size: 12px; text-transform: uppercase;">Valor</p>
                    <p style="margin: 0 0 0 0; color: #059669; font-size: 18px; font-weight: 700;">${valorFormatado}</p>
                  </td>
                </tr>
              </table>
              <p style="margin: 24px 0 0 0; color: #9ca3af; font-size: 12px;">Data: ${dataHora}</p>
              <p style="margin: 8px 0 0 0; color: #9ca3af; font-size: 12px;">O comprovante de pagamento será enviado pelo Mercado Pago.</p>
            </td>
          </tr>
          <tr>
            <td style="padding: 20px 40px; background-color: #f8fafc; border-top: 1px solid #e2e8f0; text-align: center;">
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
      subject: `Novo pagamento: ${pag.plano} - ${valorFormatado} - ${pag.nome}`,
      html: htmlBody
    });

    console.log('[Precos] Email de confirmação enviado para julianosalm@gmail.com');
    return true;
  } catch (err) {
    console.error('[Precos] Erro ao enviar email de confirmação:', err.message);
    if (err.code === 'EAUTH' || err.responseCode === 535) {
      console.error('[Precos] Falha de autenticação SMTP. Use "Senha de app" do Gmail (não a senha normal): https://myaccount.google.com/apppasswords');
    }
    throw err; // Propaga para o chamador retornar info ao cliente
  }
}

module.exports = router;
