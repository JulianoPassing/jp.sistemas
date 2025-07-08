#!/bin/bash

echo "🚨 Corrigindo Erro 500 da Lista Negra..."
echo "========================================"

# Verificar se estamos no diretório correto
if [ ! -f "package.json" ]; then
    echo "❌ Erro: Execute este script na pasta raiz do projeto jp.sistemas"
    exit 1
fi

echo "1. Investigando o problema..."
node scripts/debug-lista-negra-error.js

echo ""
echo "2. Aplicando correções automáticas..."
node scripts/fix-lista-negra-500.js

if [ $? -eq 0 ]; then
    echo ""
    echo "3. Reiniciando servidor..."
    pm2 restart ecosystem.config.js
    
    echo ""
    echo "4. Aguardando servidor reiniciar..."
    sleep 3
    
    echo ""
    echo "✅ Correção da Lista Negra concluída!"
    echo ""
    echo "📋 Próximos passos:"
    echo "   1. Acesse o sistema de cobranças"
    echo "   2. Vá para 'Lista de Clientes'"
    echo "   3. Teste adicionar um cliente à lista negra"
    echo "   4. Verifique se não há mais erro 500"
    echo ""
    echo "🔍 Se ainda houver problemas:"
    echo "   - Verifique os logs: pm2 logs ecosystem.config.js"
    echo "   - Execute debug: node scripts/debug-lista-negra-error.js"
    echo ""
    echo "📚 Documentação completa: CORRECAO-LISTA-NEGRA-500.md"
else
    echo ""
    echo "❌ Erro durante a correção!"
    echo ""
    echo "💡 Possíveis soluções:"
    echo "   - Verifique se o MySQL está rodando: sudo systemctl status mysql"
    echo "   - Verifique as credenciais do banco de dados"
    echo "   - Execute manualmente: node scripts/debug-lista-negra-error.js"
fi 