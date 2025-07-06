const express = require('express');
const mysql = require('mysql2/promise');
const { getCobrancasDatabaseConfig } = require('../database-config');
const bcrypt = require('bcryptjs');

const router = express.Router();

// Função para criar conexão com banco de cobranças
async function createCobrancasConnection() {
  const dbConfig = getCobrancasDatabaseConfig();
  try {
    const connection = await mysql.createConnection(dbConfig);
    return connection;
  } catch (error) {
    console.error('Erro ao conectar ao banco de cobranças:', error);
    throw error;
  }
}

// Função para criar banco de dados de cobranças
async function createCobrancasDatabase() {
  try {
    // Conectar como root para criar o banco
    const rootConfig = getCobrancasDatabaseConfig();
    const rootConnection = await mysql.createConnection({
      ...rootConfig,
      database: undefined // Sem especificar database para conectar como root
    });

    // Criar banco de dados
    await rootConnection.execute(`CREATE DATABASE IF NOT EXISTS \`jpsistemas_cobrancas\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
    
    // Conectar ao banco criado
    const cobrancasConnection = await createCobrancasConnection();

    // Criar tabelas
    await cobrancasConnection.execute(`
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
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_nome (nome),
        INDEX idx_cpf_cnpj (cpf_cnpj),
        INDEX idx_email (email),
        INDEX idx_status (status)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    await cobrancasConnection.execute(`
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

    await cobrancasConnection.execute(`
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

    await cobrancasConnection.execute(`
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

    await rootConnection.end();
    await cobrancasConnection.end();
    
    console.log('Banco de dados jpsistemas_cobrancas criado com sucesso');
    return true;
  } catch (error) {
    console.error('Erro ao criar banco de dados de cobranças:', error);
    throw error;
  }
}

// Middleware para inicializar banco se necessário
async function ensureDatabase(req, res, next) {
  try {
    await createCobrancasDatabase();
    next();
  } catch (error) {
    console.error('Erro ao garantir banco de dados:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
}

// Dashboard
router.get('/dashboard', ensureDatabase, async (req, res) => {
  try {
    const connection = await createCobrancasConnection();
    
    // Estatísticas gerais (apenas empréstimos Ativos)
    const [emprestimosStats] = await connection.execute(`
      SELECT 
        COUNT(CASE WHEN status = 'Ativo' AND cliente_id IS NOT NULL THEN 1 END) as total_emprestimos,
        SUM(CASE WHEN status = 'Ativo' AND cliente_id IS NOT NULL THEN valor ELSE 0 END) as valor_total_emprestimos,
        COUNT(CASE WHEN status = 'Ativo' AND cliente_id IS NOT NULL THEN 1 END) as emprestimos_ativos,
        COUNT(CASE WHEN status = 'Quitado' AND cliente_id IS NOT NULL THEN 1 END) as emprestimos_quitados
      FROM emprestimos
    `);

    const [cobrancasStats] = await connection.execute(`
      SELECT 
        COUNT(*) as total_cobrancas,
        SUM(valor_atualizado) as valor_total_cobrancas,
        COUNT(CASE WHEN status = 'Pendente' THEN 1 END) as cobrancas_pendentes,
        COUNT(CASE WHEN status = 'Paga' THEN 1 END) as cobrancas_pagas,
        SUM(CASE WHEN dias_atraso > 0 THEN valor_atualizado ELSE 0 END) as valor_atrasado
      FROM cobrancas
      WHERE cliente_id IS NOT NULL
    `);

    const [clientesStats] = await connection.execute(`
      SELECT COUNT(*) as total_clientes FROM clientes_cobrancas WHERE status = 'Ativo'
    `);

    // Empréstimos recentes (apenas ativos e com cliente)
    const [emprestimosRecentes] = await connection.execute(`
      SELECT e.*, c.nome as cliente_nome, c.telefone as telefone
      FROM emprestimos e
      LEFT JOIN clientes_cobrancas c ON e.cliente_id = c.id
      WHERE e.status IN ('Ativo', 'Pendente') AND e.cliente_id IS NOT NULL
      ORDER BY e.created_at DESC
      LIMIT 5
    `);

    // Cobranças pendentes (apenas com cliente e empréstimo ativo/pendente)
    const [cobrancasPendentes] = await connection.execute(`
      SELECT cb.*, c.nome as cliente_nome, c.telefone as telefone
      FROM cobrancas cb
      LEFT JOIN clientes_cobrancas c ON cb.cliente_id = c.id
      LEFT JOIN emprestimos e ON cb.emprestimo_id = e.id
      WHERE cb.status = 'Pendente' AND cb.cliente_id IS NOT NULL AND e.status IN ('Ativo', 'Pendente')
      ORDER BY cb.data_vencimento ASC
      LIMIT 10
    `);

    await connection.end();

    res.json({
      emprestimos: emprestimosStats[0],
      cobrancas: cobrancasStats[0],
      clientes: clientesStats[0],
      emprestimosRecentes,
      cobrancasPendentes
    });
  } catch (error) {
    console.error('Erro ao buscar dados do dashboard:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Clientes
router.get('/clientes', ensureDatabase, async (req, res) => {
  try {
    const connection = await createCobrancasConnection();
    const [clientes] = await connection.execute(`
      SELECT * FROM clientes_cobrancas 
      ORDER BY nome ASC
    `);
    await connection.end();
    res.json(clientes);
  } catch (error) {
    console.error('Erro ao buscar clientes:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

router.post('/clientes', ensureDatabase, async (req, res) => {
  try {
    const { nome, cpf_cnpj, email, telefone, endereco, cidade, estado, cep } = req.body;
    // Validação do nome do cliente
    if (!nome || typeof nome !== 'string' || ['undefined', 'n/a', 'na'].includes(nome.trim().toLowerCase()) || nome.trim() === '') {
      return res.status(400).json({ error: 'Nome do cliente inválido. Não é permitido cadastrar clientes sem nome ou com nome "undefined" ou "N/A".' });
    }
    const connection = await createCobrancasConnection();
    const [result] = await connection.execute(`
      INSERT INTO clientes_cobrancas (nome, cpf_cnpj, email, telefone, endereco, cidade, estado, cep)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, [nome, cpf_cnpj, email, telefone, endereco, cidade, estado, cep]);
    
    await connection.end();
    res.json({ id: result.insertId, message: 'Cliente criado com sucesso' });
  } catch (error) {
    console.error('Erro ao criar cliente:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Empréstimos
router.get('/emprestimos', ensureDatabase, async (req, res) => {
  try {
    const connection = await createCobrancasConnection();
    const [emprestimos] = await connection.execute(`
      SELECT e.*, c.nome as cliente_nome, c.telefone as telefone
      FROM emprestimos e
      LEFT JOIN clientes_cobrancas c ON e.cliente_id = c.id
      ORDER BY e.created_at DESC
    `);
    await connection.end();
    res.json(emprestimos);
  } catch (error) {
    console.error('Erro ao buscar empréstimos:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

router.post('/emprestimos', ensureDatabase, async (req, res) => {
  try {
    const { cliente_id, valor, data_emprestimo, data_vencimento, juros_mensal, multa_atraso, observacoes } = req.body;
    
    const connection = await createCobrancasConnection();
    
    // Inserir empréstimo
    const [emprestimoResult] = await connection.execute(`
      INSERT INTO emprestimos (cliente_id, valor, data_emprestimo, data_vencimento, juros_mensal, multa_atraso, observacoes)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [cliente_id, valor, data_emprestimo, data_vencimento, juros_mensal, multa_atraso, observacoes]);
    
    // Criar cobrança automaticamente
    await connection.execute(`
      INSERT INTO cobrancas (emprestimo_id, cliente_id, valor_original, valor_atualizado, data_vencimento, status)
      VALUES (?, ?, ?, ?, ?, 'Pendente')
    `, [emprestimoResult.insertId, cliente_id, valor, valor, data_vencimento]);
    
    await connection.end();
    res.json({ id: emprestimoResult.insertId, message: 'Empréstimo criado com sucesso' });
  } catch (error) {
    console.error('Erro ao criar empréstimo:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Cobranças
router.get('/cobrancas', ensureDatabase, async (req, res) => {
  try {
    const connection = await createCobrancasConnection();
    // Atualizar dias de atraso e valores
    await connection.execute(`
      UPDATE cobrancas 
      SET 
        dias_atraso = CASE 
          WHEN data_vencimento < CURDATE() THEN DATEDIFF(CURDATE(), data_vencimento)
          ELSE 0 
        END,
        valor_atualizado = valor_original + 
          (valor_original * (juros_calculados / 100)) + 
          (valor_original * (multa_calculada / 100))
      WHERE status = 'Pendente'
    `);
    // Buscar apenas cobranças de empréstimos ativos/pendentes e existentes
    const [cobrancas] = await connection.execute(`
      SELECT cb.*, c.nome as cliente_nome, c.telefone, c.email
      FROM cobrancas cb
      INNER JOIN emprestimos e ON cb.emprestimo_id = e.id
      LEFT JOIN clientes_cobrancas c ON cb.cliente_id = c.id
      WHERE cb.status = 'Pendente' AND cb.cliente_id IS NOT NULL AND e.status IN ('Ativo', 'Pendente')
      ORDER BY cb.data_vencimento ASC
    `);
    await connection.end();
    res.json(cobrancas);
  } catch (error) {
    console.error('Erro ao buscar cobranças:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Cobranças atrasadas
router.get('/cobrancas/atrasadas', ensureDatabase, async (req, res) => {
  try {
    const connection = await createCobrancasConnection();
    const [cobrancas] = await connection.execute(`
      SELECT cb.*, c.nome as cliente_nome, c.telefone, c.email
      FROM cobrancas cb
      LEFT JOIN clientes_cobrancas c ON cb.cliente_id = c.id
      WHERE cb.dias_atraso > 0 AND cb.status = 'Pendente'
      ORDER BY cb.dias_atraso DESC
    `);
    await connection.end();
    res.json(cobrancas);
  } catch (error) {
    console.error('Erro ao buscar cobranças atrasadas:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Cobranças pendentes do dia (com data de vencimento até o dia atual)
router.get('/cobrancas/pendentes-dia', ensureDatabase, async (req, res) => {
  try {
    const connection = await createCobrancasConnection();
    const [cobrancas] = await connection.execute(`
      SELECT cb.*, c.nome as cliente_nome, c.telefone, c.email
      FROM cobrancas cb
      LEFT JOIN clientes_cobrancas c ON cb.cliente_id = c.id
      WHERE cb.status = 'Pendente' 
        AND cb.data_vencimento <= CURDATE()
        AND cb.cliente_id IS NOT NULL
      ORDER BY cb.data_vencimento ASC
    `);
    await connection.end();
    res.json(cobrancas);
  } catch (error) {
    console.error('Erro ao buscar cobranças pendentes do dia:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Registrar pagamento
router.post('/cobrancas/:id/pagamento', ensureDatabase, async (req, res) => {
  try {
    const { id } = req.params;
    const { valor_pago, data_pagamento, forma_pagamento, observacoes } = req.body;
    
    const connection = await createCobrancasConnection();
    
    // Registrar pagamento
    await connection.execute(`
      INSERT INTO pagamentos (cobranca_id, valor_pago, data_pagamento, forma_pagamento, observacoes)
      VALUES (?, ?, ?, ?, ?)
    `, [id, valor_pago, data_pagamento, forma_pagamento, observacoes]);
    
    // Atualizar status da cobrança
    await connection.execute(`
      UPDATE cobrancas SET status = 'Paga' WHERE id = ?
    `, [id]);
    
    await connection.end();
    res.json({ message: 'Pagamento registrado com sucesso' });
  } catch (error) {
    console.error('Erro ao registrar pagamento:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Rota de login
router.post('/login', async (req, res) => {
  const { username, password } = req.body;
  try {
    // Conecte ao banco central de usuários (ex: jpsistemas_users)
    const conn = await mysql.createConnection({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: 'jpsistemas_users'
    });
    const [rows] = await conn.execute(
      'SELECT * FROM usuarios_cobrancas WHERE username = ?',
      [username]
    );
    await conn.end();

    if (rows.length === 0) {
      return res.status(401).json({ success: false, message: 'Usuário ou senha inválidos.' });
    }

    const user = rows[0];
    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      return res.status(401).json({ success: false, message: 'Usuário ou senha inválidos.' });
    }

    // Salva na sessão o usuário e o banco correspondente
    req.session.cobrancasUser = username;
    req.session.cobrancasDb = user.db_name;

    res.json({ success: true });
  } catch (err) {
    console.error('Erro no login:', err);
    res.status(500).json({ success: false, message: 'Erro interno do servidor.' });
  }
});

// Rota para verificar sessão
router.get('/session', (req, res) => {
  if (req.session.cobrancasUser) {
    res.json({ 
      authenticated: true, 
      user: req.session.cobrancasUser,
      db: req.session.cobrancasDb
    });
  } else {
    res.json({ authenticated: false });
  }
});

// Rota para logout
router.post('/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      return res.status(500).json({ success: false, message: 'Erro ao fazer logout.' });
    }
    res.json({ success: true });
  });
});

// Rota para atualizar status do empréstimo
router.put('/emprestimos/:id/status', ensureDatabase, async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const connection = await createCobrancasConnection();
    await connection.execute(
      'UPDATE emprestimos SET status = ? WHERE id = ?',
      [status, id]
    );
    // Se status for 'Em Atraso', atualiza o valor da dívida (valor = valor + juros)
    if (status === 'Em Atraso') {
      // Busca valor e juros atuais
      const [rows] = await connection.execute('SELECT valor, juros_mensal FROM emprestimos WHERE id = ?', [id]);
      if (rows.length > 0) {
        const valorAtual = parseFloat(rows[0].valor) || 0;
        const juros = parseFloat(rows[0].juros_mensal) || 0;
        const valorJuros = valorAtual * (juros / 100);
        const novoValor = valorAtual + valorJuros;
        await connection.execute('UPDATE emprestimos SET valor = ? WHERE id = ?', [novoValor, id]);
      }
    }
    // Se status for 'Quitado', marcar cobranças como 'Paga'
    if (status === 'Quitado') {
      await connection.execute('UPDATE cobrancas SET status = ? WHERE emprestimo_id = ?', ['Paga', id]);
    }
    // Se status for 'Cancelado', marcar cobranças como 'Cancelada'
    if (status === 'Cancelado') {
      await connection.execute('UPDATE cobrancas SET status = ? WHERE emprestimo_id = ?', ['Cancelada', id]);
    }
    await connection.end();
    res.json({ success: true });
  } catch (error) {
    console.error('Erro ao atualizar status do empréstimo:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Rota para remover empréstimo
router.delete('/emprestimos/:id', ensureDatabase, async (req, res) => {
  try {
    const { id } = req.params;
    const connection = await createCobrancasConnection();
    await connection.execute('DELETE FROM emprestimos WHERE id = ?', [id]);
    await connection.end();
    res.json({ success: true });
  } catch (error) {
    console.error('Erro ao remover empréstimo:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Remover cliente
router.delete('/clientes/:id', ensureDatabase, async (req, res) => {
  const { id } = req.params;
  try {
    const connection = await createCobrancasConnection();
    // Verifica se o cliente possui empréstimos vinculados
    const [emprestimos] = await connection.execute(
      'SELECT COUNT(*) as total FROM emprestimos WHERE cliente_id = ?',
      [id]
    );
    if (emprestimos[0].total > 0) {
      await connection.end();
      return res.status(400).json({ error: 'Não é possível remover clientes com empréstimos vinculados.' });
    }
    // Remove o cliente
    await connection.execute('DELETE FROM clientes_cobrancas WHERE id = ?', [id]);
    await connection.end();
    res.json({ message: 'Cliente removido com sucesso.' });
  } catch (error) {
    console.error('Erro ao remover cliente:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Rota para buscar detalhes de um cliente pelo ID
router.get('/clientes/:id', ensureDatabase, async (req, res) => {
  try {
    const { id } = req.params;
    console.log('DEBUG /clientes/:id - id recebido:', id);
    const connection = await createCobrancasConnection();
    // Buscar dados do cliente
    const [rows] = await connection.execute('SELECT * FROM clientes_cobrancas WHERE id = ?', [id]);
    if (rows.length === 0) {
      await connection.end();
      return res.status(404).json({ error: 'Cliente não encontrado' });
    }
    const cliente = rows[0];
    // Buscar empréstimos do cliente (apenas ativos e pendentes)
    const [emprestimos] = await connection.execute(
      'SELECT * FROM emprestimos WHERE cliente_id = ? AND status IN (?, ?) ORDER BY created_at DESC',
      [id, 'Ativo', 'Pendente']
    );
    console.log('DEBUG /clientes/:id - emprestimos encontrados:', emprestimos);
    // Buscar pagamentos relacionados a esses empréstimos (por cobrança)
    let pagamentos = [];
    if (emprestimos.length > 0) {
      const emprestimoIds = emprestimos.map(e => e.id);
      // Buscar cobranças desses empréstimos
      const [cobrancas] = await connection.execute(`SELECT * FROM cobrancas WHERE cliente_id = ?`, [id]);
      const cobrancaIds = cobrancas.map(c => c.id);
      if (cobrancaIds.length > 0) {
        const [pagamentosRows] = await connection.execute(`SELECT * FROM pagamentos WHERE cobranca_id IN (${cobrancaIds.map(() => '?').join(',')}) ORDER BY data_pagamento DESC`, cobrancaIds);
        pagamentos = pagamentosRows;
      }
    }
    await connection.end();
    res.json({ ...cliente, emprestimos, pagamentos });
  } catch (error) {
    console.error('Erro ao buscar cliente:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

module.exports = router; 