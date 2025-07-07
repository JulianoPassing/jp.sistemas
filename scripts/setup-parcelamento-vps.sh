#!/bin/bash

echo "=== CONFIGURAÇÃO DE PARCELAMENTO NO VPS ==="
echo ""

# Verificar se estamos no diretório correto
if [ ! -f "package.json" ]; then
    echo "❌ Erro: Execute este script no diretório raiz do projeto"
    exit 1
fi

# 1. Configurar variáveis de ambiente
echo "1. Configurando variáveis de ambiente..."
node scripts/setup-env-vps.js

if [ $? -ne 0 ]; then
    echo "❌ Erro ao configurar variáveis de ambiente"
    exit 1
fi

echo ""

# 2. Verificar se o MySQL está rodando
echo "2. Verificando status do MySQL..."
if ! systemctl is-active --quiet mysql; then
    echo "⚠️  MySQL não está rodando. Tentando iniciar..."
    sudo systemctl start mysql
    
    if [ $? -ne 0 ]; then
        echo "❌ Erro ao iniciar MySQL"
        exit 1
    fi
fi

echo "✅ MySQL está rodando"

# 3. Verificar se o usuário jpcobrancas existe
echo ""
echo "3. Verificando usuário do banco de dados..."
mysql -u root -p -e "SELECT User FROM mysql.user WHERE User='jpcobrancas';" 2>/dev/null | grep -q jpcobrancas

if [ $? -ne 0 ]; then
    echo "⚠️  Usuário jpcobrancas não existe. Criando..."
    mysql -u root -p -e "CREATE USER 'jpcobrancas'@'localhost' IDENTIFIED BY 'Juliano@95';"
    mysql -u root -p -e "GRANT ALL PRIVILEGES ON *.* TO 'jpcobrancas'@'localhost';"
    mysql -u root -p -e "FLUSH PRIVILEGES;"
    echo "✅ Usuário jpcobrancas criado"
else
    echo "✅ Usuário jpcobrancas já existe"
fi

# 4. Atualizar estrutura do banco para parcelamento
echo ""
echo "4. Atualizando estrutura do banco para parcelamento..."
node scripts/update-emprestimos-parcelamento.js

if [ $? -ne 0 ]; then
    echo "❌ Erro ao atualizar estrutura do banco"
    exit 1
fi

echo ""
echo "=== CONFIGURAÇÃO CONCLUÍDA ==="
echo "✅ Variáveis de ambiente configuradas"
echo "✅ MySQL verificado e funcionando"
echo "✅ Usuário do banco verificado"
echo "✅ Estrutura de parcelamento atualizada"
echo ""
echo "🎉 O sistema de parcelamento está pronto para uso!"
echo ""
echo "Para testar, acesse: http://seu-ip:3000" 