// Script para padronizar o status dos pedidos no banco de dados
const mysql = require('mysql2/promise');
require('dotenv').config();

function normalizarStatus(status) {
  if (!status) return '';
  const s = status.toString().trim().toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '');
  if (s === 'em aberto') return 'Em Aberto';
  if (s === 'em processamento') return 'Em Processamento';
  if (s === 'concluido') return 'Concluído';
  if (s === 'cancelado') return 'Cancelado';
  if (s === 'pendente') return 'Pendente';
  return status;
}

(async () => {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: 'jpsistemas_admin',
    charset: 'utf8mb4'
  });

  const [rows] = await connection.execute('SELECT id, status FROM pedidos');
  let alterados = 0;
  for (const row of rows) {
    const statusNovo = normalizarStatus(row.status);
    if (statusNovo !== row.status) {
      await connection.execute('UPDATE pedidos SET status = ? WHERE id = ?', [statusNovo, row.id]);
      alterados++;
      console.log(`Pedido ${row.id}: '${row.status}' => '${statusNovo}'`);
    }
  }
  await connection.end();
  console.log(`\nTotal de pedidos atualizados: ${alterados}`);
})(); 