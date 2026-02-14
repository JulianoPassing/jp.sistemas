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
const cors = require('cors');
const cookieParser = require('cookie-parser');
const helmet = require('helmet');
const empresaHandler = require('./api/empresa');
const cobrancasHandler = require('./api/cobrancas');
require('dotenv').config({ path: __dirname + '/.env' });
console.log('DB_HOST:', process.env.DB_HOST);
console.log('DB_USER:', process.env.DB_USER);
console.log('DB_PASSWORD:', process.env.DB_PASSWORD);
console.log('DATABASE_PROVIDER:', process.env.DATABASE_PROVIDER);
const fs = require('fs').promises;
const multer = require('multer');

const app = express();
const PORT = process.env.PORT || 3000;

// Trust proxy (nginx, etc.) para req.protocol e req.get('host') corretos
app.set('trust proxy', 1);

app.use(express.json({ limit: '70mb' }));
app.use(express.urlencoded({ extended: true, limit: '70mb' }));
app.all('/api/empresa', empresaHandler);
// app.use('/api/cobrancas', cobrancasHandler);

// CORS - deve vir antes de qualquer middleware de sessão ou rotas
const allowedOrigins = [
  'https://jp-sistemas.vercel.app',
  'https://jp-sistemas.com',
  'http://jp-sistemas.com',
  'http://localhost:3000'
];
app.use(cors({
  origin: allowedOrigins,
  credentials: true
}));

// Middleware
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false
}));
app.use(express.static('public'));
app.use(cookieParser());

// Configuração de sessão para VPS
const isProduction = process.env.NODE_ENV === 'production' || process.env.PORT;
const sessionStore = new MySQLStore({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: 'jpsistemas_sessions',
  clearExpired: true,
  checkExpirationInterval: 900000, // 15 minutos
  expiration: 86400000 // 24 horas
});

app.use(session({
  name: 'connect.sid',
  secret: process.env.SESSION_SECRET || 'SeuSessionSecretMuitoForte123!',
  resave: true,
  saveUninitialized: true,
  store: sessionStore,
  cookie: {
    secure: false, // false para VPS sem HTTPS
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 24 * 60 * 60 * 1000, // 24 horas
    path: '/',
    domain: undefined // Deixa o navegador definir o domínio
  },
  rolling: true
}));

app.use('/api/cobrancas', cobrancasHandler);
app.use('/api/mercadopago', require('./api/mercadopago'));
app.use('/api/precos', require('./api/precos'));

// Função utilitária para converter undefined para null
function safeValue(value) {
  return value === undefined ? null : value;
}

// Função utilitária para converter array de valores
function safeValues(values) {
  return values.map(value => safeValue(value));
}

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
        nome_cliente VARCHAR(255),
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
      CREATE TABLE IF NOT EXISTS cliente_documentos (
        id INT AUTO_INCREMENT PRIMARY KEY,
        cliente_id INT NOT NULL,
        nome_original VARCHAR(255) NOT NULL,
        nome_arquivo VARCHAR(255) NOT NULL,
        caminho VARCHAR(500) NOT NULL,
        tipo_mime VARCHAR(100) NOT NULL,
        tamanho INT DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (cliente_id) REFERENCES clientes(id) ON DELETE CASCADE,
        INDEX idx_cliente_id (cliente_id)
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

// Função para normalizar o status do pedido
function normalizarStatus(status) {
  if (!status) return '';
  const s = status.toString().trim().toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '');
  if (s === 'em aberto') return 'Em Aberto';
  if (s === 'em processamento') return 'Em Processamento';
  if (s === 'concluido') return 'Concluído';
  if (s === 'cancelado') return 'Cancelado';
  if (s === 'pendente') return 'Pendente';
  return status;
}

// Função para normalizar data para formato MySQL
function normalizarData(data) {
  if (!data) return null;
  // Se já é uma string no formato YYYY-MM-DD, retorna como está
  if (typeof data === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(data)) {
    return data;
  }
  // Se é uma data ISO ou outro formato, converte para YYYY-MM-DD usando UTC
  try {
    const dataObj = new Date(data);
    if (isNaN(dataObj.getTime())) {
      return null; // Data inválida
    }
    // Extrair ano, mês e dia em UTC
    const ano = dataObj.getUTCFullYear();
    const mes = String(dataObj.getUTCMonth() + 1).padStart(2, '0');
    const dia = String(dataObj.getUTCDate()).padStart(2, '0');
    return `${ano}-${mes}-${dia}`;
  } catch (error) {
    console.warn('Erro ao normalizar data:', data, error);
    return null;
  }
}

// Middleware de autenticação por JWT
const { requireAuthJWT } = require('./middlewares/auth');

