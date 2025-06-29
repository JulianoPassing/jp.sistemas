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

// Rota pública para listar clientes (exemplo para banco do admin)
app.get('/api/clientes', async (req, res) => {
  try {
    // Conectar ao banco do admin (ajuste para multi-tenant se necessário)
    const connection = await mysql.createConnection({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: 'jpsistemas_admin', // ou o banco correto do usuário logado
      charset: 'utf8mb4'
    });

    const [rows] = await connection.execute('SELECT * FROM clientes ORDER BY razao');
    await connection.end();
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Rota para criar novo cliente
app.post('/api/clientes', async (req, res) => {
  try {
    const connection = await mysql.createConnection({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: 'jpsistemas_admin',
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

// Rota para atualizar cliente
app.put('/api/clientes/:id', async (req, res) => {
  try {
    const connection = await mysql.createConnection({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: 'jpsistemas_admin',
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

// Rota para deletar cliente
app.delete('/api/clientes/:id', async (req, res) => {
  try {
    const connection = await mysql.createConnection({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: 'jpsistemas_admin',
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

// Rotas para Produtos
// Rota para listar produtos
app.get('/api/produtos', async (req, res) => {
  try {
    const connection = await mysql.createConnection({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: 'jpsistemas_admin',
      charset: 'utf8mb4'
    });

    const [rows] = await connection.execute('SELECT * FROM produtos ORDER BY nome');
    await connection.end();
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Rota para criar novo produto
app.post('/api/produtos', async (req, res) => {
  try {
    const connection = await mysql.createConnection({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: 'jpsistemas_admin',
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

// Rota para atualizar produto
app.put('/api/produtos/:id', async (req, res) => {
  try {
    const connection = await mysql.createConnection({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: 'jpsistemas_admin',
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

// Rota para deletar produto
app.delete('/api/produtos/:id', async (req, res) => {
  try {
    const connection = await mysql.createConnection({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: 'jpsistemas_admin',
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

// Rotas para Pedidos
// Listar pedidos
app.get('/api/pedidos', async (req, res) => {
  try {
    const connection = await mysql.createConnection({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: 'jpsistemas_admin',
      charset: 'utf8mb4'
    });
    const [rows] = await connection.execute('SELECT * FROM pedidos ORDER BY data_pedido DESC, id DESC');
    await connection.end();
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
// Criar novo pedido
app.post('/api/pedidos', async (req, res) => {
  try {
    const connection = await mysql.createConnection({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: 'jpsistemas_admin',
      charset: 'utf8mb4'
    });
    const { cliente_id, data_pedido, status, valor_total, observacoes } = req.body;
    const [result] = await connection.execute(
      'INSERT INTO pedidos (cliente_id, data_pedido, status, valor_total, observacoes) VALUES (?, ?, ?, ?, ?)',
      [cliente_id, data_pedido, status, valor_total, observacoes]
    );
    await connection.end();
    res.status(201).json({ id: result.insertId, message: 'Pedido criado com sucesso' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
// Editar pedido
app.put('/api/pedidos/:id', async (req, res) => {
  try {
    const connection = await mysql.createConnection({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: 'jpsistemas_admin',
      charset: 'utf8mb4'
    });
    const { id } = req.params;
    const { cliente_id, data_pedido, status, valor_total, observacoes } = req.body;
    await connection.execute(
      'UPDATE pedidos SET cliente_id=?, data_pedido=?, status=?, valor_total=?, observacoes=? WHERE id=?',
      [cliente_id, data_pedido, status, valor_total, observacoes, id]
    );
    await connection.end();
    res.json({ message: 'Pedido atualizado com sucesso' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
// Excluir pedido
app.delete('/api/pedidos/:id', async (req, res) => {
  try {
    const connection = await mysql.createConnection({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: 'jpsistemas_admin',
      charset: 'utf8mb4'
    });
    const { id } = req.params;
    await connection.execute('DELETE FROM pedidos WHERE id=?', [id]);
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

    // Buscar total de clientes
    const [clientesResult] = await connection.execute('SELECT COUNT(*) as total FROM clientes');
    const totalClientes = clientesResult[0].total;

    // Buscar total de produtos
    const [produtosResult] = await connection.execute('SELECT COUNT(*) as total FROM produtos');
    const totalProdutos = produtosResult[0].total;

    // Buscar total de pedidos
    const [pedidosResult] = await connection.execute('SELECT COUNT(*) as total FROM pedidos');
    const totalPedidos = pedidosResult[0].total;

    // Buscar soma total de vendas (valor_total dos pedidos)
    const [vendasResult] = await connection.execute('SELECT COALESCE(SUM(valor_total), 0) as total FROM pedidos');
    const totalVendas = parseFloat(vendasResult[0].total);

    // Buscar lucro total (aproximação baseada na diferença entre preço de venda e custo)
    // Para uma aproximação mais precisa, vamos usar uma margem média de 30%
    const lucroTotal = totalVendas * 0.3;

    // Buscar pedidos do mês atual
    const [pedidosMesResult] = await connection.execute(`
      SELECT COUNT(*) as total 
      FROM pedidos 
      WHERE MONTH(data_pedido) = MONTH(CURRENT_DATE()) 
      AND YEAR(data_pedido) = YEAR(CURRENT_DATE())
    `);
    const pedidosMes = pedidosMesResult[0].total;

    // Buscar vendas do mês atual
    const [vendasMesResult] = await connection.execute(`
      SELECT COALESCE(SUM(valor_total), 0) as total 
      FROM pedidos 
      WHERE MONTH(data_pedido) = MONTH(CURRENT_DATE()) 
      AND YEAR(data_pedido) = YEAR(CURRENT_DATE())
    `);
    const vendasMes = parseFloat(vendasMesResult[0].total);

    // Calcular lucro do mês
    const lucroMes = vendasMes * 0.3;

    await connection.end();

    res.json({
      totalClientes,
      totalProdutos,
      totalPedidos,
      totalVendas: totalVendas.toFixed(2),
      lucroTotal: lucroTotal.toFixed(2),
      pedidosMes,
      vendasMes: vendasMes.toFixed(2),
      lucroMes: lucroMes.toFixed(2)
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
