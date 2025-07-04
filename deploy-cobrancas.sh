#!/bin/bash

# 🚀 Script de Deploy - J.P Sistemas com Módulo de Cobranças
# Este script configura o sistema completo com banco de dados separado para cobranças

set -e  # Para o script se houver erro

echo "🚀 Iniciando deploy do J.P Sistemas com módulo de cobranças..."

# Cores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Função para log colorido
log() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')] $1${NC}"
}

warn() {
    echo -e "${YELLOW}[$(date +'%Y-%m-%d %H:%M:%S')] WARNING: $1${NC}"
}

error() {
    echo -e "${RED}[$(date +'%Y-%m-%d %H:%M:%S')] ERROR: $1${NC}"
}

# Verificar se está rodando como root
if [[ $EUID -eq 0 ]]; then
   error "Este script não deve ser executado como root"
   exit 1
fi

# Verificar se o Node.js está instalado
if ! command -v node &> /dev/null; then
    log "Instalando Node.js..."
    curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
    sudo apt-get install -y nodejs
else
    log "Node.js já está instalado: $(node --version)"
fi

# Verificar se o PM2 está instalado
if ! command -v pm2 &> /dev/null; then
    log "Instalando PM2..."
    sudo npm install -g pm2
else
    log "PM2 já está instalado: $(pm2 --version)"
fi

# Verificar se o MariaDB está rodando
if ! sudo systemctl is-active --quiet mariadb; then
    error "MariaDB não está rodando. Inicie o serviço primeiro:"
    echo "sudo systemctl start mariadb"
    exit 1
fi

log "MariaDB está rodando ✓"

# Criar diretório de logs se não existir
mkdir -p logs

# Instalar dependências
log "Instalando dependências..."
npm install

# Verificar se o arquivo .env existe
if [ ! -f .env ]; then
    log "Criando arquivo .env..."
    cp env.example .env
    warn "⚠️  Configure o arquivo .env com suas credenciais de banco de dados"
    echo "Edite o arquivo .env e configure:"
    echo "  - DB_HOST, DB_USER, DB_PASSWORD"
    echo "  - JWT_SECRET, SESSION_SECRET"
    echo ""
    echo "Pressione Enter quando terminar..."
    read
fi

# Inicializar banco de dados principal
log "Inicializando banco de dados principal..."
npm run init-vercel

# Inicializar banco de dados de cobranças
log "Inicializando banco de dados de cobranças..."
npm run init-cobrancas

# Parar aplicação anterior se estiver rodando
if pm2 list | grep -q "jpsistemas"; then
    log "Parando aplicação anterior..."
    pm2 stop jpsistemas
    pm2 delete jpsistemas
fi

# Iniciar com PM2
log "Iniciando aplicação com PM2..."
pm2 start ecosystem.config.js

# Salvar configuração do PM2
log "Salvando configuração do PM2..."
pm2 save

# Configurar auto-start no boot
log "Configurando auto-start no boot..."
pm2 startup

log "🎉 Deploy concluído com sucesso!"
echo ""
echo "📊 Status da aplicação:"
pm2 status
echo ""
echo "🔗 URLs de acesso:"
echo "  - Sistema Principal: http://localhost:3000"
echo "  - Módulo de Cobranças: http://localhost:3000/jp.cobrancas/"
echo ""
echo "📋 Comandos úteis:"
echo "  - Ver logs: pm2 logs jpsistemas"
echo "  - Reiniciar: pm2 restart jpsistemas"
echo "  - Parar: pm2 stop jpsistemas"
echo "  - Monitorar: pm2 monit"
echo ""
echo "📝 Dados de exemplo inseridos no módulo de cobranças:"
echo "  - 3 clientes de exemplo"
echo "  - 3 empréstimos de exemplo"
echo "  - 3 cobranças pendentes"
echo ""
log "✅ Sistema pronto para uso!" 