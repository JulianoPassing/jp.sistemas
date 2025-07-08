#!/bin/bash

echo "🔧 DEBUG - Valor Final dos Empréstimos"
echo "======================================"
echo

echo "🚨 PROBLEMAS IDENTIFICADOS:"
echo "1. Duplicatas ainda aparecem na lista (6 linhas em vez de 3)"
echo "2. Coluna 'Valor Final' mostra datas em vez de valores"
echo

echo "🔍 POSSÍVEIS CAUSAS:"
echo "- Servidor não foi reiniciado após mudanças na API"
echo "- Cache do navegador interferindo"
echo "- API não está retornando valor_final corretamente"
echo

echo "📊 Testando dados direto do banco..."
node -e "
const mysql = require('mysql2');
const connection = mysql.createConnection({
  host: 'localhost',
  user: 'jpsistemas',
  password: 'Juliano@95',
  database: 'jpcobrancas_cobranca'
});

connection.query(\`
  SELECT DISTINCT e.id, e.cliente_id, c.nome as cliente_nome, e.valor, e.valor_parcela, e.numero_parcelas, e.juros_mensal, e.tipo_emprestimo,
         CASE 
           WHEN e.tipo_emprestimo = 'in_installments' THEN (e.valor_parcela * e.numero_parcelas)
           ELSE e.valor * (1 + (e.juros_mensal / 100))
         END as valor_final
  FROM emprestimos e
  LEFT JOIN clientes_cobrancas c ON e.cliente_id = c.id
  ORDER BY e.id
\`, (err, results) => {
  if (err) {
    console.error('❌ Erro:', err);
    process.exit(1);
  }
  
  console.log('🔍 QUERY DIRETA NO BANCO:');
  console.log('Total de registros:', results.length);
  
  const grouped = results.reduce((acc, row) => {
    if (!acc[row.id]) {
      acc[row.id] = [];
    }
    acc[row.id].push(row);
    return acc;
  }, {});
  
  console.log('IDs únicos:', Object.keys(grouped).length);
  
  if (Object.keys(grouped).length !== results.length) {
    console.log('⚠️  HÁ DUPLICATAS NO BANCO!');
  }
  
  results.forEach(row => {
    console.log(\`📄 ID \${row.id}: \${row.cliente_nome} - Inicial: R$ \${row.valor} - Final: R$ \${row.valor_final}\`);
  });
  
  connection.end();
});
"

echo
echo "🔄 PRÓXIMOS PASSOS:"
echo "1. Reiniciar o servidor Node.js"
echo "2. Limpar cache do navegador (Ctrl+Shift+R)"
echo "3. Recarregar emprestimos.html"
echo "4. Verificar logs no console do navegador"
echo

echo "📋 COMANDOS PARA REINICIAR:"
echo "pm2 restart all  # se usando PM2"
echo "# OU"
echo "pkill -f 'node.*server.js'  # matar processo"
echo "node server.js  # reiniciar manualmente"
echo

echo "🔍 LOGS A VERIFICAR NO CONSOLE:"
echo "- '📋 Histórico: API retornou X empréstimos'"
echo "- '💰 Histórico: Valores retornados pela API'"
echo "- '🚨 Histórico: Empréstimo duplicado ignorado'"
echo

echo "✅ RESULTADO ESPERADO APÓS CORREÇÃO:"
echo "- Apenas 3 empréstimos únicos na lista"
echo "- Coluna 'Valor Final' mostrando R$ 8.100,00, R$ 1.300,00, R$ 10.000,00"
echo "- Sem duplicatas"
echo 