// Rota de login usando JWT
app.post('/api/auth/login', async (req, res) => {
  try {
    console.log('Login iniciado');
    const { username, password } = req.body;
    const usersConfig = getUsersConfig();
    console.log('Config do banco:', usersConfig);
    const connection = await mysql.createConnection(usersConfig);
    console.log('Conectado ao banco de usuários');

    const [users] = await connection.execute(
      'SELECT * FROM users WHERE username = ? AND is_active = TRUE',
      [username]
    );
    console.log('Consulta de usuário executada');
    await connection.end();

    if (users.length === 0) {
      console.log('Usuário não encontrado');
      return res.status(401).json({ error: 'Usuário não encontrado ou inativo' });
    }

    const user = users[0];
    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      console.log('Senha incorreta');
      return res.status(401).json({ error: 'Senha incorreta' });
    }

    try {
      console.log('Criando banco do usuário...');
      await createUserDatabase(username);
      console.log('Banco do usuário criado');
    } catch (dbError) {
      console.error('Erro ao criar banco do usuário:', dbError);
      return res.status(500).json({ error: 'Erro interno do servidor' });
    }

    // Cria a sessão express para rotas que dependem de req.session.username
    req.session.username = user.username;
    // Log para depuração: verificar se a sessão está sendo criada corretamente
    console.log('Sessão após login:', req.sessionID, req.session);

    const userPayload = {
      id: user.id,
      username: user.username,
      email: user.email,
      isAdmin: user.is_admin,
      dbName: `jpsistemas_${username.toLowerCase().replace(/[^a-z0-9]/g, '_')}`
    };
    const token = jwt.sign(userPayload, process.env.JWT_SECRET, { expiresIn: '24h' });

    req.session.save((err) => {
      if (err) {
        console.error('Erro ao salvar sessão:', err);
        return res.status(500).json({ error: 'Erro ao salvar sessão' });
      }
      const isProduction = process.env.NODE_ENV === 'production' || /jp-sistemas\.com/i.test(req.get('host') || '');
      const cookieOptions = {
        httpOnly: true,
        secure: isProduction,
        sameSite: isProduction ? 'none' : 'lax',
        maxAge: 24 * 60 * 60 * 1000
      };
      if (isProduction) cookieOptions.domain = '.jp-sistemas.com';
      res.cookie('token', token, cookieOptions);
      res.json({ success: true, user: userPayload });
    });
  } catch (error) {
    console.error('Erro no login:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Rota de logout para limpar o cookie JWT
app.post('/api/auth/logout', (req, res) => {
  res.clearCookie('token', {
    httpOnly: true,
    secure: false,
    sameSite: 'lax',
    path: '/'
  });
  res.json({ success: true });
});

// Perfil do usuário (e-mail) e alteração de senha/e-mail
app.get('/api/auth/perfil', requireAuthJWT, async (req, res) => {
  try {
    const usersConfig = getUsersConfig();
    const connection = await mysql.createConnection(usersConfig);
    const [rows] = await connection.execute(
      'SELECT username, email FROM users WHERE username = ? AND is_active = TRUE',
      [req.user.username]
    );
    await connection.end();
    if (rows.length === 0) return res.status(404).json({ error: 'Usuário não encontrado.' });
    res.json({ username: rows[0].username, email: rows[0].email || '' });
  } catch (error) {
    console.error('Erro ao buscar perfil:', error);
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/auth/alterar-senha', requireAuthJWT, async (req, res) => {
  try {
    const { senha_atual, nova_senha } = req.body;
    if (!senha_atual || !nova_senha) {
      return res.status(400).json({ error: 'Informe a senha atual e a nova senha.' });
    }
    if (nova_senha.length < 6) {
      return res.status(400).json({ error: 'A nova senha deve ter no mínimo 6 caracteres.' });
    }
    const usersConfig = getUsersConfig();
    const connection = await mysql.createConnection(usersConfig);
    const [rows] = await connection.execute('SELECT password FROM users WHERE username = ?', [req.user.username]);
    if (rows.length === 0) {
      await connection.end();
      return res.status(404).json({ error: 'Usuário não encontrado.' });
    }
    const valid = await bcrypt.compare(senha_atual, rows[0].password);
    if (!valid) {
      await connection.end();
      return res.status(401).json({ error: 'Senha atual incorreta.' });
    }
    const hash = await bcrypt.hash(nova_senha, 12);
    await connection.execute('UPDATE users SET password = ?, updated_at = NOW() WHERE username = ?', [hash, req.user.username]);
    await connection.end();
    res.json({ message: 'Senha alterada com sucesso.' });
  } catch (error) {
    console.error('Erro ao alterar senha:', error);
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/auth/alterar-email', requireAuthJWT, async (req, res) => {
  try {
    const { email, senha_atual } = req.body;
    if (!email || typeof email !== 'string' || !email.includes('@')) {
      return res.status(400).json({ error: 'Informe um e-mail válido.' });
    }
    if (!senha_atual) {
      return res.status(400).json({ error: 'Informe a senha atual para confirmar.' });
    }
    const usersConfig = getUsersConfig();
    const connection = await mysql.createConnection(usersConfig);
    const [rows] = await connection.execute('SELECT password FROM users WHERE username = ?', [req.user.username]);
    if (rows.length === 0) {
      await connection.end();
      return res.status(404).json({ error: 'Usuário não encontrado.' });
    }
    const valid = await bcrypt.compare(senha_atual, rows[0].password);
    if (!valid) {
      await connection.end();
      return res.status(401).json({ error: 'Senha atual incorreta.' });
    }
    const [existing] = await connection.execute('SELECT id FROM users WHERE email = ? AND username != ?', [email.trim(), req.user.username]);
    if (existing.length > 0) {
      await connection.end();
      return res.status(400).json({ error: 'Este e-mail já está em uso por outro usuário.' });
    }
    await connection.execute('UPDATE users SET email = ?, updated_at = NOW() WHERE username = ?', [email.trim(), req.user.username]);
    await connection.end();
    res.json({ message: 'E-mail alterado com sucesso.' });
  } catch (error) {
    console.error('Erro ao alterar e-mail:', error);
    res.status(500).json({ error: error.message });
  }
});

// Rotas protegidas usando JWT
app.get('/api/clientes', requireAuthJWT, async (req, res) => {
  try {
    const connection = await mysql.createConnection({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: req.user.dbName,
      charset: 'utf8mb4'
    });
    const [rows] = await connection.execute('SELECT * FROM clientes ORDER BY razao');
    await connection.end();
    res.json(rows);
  } catch (error) {
    console.error('Erro ao listar clientes:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/clientes', requireAuthJWT, async (req, res) => {
  try {
    const connection = await mysql.createConnection({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: req.user.dbName,
      charset: 'utf8mb4'
    });
    const { razao, cnpj, ie, endereco, bairro, cidade, estado, cep, email, telefone, transporte, prazo, obs } = req.body;
    const [result] = await connection.execute(
      'INSERT INTO clientes (razao, cnpj, ie, endereco, bairro, cidade, estado, cep, email, telefone, transporte, prazo, obs) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      safeValues([razao, cnpj, ie, endereco, bairro, cidade, estado, cep, email, telefone, transporte, prazo, obs])
    );
    await connection.end();
    res.status(201).json({ id: result.insertId, message: 'Cliente criado com sucesso' });
  } catch (error) {
    console.error('Erro ao cadastrar cliente:', error);
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/clientes/:id', requireAuthJWT, async (req, res) => {
  try {
    const connection = await mysql.createConnection({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: req.user.dbName,
      charset: 'utf8mb4'
    });
    const { id } = req.params;
    const { razao, cnpj, ie, endereco, bairro, cidade, estado, cep, email, telefone, transporte, prazo, obs } = req.body;
    await connection.execute(
      'UPDATE clientes SET razao = ?, cnpj = ?, ie = ?, endereco = ?, bairro = ?, cidade = ?, estado = ?, cep = ?, email = ?, telefone = ?, transporte = ?, prazo = ?, obs = ? WHERE id = ?',
      [...safeValues([razao, cnpj, ie, endereco, bairro, cidade, estado, cep, email, telefone, transporte, prazo, obs]), id]
    );
    await connection.end();
    res.json({ message: 'Cliente atualizado com sucesso' });
  } catch (error) {
    console.error('Erro ao atualizar cliente:', error);
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/clientes/:id', requireAuthJWT, async (req, res) => {
  try {
    const connection = await mysql.createConnection({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: req.user.dbName,
      charset: 'utf8mb4'
    });
    const { id } = req.params;
    await connection.execute('DELETE FROM clientes WHERE id = ?', [id]);
    await connection.end();
    res.json({ message: 'Cliente removido com sucesso' });
  } catch (error) {
    console.error('Erro ao remover cliente:', error);
    res.status(500).json({ error: error.message });
  }
});

// --- Documentos do cliente (PDF e imagens) ---
const uploadsDir = path.join(__dirname, 'uploads');
const allowedMimes = [
  'application/pdf',
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/gif',
  'image/webp'
];

const storageDocumentos = multer.diskStorage({
  destination: async (req, file, cb) => {
    try {
      const dbName = (req.user && req.user.dbName) ? String(req.user.dbName).replace(/[^a-z0-9_]/g, '_') : 'default';
      const clienteId = req.params.id || '0';
      const dir = path.join(uploadsDir, dbName, 'clientes', clienteId);
      await fs.mkdir(dir, { recursive: true });
      cb(null, dir);
    } catch (err) {
      cb(err);
    }
  },
  filename: (req, file, cb) => {
    const nomeOriginal = (file.originalname || 'arquivo').replace(/[^a-zA-Z0-9._-]/g, '_');
    const ext = path.extname(nomeOriginal) || (file.mimetype === 'application/pdf' ? '.pdf' : path.extname(nomeOriginal));
    cb(null, `${Date.now()}-${nomeOriginal}`);
  }
});

const uploadDocumentos = multer({
  storage: storageDocumentos,
  limits: { fileSize: 15 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Tipo de arquivo não permitido. Use PDF ou imagens (JPEG, PNG, GIF, WebP).'));
    }
  }
});

app.get('/api/clientes/:id/documentos', requireAuthJWT, async (req, res) => {
  try {
    const connection = await mysql.createConnection({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: req.user.dbName,
      charset: 'utf8mb4'
    });
    const { id } = req.params;
    const [rows] = await connection.execute(
      'SELECT id, nome_original, nome_arquivo, caminho, tipo_mime, tamanho, created_at FROM cliente_documentos WHERE cliente_id = ? ORDER BY created_at DESC',
      [id]
    );
    await connection.end();
    res.json(rows);
  } catch (error) {
    console.error('Erro ao listar documentos:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/clientes/:id/documentos', requireAuthJWT, (req, res, next) => {
  uploadDocumentos.array('arquivo', 20)(req, res, async (err) => {
    if (err) {
      if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ error: 'Arquivo muito grande. Máximo 15 MB por arquivo.' });
      }
      return res.status(400).json({ error: err.message || 'Erro no upload.' });
    }
    const files = req.files && req.files.length ? req.files : [];
    if (files.length === 0) {
      return res.status(400).json({ error: 'Nenhum arquivo enviado. Envie um ou mais PDFs ou imagens.' });
    }
    try {
      const connection = await mysql.createConnection({
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: req.user.dbName,
        charset: 'utf8mb4'
      });
      const { id } = req.params;
      const uploaded = [];
      for (const file of files) {
        const caminhoRel = path.relative(path.join(__dirname, 'uploads'), file.path).replace(/\\/g, '/');
        await connection.execute(
          'INSERT INTO cliente_documentos (cliente_id, nome_original, nome_arquivo, caminho, tipo_mime, tamanho) VALUES (?, ?, ?, ?, ?, ?)',
          [id, file.originalname || file.filename, file.filename, caminhoRel, file.mimetype, file.size || 0]
        );
        uploaded.push(file.originalname || file.filename);
      }
      await connection.end();
      res.status(201).json({ message: files.length === 1 ? 'Documento anexado com sucesso.' : `${files.length} documentos anexados com sucesso.`, count: files.length });
    } catch (error) {
      console.error('Erro ao salvar documento:', error);
      for (const file of files) {
        try { await fs.unlink(file.path); } catch (_) {}
      }
      res.status(500).json({ error: error.message });
    }
  });
});

app.get('/api/clientes/:id/documentos/:docId/arquivo', requireAuthJWT, async (req, res) => {
  try {
    const connection = await mysql.createConnection({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: req.user.dbName,
      charset: 'utf8mb4'
    });
    const { id, docId } = req.params;
    const [rows] = await connection.execute(
      'SELECT caminho, nome_original, tipo_mime FROM cliente_documentos WHERE id = ? AND cliente_id = ?',
      [docId, id]
    );
    await connection.end();
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Documento não encontrado.' });
    }
    const doc = rows[0];
    const fullPath = path.join(uploadsDir, doc.caminho);
    try {
      await fs.access(fullPath);
    } catch (_) {
      return res.status(404).json({ error: 'Arquivo não encontrado no servidor.' });
    }
    res.setHeader('Content-Type', doc.tipo_mime || 'application/octet-stream');
    res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(doc.nome_original)}"`);
    res.sendFile(path.resolve(fullPath));
  } catch (error) {
    console.error('Erro ao servir documento:', error);
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/clientes/:id/documentos/:docId', requireAuthJWT, async (req, res) => {
  try {
    const connection = await mysql.createConnection({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: req.user.dbName,
      charset: 'utf8mb4'
    });
    const { id, docId } = req.params;
    const [rows] = await connection.execute(
      'SELECT caminho FROM cliente_documentos WHERE id = ? AND cliente_id = ?',
      [docId, id]
    );
    if (rows.length === 0) {
      await connection.end();
      return res.status(404).json({ error: 'Documento não encontrado.' });
    }
    const fullPath = path.join(uploadsDir, rows[0].caminho);
    await connection.execute('DELETE FROM cliente_documentos WHERE id = ? AND cliente_id = ?', [docId, id]);
    await connection.end();
    try {
      await fs.unlink(fullPath);
    } catch (_) {}
    res.json({ message: 'Documento removido com sucesso' });
  } catch (error) {
    console.error('Erro ao remover documento:', error);
    res.status(500).json({ error: error.message });
  }
});

// Rotas de produtos (multi-tenant) protegidas por JWT
app.get('/api/produtos', requireAuthJWT, async (req, res) => {
  try {
    const connection = await mysql.createConnection({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: req.user.dbName,
      charset: 'utf8mb4'
    });
    const [rows] = await connection.execute('SELECT * FROM produtos ORDER BY nome');
    console.log('Produtos retornados pela API:', rows);
    await connection.end();
    res.json(rows);
  } catch (error) {
    console.error('Erro ao listar produtos:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/produtos', requireAuthJWT, async (req, res) => {
  try {
    const connection = await mysql.createConnection({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: req.user.dbName,
      charset: 'utf8mb4'
    });
    const { nome, descricao, preco_custo, preco_venda, categoria, codigo, estoque, fornecedor, peso, dimensoes, status } = req.body;
    console.log('Dados recebidos para criar produto:', { nome, descricao, preco_custo, preco_venda, categoria, codigo, estoque, fornecedor, peso, dimensoes, status });
    const valores = safeValues([nome, descricao, preco_custo, preco_venda, categoria, codigo, estoque, fornecedor, peso, dimensoes, status]);
    console.log('Valores processados:', valores);
    const [result] = await connection.execute(
      'INSERT INTO produtos (nome, descricao, preco_custo, preco_venda, categoria, codigo, estoque, fornecedor, peso, dimensoes, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      valores
    );
    await connection.end();
    res.status(201).json({ id: result.insertId, message: 'Produto criado com sucesso' });
  } catch (error) {
    console.error('Erro ao cadastrar produto:', error);
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/produtos/:id', requireAuthJWT, async (req, res) => {
  try {
    const connection = await mysql.createConnection({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: req.user.dbName,
      charset: 'utf8mb4'
    });
    const { id } = req.params;
    const { nome, descricao, preco_custo, preco_venda, categoria, codigo, estoque, fornecedor, peso, dimensoes, status } = req.body;
    await connection.execute(
      'UPDATE produtos SET nome = ?, descricao = ?, preco_custo = ?, preco_venda = ?, categoria = ?, codigo = ?, estoque = ?, fornecedor = ?, peso = ?, dimensoes = ?, status = ? WHERE id = ?',
      [...safeValues([nome, descricao, preco_custo, preco_venda, categoria, codigo, estoque, fornecedor, peso, dimensoes, status]), id]
    );
    await connection.end();
    res.json({ message: 'Produto atualizado com sucesso' });
  } catch (error) {
    console.error('Erro ao atualizar produto:', error);
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/produtos/:id', requireAuthJWT, async (req, res) => {
  try {
    const connection = await mysql.createConnection({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: req.user.dbName,
      charset: 'utf8mb4'
    });
    const { id } = req.params;
    await connection.execute('DELETE FROM produtos WHERE id = ?', [id]);
    await connection.end();
    res.json({ message: 'Produto removido com sucesso' });
  } catch (error) {
    console.error('Erro ao remover produto:', error);
    res.status(500).json({ error: error.message });
  }
});

// Rotas de pedidos (multi-tenant) protegidas por JWT
app.get('/api/pedidos', requireAuthJWT, async (req, res) => {
  try {
    const connection = await mysql.createConnection({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: req.user.dbName,
      charset: 'utf8mb4'
    });
    const [rows] = await connection.execute(`
      SELECT p.*, COALESCE(p.nome_cliente, c.razao) as nome_cliente, c.cnpj, c.telefone, c.email, c.endereco 
      FROM pedidos p 
      LEFT JOIN clientes c ON p.cliente_id = c.id 
      ORDER BY p.data_pedido DESC, p.id DESC
    `);
    // Buscar itens de todos os pedidos
    const [itens] = await connection.execute(`
      SELECT pi.pedido_id, pi.produto_id, pi.quantidade, pi.preco_unitario, pr.nome as produto, pr.preco_custo, pr.preco_venda
      FROM pedido_itens pi
      LEFT JOIN produtos pr ON pi.produto_id = pr.id
    `);
    // Agrupar itens por pedido_id
    const itensPorPedido = {};
    itens.forEach(item => {
      if (!itensPorPedido[item.pedido_id]) itensPorPedido[item.pedido_id] = [];
      itensPorPedido[item.pedido_id].push({
        produto_id: item.produto_id,
        produto: item.produto,
        quantidade: item.quantidade,
        precoUnitario: item.preco_unitario,
        preco_custo: item.preco_custo,
        preco_venda: item.preco_venda,
        subtotal: Number(item.preco_unitario) * Number(item.quantidade)
      });
    });
    // Adicionar array itens em cada pedido
    const pedidosComItens = rows.map(pedido => ({
      ...pedido,
      itens: itensPorPedido[pedido.id] || []
    }));
    await connection.end();
    res.json(pedidosComItens);
  } catch (error) {
    console.error('Erro ao listar pedidos:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/pedidos', requireAuthJWT, async (req, res) => {
  let connection;
  try {
    connection = await mysql.createConnection({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: req.user.dbName,
      charset: 'utf8mb4'
    });
    const { cliente_id, data_pedido, status, valor_total, observacoes, itens, nome_cliente } = req.body;
    // Validar itens
    if ((!Array.isArray(itens) || itens.length === 0) && status !== 'Em Aberto') {
      return res.status(400).json({ error: 'O pedido deve conter pelo menos um item.' });
    }
    // Normalizar o status e a data
    const statusNormalizado = normalizarStatus(status);
    const dataNormalizada = normalizarData(data_pedido);
    // Verificar se o pedido está sendo criado como "Concluído"
    const estaConcluindo = statusNormalizado === 'Concluído';
    
    // Iniciar transação
    await connection.beginTransaction();
    // Inserir pedido
    const [result] = await connection.execute(
      'INSERT INTO pedidos (cliente_id, nome_cliente, data_pedido, status, valor_total, observacoes) VALUES (?, ?, ?, ?, ?, ?)',
      safeValues([cliente_id, nome_cliente, dataNormalizada, statusNormalizado, valor_total, observacoes])
    );
    const pedidoId = result.insertId;
    
    // Inserir itens
    for (const item of itens) {
      await connection.execute(
        'INSERT INTO pedido_itens (pedido_id, produto_id, quantidade, preco_unitario) VALUES (?, ?, ?, ?)',
        [pedidoId, ...safeValues([item.produto_id, item.quantidade, item.preco_unitario])]
      );
      
      // Se o pedido está sendo criado como "Concluído", atualizar estoque
      if (estaConcluindo && item.produto_id && item.quantidade) {
        // Buscar estoque atual do produto
        const [produtoResult] = await connection.execute(
          'SELECT estoque FROM produtos WHERE id = ?',
          [item.produto_id]
        );
        
        if (produtoResult.length > 0) {
          const estoqueAtual = produtoResult[0].estoque || 0;
          const novaQuantidade = estoqueAtual - item.quantidade;
          
          // Atualizar estoque (permitir valores negativos)
          await connection.execute(
            'UPDATE produtos SET estoque = ? WHERE id = ?',
            [novaQuantidade, item.produto_id]
          );
          
          console.log(`Estoque atualizado: Produto ID ${item.produto_id}, estoque anterior: ${estoqueAtual}, quantidade vendida: ${item.quantidade}, novo estoque: ${novaQuantidade}`);
        }
      }
    }
    
    await connection.commit();
    await connection.end();
    res.status(201).json({ id: pedidoId, message: 'Pedido criado com sucesso' });
  } catch (error) {
    console.error('Erro ao cadastrar pedido:', error);
    if (connection) await connection.rollback();
    if (connection) await connection.end();
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/pedidos/:id', requireAuthJWT, async (req, res) => {
  let connection;
  try {
    connection = await mysql.createConnection({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: req.user.dbName,
      charset: 'utf8mb4'
    });
    const { id } = req.params;
    const { cliente_id, data_pedido, status, valor_total, observacoes, itens, nome_cliente } = req.body;
    const itensArray = Array.isArray(itens) ? itens : [];
    
    // Normalizar o status e a data
    const statusNormalizado = normalizarStatus(status);
    const dataNormalizada = normalizarData(data_pedido);
    
    // Verificar se o status está sendo alterado para "Concluído"
    const [pedidoAtual] = await connection.execute('SELECT status FROM pedidos WHERE id = ?', [id]);
    const statusAnterior = pedidoAtual[0]?.status;
    const estaConcluindo = statusNormalizado === 'Concluído' && statusAnterior !== 'Concluído';
    
    // Iniciar transação
    await connection.beginTransaction();
    
    // Atualizar pedido
    await connection.execute(
      'UPDATE pedidos SET cliente_id = ?, nome_cliente = ?, data_pedido = ?, status = ?, valor_total = ?, observacoes = ? WHERE id = ?',
      [...safeValues([cliente_id, nome_cliente, dataNormalizada, statusNormalizado, valor_total, observacoes]), id]
    );
    
    // Se está concluindo o pedido, atualizar estoque
    if (estaConcluindo && itensArray.length > 0) {
      for (const item of itensArray) {
        if (item.produto_id && item.quantidade) {
          // Buscar estoque atual do produto
          const [produtoResult] = await connection.execute(
            'SELECT estoque FROM produtos WHERE id = ?',
            [item.produto_id]
          );
          
          if (produtoResult.length > 0) {
            const estoqueAtual = produtoResult[0].estoque || 0;
            const novaQuantidade = estoqueAtual - item.quantidade;
            
            // Atualizar estoque (permitir valores negativos)
            await connection.execute(
              'UPDATE produtos SET estoque = ? WHERE id = ?',
              [novaQuantidade, item.produto_id]
            );
            
            console.log(`Estoque atualizado: Produto ID ${item.produto_id}, estoque anterior: ${estoqueAtual}, quantidade vendida: ${item.quantidade}, novo estoque: ${novaQuantidade}`);
          }
        }
      }
    }
    
    // Remover itens antigos
    await connection.execute('DELETE FROM pedido_itens WHERE pedido_id = ?', [id]);
    
    // Inserir novos itens
    for (const item of itensArray) {
      await connection.execute(
        'INSERT INTO pedido_itens (pedido_id, produto_id, quantidade, preco_unitario) VALUES (?, ?, ?, ?)',
        [id, ...safeValues([item.produto_id, item.quantidade, item.preco_unitario])]
      );
    }
    
    await connection.commit();
    await connection.end();
    res.json({ message: 'Pedido atualizado com sucesso' });
  } catch (error) {
    console.error('Erro ao atualizar pedido:', error);
    if (connection) await connection.rollback();
    if (connection) await connection.end();
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/pedidos/:id', requireAuthJWT, async (req, res) => {
  try {
    const connection = await mysql.createConnection({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: req.user.dbName,
      charset: 'utf8mb4'
    });
    const { id } = req.params;
    await connection.execute('DELETE FROM pedido_itens WHERE pedido_id = ?', [id]);
    await connection.execute('DELETE FROM pedidos WHERE id = ?', [id]);
    await connection.end();
    res.json({ message: 'Pedido removido com sucesso' });
  } catch (error) {
    console.error('Erro ao remover pedido:', error);
    res.status(500).json({ error: error.message });
  }
});

// Rotas para Caixa
// Listar lançamentos de caixa
app.get('/api/caixa', async (req, res) => {
  try {
    const connection = await mysql.createConnection({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: 'jpsistemas_admin',
      charset: 'utf8mb4'
    });
    const [rows] = await connection.execute('SELECT * FROM caixa ORDER BY data DESC, id DESC');
    await connection.end();
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Registrar novo pagamento/lançamento
app.post('/api/caixa', async (req, res) => {
  try {
    const connection = await mysql.createConnection({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: 'jpsistemas_admin',
      charset: 'utf8mb4'
    });
    const { tipo, valor, descricao, data, pedido_id } = req.body;
    const [result] = await connection.execute(
      'INSERT INTO caixa (tipo, valor, descricao, data, pedido_id) VALUES (?, ?, ?, ?, ?)',
      safeValues([tipo, valor, descricao, data, pedido_id])
    );
    await connection.end();
    res.status(201).json({ id: result.insertId, message: 'Lançamento registrado com sucesso' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Rota para relatórios
app.get('/api/relatorios/estatisticas', requireAuthJWT, async (req, res) => {
  try {
    console.log('Banco usado para estatísticas:', req.user && req.user.dbName);
    const connection = await mysql.createConnection({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: req.user.dbName,
      charset: 'utf8mb4'
    });

    // Verificar se foi passado um parâmetro de mês
    const { mes } = req.query;
    let mesFiltro = '';
    let anoFiltro = '';
    
    if (mes) {
      const [ano, mesNum] = mes.split('-');
      mesFiltro = parseInt(mesNum, 10); // Garante que o mês é inteiro
      anoFiltro = parseInt(ano, 10);
    } else {
      // Se não foi passado, usar mês atual
      const hoje = new Date();
      mesFiltro = hoje.getMonth() + 1;
      anoFiltro = hoje.getFullYear();
    }

    // Buscar total de clientes (sempre geral)
    const [clientesResult] = await connection.execute('SELECT COUNT(*) as total FROM clientes');
    const totalClientes = clientesResult[0].total;

    // Buscar total de produtos (sempre geral)
    const [produtosResult] = await connection.execute('SELECT COUNT(*) as total FROM produtos');
    const totalProdutos = produtosResult[0].total;

    // Buscar total de pedidos CONCLUÍDOS
    const [pedidosResult] = await connection.execute('SELECT COUNT(*) as total FROM pedidos WHERE status IN ("Concluído", "concluído", "Concluido", "concluido", "CONCLUÍDO", "CONCLUIDO")');
    console.log('Total pedidos concluídos encontrados:', pedidosResult[0].total);
    const totalPedidos = pedidosResult[0].total;

    // Buscar total de pedidos EM PROCESSAMENTO
    const [pedidosProcessamentoResult] = await connection.execute('SELECT COUNT(*) as total FROM pedidos WHERE status IN ("Em Processamento", "em processamento", "Em processamento", "EM PROCESSAMENTO", "pendente", "Pendente", "PENDENTE")');
    const totalPedidosProcessamento = pedidosProcessamentoResult[0].total;

    // Buscar soma total de vendas (valor_total dos pedidos CONCLUÍDOS)
    const [vendasResult] = await connection.execute('SELECT COALESCE(SUM(valor_total), 0) as total FROM pedidos WHERE status IN ("Concluído", "concluído", "Concluido", "concluido", "CONCLUÍDO", "CONCLUIDO")');
    const totalVendas = parseFloat(vendasResult[0].total);

    // Buscar soma total de vendas EM PROCESSAMENTO
    const [vendasProcessamentoResult] = await connection.execute('SELECT COALESCE(SUM(valor_total), 0) as total FROM pedidos WHERE status IN ("Em Processamento", "em processamento", "Em processamento", "EM PROCESSAMENTO", "pendente", "Pendente", "PENDENTE")');
    const totalVendasProcessamento = parseFloat(vendasProcessamentoResult[0].total);

    // Buscar lucro total (aproximação baseada na diferença entre preço de venda e custo)
    // Para uma aproximação mais precisa, vamos usar uma margem média de 30%
    const lucroTotal = totalVendas * 0.3;
    const lucroTotalProcessamento = totalVendasProcessamento * 0.3;

    // Buscar pedidos CONCLUÍDOS do mês selecionado
    const [pedidosMesResult] = await connection.execute(`
      SELECT COUNT(*) as total 
      FROM pedidos 
      WHERE MONTH(data_pedido) = ? 
      AND YEAR(data_pedido) = ?
      AND status IN ("Concluído", "concluído", "Concluido", "concluido", "CONCLUÍDO", "CONCLUIDO")
    `, [mesFiltro, anoFiltro]);
    const pedidosMes = pedidosMesResult[0].total;

    // Buscar pedidos EM PROCESSAMENTO do mês selecionado
    const [pedidosMesProcessamentoResult] = await connection.execute(`
      SELECT COUNT(*) as total 
      FROM pedidos 
      WHERE MONTH(data_pedido) = ? 
      AND YEAR(data_pedido) = ?
      AND status IN ("Em Processamento", "em processamento", "Em processamento", "EM PROCESSAMENTO", "pendente", "Pendente", "PENDENTE")
    `, [mesFiltro, anoFiltro]);
    const pedidosMesProcessamento = pedidosMesProcessamentoResult[0].total;

    // Buscar vendas do mês selecionado (apenas pedidos CONCLUÍDOS)
    const [vendasMesResult] = await connection.execute(`
      SELECT COALESCE(SUM(valor_total), 0) as total 
      FROM pedidos 
      WHERE MONTH(data_pedido) = ? 
      AND YEAR(data_pedido) = ?
      AND status IN ("Concluído", "concluído", "Concluido", "concluido", "CONCLUÍDO", "CONCLUIDO")
    `, [mesFiltro, anoFiltro]);
    const vendasMes = parseFloat(vendasMesResult[0].total);

    // Buscar vendas EM PROCESSAMENTO do mês selecionado
    const [vendasMesProcessamentoResult] = await connection.execute(`
      SELECT COALESCE(SUM(valor_total), 0) as total 
      FROM pedidos 
      WHERE MONTH(data_pedido) = ? 
      AND YEAR(data_pedido) = ?
      AND status IN ("Em Processamento", "em processamento", "Em processamento", "EM PROCESSAMENTO", "pendente", "Pendente", "PENDENTE")
    `, [mesFiltro, anoFiltro]);
    const vendasMesProcessamento = parseFloat(vendasMesProcessamentoResult[0].total);

    // Calcular lucro do mês
    const lucroMes = vendasMes * 0.3;
    const lucroMesProcessamento = vendasMesProcessamento * 0.3;

    await connection.end();

    res.json({
      totalClientes,
      totalProdutos,
      totalPedidos,
      totalPedidosProcessamento,
      totalVendas: totalVendas.toFixed(2),
      totalVendasProcessamento: totalVendasProcessamento.toFixed(2),
      lucroTotal: lucroTotal.toFixed(2),
      lucroTotalProcessamento: lucroTotalProcessamento.toFixed(2),
      pedidosMes,
      pedidosMesProcessamento,
      vendasMes: vendasMes.toFixed(2),
      vendasMesProcessamento: vendasMesProcessamento.toFixed(2),
      lucroMes: lucroMes.toFixed(2),
      lucroMesProcessamento: lucroMesProcessamento.toFixed(2),
      mesSelecionado: mes || `${anoFiltro}-${String(mesFiltro).padStart(2, '0')}`
    });

  } catch (error) {
    console.error('Erro ao buscar estatísticas:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Rota de teste para setar um cookie manualmente
app.get('/api/test-cookie', (req, res) => {
  res.cookie('testcookie', 'valor', {
    secure: true,
    httpOnly: true,
    sameSite: 'none',
    domain: '.jp-sistemas.vercel.app',
    maxAge: 60000 // 1 minuto
  });
  res.json({ ok: true });
});

// Rotas para servir páginas do painel e principais HTML
const publicPath = path.join(__dirname, 'public');

app.get('/painel', (req, res) => {
  res.sendFile(path.join(publicPath, 'painel.html'));
});
app.get('/painel-clientes', (req, res) => {
  res.sendFile(path.join(publicPath, 'painel-clientes.html'));
});
app.get('/pedidos', (req, res) => {
  res.sendFile(path.join(publicPath, 'pedidos.html'));
});
app.get('/produtos', (req, res) => {
  res.sendFile(path.join(publicPath, 'produtos.html'));
});
app.get('/relatorios', (req, res) => {
  res.sendFile(path.join(publicPath, 'relatorios.html'));
});
app.get('/configuracoes', (req, res) => {
  res.sendFile(path.join(publicPath, 'configuracoes.html'));
});
app.get('/caixa', (req, res) => {
  res.sendFile(path.join(publicPath, 'caixa.html'));
});
app.get('/ajuda', (req, res) => {
  res.sendFile(path.join(publicPath, 'ajuda.html'));
});

app.use('/api/contas', require('./api/contas'));

// Página 404 personalizada para rotas não encontradas
app.use((req, res) => {
  res.status(404).sendFile(path.join(publicPath, '404.html'));
});

// Inicialização do servidor (apenas se executado diretamente)
if (require.main === module) {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`🚀 Servidor J.P Sistemas rodando na porta ${PORT}`);
    console.log(`📱 Acesse: http://localhost:${PORT}`);
    console.log(`🔧 Ambiente: ${process.env.NODE_ENV || 'development'}`);
  });
}
