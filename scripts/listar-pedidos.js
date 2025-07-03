const mysql = require('mysql2/promise');
require('dotenv').config();

async function listarPedidos() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME || 'jpsistemas_admin', // ajuste se necessário
    charset: 'utf8mb4'
  });

  const [rows] = await connection.execute('SELECT id, status, data_pedido, valor_total FROM pedidos ORDER BY data_pedido DESC, id DESC');

  if (rows.length === 0) {
    console.log('Nenhum pedido encontrado.');
    return;
  }

  console.log('ID | Status        | Data        | Valor Total');
  console.log('----------------------------------------------');
  rows.forEach(p => {
    console.log(`${p.id.toString().padEnd(3)}| ${p.status.padEnd(13)}| ${p.data_pedido} | R$ ${Number(p.valor_total).toFixed(2)}`);
  });

  await connection.end();
}

listarPedidos().catch(err => {
  console.error('Erro ao listar pedidos:', err);
}); 