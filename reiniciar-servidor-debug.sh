#!/bin/bash

echo "🔄 REINICIAR SERVIDOR - Aplicar Correções"
echo "======================================="
echo

echo "🎯 OBJETIVO: Aplicar correções do valor_final na API"
echo

echo "📋 ETAPA 1: Verificar processos Node.js em execução"
echo "Processos Node.js ativos:"
ps aux | grep -E "(node|pm2)" | grep -v grep || echo "Nenhum processo encontrado"
echo

echo "📋 ETAPA 2: Tentar reiniciar com PM2 (se disponível)"
if command -v pm2 &> /dev/null; then
    echo "PM2 encontrado - reiniciando aplicações..."
    pm2 restart all
    echo "✅ PM2 reiniciado"
else
    echo "PM2 não encontrado - tentando método manual..."
    
    # Matar processos Node.js relacionados ao servidor
    echo "Finalizando processos Node.js do servidor..."
    pkill -f "node.*server.js" || echo "Nenhum processo server.js encontrado"
    pkill -f "node.*app.js" || echo "Nenhum processo app.js encontrado"
    
    echo "Aguardando 2 segundos..."
    sleep 2
    
    # Verificar se ainda há processos
    remaining=$(ps aux | grep -E "(node.*server|node.*app)" | grep -v grep | wc -l)
    if [ $remaining -gt 0 ]; then
        echo "⚠️  Ainda há processos Node.js em execução"
        ps aux | grep -E "(node.*server|node.*app)" | grep -v grep
    else
        echo "✅ Todos os processos Node.js foram finalizados"
    fi
fi

echo
echo "📋 ETAPA 3: Verificar se a API foi atualizada"
echo "Verificando se a query na API contém DISTINCT e valor_final..."
if grep -q "valor_final" api/cobrancas.js; then
    echo "✅ Campo valor_final encontrado na API"
else
    echo "❌ Campo valor_final NÃO encontrado na API"
fi

if grep -q "SELECT DISTINCT.*valor_final" api/cobrancas.js; then
    echo "✅ Query com DISTINCT e valor_final encontrada"
else
    echo "❌ Query com DISTINCT e valor_final NÃO encontrada"
fi

echo
echo "📋 ETAPA 4: Reiniciar servidor manualmente (se necessário)"
echo "Para reiniciar manualmente, execute:"
echo "nohup node server.js > server.log 2>&1 &"
echo "# OU"
echo "pm2 start server.js --name jp-sistemas"

echo
echo "📋 ETAPA 5: Testar API"
echo "Teste a API com curl (aguarde o servidor iniciar):"
echo "curl -X GET http://localhost:3000/api/cobrancas/emprestimos"

echo
echo "📋 ETAPA 6: Verificar no navegador"
echo "1. Abra emprestimos.html"
echo "2. Pressione Ctrl+Shift+R para limpar cache"
echo "3. Pressione F12 para abrir console"
echo "4. Verifique os logs:"
echo "   - '💰 Histórico: Valores retornados pela API'"
echo "   - Procure por valor_final nos dados"

echo
echo "🎯 RESULTADO ESPERADO:"
echo "- API deve retornar 3 empréstimos únicos"
echo "- Cada empréstimo deve ter campo valor_final"
echo "- Coluna 'Valor Final' deve mostrar valores, não datas"
echo "- Sem duplicatas na lista"

echo
echo "✅ Execute este script e depois teste no navegador!"
echo 