const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');

console.log('🔧 Testando Dashboard na VPS...');

async function main() {
  let connection;
  
  try {
    // Conectar ao banco usando a configuração do database-config.js
    const dbConfig = require('../database-config.js');
    connection = await mysql.createConnection(dbConfig);
    
    console.log('✅ Conectado ao banco!');
    
    // Verificar se existem empréstimos
    const [emprestimos] = await connection.execute(`
      SELECT 
        id,
        COALESCE(valor_inicial, valor, 0) as valor,
        status,
        cliente_id,
        created_at
      FROM emprestimos
      LIMIT 10
    `);
    
    console.log('\n📊 Empréstimos encontrados:', emprestimos.length);
    
    if (emprestimos.length > 0) {
      console.log('\n🔍 Primeiros empréstimos:');
      emprestimos.forEach((emp, index) => {
        console.log(`${index + 1}. ID: ${emp.id}, Valor: R$ ${emp.valor}, Status: "${emp.status}", Cliente: ${emp.cliente_id}`);
      });
    }
    
    // Testar a query simplificada
    const [stats] = await connection.execute(`
      SELECT 
        COUNT(*) as total_emprestimos,
        COALESCE(SUM(COALESCE(valor_inicial, valor, 0)), 0) as valor_total_emprestimos,
        COUNT(*) as emprestimos_ativos,
        0 as emprestimos_quitados
      FROM emprestimos
      WHERE (valor_inicial > 0 OR valor > 0)
    `);
    
    console.log('\n📈 Estatísticas do Dashboard:');
    console.log(`Total Empréstimos: ${stats[0].total_emprestimos}`);
    console.log(`Valor Total: R$ ${stats[0].valor_total_emprestimos}`);
    console.log(`Empréstimos Ativos: ${stats[0].emprestimos_ativos}`);
    
    console.log('\n✅ Teste concluído!');
    console.log('💡 Se os valores ainda estiverem zerados, reinicie o servidor:');
    console.log('   pm2 restart ecosystem.config.js');
    
  } catch (error) {
    console.error('❌ Erro:', error.message);
    console.log('\n🔧 Tentando solução alternativa...');
    
    // Tentar com credenciais padrão
    try {
      connection = await mysql.createConnection({
        host: 'localhost',
        user: 'root',
        password: 'senha123',
        database: 'jp_cobrancas'
      });
      
      console.log('✅ Conectado com credenciais padrão!');
      
      const [emprestimos] = await connection.execute('SELECT COUNT(*) as total FROM emprestimos');
      console.log('Total empréstimos:', emprestimos[0].total);
      
    } catch (error2) {
      console.error('❌ Erro na conexão alternativa:', error2.message);
    }
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

main().catch(console.error); 