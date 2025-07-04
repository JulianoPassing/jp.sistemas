const express = require('express');
const router = express.Router();
const db = require('../db');

// Listar todos os clientes
router.get('/', async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT c.*, 
             COUNT(l.id) as total_emprestimos,
             SUM(CASE WHEN l.status = 'active' THEN 1 ELSE 0 END) as emprestimos_ativos,
             SUM(CASE WHEN l.due_date < CURDATE() AND l.status = 'active' THEN 1 ELSE 0 END) as emprestimos_atrasados
      FROM clients c
      LEFT JOIN loans l ON c.id = l.client_id
      GROUP BY c.id
      ORDER BY c.name
    `);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Buscar cliente por ID
router.get('/:id', async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM clients WHERE id = ?', [req.params.id]);
    
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Cliente não encontrado' });
    }
    
    // Buscar empréstimos do cliente
    const [emprestimos] = await db.query(`
      SELECT l.*, 
             COALESCE(SUM(t.amount), 0) as total_pago,
             (l.amount - COALESCE(SUM(t.amount), 0)) as valor_restante
      FROM loans l
      LEFT JOIN transactions t ON l.id = t.loan_id
      WHERE l.client_id = ?
      GROUP BY l.id
      ORDER BY l.created_at DESC
    `, [req.params.id]);
    
    const cliente = rows[0];
    cliente.emprestimos = emprestimos;
    
    res.json(cliente);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Adicionar novo cliente
router.post('/', async (req, res) => {
  const { name, email, phone, cpf_cnpj, address } = req.body;
  
  try {
    // Verificar se CPF/CNPJ já existe
    if (cpf_cnpj) {
      const [existing] = await db.query('SELECT id FROM clients WHERE cpf_cnpj = ?', [cpf_cnpj]);
      if (existing.length > 0) {
        return res.status(400).json({ error: 'CPF/CNPJ já cadastrado' });
      }
    }
    
    const [result] = await db.query(
      'INSERT INTO clients (name, email, phone, cpf_cnpj, address) VALUES (?, ?, ?, ?, ?)',
      [name, email, phone, cpf_cnpj, address]
    );
    
    const [newCliente] = await db.query('SELECT * FROM clients WHERE id = ?', [result.insertId]);
    res.status(201).json(newCliente[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Atualizar cliente
router.put('/:id', async (req, res) => {
  const { name, email, phone, cpf_cnpj, address } = req.body;
  
  try {
    // Verificar se CPF/CNPJ já existe em outro cliente
    if (cpf_cnpj) {
      const [existing] = await db.query('SELECT id FROM clients WHERE cpf_cnpj = ? AND id != ?', [cpf_cnpj, req.params.id]);
      if (existing.length > 0) {
        return res.status(400).json({ error: 'CPF/CNPJ já cadastrado para outro cliente' });
      }
    }
    
    await db.query(
      'UPDATE clients SET name = ?, email = ?, phone = ?, cpf_cnpj = ?, address = ? WHERE id = ?',
      [name, email, phone, cpf_cnpj, address, req.params.id]
    );
    
    const [updatedCliente] = await db.query('SELECT * FROM clients WHERE id = ?', [req.params.id]);
    res.json(updatedCliente[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Deletar cliente
router.delete('/:id', async (req, res) => {
  try {
    // Verificar se cliente tem empréstimos ativos
    const [emprestimos] = await db.query('SELECT COUNT(*) as total FROM loans WHERE client_id = ? AND status = "active"', [req.params.id]);
    
    if (emprestimos[0].total > 0) {
      return res.status(400).json({ error: 'Não é possível deletar cliente com empréstimos ativos' });
    }
    
    await db.query('DELETE FROM clients WHERE id = ?', [req.params.id]);
    res.json({ message: 'Cliente deletado com sucesso' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Buscar clientes por nome ou CPF/CNPJ
router.get('/search/:term', async (req, res) => {
  try {
    const searchTerm = `%${req.params.term}%`;
    const [rows] = await db.query(`
      SELECT * FROM clients 
      WHERE name LIKE ? OR cpf_cnpj LIKE ? OR phone LIKE ?
      ORDER BY name
    `, [searchTerm, searchTerm, searchTerm]);
    
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Clientes em atraso
router.get('/overdue/all', async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT DISTINCT c.*, 
             COUNT(l.id) as total_emprestimos_atrasados,
             SUM(l.amount) as valor_total_atrasado
      FROM clients c
      JOIN loans l ON c.id = l.client_id
      WHERE l.due_date < CURDATE() AND l.status = 'active'
      GROUP BY c.id
      ORDER BY valor_total_atrasado DESC
    `);
    
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Estatísticas dos clientes
router.get('/stats/overview', async (req, res) => {
  try {
    // Total de clientes
    const [totalClientes] = await db.query('SELECT COUNT(*) as total FROM clients');
    
    // Clientes com empréstimos ativos
    const [clientesAtivos] = await db.query(`
      SELECT COUNT(DISTINCT client_id) as total 
      FROM loans 
      WHERE status = 'active'
    `);
    
    // Clientes em atraso
    const [clientesAtraso] = await db.query(`
      SELECT COUNT(DISTINCT client_id) as total 
      FROM loans 
      WHERE due_date < CURDATE() AND status = 'active'
    `);
    
    // Clientes novos este mês
    const [clientesNovos] = await db.query(`
      SELECT COUNT(*) as total 
      FROM clients 
      WHERE DATE_FORMAT(created_at, '%Y-%m') = DATE_FORMAT(CURDATE(), '%Y-%m')
    `);
    
    const stats = {
      totalClientes: totalClientes[0].total,
      clientesAtivos: clientesAtivos[0].total,
      clientesAtraso: clientesAtraso[0].total,
      clientesNovos: clientesNovos[0].total
    };
    
    res.json(stats);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router; 