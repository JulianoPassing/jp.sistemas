const express = require('express');
const router = express.Router();
const db = require('../db');

// Listar todos os empréstimos
router.get('/', async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT l.*, c.name as client_name, c.phone as client_phone
      FROM loans l
      JOIN clients c ON l.client_id = c.id
      ORDER BY l.created_at DESC
    `);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Buscar empréstimo por ID
router.get('/:id', async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT l.*, c.name as client_name, c.phone as client_phone, c.email as client_email
      FROM loans l
      JOIN clients c ON l.client_id = c.id
      WHERE l.id = ?
    `, [req.params.id]);
    
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Empréstimo não encontrado' });
    }
    
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Criar novo empréstimo
router.post('/', async (req, res) => {
  const { client_id, amount, interest_rate, start_date, due_date } = req.body;
  
  try {
    const [result] = await db.query(
      'INSERT INTO loans (client_id, amount, interest_rate, start_date, due_date) VALUES (?, ?, ?, ?, ?)',
      [client_id, amount, interest_rate, start_date, due_date]
    );
    
    const [newLoan] = await db.query(`
      SELECT l.*, c.name as client_name, c.phone as client_phone
      FROM loans l
      JOIN clients c ON l.client_id = c.id
      WHERE l.id = ?
    `, [result.insertId]);
    
    res.status(201).json(newLoan[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Atualizar empréstimo
router.put('/:id', async (req, res) => {
  const { amount, interest_rate, start_date, due_date, status } = req.body;
  
  try {
    await db.query(
      'UPDATE loans SET amount = ?, interest_rate = ?, start_date = ?, due_date = ?, status = ? WHERE id = ?',
      [amount, interest_rate, start_date, due_date, status, req.params.id]
    );
    
    const [updatedLoan] = await db.query(`
      SELECT l.*, c.name as client_name, c.phone as client_phone
      FROM loans l
      JOIN clients c ON l.client_id = c.id
      WHERE l.id = ?
    `, [req.params.id]);
    
    res.json(updatedLoan[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Deletar empréstimo
router.delete('/:id', async (req, res) => {
  try {
    await db.query('DELETE FROM loans WHERE id = ?', [req.params.id]);
    res.json({ message: 'Empréstimo deletado com sucesso' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Buscar empréstimos em atraso
router.get('/overdue/all', async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT l.*, c.name as client_name, c.phone as client_phone,
             DATEDIFF(CURDATE(), l.due_date) as days_overdue
      FROM loans l
      JOIN clients c ON l.client_id = c.id
      WHERE l.due_date < CURDATE() AND l.status = 'active'
      ORDER BY l.due_date ASC
    `);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router; 