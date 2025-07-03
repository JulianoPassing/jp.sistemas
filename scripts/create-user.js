/**
 * Script para Criar Novos Usuários no Sistema J.P Sistemas
 * Sistema Multi-Tenancy com MariaDB
 */

const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
require('dotenv').config();

// Função para criar banco de dados do usuário
async function createUserDatabase(username) {
  const dbName = `jpsistemas_${username.toLowerCase().replace(/[^a-z0-9]/g, '_')}`;
  
  try {
    // Conectar como root para criar o banco
    const rootConnection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'jpsistemas',
      password: process.env.DB_PASSWORD || 'SuaSenhaForte123!',
      charset: 'utf8mb4'
    });

    // Criar banco de dados
    await rootConnection.execute(`CREATE DATABASE IF NOT EXISTS \`${dbName}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
    
    // Conectar ao banco criado
    const userConnection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'jpsistemas',
      password: process.env.DB_PASSWORD || 'SuaSenhaForte123!',
      database: dbName,
      charset: 'utf8mb4'
    });

    // Criar tabelas
    await userConnection.execute(`
      CREATE TABLE IF NOT EXISTS clientes (
        id INT AUTO_INCREMENT PRIMARY KEY,
        razao VARCHAR(255) NOT NULL,
        cnpj VARCHAR(18),
        ie VARCHAR(20),
        endereco VARCHAR(255),
        bairro VARCHAR(100),
        cidade VARCHAR(100),
        estado VARCHAR(2),
        cep VARCHAR(9),
        email VARCHAR(255),
        telefone VARCHAR(20),
        transporte VARCHAR(100),
        prazo VARCHAR(50),
        obs TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_razao (razao),
        INDEX idx_cnpj (cnpj),
        INDEX idx_email (email)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    await userConnection.execute(`
      CREATE TABLE IF NOT EXISTS produtos (
        id INT AUTO_INCREMENT PRIMARY KEY,
        nome VARCHAR(255) NOT NULL,
        descricao TEXT,
        preco_custo DECIMAL(10,2),
        preco_venda DECIMAL(10,2),
        categoria VARCHAR(100),
        codigo VARCHAR(50),
        estoque INT DEFAULT 0,
        fornecedor VARCHAR(255),
        peso VARCHAR(50),
        dimensoes VARCHAR(100),
        status VARCHAR(50) DEFAULT 'Ativo',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_nome (nome),
        INDEX idx_categoria (categoria),
        INDEX idx_codigo (codigo)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    await userConnection.execute(`
      CREATE TABLE IF NOT EXISTS pedidos (
        id INT AUTO_INCREMENT PRIMARY KEY,
        cliente_id INT,
        data_pedido DATE,
        status VARCHAR(50) DEFAULT 'pendente',
        valor_total DECIMAL(10,2),
        observacoes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (cliente_id) REFERENCES clientes(id) ON DELETE SET NULL,
        INDEX idx_data_pedido (data_pedido),
        INDEX idx_status (status),
        INDEX idx_cliente_id (cliente_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    await userConnection.execute(`
      CREATE TABLE IF NOT EXISTS pedido_itens (
        id INT AUTO_INCREMENT PRIMARY KEY,
        pedido_id INT,
        produto_id INT,
        quantidade INT,
        preco_unitario DECIMAL(10,2),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (pedido_id) REFERENCES pedidos(id) ON DELETE CASCADE,
        FOREIGN KEY (produto_id) REFERENCES produtos(id) ON DELETE SET NULL,
        INDEX idx_pedido_id (pedido_id),
        INDEX idx_produto_id (produto_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    await userConnection.execute(`
      CREATE TABLE IF NOT EXISTS contas_pagar (
        id INT AUTO_INCREMENT PRIMARY KEY,
        descricao VARCHAR(255) NOT NULL,
        valor DECIMAL(10,2) NOT NULL,
        data_vencimento DATE NOT NULL,
        status VARCHAR(20) DEFAULT 'aberto',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    await userConnection.execute(`
      CREATE TABLE IF NOT EXISTS contas_receber (
        id INT AUTO_INCREMENT PRIMARY KEY,
        descricao VARCHAR(255) NOT NULL,
        valor DECIMAL(10,2) NOT NULL,
        data_vencimento DATE NOT NULL,
        status VARCHAR(20) DEFAULT 'aberto',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    await rootConnection.end();
    await userConnection.end();
    
    console.log(`✅ Banco de dados ${dbName} criado com sucesso`);
    return dbName;
  } catch (error) {
    console.error(`❌ Erro ao criar banco de dados para ${username}:`, error);
    throw error;
  }
}

// Função para criar usuário no banco de usuários
async function createUser(username, email, password, isAdmin = false) {
  try {
    // Conectar ao banco de usuários
    const usersConnection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'jpsistemas',
      password: process.env.DB_PASSWORD || 'SuaSenhaForte123!',
      database: 'jpsistemas_users',
      charset: 'utf8mb4'
    });

    // Verificar se usuário já existe
    const [existingUsers] = await usersConnection.execute(
      'SELECT id FROM users WHERE username = ? OR email = ?',
      [username, email]
    );

    if (existingUsers.length > 0) {
      await usersConnection.end();
      throw new Error('Usuário ou email já existe no sistema');
    }

    // Criptografar senha
    const hashedPassword = await bcrypt.hash(password, 12);

    // Inserir usuário
    await usersConnection.execute(`
      INSERT INTO users (username, email, password, is_admin, is_active) 
      VALUES (?, ?, ?, ?, TRUE)
    `, [username, email, hashedPassword, isAdmin]);

    await usersConnection.end();
    
    console.log(`✅ Usuário ${username} criado com sucesso`);
    return true;
  } catch (error) {
    console.error(`❌ Erro ao criar usuário ${username}:`, error);
    throw error;
  }
}

// Função para garantir que os bancos principais existem e possuem as tabelas padrão
async function ensureMainDatabasesAndTables() {
  const mainDatabases = [
    { name: 'jpsistemas_users', charset: 'utf8mb4', collate: 'utf8mb4_unicode_ci' },
    { name: 'jpsistemas_sessions', charset: 'utf8mb4', collate: 'utf8mb4_unicode_ci' },
    { name: 'jpsistemas_admin', charset: 'utf8mb4', collate: 'utf8mb4_unicode_ci' }
  ];
  let rootConnection;
  try {
    rootConnection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'jpsistemas',
      password: process.env.DB_PASSWORD || 'SuaSenhaForte123!',
      charset: 'utf8mb4'
    });
    for (const db of mainDatabases) {
      await rootConnection.execute(
        `CREATE DATABASE IF NOT EXISTS \`${db.name}\` CHARACTER SET ${db.charset} COLLATE ${db.collate}`
      );
    }
    // Criar tabela users em jpsistemas_users
    await rootConnection.execute('USE jpsistemas_users');
    await rootConnection.execute(`
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
    // Criar tabela sessions em jpsistemas_sessions
    await rootConnection.execute('USE jpsistemas_sessions');
    await rootConnection.execute(`
      CREATE TABLE IF NOT EXISTS sessions (
        session_id VARCHAR(128) NOT NULL PRIMARY KEY,
        expires INT UNSIGNED NOT NULL,
        data TEXT,
        INDEX idx_expires (expires)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    // Criar tabela caixa em jpsistemas_admin
    await rootConnection.execute('USE jpsistemas_admin');
    await rootConnection.execute(`
      CREATE TABLE IF NOT EXISTS caixa (
        id INT AUTO_INCREMENT PRIMARY KEY,
        tipo VARCHAR(20),
        valor DECIMAL(10,2),
        descricao VARCHAR(255),
        data DATE,
        pedido_id INT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (pedido_id) REFERENCES pedidos(id) ON DELETE SET NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    await rootConnection.end();
    console.log('✅ Bancos principais e tabelas padrão verificados/criados');
  } catch (error) {
    if (rootConnection) await rootConnection.end();
    console.error('❌ Erro ao criar bancos principais/tabelas:', error);
    throw error;
  }
}

// Função principal
async function createNewUser() {
  const args = process.argv.slice(2);
  
  if (args.length < 3) {
    console.log('📋 Uso: node scripts/create-user.js <username> <email> <password> [admin]');
    console.log('');
    console.log('📝 Exemplos:');
    console.log('   node scripts/create-user.js joao_silva joao@empresa.com senha123');
    console.log('   node scripts/create-user.js admin admin@empresa.com senha123 admin');
    console.log('');
    console.log('⚠️  IMPORTANTE:');
    console.log('   - Username deve conter apenas letras, números e underscore');
    console.log('   - Email deve ser válido');
    console.log('   - Senha deve ter pelo menos 6 caracteres');
    console.log('   - Use "admin" como último parâmetro para criar usuário administrador');
    process.exit(1);
  }

  const [username, email, password, isAdminFlag] = args;
  const isAdmin = isAdminFlag === 'admin';

  // Validações
  if (!/^[a-zA-Z0-9_]+$/.test(username)) {
    console.error('❌ Username deve conter apenas letras, números e underscore');
    process.exit(1);
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    console.error('❌ Email inválido');
    process.exit(1);
  }

  if (password.length < 6) {
    console.error('❌ Senha deve ter pelo menos 6 caracteres');
    process.exit(1);
  }

  console.log('🚀 Criando novo usuário no sistema J.P Sistemas...');
  console.log('');
  console.log('📋 Dados do usuário:');
  console.log(`   Username: ${username}`);
  console.log(`   Email: ${email}`);
  console.log(`   Tipo: ${isAdmin ? 'Administrador' : 'Usuário comum'}`);
  console.log('');

  try {
    // 0. Garantir bancos principais e tabelas padrão
    await ensureMainDatabasesAndTables();
    // 1. Criar usuário no banco de usuários
    console.log('👤 Criando usuário no banco de usuários...');
    await createUser(username, email, password, isAdmin);

    // 2. Criar banco de dados do usuário
    console.log('🗄️  Criando banco de dados do usuário...');
    const dbName = await createUserDatabase(username);

    console.log('');
    console.log('✅ Usuário criado com sucesso!');
    console.log('');
    console.log('📋 Informações do usuário:');
    console.log(`   Username: ${username}`);
    console.log(`   Email: ${email}`);
    console.log(`   Senha: ${password}`);
    console.log(`   Banco de dados: ${dbName}`);
    console.log(`   Tipo: ${isAdmin ? 'Administrador' : 'Usuário comum'}`);
    console.log('');
    console.log('🔗 O usuário já pode fazer login no sistema!');
    console.log('');
    console.log('⚠️  IMPORTANTE: Altere a senha após o primeiro login!');

  } catch (error) {
    console.error('❌ Erro ao criar usuário:', error.message);
    process.exit(1);
  }
}

// Executar se chamado diretamente
if (require.main === module) {
  createNewUser();
}

module.exports = { createUser, createUserDatabase }; 