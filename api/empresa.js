const mysql = require('mysql2/promise');
const { getDatabaseConfig } = require('../database-config');

// Tabela: empresa (crie manualmente ou via script)
// Campos: id (PK), nome_fantasia, razao_social, cnpj, endereco, email, telefone

module.exports = async function empresaHandler(req, res) {
  const dbConfig = getDatabaseConfig();
  let connection;
  try {
    connection = await mysql.createConnection({ ...dbConfig, database: 'jpsistemas_users' });
    if (req.method === 'GET') {
      const [rows] = await connection.execute('SELECT nome_fantasia, razao_social, cnpj, endereco, email, telefone FROM empresa WHERE id = 1');
      if (rows.length === 0) return res.status(404).json({ error: 'Informações da empresa não encontradas.' });
      return res.json(rows[0]);
    } else if (req.method === 'POST') {
      const { nome_fantasia, razao_social, cnpj, endereco, email, telefone } = req.body;
      if (!nome_fantasia || !razao_social || !cnpj) {
        return res.status(400).json({ error: 'Campos obrigatórios não preenchidos.' });
      }
      await connection.execute(
        `INSERT INTO empresa (id, nome_fantasia, razao_social, cnpj, endereco, email, telefone)
         VALUES (1, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE nome_fantasia=VALUES(nome_fantasia), razao_social=VALUES(razao_social), cnpj=VALUES(cnpj), endereco=VALUES(endereco), email=VALUES(email), telefone=VALUES(telefone)`,
        [nome_fantasia, razao_social, cnpj, endereco, email, telefone]
      );
      return res.json({ success: true });
    } else {
      res.status(405).json({ error: 'Método não permitido' });
    }
  } catch (err) {
    res.status(500).json({ error: 'Erro no servidor', details: err.message });
  } finally {
    if (connection) await connection.end();
  }
}; 