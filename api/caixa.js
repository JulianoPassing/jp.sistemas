const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const mysql = require('mysql2/promise');
const dbConfig = require('../database-config');

// Middleware de autenticação
const authMiddleware = require('../middlewares/auth');

// Pool de conexão com o banco
const pool = mysql.createPool(dbConfig);

// Rota de login
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({
        success: false,
        message: 'Usuário e senha são obrigatórios'
      });
    }

    const connection = await pool.getConnection();
    
    try {
      const [rows] = await connection.execute(
        'SELECT * FROM usuarios WHERE username = ? AND sistema = "caixa"',
        [username]
      );

      if (rows.length === 0) {
        return res.status(401).json({
          success: false,
          message: 'Usuário ou senha inválidos'
        });
      }

      const user = rows[0];
      const isValidPassword = await bcrypt.compare(password, user.password);

      if (!isValidPassword) {
        return res.status(401).json({
          success: false,
          message: 'Usuário ou senha inválidos'
        });
      }

      // Criar sessão
      req.session.userId = user.id;
      req.session.username = user.username;
      req.session.sistema = 'caixa';
      req.session.loggedIn = true;

      res.json({
        success: true,
        message: 'Login realizado com sucesso',
        user: {
          id: user.id,
          username: user.username,
          nome: user.nome
        }
      });
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('Erro no login:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor'
    });
  }
});

// Rota de logout
router.post('/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      return res.status(500).json({
        success: false,
        message: 'Erro ao fazer logout'
      });
    }
    res.json({
      success: true,
      message: 'Logout realizado com sucesso'
    });
  });
});

// Middleware para verificar autenticação
router.use(authMiddleware);

// Rota para obter estatísticas
router.get('/estatisticas', async (req, res) => {
  try {
    const connection = await pool.getConnection();
    
    try {
      // Vendas de hoje
      const hoje = new Date().toISOString().split('T')[0];
      const [vendasHoje] = await connection.execute(
        'SELECT COALESCE(SUM(total), 0) as total FROM vendas WHERE DATE(data) = ?',
        [hoje]
      );

      // Total de produtos
      const [totalProdutos] = await connection.execute(
        'SELECT COUNT(*) as total FROM produtos'
      );

      // Vendas do mês atual
      const mesAtual = new Date().getFullYear() + '-' + String(new Date().getMonth() + 1).padStart(2, '0');
      const [vendasMes] = await connection.execute(
        'SELECT COALESCE(SUM(total), 0) as total FROM vendas WHERE DATE_FORMAT(data, "%Y-%m") = ?',
        [mesAtual]
      );

      // Produtos em baixa
      const [produtosBaixa] = await connection.execute(
        'SELECT COUNT(*) as total FROM produtos WHERE estoque <= estoque_minimo'
      );

      res.json({
        vendasHoje: parseFloat(vendasHoje[0].total),
        totalProdutos: totalProdutos[0].total,
        vendasMes: parseFloat(vendasMes[0].total),
        produtosBaixa: produtosBaixa[0].total
      });
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('Erro ao buscar estatísticas:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor'
    });
  }
});

// Rota para obter vendas recentes
router.get('/vendas-recentes', async (req, res) => {
  try {
    const connection = await pool.getConnection();
    
    try {
      const [rows] = await connection.execute(
        'SELECT * FROM vendas ORDER BY data DESC LIMIT 10'
      );

      res.json(rows);
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('Erro ao buscar vendas recentes:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor'
    });
  }
});

// Rota para obter produtos em baixa
router.get('/produtos-baixa', async (req, res) => {
  try {
    const connection = await pool.getConnection();
    
    try {
      const [rows] = await connection.execute(
        'SELECT * FROM produtos WHERE estoque <= estoque_minimo ORDER BY estoque ASC'
      );

      res.json(rows);
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('Erro ao buscar produtos em baixa:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor'
    });
  }
});

// Rota para obter produtos
router.get('/produtos', async (req, res) => {
  try {
    const { search, categoria } = req.query;
    const connection = await pool.getConnection();
    
    try {
      let query = 'SELECT * FROM produtos WHERE 1=1';
      const params = [];

      if (search) {
        query += ' AND (nome LIKE ? OR codigo LIKE ?)';
        params.push(`%${search}%`, `%${search}%`);
      }

      if (categoria) {
        query += ' AND categoria = ?';
        params.push(categoria);
      }

      query += ' ORDER BY nome ASC';

      const [rows] = await connection.execute(query, params);
      res.json(rows);
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('Erro ao buscar produtos:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor'
    });
  }
});

// Rota para obter produto específico
router.get('/produtos/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const connection = await pool.getConnection();
    
    try {
      const [rows] = await connection.execute(
        'SELECT * FROM produtos WHERE id = ?',
        [id]
      );

      if (rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Produto não encontrado'
        });
      }

      res.json(rows[0]);
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('Erro ao buscar produto:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor'
    });
  }
});

