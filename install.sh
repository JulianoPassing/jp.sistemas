#!/bin/bash

# Script de Instalação Automatizada - Sistema J.P Sistemas (MariaDB)
# Este script configura todo o ambiente necessário na VPS

set -e

# Cores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Função de log
log() {
    echo -e "${GREEN}[$(date '+%Y-%m-%d %H:%M:%S')]${NC} $1"
}

error() {
    echo -e "${RED}[ERRO]${NC} $1"
}

warning() {
    echo -e "${YELLOW}[AVISO]${NC} $1"
}

info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

# Verificar se está rodando como root
if [[ $EUID -ne 0 ]]; then
   error "Este script deve ser executado como root (sudo)"
   exit 1
fi

log "🚀 Iniciando instalação do Sistema J.P Sistemas (MariaDB)"

# Atualizar sistema
log "📦 Atualizando sistema..."
apt update && apt upgrade -y

# Instalar dependências básicas
log "📦 Instalando dependências básicas..."
apt install -y curl wget git nginx mariadb-server nodejs npm software-properties-common

# Configurar MariaDB
log "🗄️  Configurando MariaDB..."
systemctl start mariadb
systemctl enable mariadb

# Configuração segura do MariaDB
log "🔐 Configurando segurança do MariaDB..."
mysql -e "DELETE FROM mysql.user WHERE User='';"
mysql -e "DELETE FROM mysql.user WHERE User='root' AND Host NOT IN ('localhost', '127.0.0.1', '::1');"
mysql -e "DROP DATABASE IF EXISTS test;"
mysql -e "DELETE FROM mysql.db WHERE Db='test' OR Db='test\\_%';"
mysql -e "FLUSH PRIVILEGES;"

# Criar usuário MariaDB para o sistema
log "👤 Criando usuário MariaDB..."
mysql -e "CREATE USER IF NOT EXISTS 'jpsistemas'@'localhost' IDENTIFIED BY 'SuaSenhaForte123!';"
mysql -e "GRANT ALL PRIVILEGES ON *.* TO 'jpsistemas'@'localhost';"
mysql -e "FLUSH PRIVILEGES;"

# Configurar MariaDB para melhor performance
log "⚙️  Otimizando configurações do MariaDB..."
cat > /etc/mysql/conf.d/jpsistemas.cnf << 'EOF'
[mysqld]
# Configurações para multi-tenancy
innodb_buffer_pool_size = 1G
innodb_log_file_size = 256M
innodb_flush_log_at_trx_commit = 2
max_connections = 200
query_cache_size = 64M
query_cache_type = 1

# Configurações de charset
character-set-server = utf8mb4
collation-server = utf8mb4_unicode_ci

# Configurações de segurança
bind-address = 127.0.0.1
skip-networking = 0

# Configurações de log
log-error = /var/log/mysql/error.log
slow_query_log = 1
slow_query_log_file = /var/log/mysql/slow.log
long_query_time = 2
EOF

# Reiniciar MariaDB para aplicar configurações
systemctl restart mariadb

# Instalar Node.js via NVM (versão mais recente)
log "📦 Instalando Node.js via NVM..."
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
[ -s "$NVM_DIR/bash_completion" ] && \. "$NVM_DIR/bash_completion"

nvm install 18
nvm use 18
nvm alias default 18

# Verificar instalação do Node.js
NODE_VERSION=$(node --version)
NPM_VERSION=$(npm --version)
log "✅ Node.js $NODE_VERSION e npm $NPM_VERSION instalados"

# Instalar PM2 globalmente
log "📦 Instalando PM2..."
npm install -g pm2

# Configurar firewall
log "🔥 Configurando firewall..."
ufw allow ssh
ufw allow 'Nginx Full'
ufw allow 3000
ufw --force enable

# Criar diretório da aplicação
log "📁 Criando diretório da aplicação..."
mkdir -p /var/www/jpsistemas
cd /var/www/jpsistemas

# Se o projeto já existe, fazer backup
if [ -d ".git" ]; then
    log "📦 Fazendo backup do projeto existente..."
    cp -r . ../jpsistemas_backup_$(date +%Y%m%d_%H%M%S)
fi

