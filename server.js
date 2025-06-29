const express = require('express');
const mysql = require('mysql2/promise');
const path = require('path');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const session = require('express-session');
const MySQLStore = require('express-mysql-session')(session);
const { 
  getSessionConfig, 
  getUsersConfig, 
  getUserDatabaseConfig, 
  getRootConfig 
} = require('./database-config');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.static('public'));
app.use(express.urlencoded({ extended: true }));

// Configuração de sessão com suporte a múltiplos provedores
const sessionConfig = getSessionConfig();
const sessionStore = new MySQLStore(sessionConfig);

app.use(session({
  secret: process.env.SESSION_SECRET || 'SeuSessionSecretMuitoForte123!',
  store: sessionStore,
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000 // 24 horas
  }
}));

// Função para criar conexão com banco de dados específico do usuário
async function createUserDatabaseConnection(username) {
  const dbConfig = getUserDatabaseConfig(username);
  
  try {
    const connection = await mysql.createConnection(dbConfig);
    return connection;
  } catch (error) {
    console.error(`Erro ao conectar ao banco do usuário ${username}:`, error);
    throw error;
  }
}

// Função para criar banco de dados do usuário
async function createUserDatabase(username) {
  const dbName = `jpsistemas_${username.toLowerCase().replace(/[^a-z0-9]/g, '_')}`;
  
  try {
    // Conectar como root para criar o banco
    const rootConfig = getRootConfig();
    const rootConnection = await mysql.createConnection(rootConfig);

    // Criar banco de dados
    await rootConnection.execute(`CREATE DATABASE IF NOT EXISTS \`${dbName}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
    
    // Conectar ao banco criado
    const userConfig = getUserDatabaseConfig(username);
    const userConnection = await mysql.createConnection(userConfig);

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
        preco DECIMAL(10,2),
        categoria VARCHAR(100),
        codigo VARCHAR(50),
        estoque INT DEFAULT 0,
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

    await rootConnection.end();
    await userConnection.end();
    
    console.log(`Banco de dados ${dbName} criado com sucesso para o usuário ${username}`);
    return true;
  } catch (error) {
    console.error(`Erro ao criar banco de dados para ${username}:`, error);
    throw error;
  }
}

// Middleware de autenticação
function requireAuth(req, res, next) {
  if (req.session.user) {
    next();
  } else {
    res.redirect('/');
  }
}

// Rotas de autenticação
app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    
    // Conectar ao banco principal de usuários
    const usersConfig = getUsersConfig();
    const connection = await mysql.createConnection(usersConfig);

    // Buscar usuário
    const [users] = await connection.execute(
      'SELECT * FROM users WHERE username = ? AND is_active = TRUE',
      [username]
    );

    await connection.end();

    if (users.length === 0) {
      return res.status(401).json({ error: 'Usuário não encontrado ou inativo' });
    }

    const user = users[0];

    // Verificar senha
    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      return res.status(401).json({ error: 'Senha incorreta' });
    }

    // Criar ou verificar banco de dados do usuário
    try {
      await createUserDatabase(username);
    } catch (dbError) {
      console.error('Erro ao criar banco do usuário:', dbError);
      return res.status(500).json({ error: 'Erro interno do servidor' });
    }

    // Criar sessão
    req.session.user = {
      id: user.id,
      username: user.username,
      email: user.email,
      isAdmin: user.is_admin,
      dbName: `jpsistemas_${username.toLowerCase().replace(/[^a-z0-9]/g, '_')}`
    };

    res.json({ 
      success: true, 
      message: 'Login realizado com sucesso',
      user: {
        username: user.username,
        email: user.email,
        isAdmin: user.is_admin
      }
    });

  } catch (error) {
    console.error('Erro no login:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

app.post('/api/auth/register', async (req, res) => {
  try {
    const { username, email, password } = req.body;
    
    // Conectar ao banco principal de usuários
    const connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'jpsistemas',
      password: process.env.DB_PASSWORD || 'SuaSenhaForte123!',
      database: 'jpsistemas_users',
      charset: 'utf8mb4'
    });

    // Verificar se usuário já existe
    const [existingUsers] = await connection.execute(
      'SELECT * FROM users WHERE username = ? OR email = ?',
      [username, email]
    );

    if (existingUsers.length > 0) {
      await connection.end();
      return res.status(400).json({ error: 'Usuário ou email já existe' });
    }

    // Hash da senha
    const hashedPassword = await bcrypt.hash(password, 12);

    // Criar usuário
    const [result] = await connection.execute(
      'INSERT INTO users (username, email, password) VALUES (?, ?, ?)',
      [username, email, hashedPassword]
    );

    await connection.end();

    // Criar banco de dados do usuário
    await createUserDatabase(username);

    res.status(201).json({ 
      success: true, 
      message: 'Usuário criado com sucesso' 
    });

  } catch (error) {
    console.error('Erro no registro:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

app.post('/api/auth/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      return res.status(500).json({ error: 'Erro ao fazer logout' });
    }
    res.json({ success: true, message: 'Logout realizado com sucesso' });
  });
});

// Middleware para injetar conexão do banco do usuário
async function injectUserDatabase(req, res, next) {
  if (req.session.user) {
    try {
      req.dbConnection = await createUserDatabaseConnection(req.session.user.username);
      next();
    } catch (error) {
      res.status(500).json({ error: 'Erro ao conectar ao banco de dados' });
    }
  } else {
    res.status(401).json({ error: 'Usuário não autenticado' });
  }
}

// Rotas da API com banco de dados específico do usuário
app.get('/api/clientes', requireAuth, injectUserDatabase, async (req, res) => {
  try {
    const [rows] = await req.dbConnection.execute('SELECT * FROM clientes ORDER BY razao');
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  } finally {
    await req.dbConnection.end();
  }
});

app.post('/api/clientes', requireAuth, injectUserDatabase, async (req, res) => {
  try {
    const {
      razao, cnpj, ie, endereco, bairro, cidade, estado, cep,
      email, telefone, transporte, prazo, obs
    } = req.body;

    const [result] = await req.dbConnection.execute(
      `INSERT INTO clientes (razao, cnpj, ie, endereco, bairro, cidade, estado, cep, email, telefone, transporte, prazo, obs)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [razao, cnpj, ie, endereco, bairro, cidade, estado, cep, email, telefone, transporte, prazo, obs]
    );
    
    res.status(201).json({ id: result.insertId, message: 'Cliente cadastrado com sucesso!' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  } finally {
    await req.dbConnection.end();
  }
});

app.delete('/api/clientes/:id', requireAuth, injectUserDatabase, async (req, res) => {
  try {
    const { id } = req.params;
    await req.dbConnection.execute('DELETE FROM clientes WHERE id = ?', [id]);
    res.json({ message: 'Cliente removido com sucesso!' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  } finally {
    await req.dbConnection.end();
  }
});

// Rotas para páginas HTML
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/painel', requireAuth, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'painel.html'));
});

app.get('/clientes', requireAuth, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'painel-clientes.html'));
});

app.get('/produtos', requireAuth, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'produtos.html'));
});

app.get('/pedidos', requireAuth, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'pedidos.html'));
});

app.get('/relatorios', requireAuth, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'relatorios.html'));
});

app.get('/configuracoes', requireAuth, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'configuracoes.html'));
});

// Inicializar banco de dados principal
async function initializeMainDatabase() {
  try {
    const connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'jpsistemas',
      password: process.env.DB_PASSWORD || 'SuaSenhaForte123!',
      charset: 'utf8mb4'
    });

    // Criar banco de usuários
    await connection.execute('CREATE DATABASE IF NOT EXISTS jpsistemas_users CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci');
    await connection.execute('CREATE DATABASE IF NOT EXISTS jpsistemas_sessions CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci');

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
    console.log('Banco de dados principal inicializado com sucesso');
  } catch (error) {
    console.error('Erro ao inicializar banco de dados principal:', error);
  }
}

// Inicializar e iniciar servidor
async function startServer() {
  await initializeMainDatabase();
  
  app.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}`);
    console.log(`Acesse: http://localhost:${PORT}`);
  });
}

startServer().catch(console.error); 