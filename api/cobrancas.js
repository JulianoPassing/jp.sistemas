const express = require('express');
const mysql = require('mysql2/promise');
const { getCobrancasDatabaseConfig } = require('../database-config');
const bcrypt = require('bcryptjs');

const router = express.Router();

// Função para criar conexão com banco de cobranças do usuário
async function createCobrancasConnection(username) {
  const dbName = `jpcobrancas_${username.toLowerCase().replace(/[^a-z0-9]/g, '_')}`;
  const dbConfig = {
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'jpsistemas',
    password: process.env.DB_PASSWORD || 'Juliano@95',
    database: dbName,
    charset: 'utf8mb4'
  };
  
  try {
    const connection = await mysql.createConnection(dbConfig);
    return connection;
  } catch (error) {
    console.error(`Erro ao conectar ao banco de cobranças do usuário ${username}:`, error);
    throw error;
  }
}

// Função para criar banco de dados de cobranças do usuário
async function createCobrancasDatabase(username) {
  const dbName = `jpcobrancas_${username.toLowerCase().replace(/[^a-z0-9]/g, '_')}`;
  
  try {
    // Conectar como root para criar o banco
    const rootConnection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'jpsistemas',
      password: process.env.DB_PASSWORD || 'Juliano@95',
      charset: 'utf8mb4'
    });

    // Criar banco de dados
    await rootConnection.execute(`CREATE DATABASE IF NOT EXISTS \`${dbName}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
    
    // Conectar ao banco criado
    const cobrancasConnection = await createCobrancasConnection(username);

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
        observacoes TEXT,
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
        tipo_emprestimo ENUM('fixed', 'in_installments') DEFAULT 'fixed',
        numero_parcelas INT DEFAULT 1,
        frequencia ENUM('daily', 'weekly', 'biweekly', 'monthly') DEFAULT 'monthly',
        valor_parcela DECIMAL(10,2) DEFAULT 0.00,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (cliente_id) REFERENCES clientes_cobrancas(id) ON DELETE SET NULL,
        INDEX idx_cliente_id (cliente_id),
        INDEX idx_data_vencimento (data_vencimento),
        INDEX idx_status (status),
        INDEX idx_tipo_emprestimo (tipo_emprestimo)
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

    await cobrancasConnection.execute(`
      CREATE TABLE IF NOT EXISTS parcelas (
        id INT AUTO_INCREMENT PRIMARY KEY,
        emprestimo_id INT NOT NULL,
        numero_parcela INT NOT NULL,
        valor_parcela DECIMAL(10,2) NOT NULL,
        data_vencimento DATE NOT NULL,
        status ENUM('Pendente', 'Paga', 'Atrasada') DEFAULT 'Pendente',
        valor_pago DECIMAL(10,2) DEFAULT 0.00,
        data_pagamento DATE NULL,
        juros_aplicados DECIMAL(10,2) DEFAULT 0.00,
        multa_aplicada DECIMAL(10,2) DEFAULT 0.00,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (emprestimo_id) REFERENCES emprestimos(id) ON DELETE CASCADE,
        INDEX idx_emprestimo_id (emprestimo_id),
        INDEX idx_data_vencimento (data_vencimento),
        INDEX idx_status (status),
        UNIQUE KEY unique_emprestimo_parcela (emprestimo_id, numero_parcela)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    await rootConnection.end();
    await cobrancasConnection.end();
    
    console.log(`Banco de dados ${dbName} criado com sucesso para o usuário ${username}`);
    return true;
  } catch (error) {
    console.error(`Erro ao criar banco de dados de cobranças para ${username}:`, error);
    throw error;
  }
}

