#!/bin/bash

echo "========================================"
echo "   JP-Cobrancas - Instalacao"
echo "========================================"
echo

echo "[1/4] Verificando Node.js..."
if ! command -v node &> /dev/null; then
    echo "ERRO: Node.js nao encontrado!"
    echo "Por favor, instale o Node.js de: https://nodejs.org/"
    exit 1
fi
echo "Node.js encontrado: $(node --version)"

echo
echo "[2/4] Instalando dependencias do backend..."
cd backend
npm install
if [ $? -ne 0 ]; then
    echo "ERRO: Falha ao instalar dependencias!"
    exit 1
fi
echo "Dependencias instaladas com sucesso!"

echo
echo "[3/4] Configurando banco de dados..."
echo "IMPORTANTE: Certifique-se de que o MariaDB/MySQL esteja rodando"
echo "e execute o script database_config.sql manualmente:"
echo "mysql -u root -p < ../database_config.sql"
echo

echo "[4/4] Iniciando o sistema..."
echo
echo "Backend sera iniciado em: http://localhost:3001"
echo "Frontend: Abra frontend/index.html no navegador"
echo
read -p "Pressione Enter para iniciar o backend..."

echo "Iniciando backend..."
npm start 