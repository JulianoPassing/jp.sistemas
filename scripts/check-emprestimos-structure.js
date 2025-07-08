const mysql = require('mysql2/promise');

console.log('🔍 Verificando estrutura da tabela empréstimos...');

async function checkEmprestimosStructure() {
  let connection;
  
  try {
    // Conectar ao banco do usuário cobranca
    const dbConfig = {
      host: 'localhost',
      user: 'jpsistemas',
      password: 'Juliano@95',
      database: 'jpcobrancas_cobranca',
      charset: 'utf8mb4'
    };
    
    connection = await mysql.createConnection(dbConfig);
    console.log('✅ Conectado ao banco jpcobrancas_cobranca');
    
    // Verificar estrutura da tabela
    const [columns] = await connection.execute('DESCRIBE emprestimos');
    
    console.log('\n📊 Estrutura da tabela empréstimos:');
    columns.forEach(col => {
      console.log(`  - ${col.Field} (${col.Type}) ${col.Null === 'YES' ? 'NULL' : 'NOT NULL'}`);
    });
    
    // Verificar dados atuais
    const [emprestimos] = await connection.execute(`
      SELECT 
        id,
        valor,
        data_emprestimo,
        data_vencimento,
        status,
        tipo_emprestimo,
        numero_parcelas,
        valor_parcela,
        cliente_id
      FROM emprestimos
      ORDER BY id DESC
    `);
    
    console.log('\n💰 Dados atuais dos empréstimos:');
    emprestimos.forEach(emp => {
      console.log(`  ID ${emp.id}:`);
      console.log(`    Valor: R$ ${emp.valor}`);
      console.log(`    Status: ${emp.status}`);
      console.log(`    Tipo: ${emp.tipo_emprestimo}`);
      console.log(`    Parcelas: ${emp.numero_parcelas}`);
      console.log(`    Valor Parcela: R$ ${emp.valor_parcela}`);
      console.log(`    Data Empréstimo: ${emp.data_emprestimo}`);
      console.log(`    Data Vencimento: ${emp.data_vencimento}`);
      console.log(`    Cliente: ${emp.cliente_id}`);
      console.log('    ---');
    });
    
    // Verificar se tem parcelas
    try {
      const [parcelas] = await connection.execute(`
        SELECT COUNT(*) as total_parcelas
        FROM parcelas
      `);
      console.log(`\n📋 Total de parcelas: ${parcelas[0].total_parcelas}`);
      
      if (parcelas[0].total_parcelas > 0) {
        const [parcelasDetalhes] = await connection.execute(`
          SELECT 
            emprestimo_id,
            COUNT(*) as num_parcelas,
            SUM(valor_parcela) as valor_total_parcelas
          FROM parcelas
          GROUP BY emprestimo_id
        `);
        
        console.log('\n💳 Resumo das parcelas por empréstimo:');
        parcelasDetalhes.forEach(p => {
          console.log(`  Empréstimo ${p.emprestimo_id}: ${p.num_parcelas} parcelas = R$ ${p.valor_total_parcelas}`);
        });
      }
    } catch (error) {
      console.log('❌ Erro ao verificar parcelas:', error.message);
    }
    
    console.log('\n🎯 Resumo para o dashboard:');
    console.log('Para mostrar o valor inicial dos empréstimos, vou usar a coluna "valor"');
    console.log('que representa o valor inicial do empréstimo.');
    
  } catch (error) {
    console.error('❌ Erro:', error.message);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

checkEmprestimosStructure().catch(console.error); 