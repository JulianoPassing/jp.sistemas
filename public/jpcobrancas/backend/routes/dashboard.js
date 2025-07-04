const express = require('express');
const router = express.Router();
const db = require('../db');

// Dashboard principal com estatísticas
router.get('/', async (req, res) => {
  try {
    // Total de clientes
    const [totalClientes] = await db.query('SELECT COUNT(*) as total FROM clients');
    
    // Total de empréstimos ativos
    const [totalEmprestimos] = await db.query('SELECT COUNT(*) as total FROM loans WHERE status = "active"');
    
    // Valor total a receber (empréstimos ativos)
    const [valorReceber] = await db.query(`
      SELECT COALESCE(SUM(l.amount - COALESCE(SUM(t.amount), 0)), 0) as total
      FROM loans l
      LEFT JOIN transactions t ON l.id = t.loan_id
      WHERE l.status = 'active'
      GROUP BY l.id
    `);
    
    // Clientes em atraso
    const [clientesAtraso] = await db.query(`
      SELECT COUNT(DISTINCT l.client_id) as total
      FROM loans l
      WHERE l.due_date < CURDATE() AND l.status = 'active'
    `);
    
    // Empréstimos recentes (últimos 5)
    const [emprestimosRecentes] = await db.query(`
      SELECT l.*, c.name as client_name, c.phone as client_phone
      FROM loans l
      JOIN clients c ON l.client_id = c.id
      ORDER BY l.created_at DESC
      LIMIT 5
    `);
    
    // Cobranças pendentes (próximos 5 vencimentos)
    const [cobrancasPendentes] = await db.query(`
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
      LIMIT 5
    `);
    
    // Estatísticas por mês (últimos 6 meses)
    const [statsMensais] = await db.query(`
      SELECT 
        DATE_FORMAT(l.created_at, '%Y-%m') as month,
        COUNT(*) as total_loans,
        SUM(l.amount) as total_amount
      FROM loans l
      WHERE l.created_at >= DATE_SUB(CURDATE(), INTERVAL 6 MONTH)
      GROUP BY DATE_FORMAT(l.created_at, '%Y-%m')
      ORDER BY month DESC
    `);
    
    // Pagamentos do mês atual
    const [pagamentosMes] = await db.query(`
      SELECT SUM(t.amount) as total
      FROM transactions t
      WHERE DATE_FORMAT(t.payment_date, '%Y-%m') = DATE_FORMAT(CURDATE(), '%Y-%m')
    `);
    
    const dashboardData = {
      totalClientes: totalClientes[0].total,
      totalEmprestimos: totalEmprestimos[0].total,
      valorReceber: valorReceber.length > 0 ? valorReceber[0].total : 0,
      clientesAtraso: clientesAtraso[0].total,
      emprestimosRecentes,
      cobrancasPendentes,
      statsMensais,
      pagamentosMes: pagamentosMes[0].total || 0
    };
    
    res.json(dashboardData);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Estatísticas detalhadas
router.get('/stats', async (req, res) => {
  try {
    // Empréstimos por status
    const [emprestimosPorStatus] = await db.query(`
      SELECT status, COUNT(*) as total, SUM(amount) as valor_total
      FROM loans
      GROUP BY status
    `);
    
    // Top 5 clientes com mais empréstimos
    const [topClientes] = await db.query(`
      SELECT c.name, COUNT(l.id) as total_emprestimos, SUM(l.amount) as valor_total
      FROM clients c
      JOIN loans l ON c.id = l.client_id
      GROUP BY c.id
      ORDER BY total_emprestimos DESC
      LIMIT 5
    `);
    
    // Empréstimos por mês (último ano)
    const [emprestimosPorMes] = await db.query(`
      SELECT 
        DATE_FORMAT(created_at, '%Y-%m') as month,
        COUNT(*) as total,
        SUM(amount) as valor_total
      FROM loans
      WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL 12 MONTH)
      GROUP BY DATE_FORMAT(created_at, '%Y-%m')
      ORDER BY month
    `);
    
    // Taxa de inadimplência
    const [taxaInadimplencia] = await db.query(`
      SELECT 
        (COUNT(CASE WHEN due_date < CURDATE() AND status = 'active' THEN 1 END) * 100.0 / COUNT(*)) as taxa
      FROM loans
      WHERE status IN ('active', 'overdue')
    `);
    
    const stats = {
      emprestimosPorStatus,
      topClientes,
      emprestimosPorMes,
      taxaInadimplencia: taxaInadimplencia[0].taxa || 0
    };
    
    res.json(stats);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router; 