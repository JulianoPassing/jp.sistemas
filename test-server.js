const express = require('express');
const app = express();

app.use(express.json());

// Rota de teste simples
app.get('/api/test', (req, res) => {
  res.json({ 
    message: 'Servidor funcionando!',
    timestamp: new Date().toISOString(),
    env: process.env.NODE_ENV || 'development'
  });
});

// Rota para testar cobranças
app.get('/api/cobrancas/test', (req, res) => {
  res.json({ 
    message: 'Rota de cobranças funcionando!',
    timestamp: new Date().toISOString()
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Servidor de teste rodando na porta ${PORT}`);
  console.log(`📱 Acesse: http://localhost:${PORT}/api/test`);
}); 