/**
 * Script para criar a tabela cliente_documentos no banco definido em DB_NAME.
 * Execute: node scripts/add-cliente-documentos-table.js
 * Para multi-tenant, execute uma vez por banco ou use o SQL manualmente.
 */
const mysql = require('mysql2/promise');
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const SQL_CREATE_TABLE = `
CREATE TABLE IF NOT EXISTS cliente_documentos (
  id INT AUTO_INCREMENT PRIMARY KEY,
  cliente_id INT NOT NULL,
  nome_original VARCHAR(255) NOT NULL,
  nome_arquivo VARCHAR(255) NOT NULL,
  caminho VARCHAR(500) NOT NULL,
  tipo_mime VARCHAR(100) NOT NULL,
  tamanho INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (cliente_id) REFERENCES clientes(id) ON DELETE CASCADE,
  INDEX idx_cliente_id (cliente_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
`;

async function run() {
  const dbName = process.env.DB_NAME || 'sistemajuliano';
  try {
    const connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: dbName,
      charset: 'utf8mb4'
    });
    await connection.execute(SQL_CREATE_TABLE);
    await connection.end();
    console.log('Tabela cliente_documentos criada no banco', dbName);
  } catch (err) {
    console.error('Erro:', err.message);
    process.exit(1);
  }
}

run();
