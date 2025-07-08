const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
require('dotenv').config();

async function criarNovoUsuario() {
  // Configurações do novo usuário
  const username = process.argv[2];
  const email = process.argv[3];
  const password = process.argv[4];
  
  if (!username || !email || !password) {
    console.log('📋 Uso: node criar-novo-usuario-cobrancas.js <username> <email> <password>');
    console.log('');
    console.log('📝 Exemplos:');
    console.log('  node criar-novo-usuario-cobrancas.js maria maria@empresa.com senha123');
    console.log('  node criar-novo-usuario-cobrancas.js loja_sul loja@sul.com loja456');
    console.log('');
    process.exit(1);
  }

  const dbName = `jpcobrancas_${username.toLowerCase().replace(/[^a-z0-9]/g, '_')}`;
  
  try {
    console.log('🚀 Criando novo usuário no sistema JP Cobranças...');
    console.log('');
    console.log('📋 Dados do usuário:');
    console.log(`   Username: ${username}`);
    console.log(`   Email: ${email}`);
    console.log(`   Senha: ${password}`);
    console.log(`   Banco: ${dbName}`);
    console.log('');

    // Conectar ao MariaDB
    const connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'jpsistemas',
      password: process.env.DB_PASSWORD || 'Juliano@95',
      charset: 'utf8mb4'
    });

    console.log('✅ Conectado ao MariaDB');

    // 1. Garantir que o banco de usuários existe
    await connection.execute(`CREATE DATABASE IF NOT EXISTS jpsistemas_users CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
    await connection.execute('USE jpsistemas_users');

    // 2. Criar tabela de usuários se não existir
    await connection.execute(`
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

    // 3. Verificar se usuário já existe
    const [existingUser] = await connection.execute(
      'SELECT id FROM usuarios_cobrancas WHERE username = ?',
      [username]
    );

    if (existingUser.length > 0) {
      console.log('❌ Usuário já existe!');
      console.log('💡 Escolha outro nome de usuário');
      await connection.end();
      return;
    }

    // 4. Criar hash da senha
    console.log('🔐 Criando hash da senha...');
    const hashedPassword = await bcrypt.hash(password, 12);

    // 5. Inserir usuário no banco
    console.log('👤 Inserindo usuário...');
    await connection.execute(
      'INSERT INTO usuarios_cobrancas (username, password_hash, db_name) VALUES (?, ?, ?)',
      [username, hashedPassword, dbName]
    );

    console.log('✅ Usuário criado no sistema de autenticação!');

    // 6. Criar banco de dados do usuário
    console.log('📦 Criando banco de dados do usuário...');
    await connection.execute(`CREATE DATABASE IF NOT EXISTS \`${dbName}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
    await connection.execute(`USE \`${dbName}\``);

    console.log('✅ Banco de dados criado!');

    // 7. Criar tabelas (mesmas do usuário cobranca)
    console.log('📋 Criando tabelas...');

    // Tabela clientes_cobrancas
    await connection.execute(`
      CREATE TABLE clientes_cobrancas (
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

    // Tabela emprestimos
    await connection.execute(`
      CREATE TABLE emprestimos (
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
        INDEX idx_data_emprestimo (data_emprestimo),
        INDEX idx_status (status)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('✅ Tabela emprestimos criada');

    // Tabela cobrancas
    await connection.execute(`
      CREATE TABLE cobrancas (
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
        INDEX idx_status (status)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('✅ Tabela cobrancas criada');

    // Tabela pagamentos
    await connection.execute(`
      CREATE TABLE pagamentos (
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

    // Tabela parcelas (encontrada no usuário cobranca)
    await connection.execute(`
      CREATE TABLE parcelas (
        id INT AUTO_INCREMENT PRIMARY KEY,
        emprestimo_id INT,
        cliente_id INT,
        numero_parcela INT NOT NULL,
        valor_parcela DECIMAL(10,2) NOT NULL,
        data_vencimento DATE NOT NULL,
        valor_pago DECIMAL(10,2) DEFAULT 0.00,
        data_pagamento DATE,
        juros_calculados DECIMAL(10,2) DEFAULT 0.00,
        multa_calculada DECIMAL(10,2) DEFAULT 0.00,
        status VARCHAR(50) DEFAULT 'Pendente',
        observacoes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (emprestimo_id) REFERENCES emprestimos(id) ON DELETE SET NULL,
        FOREIGN KEY (cliente_id) REFERENCES clientes_cobrancas(id) ON DELETE SET NULL,
        INDEX idx_emprestimo_id (emprestimo_id),
        INDEX idx_cliente_id (cliente_id),
        INDEX idx_data_vencimento (data_vencimento),
        INDEX idx_status (status)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('✅ Tabela parcelas criada');

    // Tabela sessions
    await connection.execute(`
      CREATE TABLE sessions (
        session_id VARCHAR(128) NOT NULL PRIMARY KEY,
        expires INT UNSIGNED NOT NULL,
        data TEXT,
        INDEX idx_expires (expires)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('✅ Tabela sessions criada');

    // 8. Verificar se tudo foi criado corretamente
    console.log('🔍 Verificando criação...');
    
    // Verificar usuário
    await connection.execute('USE jpsistemas_users');
    const [userCheck] = await connection.execute(
      'SELECT * FROM usuarios_cobrancas WHERE username = ?',
      [username]
    );
    
    // Verificar banco
    const [dbCheck] = await connection.execute('SHOW DATABASES LIKE ?', [dbName]);
    
    // Verificar tabelas
    await connection.execute(`USE \`${dbName}\``);
    const [tables] = await connection.execute('SHOW TABLES');
    
    // Contar registros (deve ser 0)
    const [counts] = await connection.execute(`
      SELECT 
        (SELECT COUNT(*) FROM clientes_cobrancas) as clientes,
        (SELECT COUNT(*) FROM emprestimos) as emprestimos,
        (SELECT COUNT(*) FROM cobrancas) as cobrancas,
        (SELECT COUNT(*) FROM pagamentos) as pagamentos,
        (SELECT COUNT(*) FROM parcelas) as parcelas
    `);

    await connection.end();

    console.log('');
    console.log('🎉 Usuário criado com sucesso!');
    console.log('');
    console.log('📊 Resumo da criação:');
    console.log(`   ✅ Usuário: ${userCheck.length > 0 ? 'Criado' : 'Erro'}`);
    console.log(`   ✅ Banco: ${dbCheck.length > 0 ? 'Criado' : 'Erro'}`);
    console.log(`   ✅ Tabelas: ${tables.length} criadas`);
    console.log(`   ✅ Dados: Todas as tabelas estão zeradas`);
    console.log('');
    console.log('📋 Dados para login:');
    console.log(`   Username: ${username}`);
    console.log(`   Password: ${password}`);
    console.log(`   Database: ${dbName}`);
    console.log('');
    console.log('🔍 Contadores:');
    console.log(`   Clientes: ${counts[0].clientes}`);
    console.log(`   Empréstimos: ${counts[0].emprestimos}`);
    console.log(`   Cobranças: ${counts[0].cobrancas}`);
    console.log(`   Pagamentos: ${counts[0].pagamentos}`);
    console.log(`   Parcelas: ${counts[0].parcelas}`);
    console.log('');
    console.log('🌟 O usuário já pode fazer login no sistema!');

  } catch (error) {
    console.error('❌ Erro ao criar usuário:', error.message);
    
    if (error.code === 'ER_DUP_ENTRY') {
      console.log('💡 Usuário já existe. Escolha outro nome.');
    } else if (error.code === 'ECONNREFUSED') {
      console.log('💡 Não foi possível conectar ao MariaDB. Verifique se está rodando.');
    } else {
      console.error('Stack:', error.stack);
    }
  }
}

criarNovoUsuario(); 