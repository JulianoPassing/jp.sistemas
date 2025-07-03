const express = require('express');
const router = express.Router();
const pool = require('../db-pool');

// Listar contas
router.get('/:tipo', async (req, res) => {
  const tipo = req.params.tipo;
  if (!['pagar', 'receber'].includes(tipo)) return res.status(400).json({ error: 'Tipo inválido' });
  try {
    const [rows] = await pool.query(`SELECT * FROM contas_${tipo} ORDER BY data_vencimento ASC, id DESC`);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Erro ao buscar contas' });
  }
});

// Adicionar conta
router.post('/:tipo', async (req, res) => {
  const tipo = req.params.tipo;
  const { descricao, valor, data_vencimento } = req.body;
  console.log('POST /api/contas/' + tipo, req.body); // Log do corpo recebido
  if (!['pagar', 'receber'].includes(tipo)) return res.status(400).json({ error: 'Tipo inválido' });
  if (!descricao || !valor || !data_vencimento) return res.status(400).json({ error: 'Dados obrigatórios' });
  try {
    console.log('Antes do INSERT');
    const [result] = await pool.query(
      `INSERT INTO contas_${tipo} (descricao, valor, data_vencimento) VALUES (?, ?, ?)`,
      [descricao, valor, data_vencimento]
    );
    console.log('Depois do INSERT', result);
    res.json({ id: result.insertId, descricao, valor, data_vencimento });
  } catch (err) {
    console.error('ERRO NO INSERT:', err); // Log do erro detalhado
    res.status(500).json({ error: 'Erro ao adicionar conta', details: err.message });
  }
});

// Remover conta
router.delete('/:tipo/:id', async (req, res) => {
  const tipo = req.params.tipo;
  const id = req.params.id;
  if (!['pagar', 'receber'].includes(tipo)) return res.status(400).json({ error: 'Tipo inválido' });
  try {
    await pool.query(`DELETE FROM contas_${tipo} WHERE id = ?`, [id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Erro ao remover conta' });
  }
});

module.exports = router; 