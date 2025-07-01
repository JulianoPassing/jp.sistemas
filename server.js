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
const empresaHandler = require('./api/empresa');
require('dotenv').config();
const fs = require('fs').promises;

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.all('/api/empresa', empresaHandler);

// CORS - deve vir antes de qualquer middleware de sessão ou rotas
const allowedOrigins = [
  'https://jp-sistemas.vercel.app',
  'http://localhost:3000'
];
app.use(cors({
  origin: allowedOrigins,
  credentials: true
}));

// Middleware
app.use(express.static('public'));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Configuração de sessão
const isProduction = process.env.NODE_ENV === 'production';
const sessionStore = new MySQLStore({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: 'jpsistemas_sessions'
});

app.use(session({
  name: 'connect.sid',
  secret: process.env.SESSION_SECRET || 'SeuSessionSecretMuitoForte123!',
  resave: false,
  saveUninitialized: false,
  store: sessionStore,
  cookie: {
    secure: isProduction, // true em produção (https), false em dev/local
    httpOnly: true,
    sameSite: isProduction ? 'none' : 'lax', // 'none' para cross-domain, 'lax' para local
    domain: isProduction ? '.jp-sistemas.vercel.app' : undefined, // só seta domínio em produção
    maxAge: 24 * 60 * 60 * 1000 // 24 horas
  }
}));

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

// Função para normalizar o status do pedido
function normalizarStatus(status) {
  if (!status) return '';
  const s = status.toString().trim().toLowerCase();
  if (s === 'em aberto') return 'Em Aberto';
  if (s === 'em processamento') return 'Em Processamento';
  if (s === 'concluído' || s === 'concluido') return 'Concluído';
  if (s === 'cancelado') return 'Cancelado';
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
function requireAuthJWT(req, res, next) {
  const token = req.cookies.token || (req.headers.authorization && req.headers.authorization.split(' ')[1]);
  if (!token) return res.status(401).json({ error: 'Token não fornecido.' });
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Token inválido ou expirado.' });
  }
}

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

    const userPayload = {
      id: user.id,
      username: user.username,
      email: user.email,
      isAdmin: user.is_admin,
      dbName: `jpsistemas_${username.toLowerCase().replace(/[^a-z0-9]/g, '_')}`
    };
    const token = jwt.sign(userPayload, process.env.JWT_SECRET, { expiresIn: '24h' });

    res.cookie('token', token, {
      httpOnly: true,
      secure: true,
      sameSite: 'none',
      domain: '.jp-sistemas.vercel.app',
      maxAge: 24 * 60 * 60 * 1000
    });

    res.json({ success: true, user: userPayload });
  } catch (error) {
    console.error('Erro no login:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Rota de logout para limpar o cookie JWT
app.post('/api/auth/logout', (req, res) => {
  res.clearCookie('token', {
    httpOnly: true,
    secure: true,
    sameSite: 'none',
    domain: '.jp-sistemas.vercel.app',
    path: '/'
  });
  res.json({ success: true });
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
      SELECT pi.pedido_id, pi.quantidade, pi.preco_unitario, pr.nome as produto, pr.preco_custo, pr.preco_venda
      FROM pedido_itens pi
      LEFT JOIN produtos pr ON pi.produto_id = pr.id
    `);
    // Agrupar itens por pedido_id
    const itensPorPedido = {};
    itens.forEach(item => {
      if (!itensPorPedido[item.pedido_id]) itensPorPedido[item.pedido_id] = [];
      itensPorPedido[item.pedido_id].push({
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
    if (estaConcluindo && itens && Array.isArray(itens)) {
      for (const item of itens) {
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
    for (const item of itens) {
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
app.get('/api/relatorios/estatisticas', async (req, res) => {
  try {
    const connection = await mysql.createConnection({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: 'jpsistemas_admin',
      charset: 'utf8mb4'
    });

    // Verificar se foi passado um parâmetro de mês
    const { mes } = req.query;
    let mesFiltro = '';
    let anoFiltro = '';
    
    if (mes) {
      const [ano, mesNum] = mes.split('-');
      mesFiltro = mesNum;
      anoFiltro = ano;
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

// Fallback para SPA ou 404
app.get('*', (req, res) => {
  res.sendFile(path.join(publicPath, 'index.html'));
});

module.exports = app;

// Inicialização do servidor (apenas se executado diretamente)
if (require.main === module) {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`🚀 Servidor J.P Sistemas rodando na porta ${PORT}`);
    console.log(`📱 Acesse: http://localhost:${PORT}`);
    console.log(`🔧 Ambiente: ${process.env.NODE_ENV || 'development'}`);
  });
}
