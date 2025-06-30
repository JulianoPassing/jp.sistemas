/**
 * Script de Inicialização de Banco de Dados para Vercel
 * Cria os bancos principais necessários para o sistema multi-tenancy
 */

const mysql = require('mysql2/promise');
const { 
  getSessionConfig, 
  getUsersConfig, 
  getRootConfig 
} = require('../database-config');

async function initializeVercelDatabase() {
  console.log('🚀 Inicializando bancos de dados para Vercel...');
  
  try {
    // Obter configuração do provedor
    const provider = process.env.DATABASE_PROVIDER || 'local';
    console.log(`📊 Usando provedor: ${provider}`);
    
    // Conectar como root para criar os bancos principais
    const rootConfig = getRootConfig();
    console.log('🔗 Conectando ao servidor de banco de dados...');
    
    const rootConnection = await mysql.createConnection(rootConfig);
    console.log('✅ Conexão estabelecida com sucesso!');
    
    // Criar banco de usuários
    console.log('👥 Criando banco de usuários...');
    await rootConnection.execute(`
      CREATE DATABASE IF NOT EXISTS \`jpsistemas_users\` 
      CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
    `);
    console.log('✅ Banco de usuários criado/verificado');
    
    // Criar banco de sessões
    console.log('🔐 Criando banco de sessões...');
    await rootConnection.execute(`
      CREATE DATABASE IF NOT EXISTS \`jpsistemas_sessions\` 
      CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
    `);
    console.log('✅ Banco de sessões criado/verificado');
    
    await rootConnection.end();
    
    // Conectar ao banco de usuários para criar tabelas
    console.log('📋 Criando tabela de usuários...');
    const usersConfig = getUsersConfig();
    const usersConnection = await mysql.createConnection(usersConfig);
    
    // Criar tabela de usuários
    await usersConnection.execute(`
      CREATE TABLE IF NOT EXISTS users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        username VARCHAR(50) UNIQUE NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        is_admin BOOLEAN DEFAULT FALSE,
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_username (username),
        INDEX idx_email (email),
        INDEX idx_is_active (is_active)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('✅ Tabela de usuários criada/verificada');
    
    // Verificar se existe usuário admin padrão
    const [existingUsers] = await usersConnection.execute(
      'SELECT COUNT(*) as count FROM users WHERE username = ?',
      ['admin']
    );
    
    if (existingUsers[0].count === 0) {
      console.log('👤 Criando usuário administrador padrão...');
      const bcrypt = require('bcryptjs');
      const hashedPassword = await bcrypt.hash('admin123', 12);
      
      await usersConnection.execute(`
        INSERT INTO users (username, email, password, is_admin, is_active) 
        VALUES (?, ?, ?, TRUE, TRUE)
      `, ['admin', 'admin@jpsistemas.com', hashedPassword]);
      
      console.log('✅ Usuário administrador criado:');
      console.log('   Usuário: admin');
      console.log('   Senha: admin123');
      console.log('   ⚠️  IMPORTANTE: Altere a senha após o primeiro login!');
    } else {
      console.log('ℹ️  Usuário administrador já existe');
    }
    
    await usersConnection.end();
    
    // Conectar ao banco de sessões para verificar tabela
    console.log('🔐 Verificando tabela de sessões...');
    const sessionConfig = getSessionConfig();
    const sessionConnection = await mysql.createConnection(sessionConfig);
    
    // A tabela de sessões será criada automaticamente pelo express-mysql-session
    await sessionConnection.execute('SELECT 1');
    console.log('✅ Banco de sessões verificado');
    
    await sessionConnection.end();
    
    console.log('\n🎉 Inicialização concluída com sucesso!');
    console.log('\n📊 Bancos criados:');
    console.log('   - jpsistemas_users (usuários e autenticação)');
    console.log('   - jpsistemas_sessions (sessões ativas)');
    console.log('\n🔑 Credenciais de acesso:');
    console.log('   Usuário: admin');
    console.log('   Senha: admin123');
    console.log('\n⚠️  LEMBRE-SE: Altere a senha do administrador após o primeiro login!');
    
  } catch (error) {
    console.error('❌ Erro durante a inicialização:', error);
    console.error('\n🔧 Possíveis soluções:');
    console.error('   1. Verifique as variáveis de ambiente');
    console.error('   2. Confirme se o provedor de banco está acessível');
    console.error('   3. Verifique se as credenciais estão corretas');
    console.error('   4. Para PlanetScale, certifique-se de que o SSL está configurado');
    
    process.exit(1);
  }
}

// Executar se chamado diretamente
if (require.main === module) {
  initializeVercelDatabase();
}

module.exports = { initializeVercelDatabase }; 