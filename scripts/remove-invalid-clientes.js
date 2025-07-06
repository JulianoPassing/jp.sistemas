// Script para remover clientes inválidos do banco de dados de cobranças
const mysql = require('mysql2/promise');
const { getCobrancasDatabaseConfig } = require('../database-config');

(async () => {
  const dbConfig = getCobrancasDatabaseConfig();
  const connection = await mysql.createConnection(dbConfig);
  try {
    // Seleciona clientes inválidos sem empréstimos
    const [clientes] = await connection.execute(`
      SELECT c.id, c.nome FROM clientes_cobrancas c
      LEFT JOIN emprestimos e ON e.cliente_id = c.id
      WHERE (c.nome IS NULL OR c.nome = '' OR c.nome = 'undefined' OR c.nome = 'N/A')
        AND e.id IS NULL
    `);
    if (clientes.length === 0) {
      console.log('Nenhum cliente inválido encontrado para remover.');
      await connection.end();
      return;
    }
    const ids = clientes.map(c => c.id);
    await connection.execute(
      `DELETE FROM clientes_cobrancas WHERE id IN (${ids.map(() => '?').join(',')})`,
      ids
    );
    console.log(`Removidos ${ids.length} clientes inválidos:`, ids);
  } catch (err) {
    console.error('Erro ao remover clientes inválidos:', err);
  } finally {
    await connection.end();
  }
})(); 