# Clonar ou copiar o projeto
if [ -d "/tmp/jpsistemas" ]; then
    log "📦 Copiando projeto..."
    cp -r /tmp/jpsistemas/* .
    cp -r /tmp/jpsistemas/.* . 2>/dev/null || true
else
    log "📦 Clonando projeto do repositório..."
    git clone https://github.com/seu-usuario/jpsistemas.git .
fi

# Configurar permissões
log "🔐 Configurando permissões..."
chown -R www-data:www-data /var/www/jpsistemas
chmod -R 755 /var/www/jpsistemas

# Instalar dependências do Node.js
log "📦 Instalando dependências do Node.js..."
npm install

# Configurar variáveis de ambiente
log "⚙️  Configurando variáveis de ambiente..."
if [ ! -f ".env" ]; then
    cp env.example .env
    warning "Arquivo .env criado. Configure as variáveis de ambiente antes de continuar."
    warning "Pressione Enter após configurar o arquivo .env..."
    read
fi

# Inicializar banco de dados
log "🗄️  Inicializando banco de dados..."
npm run init-db

# Configurar Nginx
log "🌐 Configurando Nginx..."
cat > /etc/nginx/sites-available/jpsistemas << 'EOF'
server {
    listen 80;
    server_name _;

    client_max_body_size 100M;
    
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 86400;
    }

    location /api {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    # Configurações de segurança
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header Referrer-Policy "no-referrer-when-downgrade" always;
    add_header Content-Security-Policy "default-src 'self' http: https: data: blob: 'unsafe-inline'" always;
}
EOF

# Ativar site
ln -sf /etc/nginx/sites-available/jpsistemas /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default

# Testar configuração do Nginx
nginx -t

# Reiniciar Nginx
systemctl restart nginx
systemctl enable nginx

# Configurar PM2
log "⚙️  Configurando PM2..."
pm2 start server.js --name "jpsistemas"
pm2 startup
pm2 save

# Configurar backup automático
log "💾 Configurando backup automático..."
chmod +x scripts/backup.sh

# Adicionar ao crontab
(crontab -l 2>/dev/null; echo "0 2 * * * /var/www/jpsistemas/scripts/backup.sh") | crontab -

# Criar diretórios de log
mkdir -p /var/log/jpsistemas
chown -R www-data:www-data /var/log/jpsistemas

# Configurar logrotate
cat > /etc/logrotate.d/jpsistemas << 'EOF'
/var/log/jpsistemas/*.log {
    daily
    missingok
    rotate 30
    compress
    delaycompress
    notifempty
    create 644 www-data www-data
    postrotate
        pm2 reloadLogs
    endscript
}
EOF

# Instalar e configurar fail2ban
log "🛡️  Configurando fail2ban..."
apt install -y fail2ban
systemctl enable fail2ban
systemctl start fail2ban

# Configurar atualizações automáticas
log "🔄 Configurando atualizações automáticas..."
apt install -y unattended-upgrades
dpkg-reconfigure -plow unattended-upgrades

# Verificar status dos serviços
log "🔍 Verificando status dos serviços..."
systemctl status nginx --no-pager -l
systemctl status mariadb --no-pager -l
pm2 status

# Mostrar informações finais
log "✅ Instalação concluída com sucesso!"
echo ""
info "📋 Informações importantes:"
echo "   🌐 URL: http://$(hostname -I | awk '{print $1}')"
echo "   👤 Usuário admin: admin"
echo "   🔑 Senha admin: admin123"
echo "   📁 Diretório: /var/www/jpsistemas"
echo "   📝 Logs: /var/log/jpsistemas"
echo "   💾 Backups: /var/backups/jpsistemas"
echo "   🗄️  Banco: MariaDB"
echo "   🔧 Charset: utf8mb4"
echo ""
warning "⚠️  IMPORTANTE:"
echo "   1. Altere a senha do administrador após o primeiro login"
echo "   2. Configure SSL/HTTPS para produção"
echo "   3. Configure backup externo"
echo "   4. Monitore os logs regularmente"
echo "   5. Verifique as configurações do MariaDB em /etc/mysql/conf.d/jpsistemas.cnf"
echo ""
info "📞 Suporte: https://whatsa.me/5548996852138"
echo ""
log "🎉 Sistema J.P Sistemas (MariaDB) está pronto para uso!" 