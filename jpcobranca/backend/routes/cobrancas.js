const express = require('express');
const router = express.Router();
const db = require('../db');

// Listar todas as cobranças/pagamentos
router.get('/', async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT t.*, l.amount as loan_amount, l.due_date, c.name as client_name, c.phone as client_phone
      FROM transactions t
      JOIN loans l ON t.loan_id = l.id
      JOIN clients c ON l.client_id = c.id
      ORDER BY t.payment_date DESC
    `);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Buscar cobrança por ID
router.get('/:id', async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT t.*, l.amount as loan_amount, l.due_date, c.name as client_name, c.phone as client_phone
      FROM transactions t
      JOIN loans l ON t.loan_id = l.id
      JOIN clients c ON l.client_id = c.id
      WHERE t.id = ?
    `, [req.params.id]);
    
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Cobrança não encontrada' });
    }
    
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Registrar novo pagamento
router.post('/', async (req, res) => {
  const { loan_id, amount, payment_date, payment_type, notes } = req.body;
  
  try {
    // Inserir a transação
    const [result] = await db.query(
      'INSERT INTO transactions (loan_id, amount, payment_date, payment_type, notes) VALUES (?, ?, ?, ?, ?)',
      [loan_id, amount, payment_date, payment_type, notes]
    );
    
    // Verificar se o empréstimo foi totalmente pago
    const [loanData] = await db.query('SELECT amount FROM loans WHERE id = ?', [loan_id]);
    const [totalPaid] = await db.query(
      'SELECT SUM(amount) as total FROM transactions WHERE loan_id = ?',
      [loan_id]
    );
    
    // Se o total pago for maior ou igual ao valor do empréstimo, marcar como pago
    if (totalPaid[0].total >= loanData[0].amount) {
      await db.query('UPDATE loans SET status = "paid" WHERE id = ?', [loan_id]);
    }
    
    const [newTransaction] = await db.query(`
      SELECT t.*, l.amount as loan_amount, l.due_date, c.name as client_name, c.phone as client_phone
      FROM transactions t
      JOIN loans l ON t.loan_id = l.id
      JOIN clients c ON l.client_id = c.id
      WHERE t.id = ?
    `, [result.insertId]);
    
    res.status(201).json(newTransaction[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Atualizar cobrança
router.put('/:id', async (req, res) => {
  const { amount, payment_date, payment_type, notes } = req.body;
  
  try {
    await db.query(
      'UPDATE transactions SET amount = ?, payment_date = ?, payment_type = ?, notes = ? WHERE id = ?',
      [amount, payment_date, payment_type, notes, req.params.id]
    );
    
    const [updatedTransaction] = await db.query(`
      SELECT t.*, l.amount as loan_amount, l.due_date, c.name as client_name, c.phone as client_phone
      FROM transactions t
      JOIN loans l ON t.loan_id = l.id
      JOIN clients c ON l.client_id = c.id
      WHERE t.id = ?
    `, [req.params.id]);
    
    res.json(updatedTransaction[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Deletar cobrança
router.delete('/:id', async (req, res) => {
  try {
    await db.query('DELETE FROM transactions WHERE id = ?', [req.params.id]);
    res.json({ message: 'Cobrança deletada com sucesso' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Buscar cobranças pendentes (empréstimos ativos)
router.get('/pending/all', async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT l.*, c.name as client_name, c.phone as client_phone,
             DATEDIFF(l.due_date, CURDATE()) as days_until_due,
             COALESCE(SUM(t.amount), 0) as total_paid,
             (l.amount - COALESCE(SUM(t.amount), 0)) as remaining_amount
      FROM loans l
      JOIN clients c ON l.client_id = c.id
      LEFT JOIN transactions t ON l.id = t.loan_id
      WHERE l.status = 'active'
      GROUP BY l.id
      HAVING remaining_amount > 0
      ORDER BY l.due_date ASC
    `);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Buscar cobranças em atraso
router.get('/overdue/all', async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT l.*, c.name as client_name, c.phone as client_phone,
             DATEDIFF(CURDATE(), l.due_date) as days_overdue,
             COALESCE(SUM(t.amount), 0) as total_paid,
             (l.amount - COALESCE(SUM(t.amount), 0)) as remaining_amount
      FROM loans l
      JOIN clients c ON l.client_id = c.id
      LEFT JOIN transactions t ON l.id = t.loan_id
      WHERE l.due_date < CURDATE() AND l.status = 'active'
      GROUP BY l.id
      HAVING remaining_amount > 0
      ORDER BY l.due_date ASC
    `);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router; 