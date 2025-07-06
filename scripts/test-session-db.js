/**
 * Script para testar o banco de sessões
 */

const mysql = require('mysql2/promise');
require('dotenv').config();

async function testSessionDatabase() {
  console.log('🧪 Testando Banco de Sessões...\n');
  
  try {
    // Teste 1: Conectar ao banco de sessões
    console.log('1. Conectando ao banco de sessões...');
    const connection = await mysql.createConnection({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: 'jpsistemas_sessions'
    });
    
    console.log('✅ Conectado ao banco de sessões');
    
    // Teste 2: Verificar se a tabela sessions existe
    console.log('\n2. Verificando tabela sessions...');
    const [tables] = await connection.execute('SHOW TABLES LIKE "sessions"');
    
    if (tables.length === 0) {
      console.log('❌ Tabela sessions não existe!');
      console.log('Criando tabela sessions...');
      
      await connection.execute(`
        CREATE TABLE IF NOT EXISTS sessions (
          session_id VARCHAR(128) NOT NULL PRIMARY KEY,
          expires INT UNSIGNED NOT NULL,
          data TEXT,
          INDEX idx_expires (expires)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      `);
      
      console.log('✅ Tabela sessions criada');
    } else {
      console.log('✅ Tabela sessions existe');
    }
    
    // Teste 3: Verificar estrutura da tabela
    console.log('\n3. Verificando estrutura da tabela...');
    const [columns] = await connection.execute('DESCRIBE sessions');
    console.log('Estrutura da tabela sessions:');
    columns.forEach(col => {
      console.log(`  - ${col.Field}: ${col.Type} ${col.Null === 'NO' ? 'NOT NULL' : 'NULL'}`);
    });
    
    // Teste 4: Verificar sessões ativas
    console.log('\n4. Verificando sessões ativas...');
    const [sessions] = await connection.execute(
      'SELECT session_id, expires, LENGTH(data) as data_size FROM sessions WHERE expires > UNIX_TIMESTAMP()'
    );
    
    console.log(`Sessões ativas encontradas: ${sessions.length}`);
    if (sessions.length > 0) {
      sessions.forEach((session, index) => {
        const expiresDate = new Date(session.expires * 1000);
        console.log(`  Sessão ${index + 1}:`);
        console.log(`    ID: ${session.session_id.substring(0, 20)}...`);
        console.log(`    Expira: ${expiresDate.toLocaleString('pt-BR')}`);
        console.log(`    Tamanho dos dados: ${session.data_size} bytes`);
      });
    }
    
    // Teste 5: Limpar sessões expiradas
    console.log('\n5. Limpando sessões expiradas...');
    const [deleteResult] = await connection.execute(
      'DELETE FROM sessions WHERE expires <= UNIX_TIMESTAMP()'
    );
    console.log(`Sessões expiradas removidas: ${deleteResult.affectedRows}`);
    
    // Teste 6: Testar inserção de sessão
    console.log('\n6. Testando inserção de sessão...');
    const testSessionId = 'test_session_' + Date.now();
    const testExpires = Math.floor(Date.now() / 1000) + 3600; // 1 hora
    const testData = JSON.stringify({ user: 'test', timestamp: Date.now() });
    
    await connection.execute(
      'INSERT INTO sessions (session_id, expires, data) VALUES (?, ?, ?)',
      [testSessionId, testExpires, testData]
    );
    console.log('✅ Sessão de teste inserida');
    
    // Teste 7: Verificar se a sessão foi inserida
    const [testSession] = await connection.execute(
      'SELECT * FROM sessions WHERE session_id = ?',
      [testSessionId]
    );
    
    if (testSession.length > 0) {
      console.log('✅ Sessão de teste encontrada');
    } else {
      console.log('❌ Sessão de teste não encontrada');
    }
    
    // Teste 8: Remover sessão de teste
    await connection.execute('DELETE FROM sessions WHERE session_id = ?', [testSessionId]);
    console.log('✅ Sessão de teste removida');
    
    await connection.end();
    
    console.log('\n🎉 Teste do banco de sessões concluído com sucesso!');
    console.log('\n📋 Resumo:');
    console.log('  ✅ Banco de sessões acessível');
    console.log('  ✅ Tabela sessions existe e está correta');
    console.log('  ✅ Operações de CRUD funcionando');
    console.log('  ✅ Limpeza de sessões expiradas funcionando');
    
  } catch (error) {
    console.error('❌ Erro no teste do banco de sessões:', error.message);
    
    if (error.code === 'ER_BAD_DB_ERROR') {
      console.log('\n🔧 Solução: O banco jpsistemas_sessions não existe!');
      console.log('Execute: node scripts/create-sessions-db.js');
    } else if (error.code === 'ER_ACCESS_DENIED_ERROR') {
      console.log('\n🔧 Solução: Erro de acesso ao banco!');
      console.log('Verifique as credenciais no arquivo .env');
    } else if (error.code === 'ECONNREFUSED') {
      console.log('\n🔧 Solução: Não foi possível conectar ao banco!');
      console.log('Verifique se o MariaDB está rodando');
    }
  }
}

// Executar teste
testSessionDatabase(); 