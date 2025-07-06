const mysql = require('mysql2/promise');
const { getCobrancasDatabaseConfig } = require('./database-config');
require('dotenv').config();

async function testDatabaseConnection() {
  console.log('🔍 Testando conexão com banco de dados...\n');
  
  try {
    // Testar configuração
    const config = getCobrancasDatabaseConfig();
    console.log('📋 Configuração do banco:');
    console.log('- Host:', config.host);
    console.log('- User:', config.user);
    console.log('- Database:', config.database);
    console.log('- Port:', config.port);
    console.log('- SSL:', config.ssl ? 'Sim' : 'Não');
    
    // Testar conexão
    console.log('\n🔌 Testando conexão...');
    const connection = await mysql.createConnection(config);
    console.log('✅ Conexão estabelecida com sucesso!');
    
    // Testar query simples
    console.log('\n📊 Testando query...');
    const [rows] = await connection.execute('SELECT 1 as test');
    console.log('✅ Query executada com sucesso:', rows);
    
    // Verificar se as tabelas existem
    console.log('\n📋 Verificando tabelas...');
    const [tables] = await connection.execute(`
      SELECT TABLE_NAME 
      FROM INFORMATION_SCHEMA.TABLES 
      WHERE TABLE_SCHEMA = ? 
      AND TABLE_NAME LIKE '%cobrancas%'
    `, [config.database]);
    
    console.log('Tabelas encontradas:');
    tables.forEach(table => {
      console.log('-', table.TABLE_NAME);
    });
    
    // Verificar clientes
    if (tables.some(t => t.TABLE_NAME === 'clientes_cobrancas')) {
      console.log('\n👥 Verificando clientes...');
      const [clientes] = await connection.execute('SELECT COUNT(*) as total FROM clientes_cobrancas');
      console.log('Total de clientes:', clientes[0].total);
      
      if (clientes[0].total > 0) {
        const [sampleClientes] = await connection.execute('SELECT * FROM clientes_cobrancas LIMIT 3');
        console.log('Exemplo de clientes:');
        sampleClientes.forEach(cliente => {
          console.log('-', cliente.nome, '|', cliente.cpf_cnpj, '|', cliente.telefone);
        });
      }
    }
    
    await connection.end();
    console.log('\n🎉 Todos os testes passaram!');
    
  } catch (error) {
    console.error('❌ Erro no teste:', error.message);
    console.error('Stack:', error.stack);
  }
}

testDatabaseConnection(); 