const mysql = require('mysql2/promise');
const { getCobrancasDatabaseConfig } = require('./database-config');

async function testDatabaseConnection() {
  try {
    console.log('Testando conexão com o banco de dados...');
    
    const config = getCobrancasDatabaseConfig();
    console.log('Configuração do banco:', {
      host: config.host,
      user: config.user,
      database: config.database,
      port: config.port
    });
    
    const connection = await mysql.createConnection(config);
    console.log('✅ Conexão com banco de dados estabelecida com sucesso!');
    
    // Testar uma query simples
    const [rows] = await connection.execute('SELECT 1 as test');
    console.log('✅ Query de teste executada com sucesso:', rows);
    
    await connection.end();
    console.log('✅ Conexão fechada com sucesso!');
    
  } catch (error) {
    console.error('❌ Erro na conexão com banco de dados:', error.message);
    console.error('Detalhes do erro:', error);
  }
}

testDatabaseConnection(); 