// Middleware para inicializar banco se necessário
async function ensureDatabase(req, res, next) {
  try {
    const username = req.session.cobrancasUser;
    if (!username) {
      return res.status(401).json({ error: 'Usuário não autenticado' });
    }
    await createCobrancasDatabase(username);
    next();
  } catch (error) {
    console.error('Erro ao garantir banco de dados:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
}

// Dashboard - Versão Completa Restaurada
router.get('/dashboard', ensureDatabase, async (req, res) => {
  try {
    console.log('Dashboard: Iniciando busca de dados');
    const username = req.session.cobrancasUser;
    console.log('Dashboard: Username da sessão:', username);
    
    if (!username) {
      console.log('Dashboard: Erro - usuário não autenticado');
      return res.status(401).json({ error: 'Usuário não autenticado' });
    }
    
    const connection = await createCobrancasConnection(username);
    console.log('Dashboard: Conexão criada com sucesso');
    
    // Valores padrão para evitar erros
    let emprestimosStats = [{ 
      total_emprestimos: 0, 
      valor_total_emprestimos: 0, 
      emprestimos_ativos: 0, 
      emprestimos_quitados: 0 
    }];
    let cobrancasStats = [{ 
      total_cobrancas: 0, 
      valor_total_cobrancas: 0, 
      cobrancas_pendentes: 0, 
      cobrancas_pagas: 0, 
      valor_atrasado: 0 
    }];
    let clientesStats = [{ total_clientes: 0 }];
    let emprestimosRecentes = [];
    let cobrancasPendentes = [];
    let clientesEmAtraso = [{ total: 0 }];
    let emprestimosEmAtraso = [{ total: 0 }];
    let clientesAtivos = [{ total: 0 }];
    let emprestimosAtivos = [{ total: 0 }];
    
    try {
      // Atualizar dias de atraso - Query corrigida
      console.log('Dashboard: Atualizando dias de atraso');
      await connection.execute(`
        UPDATE cobrancas 
        SET dias_atraso = CASE 
          WHEN data_vencimento < CURDATE() THEN DATEDIFF(CURDATE(), data_vencimento)
          ELSE 0 
        END
        WHERE TRIM(UPPER(status)) = 'PENDENTE'
      `);
      console.log('Dashboard: Dias de atraso atualizados');
    } catch (error) {
      console.log('Dashboard: Erro ao atualizar dias de atraso:', error.message);
    }

    try {
      // Estatísticas de empréstimos - Query robusta com múltiplas tentativas
      console.log('Dashboard: Buscando estatísticas de empréstimos');
      
      // Query para somar o VALOR INICIAL de todos os empréstimos
      console.log('Dashboard: Buscando VALOR INICIAL de todos os empréstimos');
      [emprestimosStats] = await connection.execute(`
        SELECT 
          COUNT(*) as total_emprestimos,
          COALESCE(SUM(valor), 0) as valor_total_emprestimos,
          COUNT(*) as emprestimos_ativos,
          0 as emprestimos_quitados
        FROM emprestimos
        WHERE valor > 0
      `);
      console.log('Dashboard: Total investido (valor inicial):', emprestimosStats[0].valor_total_emprestimos);
      console.log('Dashboard: Estatísticas completas:', emprestimosStats[0]);
    } catch (error) {
      console.log('Dashboard: Erro ao buscar estatísticas de empréstimos:', error.message);
    }

    try {
      // Estatísticas de cobranças - Query corrigida
      console.log('Dashboard: Buscando estatísticas de cobranças');
      [cobrancasStats] = await connection.execute(`
        SELECT 
          COUNT(*) as total_cobrancas,
          COALESCE(SUM(valor_atualizado), 0) as valor_total_cobrancas,
          COUNT(CASE WHEN TRIM(UPPER(status)) = 'PENDENTE' THEN 1 END) as cobrancas_pendentes,
          COUNT(CASE WHEN TRIM(UPPER(status)) = 'PAGA' THEN 1 END) as cobrancas_pagas,
          COALESCE(SUM(CASE WHEN dias_atraso > 0 THEN valor_atualizado ELSE 0 END), 0) as valor_atrasado
        FROM cobrancas
        WHERE cliente_id IS NOT NULL
      `);
      console.log('Dashboard: Estatísticas de cobranças obtidas:', cobrancasStats[0]);
    } catch (error) {
      console.log('Dashboard: Erro ao buscar estatísticas de cobranças:', error.message);
    }

    try {
      // Verificar se a tabela clientes_cobrancas existe
      console.log('Dashboard: Verificando tabela clientes_cobrancas');
      const [tables] = await connection.execute(`SHOW TABLES LIKE 'clientes_cobrancas'`);
      
      if (tables.length > 0) {
        // Estatísticas de clientes - Query corrigida
        console.log('Dashboard: Buscando estatísticas de clientes');
        [clientesStats] = await connection.execute(`
          SELECT COUNT(*) as total_clientes FROM clientes_cobrancas WHERE TRIM(UPPER(status)) IN ('ATIVO', 'PENDENTE')
        `);
        console.log('Dashboard: Estatísticas de clientes obtidas:', clientesStats[0]);
      } else {
        console.log('Dashboard: Tabela clientes_cobrancas não existe, usando valor padrão');
      }
    } catch (error) {
      console.log('Dashboard: Erro ao buscar estatísticas de clientes:', error.message);
    }

    try {
      // Empréstimos recentes - Query robusta
      console.log('Dashboard: Buscando empréstimos recentes');
      
      // Tentar primeiro com status ativos conhecidos
      [emprestimosRecentes] = await connection.execute(`
        SELECT e.*, c.nome as cliente_nome, c.telefone as telefone
        FROM emprestimos e
        LEFT JOIN clientes_cobrancas c ON e.cliente_id = c.id
        WHERE e.cliente_id IS NOT NULL AND e.cliente_id > 0
          AND TRIM(UPPER(e.status)) IN ('ATIVO', 'PENDENTE', 'EM ANDAMENTO', 'VIGENTE', 'ABERTO')
        ORDER BY e.created_at DESC
        LIMIT 5
      `);
      
      // Se não encontrou nenhum, pegar os mais recentes independente do status
      if (emprestimosRecentes.length === 0) {
        console.log('Dashboard: Nenhum empréstimo ativo encontrado, buscando todos os recentes');
        [emprestimosRecentes] = await connection.execute(`
          SELECT e.*, c.nome as cliente_nome, c.telefone as telefone
          FROM emprestimos e
          LEFT JOIN clientes_cobrancas c ON e.cliente_id = c.id
          WHERE e.cliente_id IS NOT NULL AND e.cliente_id > 0
          ORDER BY e.created_at DESC
          LIMIT 5
        `);
      }
      
      console.log('Dashboard: Empréstimos recentes obtidos:', emprestimosRecentes.length);
    } catch (error) {
      console.log('Dashboard: Erro ao buscar empréstimos recentes:', error.message);
    }

    try {
      // Cobranças pendentes - Query corrigida
      console.log('Dashboard: Buscando cobranças pendentes');
      [cobrancasPendentes] = await connection.execute(`
        SELECT cb.*, c.nome as cliente_nome, c.telefone as telefone
        FROM cobrancas cb
        LEFT JOIN clientes_cobrancas c ON cb.cliente_id = c.id
        LEFT JOIN emprestimos e ON cb.emprestimo_id = e.id
        WHERE TRIM(UPPER(cb.status)) = 'PENDENTE' AND cb.cliente_id IS NOT NULL AND TRIM(UPPER(e.status)) IN ('ATIVO', 'PENDENTE')
        ORDER BY cb.data_vencimento ASC
        LIMIT 10
      `);
      console.log('Dashboard: Cobranças pendentes obtidas:', cobrancasPendentes.length);
    } catch (error) {
      console.log('Dashboard: Erro ao buscar cobranças pendentes:', error.message);
    }

    try {
      // Clientes em atraso - Baseado em parcelas
      console.log('Dashboard: Buscando clientes em atraso');
      
      // Primeiro tentar com parcelas (sistema parcelado)
      try {
      [clientesEmAtraso] = await connection.execute(`
        SELECT COUNT(DISTINCT c.id) as total
        FROM clientes_cobrancas c
        JOIN emprestimos e ON e.cliente_id = c.id
          JOIN parcelas p ON p.emprestimo_id = e.id
          WHERE TRIM(UPPER(p.status)) = 'PENDENTE'
            AND p.data_vencimento < CURDATE()
            AND TRIM(UPPER(e.status)) IN ('ATIVO', 'PENDENTE')
        `);
        console.log('Dashboard: Clientes em atraso (baseado em parcelas):', clientesEmAtraso[0]);
      } catch (parcelasError) {
        // Se não há tabela parcelas, usar cobranças em atraso
        console.log('Dashboard: Tabela parcelas não encontrada, usando cobranças');
        [clientesEmAtraso] = await connection.execute(`
          SELECT COUNT(DISTINCT c.id) as total
          FROM clientes_cobrancas c
          JOIN cobrancas cb ON cb.cliente_id = c.id
          WHERE TRIM(UPPER(cb.status)) = 'PENDENTE'
            AND cb.data_vencimento < CURDATE()
            AND cb.dias_atraso > 0
      `);
        console.log('Dashboard: Clientes em atraso (baseado em cobranças):', clientesEmAtraso[0]);
      }
    } catch (error) {
      console.log('Dashboard: Erro ao buscar clientes em atraso:', error.message);
    }

    try {
      // Empréstimos em atraso - Query corrigida
      console.log('Dashboard: Buscando empréstimos em atraso');
      [emprestimosEmAtraso] = await connection.execute(`
        SELECT COUNT(*) as total
        FROM emprestimos e
        WHERE TRIM(UPPER(e.status)) IN ('ATIVO', 'PENDENTE')
          AND TRIM(UPPER(e.status)) <> 'QUITADO'
          AND e.data_vencimento < CURDATE()
      `);
      console.log('Dashboard: Empréstimos em atraso obtidos:', emprestimosEmAtraso[0]);
    } catch (error) {
      console.log('Dashboard: Erro ao buscar empréstimos em atraso:', error.message);
    }

    try {
      // Clientes ativos - Query corrigida
      console.log('Dashboard: Buscando clientes ativos');
      [clientesAtivos] = await connection.execute(`
        SELECT COUNT(DISTINCT c.id) as total
        FROM clientes_cobrancas c
        JOIN emprestimos e ON e.cliente_id = c.id
        WHERE TRIM(UPPER(e.status)) IN ('ATIVO', 'PENDENTE')
          AND TRIM(UPPER(e.status)) <> 'QUITADO'
      `);
      console.log('Dashboard: Clientes ativos obtidos:', clientesAtivos[0]);
    } catch (error) {
      console.log('Dashboard: Erro ao buscar clientes ativos:', error.message);
    }

    try {
      // Empréstimos ativos - Query corrigida
      console.log('Dashboard: Buscando empréstimos ativos');
      [emprestimosAtivos] = await connection.execute(`
        SELECT COUNT(*) as total
        FROM emprestimos
        WHERE TRIM(UPPER(status)) IN ('ATIVO', 'PENDENTE')
          AND TRIM(UPPER(status)) <> 'QUITADO'
      `);
      console.log('Dashboard: Empréstimos ativos obtidos:', emprestimosAtivos[0]);
    } catch (error) {
      console.log('Dashboard: Erro ao buscar empréstimos ativos:', error.message);
    }

    await connection.end();
    console.log('Dashboard: Conexão fechada');

    const response = {
      emprestimos: emprestimosStats[0],
      cobrancas: cobrancasStats[0],
      clientes: clientesStats[0],
      emprestimosRecentes,
      cobrancasPendentes,
      clientesEmAtraso: clientesEmAtraso[0].total,
      emprestimosEmAtraso: emprestimosEmAtraso[0].total,
      clientesAtivos: clientesAtivos[0].total,
      emprestimosAtivos: emprestimosAtivos[0].total
    };
    
    console.log('Dashboard: Resposta preparada com dados:', {
      emprestimos: response.emprestimos,
      cobrancas: response.cobrancas,
      clientes: response.clientes,
      emprestimosRecentes: response.emprestimosRecentes?.length || 0,
      cobrancasPendentes: response.cobrancasPendentes?.length || 0
    });
    
    res.json(response);
  } catch (error) {
    console.error('Erro ao buscar dados do dashboard:', error);
    console.error('Stack trace:', error.stack);
    res.status(500).json({ error: 'Erro interno do servidor', details: error.message });
  }
});

// Clientes
router.get('/clientes', ensureDatabase, async (req, res) => {
  try {
    const username = req.session.cobrancasUser;
    const connection = await createCobrancasConnection(username);
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
    
    // Tratar valores undefined para null
    const params = [
      nome,
      cpf_cnpj || null,
      email || null,
      telefone || null,
      endereco || null,
      cidade || null,
      estado || null,
      cep || null
    ];
    
    console.log('Dados do cliente para inserção:', { nome, cpf_cnpj, email, telefone, endereco, cidade, estado, cep });
    console.log('Parâmetros tratados:', params);
    
    const username = req.session.cobrancasUser;
    const connection = await createCobrancasConnection(username);
    
    const [result] = await connection.execute(`
      INSERT INTO clientes_cobrancas (nome, cpf_cnpj, email, telefone, endereco, cidade, estado, cep)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, params);
    
    await connection.end();
    res.json({ id: result.insertId, message: 'Cliente criado com sucesso' });
  } catch (error) {
    console.error('Erro ao criar cliente:', error);
    res.status(500).json({ error: 'Erro interno do servidor', details: error.message });
  }
});

// Buscar parcelas de um empréstimo (rota duplicada removida - mantendo apenas a mais completa abaixo)

// Atualizar status de uma parcela específica
router.put('/emprestimos/:emprestimo_id/parcelas/:numero_parcela/status', ensureDatabase, async (req, res) => {
  try {
    const { emprestimo_id, numero_parcela } = req.params;
    const { status, data_pagamento, valor_pago, observacoes } = req.body;
    
    const username = req.session.cobrancasUser;
    const connection = await createCobrancasConnection(username);
    
    // Buscar a parcela
    const [parcelas] = await connection.execute(`
      SELECT p.*, c.id as cobranca_id
      FROM parcelas p
      LEFT JOIN cobrancas c ON c.emprestimo_id = p.emprestimo_id AND c.data_vencimento = p.data_vencimento
      WHERE p.emprestimo_id = ? AND p.numero_parcela = ?
    `, [emprestimo_id, numero_parcela]);
    
    if (parcelas.length === 0) {
      await connection.end();
      return res.status(404).json({ error: 'Parcela não encontrada' });
    }
    
    const parcela = parcelas[0];
    
    // Atualizar status da parcela
    await connection.execute(`
      UPDATE parcelas 
      SET status = ?, data_pagamento = ?, valor_pago = ?, updated_at = CURRENT_TIMESTAMP
      WHERE emprestimo_id = ? AND numero_parcela = ?
    `, [status, data_pagamento || null, valor_pago || parcela.valor_parcela, emprestimo_id, numero_parcela]);
    
    // Atualizar cobrança relacionada se existir
    if (parcela.cobranca_id) {
      await connection.execute(`
        UPDATE cobrancas 
        SET status = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `, [status === 'Paga' ? 'Paga' : 'Pendente', parcela.cobranca_id]);
      
      // Se foi marcada como paga, registrar o pagamento
      if (status === 'Paga' && data_pagamento) {
        await connection.execute(`
          INSERT INTO pagamentos (cobranca_id, valor_pago, data_pagamento, forma_pagamento, observacoes)
          VALUES (?, ?, ?, ?, ?)
        `, [parcela.cobranca_id, valor_pago || parcela.valor_parcela, data_pagamento, 'Manual', observacoes || `Pagamento da parcela ${numero_parcela}`]);
      }
    }
    
    // Verificar se todas as parcelas estão pagas para atualizar o empréstimo
    const [todasParcelas] = await connection.execute(`
      SELECT COUNT(*) as total, SUM(CASE WHEN status = 'Paga' THEN 1 ELSE 0 END) as pagas
      FROM parcelas
      WHERE emprestimo_id = ?
    `, [emprestimo_id]);
    
    if (todasParcelas[0].total === todasParcelas[0].pagas) {
      // Todas as parcelas estão pagas, marcar empréstimo como quitado
      await connection.execute(`
        UPDATE emprestimos 
        SET status = 'Quitado', updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `, [emprestimo_id]);
    } else {
      // Garantir que o empréstimo não esteja marcado como quitado se nem todas as parcelas estão pagas
      await connection.execute(`
        UPDATE emprestimos 
        SET status = 'Ativo', updated_at = CURRENT_TIMESTAMP
        WHERE id = ? AND status = 'Quitado'
      `, [emprestimo_id]);
    }
    
    await connection.end();
    res.json({ message: 'Status da parcela atualizado com sucesso' });
  } catch (error) {
    console.error('Erro ao atualizar status da parcela:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Atualizar empréstimo
router.put('/emprestimos/:id', ensureDatabase, async (req, res) => {
  try {
    const { id } = req.params;
    const { 
      cliente_id, 
      valor, 
      juros_mensal, 
      data_vencimento, 
      frequencia_pagamento, 
      numero_parcelas, 
      status, 
      observacoes 
    } = req.body;
    
    const username = req.session.cobrancasUser;
    const connection = await createCobrancasConnection(username);
    
    // Verificar se o empréstimo existe
    const [emprestimos] = await connection.execute(
      'SELECT * FROM emprestimos WHERE id = ?',
      [id]
    );
    
    if (emprestimos.length === 0) {
      await connection.end();
      return res.status(404).json({ error: 'Empréstimo não encontrado' });
    }
    
    const emprestimoAtual = emprestimos[0];
    
    // Atualizar empréstimo
    await connection.execute(`
      UPDATE emprestimos 
      SET cliente_id = ?, 
          valor = ?, 
          juros_mensal = ?, 
          data_vencimento = ?, 
          frequencia_pagamento = ?, 
          numero_parcelas = ?, 
          status = ?, 
          observacoes = ?,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [
      cliente_id, 
      valor, 
      juros_mensal, 
      data_vencimento, 
      frequencia_pagamento, 
      numero_parcelas, 
      status, 
      observacoes,
      id
    ]);
    
    // Se o número de parcelas mudou, atualizar as parcelas
    if (numero_parcelas !== emprestimoAtual.numero_parcelas) {
      // Remover parcelas antigas
      await connection.execute('DELETE FROM parcelas WHERE emprestimo_id = ?', [id]);
      
      // Criar novas parcelas se for parcelado
      if (numero_parcelas > 1) {
        const valorParcela = valor / numero_parcelas;
        const dataVencimento = new Date(data_vencimento);
        
        for (let i = 1; i <= numero_parcelas; i++) {
          const dataParcelaVencimento = new Date(dataVencimento);
          
          // Calcular data de vencimento baseada na frequência
          switch (frequencia_pagamento) {
            case 'weekly':
              dataParcelaVencimento.setDate(dataParcelaVencimento.getDate() + (i - 1) * 7);
              break;
            case 'biweekly':
              dataParcelaVencimento.setDate(dataParcelaVencimento.getDate() + (i - 1) * 14);
              break;
            case 'daily':
              dataParcelaVencimento.setDate(dataParcelaVencimento.getDate() + (i - 1));
              break;
            case 'monthly':
            default:
              dataParcelaVencimento.setMonth(dataParcelaVencimento.getMonth() + (i - 1));
              break;
          }
          
          await connection.execute(`
            INSERT INTO parcelas (emprestimo_id, numero_parcela, valor_parcela, data_vencimento, status)
            VALUES (?, ?, ?, ?, ?)
          `, [id, i, valorParcela, dataParcelaVencimento.toISOString().split('T')[0], 'Pendente']);
        }
      }
    }
    
    // Atualizar cobranças relacionadas
    await connection.execute(`
      UPDATE cobrancas 
      SET valor_original = ?, 
          valor_atualizado = ?, 
          data_vencimento = ?,
          updated_at = CURRENT_TIMESTAMP
      WHERE emprestimo_id = ?
    `, [valor, valor, data_vencimento, id]);
    
    await connection.end();
    res.json({ message: 'Empréstimo atualizado com sucesso' });
    
  } catch (error) {
    console.error('Erro ao atualizar empréstimo:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Empréstimos
router.get('/emprestimos', ensureDatabase, async (req, res) => {
  try {
    const username = req.session.cobrancasUser;
    const connection = await createCobrancasConnection(username);
    
    // Atualizar status das parcelas atrasadas
    await connection.execute(`
      UPDATE parcelas 
      SET status = 'Atrasada' 
      WHERE status = 'Pendente' 
        AND data_vencimento < CURDATE()
    `);
    
    const [emprestimos] = await connection.execute(`
      SELECT DISTINCT e.*, c.nome as cliente_nome, c.telefone as telefone,
             CASE 
               WHEN e.tipo_emprestimo = 'in_installments' THEN (e.valor_parcela * e.numero_parcelas)
               ELSE e.valor * (1 + (e.juros_mensal / 100))
             END as valor_final,
             DATE_FORMAT(e.data_emprestimo, '%Y-%m-%d') as data_emprestimo_formatada,
             DATE_FORMAT(e.data_vencimento, '%Y-%m-%d') as data_vencimento_formatada
      FROM emprestimos e
      LEFT JOIN clientes_cobrancas c ON e.cliente_id = c.id
      ORDER BY e.created_at DESC
    `);
    
    // Garantir que as datas estão no formato correto
    emprestimos.forEach(emp => {
      if (emp.data_emprestimo_formatada) {
        emp.data_emprestimo = emp.data_emprestimo_formatada;
      }
      if (emp.data_vencimento_formatada) {
        emp.data_vencimento = emp.data_vencimento_formatada;
      }
    });
    
    console.log(`API /emprestimos: Retornando ${emprestimos.length} empréstimos para usuário ${username}`);
    emprestimos.forEach(emp => {
      console.log(`  - ID ${emp.id}: ${emp.cliente_nome} - R$ ${emp.valor} (${emp.status})`);
    });
    
    await connection.end();
    res.json(emprestimos);
  } catch (error) {
    console.error('Erro ao buscar empréstimos:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Buscar empréstimo por ID
router.get('/emprestimos/:id', ensureDatabase, async (req, res) => {
  try {
    const { id } = req.params;
    const username = req.session.cobrancasUser;
    const connection = await createCobrancasConnection(username);
    
    const [emprestimos] = await connection.execute(`
      SELECT e.*, c.nome as cliente_nome, c.telefone as telefone
      FROM emprestimos e
      LEFT JOIN clientes_cobrancas c ON e.cliente_id = c.id
      WHERE e.id = ?
    `, [id]);
    
    await connection.end();
    
    if (emprestimos.length === 0) {
      return res.status(404).json({ error: 'Empréstimo não encontrado' });
    }
    
    res.json(emprestimos[0]);
  } catch (error) {
    console.error('Erro ao buscar empréstimo:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Informações do usuário autenticado
router.get('/usuario-info', async (req, res) => {
  try {
    const username = req.session.cobrancasUser;
    
    if (!username) {
      return res.status(401).json({ error: 'Usuário não autenticado' });
    }

    res.json({
      username: username,
      authenticated: true
    });
  } catch (error) {
    console.error('Erro ao buscar informações do usuário:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Estatísticas do histórico de empréstimos
router.get('/historico-emprestimos/estatisticas', ensureDatabase, async (req, res) => {
  try {
    const username = req.session.cobrancasUser;
    const connection = await createCobrancasConnection(username);
    
    // Atualizar status das parcelas atrasadas
    const [updateResult] = await connection.execute(`
      UPDATE parcelas 
      SET status = 'Atrasada' 
      WHERE status = 'Pendente' 
        AND data_vencimento < CURDATE()
    `);
    
    // Buscar estatísticas gerais
    const [stats] = await connection.execute(`
      SELECT 
        COUNT(e.id) as total_emprestimos,
        COALESCE(SUM(e.valor), 0) as valor_total_inicial,
        COALESCE(SUM(CASE 
          WHEN e.tipo_emprestimo = 'in_installments' THEN (e.valor_parcela * e.numero_parcelas)
          ELSE e.valor * (1 + (e.juros_mensal / 100))
        END), 0) as valor_total_final
      FROM emprestimos e
    `);
    
    // Contar empréstimos por status baseado nas parcelas
    const [statusStats] = await connection.execute(`
      SELECT 
        -- Empréstimos ativos: têm parcelas pendentes mas não atrasadas, OU são valor fixo e não vencidos
        COUNT(DISTINCT CASE 
          WHEN (EXISTS (SELECT 1 FROM parcelas p WHERE p.emprestimo_id = e.id AND p.status = 'Pendente')
                AND NOT EXISTS (SELECT 1 FROM parcelas p WHERE p.emprestimo_id = e.id AND p.status = 'Atrasada'))
            OR (NOT EXISTS (SELECT 1 FROM parcelas p WHERE p.emprestimo_id = e.id) 
                AND e.data_vencimento >= CURDATE() 
                AND e.status = 'Ativo')
          THEN e.id 
        END) as emprestimos_ativos,
        
        -- Empréstimos quitados: todas as parcelas pagas OU valor fixo já pago
        COUNT(DISTINCT CASE 
          WHEN (NOT EXISTS (SELECT 1 FROM parcelas p WHERE p.emprestimo_id = e.id AND p.status IN ('Pendente', 'Atrasada'))
                AND EXISTS (SELECT 1 FROM parcelas p WHERE p.emprestimo_id = e.id AND p.status = 'Paga'))
            OR (NOT EXISTS (SELECT 1 FROM parcelas p WHERE p.emprestimo_id = e.id) 
                AND e.status = 'Quitado')
          THEN e.id 
        END) as emprestimos_quitados,
        
        -- Empréstimos em atraso: têm parcelas atrasadas OU valor fixo vencido
        COUNT(DISTINCT CASE 
          WHEN EXISTS (SELECT 1 FROM parcelas p WHERE p.emprestimo_id = e.id AND p.status = 'Atrasada')
            OR (NOT EXISTS (SELECT 1 FROM parcelas p WHERE p.emprestimo_id = e.id) 
                AND e.data_vencimento < CURDATE() 
                AND e.status = 'Ativo')
          THEN e.id 
        END) as emprestimos_atraso,
        
        -- Empréstimos sem parcelas (valor fixo)
        COUNT(CASE 
          WHEN NOT EXISTS (SELECT 1 FROM parcelas p WHERE p.emprestimo_id = e.id)
          THEN e.id 
        END) as emprestimos_valor_fixo
      FROM emprestimos e
    `);
    
    // Debug detalhado: vamos investigar cada empréstimo individualmente
    const [todosEmprestimos] = await connection.execute(`
      SELECT 
        e.id,
        e.cliente_id,
        c.nome as cliente_nome,
        e.data_vencimento,
        e.status,
        e.tipo_emprestimo,
        e.numero_parcelas,
        COUNT(p.id) as total_parcelas_db,
        SUM(CASE WHEN p.status = 'Paga' THEN 1 ELSE 0 END) as parcelas_pagas,
        SUM(CASE WHEN p.status = 'Pendente' THEN 1 ELSE 0 END) as parcelas_pendentes,
        SUM(CASE WHEN p.status = 'Atrasada' THEN 1 ELSE 0 END) as parcelas_atrasadas,
        -- Verificar se seria contado como "em atraso" pela query das estatísticas
        CASE 
          WHEN EXISTS (SELECT 1 FROM parcelas p2 WHERE p2.emprestimo_id = e.id AND p2.status = 'Atrasada') THEN 'ATRASO_POR_PARCELA'
          WHEN NOT EXISTS (SELECT 1 FROM parcelas p2 WHERE p2.emprestimo_id = e.id) 
               AND e.data_vencimento < CURDATE() 
               AND e.status = 'Ativo' THEN 'ATRASO_VALOR_FIXO'
          ELSE 'NAO_ATRASO'
        END as classificacao_atraso
      FROM emprestimos e
      LEFT JOIN clientes_cobrancas c ON e.cliente_id = c.id
      LEFT JOIN parcelas p ON e.id = p.emprestimo_id
      GROUP BY e.id, e.cliente_id, c.nome, e.data_vencimento, e.status, e.tipo_emprestimo, e.numero_parcelas
      ORDER BY e.id
    `);
    
    console.log('🔍 COMPARAÇÃO DETALHADA - Análise individual de cada empréstimo:');
    console.log(`Total de empréstimos encontrados: ${todosEmprestimos.length}`);
    
    const emprestimosClassificadosAtraso = todosEmprestimos.filter(emp => emp.classificacao_atraso !== 'NAO_ATRASO');
    
    console.log(`Empréstimos classificados como "em atraso" pela query das estatísticas: ${emprestimosClassificadosAtraso.length}`);
    console.log(`Contagem reportada pela query agregada: ${statusStats[0].emprestimos_atraso}`);
    
    if (emprestimosClassificadosAtraso.length > 0) {
      console.log('Detalhes dos empréstimos classificados como "em atraso":');
      emprestimosClassificadosAtraso.forEach(emp => {
        console.log(`  ID ${emp.id}: ${emp.cliente_nome} | Tipo: ${emp.tipo_emprestimo} | Status: ${emp.status} | Classificação: ${emp.classificacao_atraso}`);
        console.log(`    Parcelas - Total: ${emp.total_parcelas_db}, Pagas: ${emp.parcelas_pagas}, Atrasadas: ${emp.parcelas_atrasadas}`);
        console.log(`    Vencimento: ${emp.data_vencimento}`);
        
        // Verificar se este empréstimo deveria realmente estar em atraso
        const statusCalculado = emp.parcelas_pagas === emp.total_parcelas_db && emp.total_parcelas_db > 0 ? 'Quitado' : 
                               emp.parcelas_atrasadas > 0 ? 'Em Atraso' : 'Ativo';
        
        console.log(`    Status calculado pela lógica de correção: ${statusCalculado}`);
        
        if (emp.classificacao_atraso !== 'NAO_ATRASO' && statusCalculado !== 'Em Atraso') {
          console.log(`    ⚠️  DISCREPÂNCIA ENCONTRADA: Query das estatísticas classifica como atraso, mas lógica de correção não!`);
        }
      });
    }
    
    // Verificar se há diferença na contagem
    if (emprestimosClassificadosAtraso.length !== statusStats[0].emprestimos_atraso) {
      console.log(`⚠️  INCONSISTÊNCIA: Contagem individual (${emprestimosClassificadosAtraso.length}) != Query agregada (${statusStats[0].emprestimos_atraso})`);
    }
    
    // Correção automática: se há discrepância, corrigir status dos empréstimos
    let correcoes_automaticas = 0;
    for (const emp of todosEmprestimos) {
      const statusCalculado = emp.parcelas_pagas === emp.total_parcelas_db && emp.total_parcelas_db > 0 ? 'Quitado' : 
                             emp.parcelas_atrasadas > 0 ? 'Em Atraso' : 'Ativo';
      
      if (emp.status !== statusCalculado) {
        console.log(`🔧 Correção automática: Empréstimo ${emp.id} (${emp.cliente_nome}) | ${emp.status} → ${statusCalculado}`);
        
        await connection.execute(`
          UPDATE emprestimos 
          SET status = ? 
          WHERE id = ?
        `, [statusCalculado, emp.id]);
        
        correcoes_automaticas++;
      }
    }
    
    if (correcoes_automaticas > 0) {
      console.log(`✅ Correções automáticas aplicadas: ${correcoes_automaticas} empréstimos`);
      
      // Recalcular estatísticas após correções
      const [statusStatsAtualizadas] = await connection.execute(`
        SELECT 
          COUNT(DISTINCT CASE 
            WHEN (EXISTS (SELECT 1 FROM parcelas p WHERE p.emprestimo_id = e.id AND p.status = 'Pendente')
                  AND NOT EXISTS (SELECT 1 FROM parcelas p WHERE p.emprestimo_id = e.id AND p.status = 'Atrasada'))
              OR (NOT EXISTS (SELECT 1 FROM parcelas p WHERE p.emprestimo_id = e.id) 
                  AND e.data_vencimento >= CURDATE() 
                  AND e.status = 'Ativo')
            THEN e.id 
          END) as emprestimos_ativos,
          
          COUNT(DISTINCT CASE 
            WHEN (NOT EXISTS (SELECT 1 FROM parcelas p WHERE p.emprestimo_id = e.id AND p.status IN ('Pendente', 'Atrasada'))
                  AND EXISTS (SELECT 1 FROM parcelas p WHERE p.emprestimo_id = e.id AND p.status = 'Paga'))
              OR (NOT EXISTS (SELECT 1 FROM parcelas p WHERE p.emprestimo_id = e.id) 
                  AND e.status = 'Quitado')
            THEN e.id 
          END) as emprestimos_quitados,
          
          COUNT(DISTINCT CASE 
            WHEN EXISTS (SELECT 1 FROM parcelas p WHERE p.emprestimo_id = e.id AND p.status = 'Atrasada')
              OR (NOT EXISTS (SELECT 1 FROM parcelas p WHERE p.emprestimo_id = e.id) 
                  AND e.data_vencimento < CURDATE() 
                  AND e.status = 'Ativo')
            THEN e.id 
          END) as emprestimos_atraso
        FROM emprestimos e
      `);
      
      // Usar estatísticas atualizadas
      Object.assign(statusStats[0], statusStatsAtualizadas[0]);
      console.log(`📊 Estatísticas atualizadas após correção: Ativos: ${statusStats[0].emprestimos_ativos}, Quitados: ${statusStats[0].emprestimos_quitados}, Atraso: ${statusStats[0].emprestimos_atraso}`);
    }
    
    // Debug: verificar parcelas atrasadas
    const [parcelasAtrasadas] = await connection.execute(`
      SELECT 
        p.id,
        p.emprestimo_id,
        p.numero_parcela,
        p.data_vencimento,
        p.status,
        e.cliente_id,
        c.nome as cliente_nome
      FROM parcelas p
      LEFT JOIN emprestimos e ON p.emprestimo_id = e.id
      LEFT JOIN clientes_cobrancas c ON e.cliente_id = c.id
      WHERE p.status = 'Atrasada'
    `);
    
    console.log('Histórico: Parcelas atrasadas encontradas:', parcelasAtrasadas.length);
    
    // Debug: listar empréstimos considerados em atraso
    const [emprestimosAtraso] = await connection.execute(`
      SELECT 
        e.id,
        e.cliente_id,
        c.nome as cliente_nome,
        e.data_emprestimo,
        e.data_vencimento,
        e.status as status_emprestimo,
        e.tipo_emprestimo,
        e.numero_parcelas,
        COUNT(p.id) as total_parcelas,
        COUNT(CASE WHEN p.status = 'Atrasada' THEN 1 END) as parcelas_atrasadas,
        'parcelas_atrasadas' as motivo_atraso
      FROM emprestimos e
      LEFT JOIN clientes_cobrancas c ON e.cliente_id = c.id
      LEFT JOIN parcelas p ON p.emprestimo_id = e.id
      WHERE EXISTS (SELECT 1 FROM parcelas p2 WHERE p2.emprestimo_id = e.id AND p2.status = 'Atrasada')
      GROUP BY e.id, e.cliente_id, c.nome, e.data_emprestimo, e.data_vencimento, e.status, e.tipo_emprestimo, e.numero_parcelas
      
      UNION
      
      SELECT 
        e.id,
        e.cliente_id,
        c.nome as cliente_nome,
        e.data_emprestimo,
        e.data_vencimento,
        e.status as status_emprestimo,
        e.tipo_emprestimo,
        e.numero_parcelas,
        0 as total_parcelas,
        0 as parcelas_atrasadas,
        'valor_fixo_vencido' as motivo_atraso
      FROM emprestimos e
      LEFT JOIN clientes_cobrancas c ON e.cliente_id = c.id
      WHERE NOT EXISTS (SELECT 1 FROM parcelas p WHERE p.emprestimo_id = e.id)
        AND e.data_vencimento < CURDATE()
        AND e.status = 'Ativo'
      ORDER BY id
    `);
    
    console.log('Histórico: Empréstimos considerados em atraso:', emprestimosAtraso.length);
    if (emprestimosAtraso.length > 0) {
      console.log('Lista de empréstimos em atraso:');
      emprestimosAtraso.forEach(emp => {
        console.log(`  - ID ${emp.id}: ${emp.cliente_nome} | Vencimento: ${emp.data_vencimento} | Motivo: ${emp.motivo_atraso} | Status: ${emp.status_emprestimo} | Tipo: ${emp.tipo_emprestimo}`);
      });
    }
    
    // Debug específico para empréstimos parcelados
    const [emprestimosParceladosDebug] = await connection.execute(`
      SELECT 
        e.id,
        e.cliente_id,
        c.nome as cliente_nome,
        e.data_vencimento,
        e.status,
        e.tipo_emprestimo,
        e.numero_parcelas,
        COUNT(p.id) as total_parcelas_db,
        SUM(CASE WHEN p.status = 'Paga' THEN 1 ELSE 0 END) as parcelas_pagas,
        SUM(CASE WHEN p.status = 'Pendente' THEN 1 ELSE 0 END) as parcelas_pendentes,
        SUM(CASE WHEN p.status = 'Atrasada' THEN 1 ELSE 0 END) as parcelas_atrasadas
      FROM emprestimos e
      LEFT JOIN clientes_cobrancas c ON e.cliente_id = c.id
      LEFT JOIN parcelas p ON e.id = p.emprestimo_id
      WHERE e.tipo_emprestimo = 'in_installments'
      GROUP BY e.id
      ORDER BY e.id
    `);
    
    console.log('🔍 EMPRÉSTIMOS PARCELADOS - Debug das estatísticas:');
    console.log(`Total de empréstimos parcelados: ${emprestimosParceladosDebug.length}`);
    
    emprestimosParceladosDebug.forEach(emp => {
      const statusCalculado = emp.parcelas_pagas === emp.total_parcelas_db && emp.total_parcelas_db > 0 ? 'Quitado' : 
                             emp.parcelas_atrasadas > 0 ? 'Em Atraso' : 'Ativo';
      
      console.log(`  ID ${emp.id}: ${emp.cliente_nome} | Status: ${emp.status} | Calculado: ${statusCalculado}`);
      console.log(`    Parcelas - Total: ${emp.total_parcelas_db}, Pagas: ${emp.parcelas_pagas}, Atrasadas: ${emp.parcelas_atrasadas}`);
      
      if (emp.status !== statusCalculado) {
        console.log(`    ⚠️  STATUS INCONSISTENTE: ${emp.status} deveria ser ${statusCalculado}`);
      }
    });
    
    await connection.end();
    
    res.json({
      geral: stats[0],
      status: statusStats[0],
      debug: {
        emprestimos_atraso_detalhado: emprestimosAtraso,
        parcelas_atrasadas: parcelasAtrasadas,
        emprestimos_parcelados: emprestimosParceladosDebug
      },
      correcoes_automaticas: correcoes_automaticas
    });
  } catch (error) {
    console.error('Erro ao buscar estatísticas do histórico:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Endpoint para corrigir status inconsistentes de empréstimos
router.post('/corrigir-status-emprestimos', ensureDatabase, async (req, res) => {
  try {
    const username = req.session.cobrancasUser;
    const connection = await createCobrancasConnection(username);
    
    console.log('🔧 Iniciando correção de status de empréstimos...');
    
    // 1. Atualizar parcelas atrasadas
    const [parcelasUpdate] = await connection.execute(`
      UPDATE parcelas 
      SET status = 'Atrasada' 
      WHERE status = 'Pendente' 
        AND data_vencimento < CURDATE()
    `);
    
    console.log(`📊 Parcelas atualizadas para atrasadas: ${parcelasUpdate.affectedRows}`);
    
    // 2. Marcar empréstimos como quitados se todas as parcelas estão pagas
    const [quitadosUpdate] = await connection.execute(`
      UPDATE emprestimos e
      SET status = 'Quitado'
      WHERE e.status = 'Ativo'
        AND EXISTS (SELECT 1 FROM parcelas p WHERE p.emprestimo_id = e.id)
        AND NOT EXISTS (SELECT 1 FROM parcelas p WHERE p.emprestimo_id = e.id AND p.status IN ('Pendente', 'Atrasada'))
    `);
    
    console.log(`✅ Empréstimos marcados como quitados: ${quitadosUpdate.affectedRows}`);
    
    // 3. Investigar empréstimos parcelados especificamente
    const [emprestimosParcelados] = await connection.execute(`
      SELECT 
        e.id,
        e.cliente_id,
        c.nome as cliente_nome,
        e.data_vencimento,
        e.status,
        e.tipo_emprestimo,
        e.numero_parcelas,
        COUNT(p.id) as total_parcelas_db,
        SUM(CASE WHEN p.status = 'Paga' THEN 1 ELSE 0 END) as parcelas_pagas,
        SUM(CASE WHEN p.status = 'Pendente' THEN 1 ELSE 0 END) as parcelas_pendentes,
        SUM(CASE WHEN p.status = 'Atrasada' THEN 1 ELSE 0 END) as parcelas_atrasadas
      FROM emprestimos e
      LEFT JOIN clientes_cobrancas c ON e.cliente_id = c.id
      LEFT JOIN parcelas p ON e.id = p.emprestimo_id
      WHERE e.tipo_emprestimo = 'in_installments'
      GROUP BY e.id
      ORDER BY e.id
    `);
    
    console.log(`🔍 INVESTIGAÇÃO DE EMPRÉSTIMOS PARCELADOS - Total encontrados: ${emprestimosParcelados.length}`);
    
    let emprestimosProblematicos = [];
    
    for (const emprestimo of emprestimosParcelados) {
      console.log(`\n📋 EMPRÉSTIMO PARCELADO ID: ${emprestimo.id}`);
      console.log(`   Cliente: ${emprestimo.cliente_nome}`);
      console.log(`   Status atual: ${emprestimo.status}`);
      console.log(`   Número de parcelas configurado: ${emprestimo.numero_parcelas}`);
      console.log(`   Total parcelas no banco: ${emprestimo.total_parcelas_db}`);
      console.log(`   Parcelas pagas: ${emprestimo.parcelas_pagas}`);
      console.log(`   Parcelas pendentes: ${emprestimo.parcelas_pendentes}`);
      console.log(`   Parcelas atrasadas: ${emprestimo.parcelas_atrasadas}`);
      
      // Buscar detalhes das parcelas para análise
      const [parcelas] = await connection.execute(`
        SELECT 
          numero_parcela,
          data_vencimento,
          status,
          valor_parcela,
          CASE 
            WHEN status = 'Pendente' AND data_vencimento < CURDATE() THEN 'DEVERIA_SER_ATRASADA'
            WHEN status = 'Atrasada' AND data_vencimento >= CURDATE() THEN 'NAO_DEVERIA_SER_ATRASADA'
            ELSE 'OK'
          END as verificacao
        FROM parcelas
        WHERE emprestimo_id = ?
        ORDER BY numero_parcela
      `, [emprestimo.id]);
      
      console.log(`   Detalhes das parcelas:`);
      console.table(parcelas);
      
      // Determinar se este empréstimo está sendo incorretamente classificado
      let statusCalculado = 'Ativo';
      
      if (emprestimo.parcelas_pagas === emprestimo.total_parcelas_db && emprestimo.total_parcelas_db > 0) {
        statusCalculado = 'Quitado';
      } else if (emprestimo.parcelas_atrasadas > 0) {
        statusCalculado = 'Em Atraso';
      }
      
      console.log(`   Status calculado: ${statusCalculado}`);
      
      // Se o status está incorreto, marcar como problemático
      if (emprestimo.status !== statusCalculado) {
        console.log(`   ⚠️  STATUS INCONSISTENTE: ${emprestimo.status} → ${statusCalculado}`);
        emprestimosProblematicos.push({
          id: emprestimo.id,
          cliente: emprestimo.cliente_nome,
          status_atual: emprestimo.status,
          status_calculado: statusCalculado,
          numero_parcelas: emprestimo.numero_parcelas,
          total_parcelas_db: emprestimo.total_parcelas_db,
          parcelas_pagas: emprestimo.parcelas_pagas,
          parcelas_atrasadas: emprestimo.parcelas_atrasadas,
          parcelas_problematicas: parcelas.filter(p => p.verificacao !== 'OK')
        });
        
        // Corrigir o status
        await connection.execute(`
          UPDATE emprestimos 
          SET status = ? 
          WHERE id = ?
        `, [statusCalculado, emprestimo.id]);
        
        console.log(`   ✅ Status corrigido para: ${statusCalculado}`);
      }
    }
    
    // 4. Empréstimos de valor fixo vencidos
    const [emprestimosValorFixoVencidos] = await connection.execute(`
      SELECT 
        e.id,
        e.cliente_id,
        c.nome as cliente_nome,
        e.data_vencimento,
        e.status,
        e.tipo_emprestimo
      FROM emprestimos e
      LEFT JOIN clientes_cobrancas c ON e.cliente_id = c.id
      WHERE NOT EXISTS (SELECT 1 FROM parcelas p WHERE p.emprestimo_id = e.id)
        AND e.data_vencimento < CURDATE()
        AND e.status = 'Ativo'
    `);
    
    console.log(`📋 Empréstimos de valor fixo vencidos encontrados: ${emprestimosValorFixoVencidos.length}`);
    
    await connection.end();
    
    res.json({
      success: true,
      correcoes: {
        parcelas_atrasadas: parcelasUpdate.affectedRows,
        emprestimos_quitados: quitadosUpdate.affectedRows,
        valor_fixo_vencidos: emprestimosValorFixoVencidos.length,
        emprestimos_parcelados_corrigidos: emprestimosProblematicos.length
      },
      emprestimos_valor_fixo_vencidos: emprestimosValorFixoVencidos,
      emprestimos_parcelados_problematicos: emprestimosProblematicos
    });
  } catch (error) {
    console.error('Erro ao corrigir status de empréstimos:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Parcelas de um empréstimo
router.get('/emprestimos/:id/parcelas', ensureDatabase, async (req, res) => {
  try {
    const { id } = req.params;
    const username = req.session.cobrancasUser;
    const connection = await createCobrancasConnection(username);
    
    // Primeiro, atualizar status das parcelas atrasadas
    await connection.execute(`
      UPDATE parcelas 
      SET status = 'Atrasada' 
      WHERE emprestimo_id = ? 
        AND status = 'Pendente' 
        AND data_vencimento < CURDATE()
    `, [id]);
    
    const [parcelas] = await connection.execute(`
      SELECT p.*, e.valor as valor_total_emprestimo, e.juros_mensal, e.multa_atraso,
             DATE_FORMAT(p.data_vencimento, '%Y-%m-%d') as data_vencimento_formatada,
             DATE_FORMAT(p.data_pagamento, '%Y-%m-%d') as data_pagamento_formatada
      FROM parcelas p
      LEFT JOIN emprestimos e ON p.emprestimo_id = e.id
      WHERE p.emprestimo_id = ?
      ORDER BY p.numero_parcela ASC
    `, [id]);
    
    // Garantir que as datas estão no formato correto
    parcelas.forEach(parcela => {
      if (parcela.data_vencimento_formatada) {
        parcela.data_vencimento = parcela.data_vencimento_formatada;
      }
      if (parcela.data_pagamento_formatada) {
        parcela.data_pagamento = parcela.data_pagamento_formatada;
      }
    });
    
    await connection.end();
    res.json(parcelas);
  } catch (error) {
    console.error('Erro ao buscar parcelas:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

router.post('/emprestimos', ensureDatabase, async (req, res) => {
  try {
    console.log('=== INÍCIO DA CRIAÇÃO DE EMPRÉSTIMO ===');
    console.log('Dados recebidos para criar empréstimo:', JSON.stringify(req.body, null, 2));
    console.log('Sessão do usuário:', req.session);
    console.log('Headers da requisição:', req.headers);
    
    const { 
      cliente_id, 
      valor, 
      valor_final,
      valor_parcela,
      valor_inicial_final,
      valor_inicial_parcela,
      data_emprestimo, 
      data_vencimento, 
      juros_mensal, 
      multa_atraso, 
      observacoes,
      tipo_emprestimo = 'fixed',
      numero_parcelas = 1,
      frequencia = 'monthly',
      data_primeira_parcela,
      tipo_calculo
    } = req.body;
    
    // Validação dos dados obrigatórios
    console.log('Validando dados obrigatórios...');
    console.log('cliente_id:', cliente_id, 'tipo:', typeof cliente_id);
    console.log('valor:', valor, 'tipo:', typeof valor);
    console.log('data_emprestimo:', data_emprestimo, 'tipo:', typeof data_emprestimo);
    
    if (!cliente_id || !valor || !data_emprestimo) {
      console.error('Dados obrigatórios faltando:', { cliente_id, valor, data_emprestimo });
      return res.status(400).json({ error: 'Dados obrigatórios faltando' });
    }
    
    // Validação adicional de tipos
    if (isNaN(Number(cliente_id))) {
      console.error('cliente_id deve ser um número:', cliente_id);
      return res.status(400).json({ error: 'ID do cliente inválido' });
    }
    
    if (isNaN(Number(valor))) {
      console.error('valor deve ser um número:', valor);
      return res.status(400).json({ error: 'Valor do empréstimo inválido' });
    }
    
    const username = req.session.cobrancasUser;
    console.log('Usuário autenticado:', username);
    
    const connection = await createCobrancasConnection(username);
    console.log('Conexão com banco estabelecida');
    
    // Verificar se o cliente existe
    const [clienteRows] = await connection.execute(`
      SELECT id, nome FROM clientes_cobrancas WHERE id = ?
    `, [cliente_id]);
    
    if (clienteRows.length === 0) {
      await connection.end();
      console.error('Cliente não encontrado:', cliente_id);
      return res.status(404).json({ error: 'Cliente não encontrado' });
    }
    
    console.log('Cliente encontrado:', clienteRows[0]);
    
    // Calcular valores baseado no tipo de cálculo
    let valorInicial = parseFloat(valor) || 0;
    let valorFinalCalculado = parseFloat(valor_final) || valorInicial;
    let valorParcelaCalculado = parseFloat(valor_parcela) || 0;
    let jurosMensalFinal = parseFloat(juros_mensal) || 0;
    
    console.log('Valores recebidos do frontend:', {
      valor, valor_final, valor_parcela, valor_inicial_final, valor_inicial_parcela, tipo_calculo
    });

    // Ajustar valores baseado no tipo de cálculo
    if (tipo_calculo === 'valor_final' && valor_final) {
      // Para valor final fixo: o frontend envia valor_inicial_final e valor_final
      // valor_inicial_final é o valor que o cliente pegou emprestado
      // valor_final é o total que ele deve pagar
      valorInicial = valorInicial; // manter o valor enviado no campo 'valor'
      valorFinalCalculado = parseFloat(valor_final);
      valorParcelaCalculado = valorFinalCalculado / parseInt(numero_parcelas);
      jurosMensalFinal = valorInicial > 0 ? ((valorFinalCalculado - valorInicial) / valorInicial) * 100 : 0;
    } else if (tipo_calculo === 'parcela_fixa' && valor_parcela) {
      valorInicial = valorInicial; // manter o valor enviado no campo 'valor'
      valorParcelaCalculado = parseFloat(valor_parcela);
      valorFinalCalculado = valorParcelaCalculado * parseInt(numero_parcelas);
      jurosMensalFinal = valorInicial > 0 ? ((valorFinalCalculado - valorInicial) / valorInicial) * 100 : 0;
    } else if (tipo_calculo === 'valor_inicial') {
      valorFinalCalculado = valorInicial * (1 + jurosMensalFinal / 100);
      valorParcelaCalculado = valorFinalCalculado / parseInt(numero_parcelas);
    }

    console.log('Valores calculados finais:', {
      valorInicial, valorFinalCalculado, valorParcelaCalculado, jurosMensalFinal
    });
    
    // Calcular data de vencimento baseada no tipo de empréstimo
    let dataVencimentoFinal = data_vencimento;
    if (tipo_emprestimo === 'in_installments' && data_primeira_parcela) {
      dataVencimentoFinal = data_primeira_parcela;
    }
    
    console.log('Cliente encontrado, inserindo empréstimo...');
    
    // Inserir empréstimo
    console.log('Tentando inserir empréstimo com dados:', {
      cliente_id, valor: valorInicial, data_emprestimo, data_vencimento: dataVencimentoFinal, 
      juros_mensal: jurosMensalFinal, 
      multa_atraso: multa_atraso || 0, 
      observacoes: observacoes || '',
      tipo_emprestimo,
      numero_parcelas,
      frequencia,
      valor_parcela: valorParcelaCalculado,
      valor_final: valorFinalCalculado
    });
    
    // Verificar se a coluna tipo_calculo existe
    const [columns] = await connection.execute(`
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_NAME = 'emprestimos' AND COLUMN_NAME = 'tipo_calculo'
    `);
    
    let emprestimoResult;
    if (columns.length > 0) {
      // Coluna existe, incluir tipo_calculo
      [emprestimoResult] = await connection.execute(`
        INSERT INTO emprestimos (
          cliente_id, valor, data_emprestimo, data_vencimento, juros_mensal, multa_atraso, observacoes,
          tipo_emprestimo, numero_parcelas, frequencia, valor_parcela, tipo_calculo
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        cliente_id, valorInicial, data_emprestimo, dataVencimentoFinal, 
        jurosMensalFinal, multa_atraso || 0, observacoes || '',
        tipo_emprestimo, numero_parcelas, frequencia, valorParcelaCalculado, tipo_calculo || 'valor_inicial'
      ]);
    } else {
      // Coluna não existe, inserir sem tipo_calculo
      [emprestimoResult] = await connection.execute(`
        INSERT INTO emprestimos (
          cliente_id, valor, data_emprestimo, data_vencimento, juros_mensal, multa_atraso, observacoes,
          tipo_emprestimo, numero_parcelas, frequencia, valor_parcela
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        cliente_id, valorInicial, data_emprestimo, dataVencimentoFinal, 
        jurosMensalFinal, multa_atraso || 0, observacoes || '',
        tipo_emprestimo, numero_parcelas, frequencia, valorParcelaCalculado
      ]);
    }
    
    console.log('Empréstimo inserido com ID:', emprestimoResult.insertId);
    
    // Se for empréstimo parcelado, criar as parcelas
    if (tipo_emprestimo === 'in_installments' && parseInt(numero_parcelas) > 1) {
      console.log('Criando parcelas para empréstimo parcelado...');
      
      const dataPrimeiraParcela = new Date(data_primeira_parcela || dataVencimentoFinal);
      const parcelas = [];
      
      for (let i = 1; i <= parseInt(numero_parcelas); i++) {
        const dataVencimentoParcela = new Date(dataPrimeiraParcela);
        
        // Calcular data de vencimento baseada na frequência
        switch (frequencia) {
          case 'daily':
            dataVencimentoParcela.setDate(dataVencimentoParcela.getDate() + (i - 1));
            break;
          case 'weekly':
            dataVencimentoParcela.setDate(dataVencimentoParcela.getDate() + ((i - 1) * 7));
            break;
          case 'biweekly':
            dataVencimentoParcela.setDate(dataVencimentoParcela.getDate() + ((i - 1) * 14));
            break;
          case 'monthly':
          default:
            dataVencimentoParcela.setMonth(dataVencimentoParcela.getMonth() + (i - 1));
            break;
        }
        
        parcelas.push([
          emprestimoResult.insertId,
          i,
          valorParcelaCalculado,
          dataVencimentoParcela.toISOString().split('T')[0]
        ]);
      }
      
      // Inserir todas as parcelas
      for (const parcela of parcelas) {
        await connection.execute(`
          INSERT INTO parcelas (emprestimo_id, numero_parcela, valor_parcela, data_vencimento)
          VALUES (?, ?, ?, ?)
        `, parcela);
      }
      
      console.log(`${parcelas.length} parcelas criadas`);
    } else {
      // Para empréstimos fixos, criar uma parcela única
      await connection.execute(`
        INSERT INTO parcelas (emprestimo_id, numero_parcela, valor_parcela, data_vencimento)
        VALUES (?, ?, ?, ?)
      `, [emprestimoResult.insertId, 1, valorFinalCalculado, dataVencimentoFinal]);
      
      console.log('Parcela única criada para empréstimo fixo');
    }
    
    // Criar cobranças baseadas nas parcelas
    if (tipo_emprestimo === 'in_installments' && parseInt(numero_parcelas) > 1) {
      console.log('Criando cobranças para cada parcela...');
      
      const dataPrimeiraParcela = new Date(data_primeira_parcela || dataVencimentoFinal);
      
      for (let i = 1; i <= parseInt(numero_parcelas); i++) {
        const dataVencimentoParcela = new Date(dataPrimeiraParcela);
        
        // Calcular data de vencimento baseada na frequência
        switch (frequencia) {
          case 'daily':
            dataVencimentoParcela.setDate(dataVencimentoParcela.getDate() + (i - 1));
            break;
          case 'weekly':
            dataVencimentoParcela.setDate(dataVencimentoParcela.getDate() + ((i - 1) * 7));
            break;
          case 'biweekly':
            dataVencimentoParcela.setDate(dataVencimentoParcela.getDate() + ((i - 1) * 14));
            break;
          case 'monthly':
          default:
            dataVencimentoParcela.setMonth(dataVencimentoParcela.getMonth() + (i - 1));
            break;
        }
        
        await connection.execute(`
          INSERT INTO cobrancas (emprestimo_id, cliente_id, valor_original, valor_atualizado, data_vencimento, status)
          VALUES (?, ?, ?, ?, ?, 'Pendente')
        `, [emprestimoResult.insertId, cliente_id, valorParcelaCalculado, valorParcelaCalculado, dataVencimentoParcela.toISOString().split('T')[0]]);
      }
      
      console.log(`${numero_parcelas} cobranças criadas para as parcelas`);
    } else {
      // Para empréstimos fixos, criar uma cobrança única
      console.log('Tentando criar cobrança única com dados:', {
        emprestimo_id: emprestimoResult.insertId,
        cliente_id,
        valor_original: valorFinalCalculado,
        valor_atualizado: valorFinalCalculado,
        data_vencimento: dataVencimentoFinal
      });
      
      await connection.execute(`
        INSERT INTO cobrancas (emprestimo_id, cliente_id, valor_original, valor_atualizado, data_vencimento, status)
        VALUES (?, ?, ?, ?, ?, 'Pendente')
      `, [emprestimoResult.insertId, cliente_id, valorFinalCalculado, valorFinalCalculado, dataVencimentoFinal]);
      
      console.log('Cobrança única criada automaticamente');
    }
    
    await connection.end();
    res.json({ 
      id: emprestimoResult.insertId, 
      message: 'Empréstimo criado com sucesso',
      parcelas_criadas: tipo_emprestimo === 'in_installments' ? parseInt(numero_parcelas) : 1
    });
  } catch (error) {
    console.error('Erro ao criar empréstimo:', error);
    console.error('Stack trace:', error.stack);
    res.status(500).json({ error: 'Erro interno do servidor', details: error.message });
  }
});

// Cobranças
router.get('/cobrancas', ensureDatabase, async (req, res) => {
  try {
    const username = req.session.cobrancasUser;
    const connection = await createCobrancasConnection(username);
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
    const username = req.session.cobrancasUser;
    const connection = await createCobrancasConnection(username);
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

// Registrar pagamento
router.post('/cobrancas/:id/pagamento', ensureDatabase, async (req, res) => {
  try {
    const { id } = req.params;
    const { valor_pago, data_pagamento, forma_pagamento, observacoes } = req.body;
    
    const username = req.session.cobrancasUser;
    const connection = await createCobrancasConnection(username);
    
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

// Pagamento de juros com extensão de prazo
router.post('/emprestimos/:id/pagamento-juros', ensureDatabase, async (req, res) => {
  try {
    const { id } = req.params;
    const { valor_juros_pago, data_pagamento, forma_pagamento, observacoes } = req.body;
    
    const username = req.session.cobrancasUser;
    const connection = await createCobrancasConnection(username);
    
    // Buscar dados do empréstimo
    const [emprestimoRows] = await connection.execute(`
      SELECT e.*, c.nome as cliente_nome 
      FROM emprestimos e 
      LEFT JOIN clientes_cobrancas c ON e.cliente_id = c.id 
      WHERE e.id = ?
    `, [id]);
    
    if (emprestimoRows.length === 0) {
      await connection.end();
      return res.status(404).json({ error: 'Empréstimo não encontrado' });
    }
    
    const emprestimo = emprestimoRows[0];
    
    // Calcular juros acumulados
    const valorInicial = parseFloat(emprestimo.valor) || 0;
    const jurosMensal = parseFloat(emprestimo.juros_mensal) || 0;
    const jurosAcumulados = valorInicial * (jurosMensal / 100);
    
    // Verificar se o valor pago é suficiente para cobrir os juros
    if (parseFloat(valor_juros_pago) < jurosAcumulados) {
      await connection.end();
      return res.status(400).json({ 
        error: `Valor insuficiente. Juros acumulados: R$ ${jurosAcumulados.toFixed(2)}` 
      });
    }
    
    // Registrar pagamento de juros
    await connection.execute(`
      INSERT INTO pagamentos (cobranca_id, valor_pago, data_pagamento, forma_pagamento, observacoes)
      VALUES (?, ?, ?, ?, ?)
    `, [emprestimo.id, valor_juros_pago, data_pagamento, forma_pagamento, `Pagamento de juros: ${observacoes || ''}`]);
    
    // Calcular nova data de vencimento (+30 dias)
    const dataVencimentoAtual = new Date(emprestimo.data_vencimento);
    const novaDataVencimento = new Date(dataVencimentoAtual);
    novaDataVencimento.setDate(novaDataVencimento.getDate() + 30);
    
    // Atualizar empréstimo: nova data de vencimento, status Ativo, valor volta ao inicial
    // O valor da dívida volta ao valor inicial do empréstimo (não acumula juros)
    
    await connection.execute(`
      UPDATE emprestimos 
      SET 
        data_vencimento = ?,
        valor = ?,
        status = 'Ativo',
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [novaDataVencimento.toISOString().split('T')[0], valorInicial, id]);
    
    // Atualizar cobrança relacionada
    await connection.execute(`
      UPDATE cobrancas 
      SET 
        data_vencimento = ?,
        valor_original = ?,
        valor_atualizado = ?,
        status = 'Pendente',
        updated_at = CURRENT_TIMESTAMP
      WHERE emprestimo_id = ?
    `, [novaDataVencimento.toISOString().split('T')[0], valorInicial, valorInicial, id]);
    
    await connection.end();
    
    res.json({ 
      message: 'Pagamento de juros registrado com sucesso',
      nova_data_vencimento: novaDataVencimento.toISOString().split('T')[0],
      novo_valor: valorInicial,
      juros_pagos: valor_juros_pago
    });
    
  } catch (error) {
    console.error('Erro ao registrar pagamento de juros:', error);
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

    // Criar banco de dados do usuário se não existir
    try {
      await createCobrancasDatabase(username);
    } catch (dbError) {
      console.error('Erro ao criar banco do usuário:', dbError);
      return res.status(500).json({ success: false, message: 'Erro interno do servidor.' });
    }

    // Salva na sessão o usuário
    req.session.cobrancasUser = username;
    req.session.cobrancasDb = `jpsistemas_${username.toLowerCase().replace(/[^a-z0-9]/g, '_')}`;

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

// Rota para verificar autenticação (usada pelo frontend)
router.get('/check-auth', (req, res) => {
  if (req.session.cobrancasUser) {
    res.json({ 
      authenticated: true, 
      user: req.session.cobrancasUser,
      db: req.session.cobrancasDb
    });
  } else {
    res.status(401).json({ authenticated: false });
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
    const username = req.session.cobrancasUser;
    const connection = await createCobrancasConnection(username);
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
    const username = req.session.cobrancasUser;
    const connection = await createCobrancasConnection(username);
    await connection.execute('DELETE FROM emprestimos WHERE id = ?', [id]);
    await connection.end();
    res.json({ success: true });
  } catch (error) {
    console.error('Erro ao remover empréstimo:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Rota para gerenciar lista negra
router.put('/clientes/:id/lista-negra', ensureDatabase, async (req, res) => {
  try {
    const { id } = req.params;
    const { status, motivo } = req.body;
    
    console.log(`DEBUG: Gerenciando lista negra para cliente ${id}`);
    console.log(`DEBUG: Status: ${status}, Motivo: ${motivo}`);
    
    const username = req.session.cobrancasUser;
    const connection = await createCobrancasConnection(username);
    
    // Verificar se o cliente existe
    const [clienteRows] = await connection.execute(`
      SELECT id, nome, status FROM clientes_cobrancas WHERE id = ?
    `, [id]);
    
    if (clienteRows.length === 0) {
      await connection.end();
      return res.status(404).json({ error: 'Cliente não encontrado' });
    }
    
    console.log(`DEBUG: Cliente encontrado: ${clienteRows[0].nome} (Status atual: ${clienteRows[0].status})`);
    
    // Atualizar status do cliente
    await connection.execute(`
      UPDATE clientes_cobrancas 
      SET 
        status = ?,
        observacoes = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [status, motivo, id]);
    
    console.log(`DEBUG: Cliente atualizado com sucesso`);
    
    await connection.end();
    res.json({ 
      message: `Cliente ${status === 'Lista Negra' ? 'adicionado à' : 'removido da'} lista negra com sucesso`,
      cliente_id: id,
      novo_status: status
    });
  } catch (error) {
    console.error('Erro ao gerenciar lista negra:', error);
    console.error('Detalhes do erro:', {
      message: error.message,
      code: error.code,
      sqlMessage: error.sqlMessage
    });
    res.status(500).json({ 
      error: 'Erro interno do servidor',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Remover cliente
router.delete('/clientes/:id', ensureDatabase, async (req, res) => {
  const { id } = req.params;
  try {
    const username = req.session.cobrancasUser;
    const connection = await createCobrancasConnection(username);
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
    const username = req.session.cobrancasUser;
    const connection = await createCobrancasConnection(username);
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