const mysql = require('mysql2/promise');

console.log('🔧 Testando Dashboard do Usuário COBRANCA...');

async function testCobrancaDatabase() {
  let connection;
  
  try {
    // Conectar ao banco do usuário "cobranca"
    const dbConfig = {
      host: 'localhost',
      user: 'jpcobrancas',
      password: 'Juliano@95',
      database: 'jpcobrancas_cobranca',
      charset: 'utf8mb4'
    };
    
    console.log('🔍 Conectando ao banco:', dbConfig.database);
    
    connection = await mysql.createConnection(dbConfig);
    console.log('✅ Conectado ao banco do usuário cobranca!');
    
    // Verificar empréstimos
    const [emprestimos] = await connection.execute(`
      SELECT 
        id,
        valor,
        status,
        cliente_id,
        data_emprestimo,
        data_vencimento
      FROM emprestimos
      ORDER BY id DESC
    `);
    
    console.log('\n📊 Empréstimos do usuário cobranca:', emprestimos.length);
    
    if (emprestimos.length > 0) {
      console.log('\n🔍 Lista dos empréstimos:');
      emprestimos.forEach((emp, index) => {
        console.log(`${index + 1}. ID: ${emp.id}, Valor: R$ ${emp.valor}, Status: "${emp.status}", Cliente: ${emp.cliente_id}`);
      });
    }
    
    // Calcular estatísticas
    const [stats] = await connection.execute(`
      SELECT 
        COUNT(*) as total_emprestimos,
        COALESCE(SUM(valor), 0) as valor_total_emprestimos,
        COUNT(*) as emprestimos_ativos
      FROM emprestimos
      WHERE valor > 0
    `);
    
    console.log('\n📈 Estatísticas do Dashboard:');
    console.log(`Total Empréstimos: ${stats[0].total_emprestimos}`);
    console.log(`Valor Total: R$ ${stats[0].valor_total_emprestimos}`);
    console.log(`Empréstimos Ativos: ${stats[0].emprestimos_ativos}`);
    
    // Verificar clientes
    const [clientes] = await connection.execute(`
      SELECT COUNT(*) as total_clientes 
      FROM clientes_cobrancas
    `);
    
    console.log(`Total Clientes: ${clientes[0].total_clientes}`);
    
    console.log('\n✅ Teste concluído para o usuário cobranca!');
    console.log('💡 Agora reinicie o servidor: pm2 restart ecosystem.config.js');
    
  } catch (error) {
    console.error('❌ Erro:', error.message);
    
    // Tentar com senha alternativa
    try {
      const dbConfigAlt = {
        host: 'localhost',
        user: 'jpcobrancas',
        password: 'Juliano@95!',
        database: 'jpcobrancas_cobranca',
        charset: 'utf8mb4'
      };
      
      console.log('\n🔄 Tentando com senha alternativa...');
      connection = await mysql.createConnection(dbConfigAlt);
      
      const [emprestimos] = await connection.execute('SELECT COUNT(*) as total FROM emprestimos');
      console.log('✅ Conectado! Total empréstimos:', emprestimos[0].total);
      
    } catch (error2) {
      console.error('❌ Erro com senha alternativa:', error2.message);
    }
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

testCobrancaDatabase().catch(console.error); 