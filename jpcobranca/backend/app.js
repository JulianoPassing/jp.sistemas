const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const db = require('./db');

const app = express();
app.use(cors());
app.use(bodyParser.json());

// Rotas da API
const clientesRouter = require('./routes/clientes');
const emprestimosRouter = require('./routes/emprestimos');
const cobrancasRouter = require('./routes/cobrancas');
const dashboardRouter = require('./routes/dashboard');

app.use('/api/clientes', clientesRouter);
app.use('/api/emprestimos', emprestimosRouter);
app.use('/api/cobrancas', cobrancasRouter);
app.use('/api/dashboard', dashboardRouter);

// Rota de teste
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', message: 'JP-Cobranças API funcionando!' });
});

// Middleware de tratamento de erros
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Erro interno do servidor' });
});

// Rota para arquivos não encontrados
app.use('*', (req, res) => {
  res.status(404).json({ error: 'Rota não encontrada' });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`🚀 Backend JP-Cobranças rodando em http://localhost:${PORT}`);
  console.log(`📊 API disponível em http://localhost:${PORT}/api`);
}); 