/**
 * Script para Criar Novo Usuário no Sistema JP Cobranças
 * Cria usuário, banco de dados e todas as tabelas necessárias
 */

const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
require('dotenv').config();

// Configuração do banco de dados
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'jpsistemas',
  password: process.env.DB_PASSWORD || 'Juliano@95',
  port: process.env.DB_PORT || 3306,
  charset: 'utf8mb4'
};

// Função para criar banco de dados do usuário
async function createUserDatabase(username) {
  const dbName = `jpcobrancas_${username.toLowerCase().replace(/[^a-z0-9]/g, '_')}`;
  
  try {
    console.log(`📦 Criando banco de dados: ${dbName}`);
    
    // Conectar como root para criar o banco
    const rootConnection = await mysql.createConnection(dbConfig);
    
    // Criar banco de dados
    await rootConnection.execute(`CREATE DATABASE IF NOT EXISTS \`${dbName}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
    console.log(`✅ Banco de dados ${dbName} criado com sucesso`);
    
    // Conectar ao banco criado
    const userConnection = await mysql.createConnection({
      ...dbConfig,
      database: dbName
    });

    console.log(`📋 Criando tabelas no banco ${dbName}...`);

    // Tabela de clientes
    await userConnection.execute(`
      CREATE TABLE IF NOT EXISTS clientes_cobrancas (
        id INT AUTO_INCREMENT PRIMARY KEY,
        nome VARCHAR(255) NOT NULL,
        cpf_cnpj VARCHAR(18),
        email VARCHAR(255),
        telefone VARCHAR(20),
        endereco VARCHAR(255),
        cidade VARCHAR(100),
        estado VARCHAR(2),
        cep VARCHAR(9),
        status VARCHAR(50) DEFAULT 'Ativo',
        observacoes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_nome (nome),
        INDEX idx_cpf_cnpj (cpf_cnpj),
        INDEX idx_email (email),
        INDEX idx_status (status)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('✅ Tabela clientes_cobrancas criada');

    // Tabela de empréstimos
    await userConnection.execute(`
      CREATE TABLE IF NOT EXISTS emprestimos (
        id INT AUTO_INCREMENT PRIMARY KEY,
        cliente_id INT,
        valor DECIMAL(10,2) NOT NULL,
        data_emprestimo DATE NOT NULL,
        data_vencimento DATE NOT NULL,
        juros_mensal DECIMAL(5,2) DEFAULT 0.00,
        multa_atraso DECIMAL(5,2) DEFAULT 0.00,
        status VARCHAR(50) DEFAULT 'Ativo',
        observacoes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (cliente_id) REFERENCES clientes_cobrancas(id) ON DELETE SET NULL,
        INDEX idx_cliente_id (cliente_id),
        INDEX idx_data_vencimento (data_vencimento),
        INDEX idx_status (status)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('✅ Tabela emprestimos criada');

    // Tabela de cobranças
    await userConnection.execute(`
      CREATE TABLE IF NOT EXISTS cobrancas (
        id INT AUTO_INCREMENT PRIMARY KEY,
        emprestimo_id INT,
        cliente_id INT,
        valor_original DECIMAL(10,2) NOT NULL,
        valor_atualizado DECIMAL(10,2) NOT NULL,
        juros_calculados DECIMAL(10,2) DEFAULT 0.00,
        multa_calculada DECIMAL(10,2) DEFAULT 0.00,
        data_vencimento DATE NOT NULL,
        dias_atraso INT DEFAULT 0,
        status VARCHAR(50) DEFAULT 'Pendente',
        data_cobranca DATE,
        observacoes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (emprestimo_id) REFERENCES emprestimos(id) ON DELETE SET NULL,
        FOREIGN KEY (cliente_id) REFERENCES clientes_cobrancas(id) ON DELETE SET NULL,
        INDEX idx_emprestimo_id (emprestimo_id),
        INDEX idx_cliente_id (cliente_id),
        INDEX idx_data_vencimento (data_vencimento),
        INDEX idx_status (status),
        INDEX idx_dias_atraso (dias_atraso)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('✅ Tabela cobrancas criada');

    // Tabela de pagamentos
    await userConnection.execute(`
      CREATE TABLE IF NOT EXISTS pagamentos (
        id INT AUTO_INCREMENT PRIMARY KEY,
        cobranca_id INT,
        valor_pago DECIMAL(10,2) NOT NULL,
        data_pagamento DATE NOT NULL,
        forma_pagamento VARCHAR(50),
        observacoes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (cobranca_id) REFERENCES cobrancas(id) ON DELETE SET NULL,
        INDEX idx_cobranca_id (cobranca_id),
        INDEX idx_data_pagamento (data_pagamento)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('✅ Tabela pagamentos criada');

    // Tabela de usuários (para o banco específico)
    await userConnection.execute(`
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
    console.log('✅ Tabela users criada');

    // Tabela de sessões
    await userConnection.execute(`
      CREATE TABLE IF NOT EXISTS sessions (
        session_id VARCHAR(128) NOT NULL PRIMARY KEY,
        expires INT UNSIGNED NOT NULL,
        data TEXT,
        INDEX idx_expires (expires)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('✅ Tabela sessions criada');

    await rootConnection.end();
    await userConnection.end();
    
    console.log(`✅ Banco de dados ${dbName} e todas as tabelas criadas com sucesso`);
    return dbName;
  } catch (error) {
    console.error(`❌ Erro ao criar banco de dados para ${username}:`, error);
    throw error;
  }
}

// Função para criar usuário no banco de usuários
async function createUser(username, email, password, isAdmin = false) {
  try {
    console.log(`👤 Criando usuário: ${username}`);
    
    // Conectar ao banco de usuários
    const usersConnection = await mysql.createConnection({
      ...dbConfig,
      database: 'jpsistemas_users'
    });

    // Verificar se usuário já existe
    const [existingUsers] = await usersConnection.execute(
      'SELECT id FROM usuarios_cobrancas WHERE username = ?',
      [username]
    );

    if (existingUsers.length > 0) {
      await usersConnection.end();
      throw new Error('Usuário já existe no sistema');
    }

    // Criptografar senha
    const hashedPassword = await bcrypt.hash(password, 12);

    // Nome do banco de dados do usuário
    const dbName = `jpcobrancas_${username.toLowerCase().replace(/[^a-z0-9]/g, '_')}`;

    // Inserir usuário
    await usersConnection.execute(`
      INSERT INTO usuarios_cobrancas (username, password_hash, db_name) 
      VALUES (?, ?, ?)
    `, [username, hashedPassword, dbName]);

    await usersConnection.end();
    
    console.log(`✅ Usuário ${username} criado com sucesso`);
    return true;
  } catch (error) {
    console.error(`❌ Erro ao criar usuário ${username}:`, error);
    throw error;
  }
}

// Função para garantir que o banco de usuários existe
async function ensureUsersDatabase() {
  try {
    console.log('🔍 Verificando banco de usuários...');
    
    const rootConnection = await mysql.createConnection(dbConfig);
    
    // Criar banco de usuários se não existir
    await rootConnection.execute(`CREATE DATABASE IF NOT EXISTS jpsistemas_users CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
    
    // Conectar ao banco de usuários
    const usersConnection = await mysql.createConnection({
      ...dbConfig,
      database: 'jpsistemas_users'
    });

    // Criar tabela de usuários se não existir
    await usersConnection.execute(`
      CREATE TABLE IF NOT EXISTS usuarios_cobrancas (
        id INT AUTO_INCREMENT PRIMARY KEY,
        username VARCHAR(50) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        db_name VARCHAR(100) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_username (username),
        INDEX idx_db_name (db_name)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    await rootConnection.end();
    await usersConnection.end();
    
    console.log('✅ Banco de usuários verificado/criado');
  } catch (error) {
    console.error('❌ Erro ao verificar banco de usuários:', error);
    throw error;
  }
}

// Função principal
async function main() {
  try {
    // Verificar argumentos
    if (process.argv.length < 4) {
      console.log('📋 Uso: node scripts/create-cobrancas-user.js <username> <email> <password> [isAdmin]');
      console.log('');
      console.log('📝 Exemplos:');
      console.log('  node scripts/create-cobrancas-user.js joao joao@empresa.com senha123');
      console.log('  node scripts/create-cobrancas-user.js admin admin@empresa.com admin123 true');
      console.log('');
      process.exit(1);
    }

    const username = process.argv[2];
    const email = process.argv[3];
    const password = process.argv[4];
    const isAdmin = process.argv[5] === 'true';

    console.log('🚀 Iniciando criação de usuário no sistema JP Cobranças...');
    console.log('');
    console.log('📋 Dados do usuário:');
    console.log(`   Username: ${username}`);
    console.log(`   Email: ${email}`);
    console.log(`   Admin: ${isAdmin ? 'Sim' : 'Não'}`);
    console.log('');

    // Validar dados
    if (!username || username.length < 3) {
      throw new Error('Username deve ter pelo menos 3 caracteres');
    }

    if (!email || !email.includes('@')) {
      throw new Error('Email inválido');
    }

    if (!password || password.length < 6) {
      throw new Error('Senha deve ter pelo menos 6 caracteres');
    }

    // Garantir que o banco de usuários existe
    await ensureUsersDatabase();

    // Criar banco de dados do usuário
    const dbName = await createUserDatabase(username);

    // Criar usuário no banco de usuários
    await createUser(username, email, password, isAdmin);

    console.log('');
    console.log('🎉 Usuário criado com sucesso!');
    console.log('');
    console.log('📋 Informações do usuário:');
    console.log(`   Username: ${username}`);
    console.log(`   Email: ${email}`);
    console.log(`   Senha: ${password}`);
    console.log(`   Banco de dados: ${dbName}`);
    console.log(`   Admin: ${isAdmin ? 'Sim' : 'Não'}`);
    console.log('');
    console.log('🔗 URLs de acesso:');
    console.log(`   Login: http://localhost:3000/jp.cobrancas/login.html`);
    console.log(`   Dashboard: http://localhost:3000/jp.cobrancas/dashboard.html`);
    console.log('');
    console.log('⚠️  IMPORTANTE: Guarde essas informações em local seguro!');
    console.log('');

  } catch (error) {
    console.error('❌ Erro:', error.message);
    process.exit(1);
  }
}

// Executar se for chamado diretamente
if (require.main === module) {
  main();
}

module.exports = {
  createUserDatabase,
  createUser,
  ensureUsersDatabase
}; 