#!/usr/bin/env node
/**
 * Script de backup diário JP-Cobranças
 * Envia backup por e-mail para usuários com backup_diario_ativo = 1 e e-mail cadastrado.
 *
 * Uso:
 *   node scripts/backup-diario-cobrancas.js
 *
 * Ou via cron (ex: todo dia às 7h):
 *   0 7 * * * cd /caminho/projeto && node scripts/backup-diario-cobrancas.js
 *
 * Alternativa: chamar o endpoint HTTP (com servidor rodando):
 *   curl -X POST "http://localhost:3000/api/cobrancas/backup-diario-enviar?token=SEU_TOKEN"
 *
 * Variáveis de ambiente necessárias:
 *   DB_HOST, DB_USER, DB_PASSWORD
 *   SMTP_USER, SMTP_PASS (ou BACKUP_EMAIL_APP_PASSWORD)
 *   BACKUP_CRON_TOKEN (para o endpoint HTTP)
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const mysql = require('mysql2/promise');
const nodemailer = require('nodemailer');
const AdmZip = require('adm-zip');
const XLSX = require('xlsx');

async function getUsersConnection() {
  return mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'jpsistemas',
    password: process.env.DB_PASSWORD || 'Juliano@95',
    database: 'jpsistemas_users',
    charset: 'utf8mb4'
  });
}

function createCobrancasConnection(username) {
  const dbName = `jpcobrancas_${username.toLowerCase().replace(/[^a-z0-9]/g, '_')}`;
  return mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'jpsistemas',
    password: process.env.DB_PASSWORD || 'Juliano@95',
    database: dbName,
    charset: 'utf8mb4'
  });
}

async function run() {
  const results = { enviados: 0, erros: [] };
  console.log('[Backup Diário] Iniciando...');

  const smtpPass = process.env.SMTP_PASS || process.env.BACKUP_EMAIL_APP_PASSWORD;
  if (!smtpPass) {
    console.error('[Backup Diário] ERRO: SMTP_PASS ou BACKUP_EMAIL_APP_PASSWORD não configurado.');
    process.exit(1);
  }

  const smtpUser = process.env.SMTP_USER || process.env.BACKUP_EMAIL_USER || 'suporte.jpsistemas@gmail.com';
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT || '587', 10),
    secure: false,
    auth: { user: smtpUser, pass: smtpPass }
  });

  const usersConn = await getUsersConnection();
  let users = [];
  try {
    await usersConn.execute('ALTER TABLE usuarios_cobrancas ADD COLUMN email VARCHAR(255) NULL');
  } catch (e) {
    if (e.code !== 'ER_DUP_FIELDNAME') throw e;
  }
  const [rows] = await usersConn.execute(
    "SELECT username, email FROM usuarios_cobrancas WHERE email IS NOT NULL AND TRIM(email) != '' AND email LIKE '%@%'"
  );
  users = rows;
  await usersConn.end();

  for (const row of users) {
    const username = (row.username || '').trim();
    const email = (row.email || '').trim();
    if (!username || !email) continue;

    try {
      const conn = await createCobrancasConnection(username);
      let configRows = [];
      try {
        [configRows] = await conn.execute('SELECT backup_diario_ativo FROM configuracoes LIMIT 1');
      } catch (_) {}
      const backupAtivo = configRows.length > 0 && (configRows[0].backup_diario_ativo === 1 || configRows[0].backup_diario_ativo === '1');
      if (!backupAtivo) {
        await conn.end();
        continue;
      }

      const [emprestimos] = await conn.execute(`
        SELECT e.*, c.nome as cliente_nome, c.cpf_cnpj, c.telefone, c.email as cliente_email
        FROM emprestimos e
        LEFT JOIN clientes_cobrancas c ON e.cliente_id = c.id
        ORDER BY e.created_at DESC
      `);
      const [clientes] = await conn.execute('SELECT * FROM clientes_cobrancas ORDER BY nome ASC');
      await conn.end();

      const formatDate = (d) => d ? (d instanceof Date ? d.toISOString().slice(0, 10) : String(d).slice(0, 10)) : '-';
      const formatMoney = (v) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(v) || 0);

      const dadosEmp = (emprestimos || []).map(e => ({
        'ID': e.id, 'Cliente': e.cliente_nome || '-', 'CPF/CNPJ': e.cpf_cnpj || '-', 'Telefone': e.telefone || '-',
        'Valor': formatMoney(e.valor), 'Juros (%)': Number(e.juros_mensal || 0), 'Data Empréstimo': formatDate(e.data_emprestimo),
        'Data Vencimento': formatDate(e.data_vencimento), 'Status': e.status || '-', 'Observações': (e.observacoes || '-').substring(0, 100)
      }));
      const dadosCli = (clientes || []).map(c => ({
        'ID': c.id, 'Nome': c.nome || '-', 'CPF/CNPJ': c.cpf_cnpj || '-', 'Email': c.email || '-', 'Telefone': c.telefone || '-',
        'Endereço': c.endereco || '-', 'Cidade': c.cidade || '-', 'Estado': c.estado || '-', 'Status': c.status || 'Ativo',
        'Data Cadastro': formatDate(c.created_at)
      }));

      const dataHora = new Date();
      const nomeEmp = `Backup_Emprestimos_${dataHora.getFullYear()}-${String(dataHora.getMonth() + 1).padStart(2, '0')}-${String(dataHora.getDate()).padStart(2, '0')}.xlsx`;
      const nomeCli = `Backup_Carteira_Clientes_${dataHora.getFullYear()}-${String(dataHora.getMonth() + 1).padStart(2, '0')}-${String(dataHora.getDate()).padStart(2, '0')}.xlsx`;

      const wbEmp = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wbEmp, XLSX.utils.json_to_sheet(dadosEmp), 'Empréstimos');
      const wbCli = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wbCli, XLSX.utils.json_to_sheet(dadosCli), 'Carteira de Clientes');

      const bufEmp = XLSX.write(wbEmp, { bookType: 'xlsx', type: 'buffer' });
      const bufCli = XLSX.write(wbCli, { bookType: 'xlsx', type: 'buffer' });

      const zip = new AdmZip();
      zip.addFile(nomeEmp, Buffer.from(bufEmp));
      zip.addFile(nomeCli, Buffer.from(bufCli));
      const zipBuf = zip.toBuffer();

      const dataHoraStr = dataHora.toLocaleString('pt-BR', { dateStyle: 'long', timeStyle: 'medium' });
      await transporter.sendMail({
        from: `"JP-Cobranças" <${smtpUser}>`,
        to: email,
        subject: `Backup diário JP-Cobranças — ${dataHoraStr}`,
        html: `<!DOCTYPE html><html><head><meta charset="utf-8"></head><body style="font-family:sans-serif;padding:20px;">
<h2>Backup JP-Cobranças</h2>
<p>Olá, <strong>${username}</strong>!</p>
<p>Segue em anexo o backup diário automático (Empréstimos + Carteira de Clientes).</p>
<p><strong>Data:</strong> ${dataHoraStr}</p>
<p style="color:#666;font-size:12px;">Enviado automaticamente pelo sistema JP-Cobranças.</p>
</body></html>`,
        attachments: [{ filename: 'backup.zip', content: zipBuf }]
      });

      results.enviados++;
      console.log('[Backup Diário] Enviado para', username, ':', email);
    } catch (err) {
      results.erros.push({ username, erro: err.message });
      console.error('[Backup Diário] Erro para', username, ':', err.message);
    }
  }

  console.log('[Backup Diário] Concluído. Enviados:', results.enviados, 'Erros:', results.erros.length);
  if (results.erros.length > 0) {
    results.erros.forEach(e => console.error('  -', e.username, ':', e.erro));
  }
}

run().catch(err => {
  console.error('[Backup Diário] Erro fatal:', err);
  process.exit(1);
});
