/**
 * Cria a tabela cliente_documentos em TODOS os bancos do sistema que têm a tabela clientes
 * (banco principal + um banco por usuário: diego, deivid, etc.).
 * Execute: node scripts/add-cliente-documentos-table.js
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
  const config = {
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    charset: 'utf8mb4'
  };

  try {
    const conn = await mysql.createConnection({ ...config });
    const [rows] = await conn.execute(`
      SELECT TABLE_SCHEMA
      FROM information_schema.TABLES
      WHERE TABLE_NAME = 'clientes'
      AND TABLE_SCHEMA NOT IN ('information_schema', 'mysql', 'performance_schema', 'sys')
    `);
    await conn.end();

    const databases = rows.map((r) => r.TABLE_SCHEMA);
    if (databases.length === 0) {
      console.log('Nenhum banco com tabela "clientes" encontrado.');
      return;
    }

    console.log('Bancos com tabela clientes:', databases.join(', '));

    for (const dbName of databases) {
      const connection = await mysql.createConnection({ ...config, database: dbName });
      await connection.execute(SQL_CREATE_TABLE);
      await connection.end();
      console.log('Tabela cliente_documentos criada no banco:', dbName);
    }
    console.log('Concluído. Total:', databases.length, 'banco(s).');
  } catch (err) {
    console.error('Erro:', err.message);
    process.exit(1);
  }
}

run();
