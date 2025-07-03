const mysql = require('mysql2/promise');
require('dotenv').config();

async function main() {
  // Conexão ao servidor MySQL (ajuste as variáveis se necessário)
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'jpsistemas',
    password: process.env.DB_PASSWORD || 'SuaSenhaForte123!',
    charset: 'utf8mb4'
  });

  // Buscar todos os bancos de usuários
  const [databases] = await connection.query("SHOW DATABASES LIKE 'jpsistemas_%'");
  const mainDatabases = ['jpsistemas_users', 'jpsistemas_sessions', 'jpsistemas_admin'];
  const userDatabases = databases
    .map(db => db.Database)
    .filter(dbName => dbName && !mainDatabases.includes(dbName));

  for (const dbName of userDatabases) {
    try {
      console.log(`\n🔍 Alterando banco: ${dbName}`);

      // Adicionar status em contas_pagar
      await connection.query(`USE \`${dbName}\``);
      const [colsPagar] = await connection.query("SHOW COLUMNS FROM contas_pagar LIKE 'status'");
      if (colsPagar.length === 0) {
        await connection.query("ALTER TABLE contas_pagar ADD COLUMN status VARCHAR(20) DEFAULT 'aberto'");
        console.log('✅ Adicionado status em contas_pagar');
      } else {
        console.log('✔️ Já existe status em contas_pagar');
      }

      // Adicionar status em contas_receber
      const [colsReceber] = await connection.query("SHOW COLUMNS FROM contas_receber LIKE 'status'");
      if (colsReceber.length === 0) {
        await connection.query("ALTER TABLE contas_receber ADD COLUMN status VARCHAR(20) DEFAULT 'aberto'");
        console.log('✅ Adicionado status em contas_receber');
      } else {
        console.log('✔️ Já existe status em contas_receber');
      }
    } catch (err) {
      console.error(`❌ Erro no banco ${dbName}:`, err.message);
    }
  }

  await connection.end();
  console.log('\n🏁 Script finalizado!');
}

main(); 