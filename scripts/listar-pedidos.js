const mysql = require('mysql2/promise');
require('dotenv').config();

async function listarPedidosMultiTenant() {
  const adminConnection = await mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    charset: 'utf8mb4'
  });

  // Listar todos os bancos de dados
  const [dbs] = await adminConnection.execute('SHOW DATABASES');
  // Filtrar bancos que provavelmente são de clientes (ajuste o filtro conforme seu padrão)
  const bancosClientes = dbs
    .map(db => db.Database)
    .filter(name => name.startsWith('jpsistemas_') && name !== 'jpsistemas_admin');

  if (bancosClientes.length === 0) {
    console.log('Nenhum banco de cliente encontrado.');
    return;
  }

  for (const dbName of bancosClientes) {
    try {
      const connection = await mysql.createConnection({
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: dbName,
        charset: 'utf8mb4'
      });
      // Verifica se a tabela pedidos existe
      const [tables] = await connection.execute("SHOW TABLES LIKE 'pedidos'");
      if (tables.length === 0) {
        await connection.end();
        continue;
      }
      const [rows] = await connection.execute('SELECT id, status, data_pedido, valor_total FROM pedidos ORDER BY data_pedido DESC, id DESC');
      if (rows.length > 0) {
        console.log(`\nBanco: ${dbName}`);
        console.log('ID | Status        | Data        | Valor Total');
        console.log('----------------------------------------------');
        rows.forEach(p => {
          console.log(`${p.id.toString().padEnd(3)}| ${p.status.padEnd(13)}| ${p.data_pedido} | R$ ${Number(p.valor_total).toFixed(2)}`);
        });
      }
      await connection.end();
    } catch (err) {
      console.error(`Erro ao acessar banco ${dbName}:`, err.message);
    }
  }
  await adminConnection.end();
}

listarPedidosMultiTenant().catch(err => {
  console.error('Erro geral ao listar pedidos:', err);
}); 