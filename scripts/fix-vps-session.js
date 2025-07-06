/**
 * Script para corrigir problemas de sessão em VPS
 */

const mysql = require('mysql2/promise');
require('dotenv').config();

async function fixVPSSession() {
  console.log('🔧 Corrigindo Problemas de Sessão na VPS...\n');
  
  try {
    // Passo 1: Verificar e criar banco de sessões
    console.log('1. Verificando banco de sessões...');
    const rootConnection = await mysql.createConnection({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD
    });
    
    // Criar banco de sessões se não existir
    await rootConnection.execute(`
      CREATE DATABASE IF NOT EXISTS \`jpsistemas_sessions\` 
      CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
    `);
    console.log('✅ Banco jpsistemas_sessions verificado/criado');
    
    await rootConnection.end();
    
    // Passo 2: Conectar ao banco de sessões
    const sessionConnection = await mysql.createConnection({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: 'jpsistemas_sessions'
    });
    
    // Passo 3: Criar tabela sessions se não existir
    console.log('\n2. Verificando tabela sessions...');
    await sessionConnection.execute(`
      CREATE TABLE IF NOT EXISTS sessions (
        session_id VARCHAR(128) NOT NULL PRIMARY KEY,
        expires INT UNSIGNED NOT NULL,
        data TEXT,
        INDEX idx_expires (expires)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('✅ Tabela sessions verificado/criada');
    
    // Passo 4: Limpar sessões antigas
    console.log('\n3. Limpando sessões expiradas...');
    const [deleteResult] = await sessionConnection.execute(
      'DELETE FROM sessions WHERE expires <= UNIX_TIMESTAMP()'
    );
    console.log(`✅ ${deleteResult.affectedRows} sessões expiradas removidas`);
    
    // Passo 5: Verificar configuração da tabela
    console.log('\n4. Verificando configuração da tabela...');
    const [columns] = await sessionConnection.execute('DESCRIBE sessions');
    console.log('Estrutura da tabela sessions:');
    columns.forEach(col => {
      console.log(`  - ${col.Field}: ${col.Type} ${col.Null === 'NO' ? 'NOT NULL' : 'NULL'}`);
    });
    
    // Passo 6: Verificar índices
    console.log('\n5. Verificando índices...');
    const [indexes] = await sessionConnection.execute('SHOW INDEX FROM sessions');
    console.log('Índices da tabela sessions:');
    indexes.forEach(index => {
      console.log(`  - ${index.Key_name}: ${index.Column_name}`);
    });
    
    // Passo 7: Testar inserção e leitura
    console.log('\n6. Testando operações de sessão...');
    const testSessionId = 'test_vps_session_' + Date.now();
    const testExpires = Math.floor(Date.now() / 1000) + 3600; // 1 hora
    const testData = JSON.stringify({ 
      user: 'test_vps', 
      timestamp: Date.now(),
      ip: '127.0.0.1'
    });
    
    // Inserir sessão de teste
    await sessionConnection.execute(
      'INSERT INTO sessions (session_id, expires, data) VALUES (?, ?, ?)',
      [testSessionId, testExpires, testData]
    );
    console.log('✅ Sessão de teste inserida');
    
    // Ler sessão de teste
    const [testSession] = await sessionConnection.execute(
      'SELECT * FROM sessions WHERE session_id = ?',
      [testSessionId]
    );
    
    if (testSession.length > 0) {
      console.log('✅ Sessão de teste lida com sucesso');
      const parsedData = JSON.parse(testSession[0].data);
      console.log(`   Dados: ${parsedData.user} - ${new Date(parsedData.timestamp).toLocaleString('pt-BR')}`);
    } else {
      console.log('❌ Erro ao ler sessão de teste');
    }
    
    // Remover sessão de teste
    await sessionConnection.execute('DELETE FROM sessions WHERE session_id = ?', [testSessionId]);
    console.log('✅ Sessão de teste removida');
    
    await sessionConnection.end();
    
    // Passo 8: Verificar variáveis de ambiente
    console.log('\n7. Verificando variáveis de ambiente...');
    const requiredEnvVars = ['DB_HOST', 'DB_USER', 'DB_PASSWORD', 'SESSION_SECRET'];
    const missingVars = [];
    
    requiredEnvVars.forEach(varName => {
      if (!process.env[varName]) {
        missingVars.push(varName);
      }
    });
    
    if (missingVars.length > 0) {
      console.log('⚠️  Variáveis de ambiente faltando:', missingVars.join(', '));
      console.log('   Adicione estas variáveis ao arquivo .env');
    } else {
      console.log('✅ Todas as variáveis de ambiente necessárias estão configuradas');
    }
    
    // Passo 9: Criar arquivo de configuração para VPS
    console.log('\n8. Criando configuração específica para VPS...');
    const vpsConfig = `
# Configuração de Sessão para VPS
# Adicione estas configurações ao seu arquivo .env

# Configurações de Banco
DB_HOST=${process.env.DB_HOST || 'localhost'}
DB_USER=${process.env.DB_USER || 'jpsistemas'}
DB_PASSWORD=${process.env.DB_PASSWORD || 'SuaSenhaForte123!'}

# Configurações de Sessão
SESSION_SECRET=${process.env.SESSION_SECRET || 'SeuSessionSecretMuitoForte123!'}

# Configurações de Produção
NODE_ENV=production
PORT=3000

# Configurações de Segurança
CORS_ORIGIN=*
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
`;
    
    console.log('📝 Configuração recomendada para VPS:');
    console.log(vpsConfig);
    
    console.log('\n🎉 Correção de sessão para VPS concluída!');
    console.log('\n📋 Próximos passos:');
    console.log('1. Reinicie o servidor: pm2 restart jp-sistemas');
    console.log('2. Teste o login em uma guia normal');
    console.log('3. Pressione F5 para verificar se a sessão persiste');
    console.log('4. Se ainda houver problemas, execute: node scripts/diagnose-session-issue.js');
    
  } catch (error) {
    console.error('❌ Erro ao corrigir sessão na VPS:', error.message);
    
    if (error.code === 'ER_ACCESS_DENIED_ERROR') {
      console.log('\n🔧 Solução: Erro de acesso ao banco!');
      console.log('1. Verifique as credenciais no arquivo .env');
      console.log('2. Confirme se o usuário tem permissões para criar bancos');
      console.log('3. Execute: mysql -u root -p');
      console.log('4. GRANT ALL PRIVILEGES ON jpsistemas_sessions.* TO \'jpsistemas\'@\'%\';');
    } else if (error.code === 'ECONNREFUSED') {
      console.log('\n🔧 Solução: Não foi possível conectar ao banco!');
      console.log('1. Verifique se o MariaDB está rodando: systemctl status mariadb');
      console.log('2. Inicie o MariaDB: systemctl start mariadb');
      console.log('3. Configure para iniciar automaticamente: systemctl enable mariadb');
    }
  }
}

// Executar correção
fixVPSSession(); 