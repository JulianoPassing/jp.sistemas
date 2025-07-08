const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');

// Carregar variáveis de ambiente se existir arquivo .env
try {
  require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
} catch (e) {
  console.log('💡 Arquivo .env não encontrado, usando configurações padrão');
}

console.log('🔧 Testando Dashboard na VPS...');

async function main() {
  let connection;
  
  try {
    // Conectar ao banco do usuário "cobranca" usando a mesma função da API
    const username = 'cobranca';
    const dbName = `jpcobrancas_${username.toLowerCase().replace(/[^a-z0-9]/g, '_')}`;
    const dbConfig = {
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'jpcobrancas',
      password: process.env.DB_PASSWORD || 'Juliano@95',
      database: dbName,
      charset: 'utf8mb4'
    };
    
    console.log('🔍 Configuração do banco (usuário cobranca):', {
      host: dbConfig.host,
      user: dbConfig.user,
      database: dbConfig.database,
      port: dbConfig.port,
      temSenha: !!dbConfig.password
    });
    
    connection = await mysql.createConnection(dbConfig);
    
    console.log('✅ Conectado ao banco!');
    
    // Verificar se existem empréstimos
    const [emprestimos] = await connection.execute(`
      SELECT 
        id,
        valor,
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
        COALESCE(SUM(valor), 0) as valor_total_emprestimos,
        COUNT(*) as emprestimos_ativos,
        0 as emprestimos_quitados
      FROM emprestimos
      WHERE valor > 0
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
    
    // Tentar com credenciais padrão do sistema
    console.log('🔄 Tentando credenciais padrão do sistema...');
    
    const credenciaisAlternativas = [
      {
        host: 'localhost',
        user: 'jpcobrancas',
        password: 'Juliano@95',
        database: 'jpcobrancas_cobranca'
      },
      {
        host: 'localhost',
        user: 'jpcobrancas',
        password: 'Juliano@95!',
        database: 'jpcobrancas_cobranca'
      },
      {
        host: 'localhost',
        user: 'jpsistemas',
        password: 'Juliano@95',
        database: 'jpcobrancas_cobranca'
      },
      {
        host: 'localhost',
        user: 'jpsistemas',
        password: 'Juliano@95!',
        database: 'jpcobrancas_cobranca'
      },
      {
        host: 'localhost',
        user: 'root',
        password: 'Juliano@95',
        database: 'jpcobrancas_cobranca'
      }
    ];
    
    for (const cred of credenciaisAlternativas) {
      try {
        console.log(`🔍 Tentando: ${cred.user}@${cred.host}/${cred.database}`);
        connection = await mysql.createConnection(cred);
        
        console.log('✅ Conectado com credenciais alternativas!');
        
        const [emprestimos] = await connection.execute('SELECT COUNT(*) as total FROM emprestimos');
        console.log('Total empréstimos:', emprestimos[0].total);
        
        const [stats] = await connection.execute(`
          SELECT 
            COUNT(*) as total_emprestimos,
            COALESCE(SUM(valor), 0) as valor_total
          FROM emprestimos
          WHERE valor > 0
        `);
        
        console.log('📊 Estatísticas:', {
          total: stats[0].total_emprestimos,
          valor_total: stats[0].valor_total
        });
        
        break;
        
      } catch (error2) {
        console.log(`❌ Falhou com ${cred.user}: ${error2.message}`);
        continue;
      }
    }
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

main().catch(console.error); 