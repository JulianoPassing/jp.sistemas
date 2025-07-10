const mysql = require('mysql2/promise');

// Configuração do banco de dados
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'jp_cobrancas',
  charset: 'utf8mb4'
};

async function correcaoImediataDede() {
  let connection;
  
  try {
    connection = await mysql.createConnection(dbConfig);
    console.log('🔗 Conectado ao banco de dados');
    
    console.log('\n🚨 CORREÇÃO IMEDIATA - Empréstimo do Dedé');
    
    // Buscar empréstimo do Dedé
    const [emprestimos] = await connection.execute(`
      SELECT e.id, e.cliente_id, e.valor, e.data_vencimento, e.status, e.numero_parcelas,
             c.nome as cliente_nome
      FROM emprestimos e
      LEFT JOIN clientes_cobrancas c ON e.cliente_id = c.id
      WHERE (c.nome LIKE '%Dedé%' OR c.nome LIKE '%Dede%' OR c.nome LIKE '%Horácio%')
      ORDER BY e.id DESC
      LIMIT 1
    `);
    
    if (emprestimos.length === 0) {
      console.log('❌ Empréstimo do Dedé não encontrado');
      await connection.end();
      return;
    }
    
    const emp = emprestimos[0];
    console.log('\n📋 EMPRÉSTIMO ENCONTRADO:');
    console.log(`   ID: ${emp.id}`);
    console.log(`   Cliente: ${emp.cliente_nome}`);
    console.log(`   Data atual: ${emp.data_vencimento}`);
    console.log(`   Status atual: ${emp.status}`);
    console.log(`   Número de parcelas: ${emp.numero_parcelas}`);
    
    // Aplicar correção: Data 16/07/2024 e Status Ativo
    const novaData = '2024-07-16';
    const novoStatus = 'Ativo';
    
    console.log('\n🔧 APLICANDO CORREÇÃO:');
    console.log(`   Nova data: ${novaData}`);
    console.log(`   Novo status: ${novoStatus}`);
    
    // Atualizar empréstimo
    const [updateResult] = await connection.execute(`
      UPDATE emprestimos 
      SET data_vencimento = ?, 
          status = ?, 
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [novaData, novoStatus, emp.id]);
    
    console.log(`   ✅ Empréstimo atualizado! (${updateResult.affectedRows} linha afetada)`);
    
    // Atualizar cobranças relacionadas se existirem
    const [cobrancasUpdate] = await connection.execute(`
      UPDATE cobrancas 
      SET data_vencimento = ?, 
          status = 'Pendente',
          updated_at = CURRENT_TIMESTAMP
      WHERE emprestimo_id = ?
    `, [novaData, emp.id]);
    
    if (cobrancasUpdate.affectedRows > 0) {
      console.log(`   ✅ Cobranças atualizadas! (${cobrancasUpdate.affectedRows} linhas afetadas)`);
    }
    
    // Verificar resultado final
    console.log('\n🔍 VERIFICAÇÃO FINAL:');
    const [emprestimoAtualizado] = await connection.execute(`
      SELECT id, data_vencimento, status, updated_at 
      FROM emprestimos 
      WHERE id = ?
    `, [emp.id]);
    
    const resultado = emprestimoAtualizado[0];
    console.log('   Resultado no banco:');
    console.log(`      ID: ${resultado.id}`);
    console.log(`      Data: ${resultado.data_vencimento}`);
    console.log(`      Status: ${resultado.status}`);
    console.log(`      Atualizado em: ${resultado.updated_at}`);
    
    // Verificações
    if (resultado.data_vencimento === novaData) {
      console.log('   ✅ Data corrigida com sucesso!');
    } else {
      console.log('   ❌ Erro: Data não foi atualizada corretamente');
    }
    
    if (resultado.status === novoStatus) {
      console.log('   ✅ Status corrigido com sucesso!');
    } else {
      console.log('   ❌ Erro: Status não foi atualizado corretamente');
    }
    
    console.log('\n🎉 CORREÇÃO CONCLUÍDA!');
    console.log('💡 Agora recarregue a página no navegador (Ctrl+F5) para ver as alterações');
    
    await connection.end();
    
  } catch (error) {
    console.error('❌ Erro na correção:', error);
    if (connection) await connection.end();
    process.exit(1);
  }
}

// Executar correção
console.log('🚀 Iniciando correção imediata...');
correcaoImediataDede().catch(console.error); 