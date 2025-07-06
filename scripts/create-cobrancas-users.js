const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');

async function createCobrancasUsersTable() {
  try {
    console.log('Criando tabela de usuários de cobranças...');
    
    // Conectar ao banco de usuários
    const connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'jpsistemas',
      password: process.env.DB_PASSWORD || 'Juliano@95',
      database: 'jpsistemas_users',
      charset: 'utf8mb4'
    });

    // Criar tabela de usuários de cobranças
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS usuarios_cobrancas (
        id INT AUTO_INCREMENT PRIMARY KEY,
        username VARCHAR(50) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        db_name VARCHAR(100) DEFAULT 'jpsistemas_cobrancas',
        email VARCHAR(255),
        nome_completo VARCHAR(255),
        role VARCHAR(50) DEFAULT 'admin',
        status VARCHAR(50) DEFAULT 'ativo',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_username (username),
        INDEX idx_status (status)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    console.log('✅ Tabela usuarios_cobrancas criada com sucesso!');

    // Verificar se já existe um usuário admin
    const [existingUsers] = await connection.execute(
      'SELECT COUNT(*) as count FROM usuarios_cobrancas WHERE username = ?',
      ['admin']
    );

    if (existingUsers[0].count === 0) {
      // Criar usuário admin padrão
      const password = 'admin123';
      const passwordHash = await bcrypt.hash(password, 10);
      
      await connection.execute(`
        INSERT INTO usuarios_cobrancas (username, password_hash, nome_completo, email, role)
        VALUES (?, ?, ?, ?, ?)
      `, ['admin', passwordHash, 'Administrador', 'admin@jpsistemas.com', 'admin']);

      console.log('✅ Usuário admin criado com sucesso!');
      console.log('📋 Credenciais de acesso:');
      console.log('   Usuário: admin');
      console.log('   Senha: admin123');
    } else {
      console.log('ℹ️  Usuário admin já existe');
    }

    await connection.end();
    console.log('✅ Script executado com sucesso!');

  } catch (error) {
    console.error('❌ Erro ao criar tabela de usuários:', error.message);
    
    if (error.code === 'ER_BAD_DB_ERROR') {
      console.log('💡 Dica: O banco jpsistemas_users não existe. Criando...');
      
      // Criar o banco de dados primeiro
      const rootConnection = await mysql.createConnection({
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER || 'jpsistemas',
        password: process.env.DB_PASSWORD || 'Juliano@95',
        charset: 'utf8mb4'
      });

      await rootConnection.execute('CREATE DATABASE IF NOT EXISTS `jpsistemas_users` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci');
      await rootConnection.end();
      
      console.log('✅ Banco jpsistemas_users criado. Execute o script novamente.');
    }
  }
}

createCobrancasUsersTable(); 