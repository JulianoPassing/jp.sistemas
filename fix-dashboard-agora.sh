#!/bin/bash

echo "🔧 Corrigindo Dashboard JP.Cobranças na VPS..."
echo "=================================================="

# Testar o script
echo "1. Testando conexão com banco..."
node scripts/fix-dashboard-vps.js

echo ""
echo "2. Reiniciando servidor..."
pm2 restart ecosystem.config.js

echo ""
echo "3. Aguardando servidor reiniciar..."
sleep 3

echo ""
echo "✅ Pronto! Dashboard corrigido!"
echo "📱 Acesse o dashboard e verifique se os valores aparecem"
echo "🔄 Se ainda estiver zerado, aguarde alguns segundos e recarregue a página" 