// Rota para criar produto
router.post('/produtos', async (req, res) => {
  try {
    const { codigo, nome, categoria, preco, estoque, estoqueMinimo, descricao } = req.body;

    if (!codigo || !nome || !categoria || !preco || estoque === undefined || estoqueMinimo === undefined) {
      return res.status(400).json({
        success: false,
        message: 'Todos os campos obrigatórios devem ser preenchidos'
      });
    }

    const connection = await pool.getConnection();
    
    try {
      // Verificar se código já existe
      const [existing] = await connection.execute(
        'SELECT id FROM produtos WHERE codigo = ?',
        [codigo]
      );

      if (existing.length > 0) {
        return res.status(400).json({
          success: false,
          message: 'Código do produto já existe'
        });
      }

      const [result] = await connection.execute(
        'INSERT INTO produtos (codigo, nome, categoria, preco, estoque, estoque_minimo, descricao) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [codigo, nome, categoria, preco, estoque, estoqueMinimo, descricao || null]
      );

      res.status(201).json({
        success: true,
        message: 'Produto criado com sucesso',
        id: result.insertId
      });
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('Erro ao criar produto:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor'
    });
  }
});

// Rota para atualizar produto
router.put('/produtos/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { codigo, nome, categoria, preco, estoque, estoqueMinimo, descricao } = req.body;

    if (!codigo || !nome || !categoria || !preco || estoque === undefined || estoqueMinimo === undefined) {
      return res.status(400).json({
        success: false,
        message: 'Todos os campos obrigatórios devem ser preenchidos'
      });
    }

    const connection = await pool.getConnection();
    
    try {
      // Verificar se código já existe em outro produto
      const [existing] = await connection.execute(
        'SELECT id FROM produtos WHERE codigo = ? AND id != ?',
        [codigo, id]
      );

      if (existing.length > 0) {
        return res.status(400).json({
          success: false,
          message: 'Código do produto já existe'
        });
      }

      const [result] = await connection.execute(
        'UPDATE produtos SET codigo = ?, nome = ?, categoria = ?, preco = ?, estoque = ?, estoque_minimo = ?, descricao = ? WHERE id = ?',
        [codigo, nome, categoria, preco, estoque, estoqueMinimo, descricao || null, id]
      );

      if (result.affectedRows === 0) {
        return res.status(404).json({
          success: false,
          message: 'Produto não encontrado'
        });
      }

      res.json({
        success: true,
        message: 'Produto atualizado com sucesso'
      });
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('Erro ao atualizar produto:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor'
    });
  }
});

// Rota para excluir produto
router.delete('/produtos/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const connection = await pool.getConnection();
    
    try {
      const [result] = await connection.execute(
        'DELETE FROM produtos WHERE id = ?',
        [id]
      );

      if (result.affectedRows === 0) {
        return res.status(404).json({
          success: false,
          message: 'Produto não encontrado'
        });
      }

      res.json({
        success: true,
        message: 'Produto excluído com sucesso'
      });
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('Erro ao excluir produto:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor'
    });
  }
});

// Rota para obter vendas
router.get('/vendas', async (req, res) => {
  try {
    const { search, dataInicio, dataFim, formaPagamento } = req.query;
    const connection = await pool.getConnection();
    
    try {
      let query = 'SELECT * FROM vendas WHERE 1=1';
      const params = [];

      if (search) {
        query += ' AND id LIKE ?';
        params.push(`%${search}%`);
      }

      if (dataInicio) {
        query += ' AND DATE(data) >= ?';
        params.push(dataInicio);
      }

      if (dataFim) {
        query += ' AND DATE(data) <= ?';
        params.push(dataFim);
      }

      if (formaPagamento) {
        query += ' AND forma_pagamento = ?';
        params.push(formaPagamento);
      }

      query += ' ORDER BY data DESC';

      const [rows] = await connection.execute(query, params);
      res.json(rows);
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('Erro ao buscar vendas:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor'
    });
  }
});

// Rota para obter venda específica
router.get('/vendas/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const connection = await pool.getConnection();
    
    try {
      const [rows] = await connection.execute(
        'SELECT * FROM vendas WHERE id = ?',
        [id]
      );

      if (rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Venda não encontrada'
        });
      }

      const venda = rows[0];

      // Buscar itens da venda
      const [itens] = await connection.execute(
        'SELECT * FROM vendas_itens WHERE venda_id = ?',
        [id]
      );

      venda.itens = itens;
      res.json(venda);
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('Erro ao buscar venda:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor'
    });
  }
});

// Rota para criar venda
router.post('/vendas', async (req, res) => {
  try {
    const { id, data, itens, subtotal, desconto, total, formaPagamento, valorRecebido, troco } = req.body;

    if (!itens || itens.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'A venda deve ter pelo menos um item'
      });
    }

    const connection = await pool.getConnection();
    
    try {
      await connection.beginTransaction();

      // Inserir venda
      const [vendaResult] = await connection.execute(
        'INSERT INTO vendas (id, data, subtotal, desconto, total, forma_pagamento, valor_recebido, troco) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        [id, data, subtotal, desconto, total, formaPagamento, valorRecebido || null, troco || 0]
      );

      // Inserir itens da venda
      for (const item of itens) {
        await connection.execute(
          'INSERT INTO vendas_itens (venda_id, produto_id, codigo, nome, preco, quantidade) VALUES (?, ?, ?, ?, ?, ?)',
          [id, item.id, item.codigo, item.nome, item.preco, item.quantidade]
        );

        // Atualizar estoque do produto
        await connection.execute(
          'UPDATE produtos SET estoque = estoque - ? WHERE id = ?',
          [item.quantidade, item.id]
        );
      }

      await connection.commit();

      res.status(201).json({
        success: true,
        message: 'Venda registrada com sucesso',
        vendaId: id
      });
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('Erro ao criar venda:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor'
    });
  }
});

module.exports = router; 