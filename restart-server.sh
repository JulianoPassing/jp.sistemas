#!/bin/bash

echo "🔄 Reiniciando servidor..."

# Parar o processo atual (se estiver rodando)
pkill -f "node server.js" || echo "Nenhum processo encontrado para parar"

# Aguardar um pouco
sleep 2

# Iniciar o servidor novamente
echo "🚀 Iniciando servidor..."
nohup node server.js > server.log 2>&1 &

echo "✅ Servidor reiniciado!"
echo "📋 Logs disponíveis em: server.log"
echo "🔍 Para ver os logs: tail -f server.log" 