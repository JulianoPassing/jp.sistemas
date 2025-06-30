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

// Configuração de sessão simplificada (sem banco de dados)
app.use(session({
  secret: process.env.SESSION_SECRET || 'SeuSessionSecretMuitoForte123!',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: false,
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
    const usersConfig = getUsersConfig();
    const connection = await mysql.createConnection(usersConfig);

    const [users] = await connection.execute(
      'SELECT * FROM users WHERE username = ? AND is_active = TRUE',
      [username]
    );
    await connection.end();

    if (users.length === 0) {
      return res.status(401).json({ error: 'Usuário não encontrado ou inativo' });
    }

    const user = users[0];
    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      return res.status(401).json({ error: 'Senha incorreta' });
    }

    try {
      await createUserDatabase(username);
    } catch (dbError) {
      console.error('Erro ao criar banco do usuário:', dbError);
      return res.status(500).json({ error: 'Erro interno do servidor' });
    }

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

// Middleware para garantir autenticação nas rotas multi-tenant
function requireUserDb(req, res, next) {
  if (!req.session.user || !req.session.user.dbName) {
    return res.status(401).json({ error: 'Não autenticado.' });
  }
  next();
}

// Rotas de clientes (multi-tenant)
app.get('/api/clientes', requireUserDb, async (req, res) => {
  try {
    const connection = await mysql.createConnection({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: req.session.user.dbName,
      charset: 'utf8mb4'
    });
    const [rows] = await connection.execute('SELECT * FROM clientes ORDER BY razao');
    await connection.end();
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/clientes', requireUserDb, async (req, res) => {
  try {
    const connection = await mysql.createConnection({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: req.session.user.dbName,
      charset: 'utf8mb4'
    });
    const { razao, cnpj, ie, endereco, bairro, cidade, estado, cep, email, telefone, transporte, prazo, obs } = req.body;
    const [result] = await connection.execute(
      'INSERT INTO clientes (razao, cnpj, ie, endereco, bairro, cidade, estado, cep, email, telefone, transporte, prazo, obs) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [razao, cnpj, ie, endereco, bairro, cidade, estado, cep, email, telefone, transporte, prazo, obs]
    );
    await connection.end();
    res.status(201).json({ id: result.insertId, message: 'Cliente criado com sucesso' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/clientes/:id', requireUserDb, async (req, res) => {
  try {
    const connection = await mysql.createConnection({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: req.session.user.dbName,
      charset: 'utf8mb4'
    });
    const { id } = req.params;
    const { razao, cnpj, ie, endereco, bairro, cidade, estado, cep, email, telefone, transporte, prazo, obs } = req.body;
    await connection.execute(
      'UPDATE clientes SET razao = ?, cnpj = ?, ie = ?, endereco = ?, bairro = ?, cidade = ?, estado = ?, cep = ?, email = ?, telefone = ?, transporte = ?, prazo = ?, obs = ? WHERE id = ?',
      [razao, cnpj, ie, endereco, bairro, cidade, estado, cep, email, telefone, transporte, prazo, obs, id]
    );
    await connection.end();
    res.json({ message: 'Cliente atualizado com sucesso' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/clientes/:id', requireUserDb, async (req, res) => {
  try {
    const connection = await mysql.createConnection({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: req.session.user.dbName,
      charset: 'utf8mb4'
    });
    const { id } = req.params;
    await connection.execute('DELETE FROM clientes WHERE id = ?', [id]);
    await connection.end();
    res.json({ message: 'Cliente removido com sucesso' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Rotas de produtos (multi-tenant)
app.get('/api/produtos', requireUserDb, async (req, res) => {
  try {
    const connection = await mysql.createConnection({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: req.session.user.dbName,
      charset: 'utf8mb4'
    });
    const [rows] = await connection.execute('SELECT * FROM produtos ORDER BY nome');
    await connection.end();
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/produtos', requireUserDb, async (req, res) => {
  try {
    const connection = await mysql.createConnection({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: req.session.user.dbName,
      charset: 'utf8mb4'
    });
    const { nome, descricao, preco_custo, preco_venda, categoria, codigo, estoque, fornecedor, peso, dimensoes, status } = req.body;
    const [result] = await connection.execute(
      'INSERT INTO produtos (nome, descricao, preco_custo, preco_venda, categoria, codigo, estoque, fornecedor, peso, dimensoes, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [nome, descricao, preco_custo, preco_venda, categoria, codigo, estoque, fornecedor, peso, dimensoes, status]
    );
    await connection.end();
    res.status(201).json({ id: result.insertId, message: 'Produto criado com sucesso' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/produtos/:id', requireUserDb, async (req, res) => {
  try {
    const connection = await mysql.createConnection({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: req.session.user.dbName,
      charset: 'utf8mb4'
    });
    const { id } = req.params;
    const { nome, descricao, preco_custo, preco_venda, categoria, codigo, estoque, fornecedor, peso, dimensoes, status } = req.body;
    await connection.execute(
      'UPDATE produtos SET nome = ?, descricao = ?, preco_custo = ?, preco_venda = ?, categoria = ?, codigo = ?, estoque = ?, fornecedor = ?, peso = ?, dimensoes = ?, status = ? WHERE id = ?',
      [nome, descricao, preco_custo, preco_venda, categoria, codigo, estoque, fornecedor, peso, dimensoes, status, id]
    );
    await connection.end();
    res.json({ message: 'Produto atualizado com sucesso' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/produtos/:id', requireUserDb, async (req, res) => {
  try {
    const connection = await mysql.createConnection({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: req.session.user.dbName,
      charset: 'utf8mb4'
    });
    const { id } = req.params;
    await connection.execute('DELETE FROM produtos WHERE id = ?', [id]);
    await connection.end();
    res.json({ message: 'Produto removido com sucesso' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Rotas de pedidos (multi-tenant)
app.get('/api/pedidos', requireUserDb, async (req, res) => {
  try {
    const connection = await mysql.createConnection({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: req.session.user.dbName,
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
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/pedidos', requireUserDb, async (req, res) => {
  let connection;
  try {
    connection = await mysql.createConnection({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: req.session.user.dbName,
      charset: 'utf8mb4'
    });
    const { cliente_id, data_pedido, status, valor_total, observacoes, itens, nome_cliente } = req.body;
    // Validar itens
    if ((!Array.isArray(itens) || itens.length === 0) && status !== 'Em Aberto') {
      return res.status(400).json({ error: 'O pedido deve conter pelo menos um item.' });
    }
    // Normalizar o status
    const statusNormalizado = normalizarStatus(status);
    // Iniciar transação
    await connection.beginTransaction();
    // Garantir que nenhum valor seja undefined
    const safeClienteId = typeof cliente_id === 'undefined' ? null : cliente_id;
    const safeDataPedido = typeof data_pedido === 'undefined' ? null : data_pedido;
    const safeStatus = typeof statusNormalizado === 'undefined' ? null : statusNormalizado;
    const safeValorTotal = typeof valor_total === 'undefined' ? null : valor_total;
    const safeObservacoes = typeof observacoes === 'undefined' ? null : observacoes;
    const safeNomeCliente = typeof nome_cliente === 'undefined' ? null : nome_cliente;
    // Inserir pedido
    const [result] = await connection.execute(
      'INSERT INTO pedidos (cliente_id, nome_cliente, data_pedido, status, valor_total, observacoes) VALUES (?, ?, ?, ?, ?, ?)',
      [safeClienteId, safeNomeCliente, safeDataPedido, safeStatus, safeValorTotal, safeObservacoes]
    );
    const pedidoId = result.insertId;
    // Inserir itens
    for (const item of itens) {
      await connection.execute(
        'INSERT INTO pedido_itens (pedido_id, produto_id, quantidade, preco_unitario) VALUES (?, ?, ?, ?)',
        [pedidoId, item.produto_id, item.quantidade, item.preco_unitario]
      );
    }
    await connection.commit();
    await connection.end();
    res.status(201).json({ id: pedidoId, message: 'Pedido criado com sucesso' });
  } catch (error) {
    if (connection) await connection.rollback();
    if (connection) await connection.end();
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/pedidos/:id', requireUserDb, async (req, res) => {
  let connection;
  try {
    connection = await mysql.createConnection({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: req.session.user.dbName,
      charset: 'utf8mb4'
    });
    const { id } = req.params;
    const { cliente_id, data_pedido, status, valor_total, observacoes, itens, nome_cliente } = req.body;
    // Normalizar o status
    const statusNormalizado = normalizarStatus(status);
    // Iniciar transação
    await connection.beginTransaction();
    // Atualizar pedido
    await connection.execute(
      'UPDATE pedidos SET cliente_id = ?, nome_cliente = ?, data_pedido = ?, status = ?, valor_total = ?, observacoes = ? WHERE id = ?',
      [cliente_id, nome_cliente, data_pedido, statusNormalizado, valor_total, observacoes, id]
    );
    // Remover itens antigos
    await connection.execute('DELETE FROM pedido_itens WHERE pedido_id = ?', [id]);
    // Inserir novos itens
    for (const item of itens) {
      await connection.execute(
        'INSERT INTO pedido_itens (pedido_id, produto_id, quantidade, preco_unitario) VALUES (?, ?, ?, ?)',
        [id, item.produto_id, item.quantidade, item.preco_unitario]
      );
    }
    await connection.commit();
    await connection.end();
    res.json({ message: 'Pedido atualizado com sucesso' });
  } catch (error) {
    if (connection) await connection.rollback();
    if (connection) await connection.end();
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/pedidos/:id', requireUserDb, async (req, res) => {
  try {
    const connection = await mysql.createConnection({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: req.session.user.dbName,
      charset: 'utf8mb4'
    });
    const { id } = req.params;
    await connection.execute('DELETE FROM pedido_itens WHERE pedido_id = ?', [id]);
    await connection.execute('DELETE FROM pedidos WHERE id = ?', [id]);
    await connection.end();
    res.json({ message: 'Pedido removido com sucesso' });
  } catch (error) {
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
      [tipo, valor, descricao, data, pedido_id]
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

    // Buscar total de clientes
    const [clientesResult] = await connection.execute('SELECT COUNT(*) as total FROM clientes');
    const totalClientes = clientesResult[0].total;

    // Buscar total de produtos
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
