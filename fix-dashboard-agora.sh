#!/bin/bash

echo "🔧 Corrigindo Dashboard JP.Cobranças na VPS..."
echo "=================================================="

# Verificar se estamos no diretório correto
if [ ! -f "package.json" ]; then
    echo "❌ Erro: Execute este script na pasta raiz do projeto jp.sistemas"
    exit 1
fi

# Testar o script
echo "1. Testando conexão com banco..."
node scripts/fix-dashboard-vps.js

if [ $? -eq 0 ]; then
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
else
    echo ""
    echo "❌ Erro no teste. Verifique as credenciais do banco de dados"
    echo "💡 Você pode:"
    echo "   - Verificar se o MySQL está rodando: sudo systemctl status mysql"
    echo "   - Verificar se o banco existe: mysql -u jpsistemas -p"
    echo "   - Ou executar apenas: node scripts/fix-dashboard-vps.js"
fi 