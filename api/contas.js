const express = require('express');
const router = express.Router();
const mysql = require('mysql2/promise');
const { getUserDatabaseConfig } = require('../database-config');
const { requireAuthJWT } = require('../middlewares/auth');

// Helper para obter conexão do banco do usuário logado via JWT
async function getUserConnection(req) {
  const username = req.user && req.user.username;
  if (!username) throw new Error('Usuário não autenticado');
  const dbConfig = getUserDatabaseConfig(username);
  return mysql.createConnection(dbConfig);
}

// Listar contas
router.get('/:tipo', requireAuthJWT, async (req, res) => {
  const tipo = req.params.tipo;
  if (!['pagar', 'receber'].includes(tipo)) return res.status(400).json({ error: 'Tipo inválido' });
  try {
    const connection = await getUserConnection(req);
    const [rows] = await connection.query(`SELECT * FROM contas_${tipo} ORDER BY data_vencimento ASC, id DESC`);
    await connection.end();
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao buscar contas', details: err.message });
  }
});

// Adicionar conta
router.post('/:tipo', requireAuthJWT, async (req, res) => {
  const tipo = req.params.tipo;
  const { descricao, valor, data_vencimento } = req.body;
  console.log('POST /api/contas/' + tipo, req.body); // Log do corpo recebido
  if (!['pagar', 'receber'].includes(tipo)) return res.status(400).json({ error: 'Tipo inválido' });
  if (!descricao || !valor || !data_vencimento) return res.status(400).json({ error: 'Dados obrigatórios' });
  try {
    console.log('Antes do INSERT');
    const connection = await getUserConnection(req);
    const [result] = await connection.query(
      `INSERT INTO contas_${tipo} (descricao, valor, data_vencimento) VALUES (?, ?, ?)`,
      [descricao, valor, data_vencimento]
    );
    console.log('Depois do INSERT', result);
    await connection.end();
    res.json({ id: result.insertId, descricao, valor, data_vencimento });
  } catch (err) {
    console.error('ERRO NO INSERT:', err); // Log do erro detalhado
    res.status(500).json({ error: 'Erro ao adicionar conta', details: err.message });
  }
});

// Remover conta
router.delete('/:tipo/:id', requireAuthJWT, async (req, res) => {
  const tipo = req.params.tipo;
  const id = req.params.id;
  if (!['pagar', 'receber'].includes(tipo)) return res.status(400).json({ error: 'Tipo inválido' });
  try {
    const connection = await getUserConnection(req);
    await connection.query(`DELETE FROM contas_${tipo} WHERE id = ?`, [id]);
    await connection.end();
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao remover conta', details: err.message });
  }
});

module.exports = router; 