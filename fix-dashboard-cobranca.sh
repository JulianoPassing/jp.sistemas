#!/bin/bash

echo "🔧 Corrigindo Dashboard do Usuário COBRANCA na VPS..."
echo "===================================================="

# Verificar se estamos no diretório correto
if [ ! -f "package.json" ]; then
    echo "❌ Erro: Execute este script na pasta raiz do projeto jp.sistemas"
    exit 1
fi

# Testar conexão com banco do usuário cobranca
echo "1. Testando conexão com banco do usuário cobranca..."
node scripts/test-cobranca-dashboard.js

if [ $? -eq 0 ]; then
    echo ""
    echo "2. Reiniciando servidor..."
    pm2 restart ecosystem.config.js
    
    echo ""
    echo "3. Aguardando servidor reiniciar..."
    sleep 3
    
    echo ""
    echo "✅ Pronto! Dashboard do usuário cobranca corrigido!"
    echo "📱 Faça login com usuário 'cobranca' e verifique o dashboard"
    echo "🔄 Se ainda estiver zerado, aguarde alguns segundos e recarregue a página"
    echo ""
    echo "💡 Lembre-se: Cada usuário tem seu próprio banco de dados!"
else
    echo ""
    echo "❌ Erro no teste. Verifique:"
    echo "   - Se o MySQL está rodando: sudo systemctl status mysql"
    echo "   - Se o banco existe: mysql -u jpcobrancas -p"
    echo "   - Se o usuário 'cobranca' fez login pelo menos uma vez"
fi 