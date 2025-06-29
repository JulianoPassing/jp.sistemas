const mysql = require('mysql2/promise');
require('dotenv').config();

async function initializeDatabase() {
  console.log('Inicializando banco de dados do sistema J.P Sistemas (MariaDB)...');
  
  try {
    // Conectar ao MariaDB
    const connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'jpsistemas',
      password: process.env.DB_PASSWORD || 'SuaSenhaForte123!',
      charset: 'utf8mb4'
    });

    console.log('Conectado ao MariaDB com sucesso');

    // Criar bancos de dados principais
    await connection.execute('CREATE DATABASE IF NOT EXISTS jpsistemas_users CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci');
    await connection.execute('CREATE DATABASE IF NOT EXISTS jpsistemas_sessions CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci');
    
    console.log('Bancos de dados principais criados');

    // Usar banco de usuários
    await connection.execute('USE jpsistemas_users');

    // Criar tabela de usuários
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        username VARCHAR(50) UNIQUE NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        is_active BOOLEAN DEFAULT TRUE,
        is_admin BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_username (username),
        INDEX idx_email (email),
        INDEX idx_is_active (is_active)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    // Usar banco de sessões
    await connection.execute('USE jpsistemas_sessions');

    // Criar tabela de sessões
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS sessions (
        session_id VARCHAR(128) NOT NULL PRIMARY KEY,
        expires INT UNSIGNED NOT NULL,
        data TEXT,
        INDEX idx_expires (expires)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    // Criar usuário administrador padrão se não existir
    await connection.execute('USE jpsistemas_users');
    
    const bcrypt = require('bcryptjs');
    const adminPassword = await bcrypt.hash('admin123', 12);
    
    await connection.execute(`
      INSERT IGNORE INTO users (username, email, password, is_admin) 
      VALUES ('admin', 'admin@jpsistemas.com', ?, TRUE)
    `, [adminPassword]);

    console.log('Usuário administrador criado: admin / admin123');

    await connection.end();
    
    console.log('✅ Inicialização do banco de dados concluída com sucesso!');
    console.log('');
    console.log('📋 Informações importantes:');
    console.log('   - Usuário admin: admin');
    console.log('   - Senha admin: admin123');
    console.log('   - Email admin: admin@jpsistemas.com');
    console.log('   - Banco de dados: MariaDB');
    console.log('   - Charset: utf8mb4');
    console.log('');
    console.log('⚠️  IMPORTANTE: Altere a senha do administrador após o primeiro login!');
    
  } catch (error) {
    console.error('❌ Erro ao inicializar banco de dados:', error);
    process.exit(1);
  }
}

// Executar se chamado diretamente
if (require.main === module) {
  initializeDatabase();
}

module.exports = { initializeDatabase }; 