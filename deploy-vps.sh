#!/bin/bash

# 🚀 Script de Deploy Automático para VPS - J.P Sistemas
# Autor: J.P Sistemas
# Versão: 1.0

set -e  # Parar em caso de erro

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

info() {
    echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')] INFO: $1${NC}"
}

# Verificar se está rodando como root
if [[ $EUID -ne 0 ]]; then
   error "Este script deve ser executado como root"
   exit 1
fi

# Variáveis de configuração
DB_PASSWORD="SuaSenhaForte123!"
JWT_SECRET="SeuJWTSecretMuitoForte123!"
SESSION_SECRET="SeuSessionSecretMuitoForte123!"
DOMAIN=""
APP_DIR="/var/www/jp.sistemas"

log "🚀 Iniciando deploy do J.P Sistemas na VPS..."

# Função para atualizar sistema
update_system() {
    log "Atualizando sistema..."
    apt update && apt upgrade -y
    apt install -y curl wget git unzip software-properties-common apt-transport-https ca-certificates gnupg lsb-release
}

# Função para instalar MySQL
install_mysql() {
    log "Instalando MySQL..."
    
    # Adicionar repositório MySQL
    wget https://dev.mysql.com/get/mysql-apt-config_0.8.24-1_all.deb
    dpkg -i mysql-apt-config_0.8.24-1_all.deb
    apt update
    
    # Instalar MySQL
    apt install -y mysql-server mysql-client
    
    # Configurar MySQL
    mysql_secure_installation <<EOF

y
0
$DB_PASSWORD
$DB_PASSWORD
y
y
y
y
EOF
}

# Função para configurar banco de dados
setup_database() {
    log "Configurando banco de dados..."
    
    mysql -u root -p$DB_PASSWORD <<EOF
CREATE DATABASE IF NOT EXISTS jpsistemas_users CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE DATABASE IF NOT EXISTS jpsistemas_sessions CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE DATABASE IF NOT EXISTS jpsistemas_admin CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE USER IF NOT EXISTS 'jpsistemas'@'localhost' IDENTIFIED BY '$DB_PASSWORD';
GRANT ALL PRIVILEGES ON jpsistemas_users.* TO 'jpsistemas'@'localhost';
GRANT ALL PRIVILEGES ON jpsistemas_sessions.* TO 'jpsistemas'@'localhost';
GRANT ALL PRIVILEGES ON jpsistemas_admin.* TO 'jpsistemas'@'localhost';
GRANT CREATE ON *.* TO 'jpsistemas'@'localhost';
FLUSH PRIVILEGES;
EOF
}

# Função para instalar Node.js
install_nodejs() {
    log "Instalando Node.js..."
    
    # Adicionar repositório NodeSource
    curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
    
    # Instalar Node.js
    apt install -y nodejs
    
    # Instalar PM2
    npm install -g pm2
    
    log "Node.js $(node --version) instalado"
    log "NPM $(npm --version) instalado"
}

# Função para instalar Nginx
install_nginx() {
    log "Instalando Nginx..."
    apt install -y nginx
    systemctl enable nginx
}

# Função para configurar aplicação
setup_application() {
    log "Configurando aplicação..."
    
    # Criar diretório da aplicação
    mkdir -p /var/www
    cd /var/www
    
    # Clonar repositório (assumindo que já existe)
    if [ ! -d "jp.sistemas" ]; then
        warn "Diretório jp.sistemas não encontrado. Por favor, clone o repositório manualmente."
        return 1
    fi
    
    cd jp.sistemas
    
    # Instalar dependências
    npm install
    
    # Criar arquivo .env
    cat > .env <<EOF
# ========================================
# CONFIGURAÇÃO DO PROVEDOR DE BANCO DE DADOS
# ========================================
DATABASE_PROVIDER=local

# ========================================
# CONFIGURAÇÃO LOCAL (VPS)
# ========================================
DB_HOST=localhost
DB_USER=jpsistemas
DB_PASSWORD=$DB_PASSWORD
DB_PORT=3306

# ========================================
# CONFIGURAÇÕES DA APLICAÇÃO
# ========================================
NODE_ENV=production
PORT=3000
JWT_SECRET=$JWT_SECRET
SESSION_SECRET=$SESSION_SECRET

# ========================================
# CONFIGURAÇÕES DE SEGURANÇA
# ========================================
CORS_ORIGIN=https://$DOMAIN
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
EOF
    
    # Inicializar banco de dados
    if [ -f "scripts/init-db.js" ]; then
        node scripts/init-db.js
    fi
    
    if [ -f "scripts/init-produtos.js" ]; then
        node scripts/init-produtos.js
    fi
}

# Função para configurar PM2
setup_pm2() {
    log "Configurando PM2..."
    
    cd $APP_DIR
    
    # Criar arquivo de configuração PM2
    cat > ecosystem.config.js <<EOF
module.exports = {
  apps: [{
    name: 'jp-sistemas',
    script: 'server.js',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    env: {
      NODE_ENV: 'production',
      PORT: 3000
    },
    error_file: './logs/err.log',
    out_file: './logs/out.log',
    log_file: './logs/combined.log',
    time: true
  }]
};
EOF
    
    # Criar diretório de logs
    mkdir -p logs
    
    # Iniciar aplicação
    pm2 start ecosystem.config.js
    
    # Salvar configuração PM2
    pm2 save
    
    # Configurar para iniciar com o sistema
    pm2 startup
}

# Função para configurar Nginx
setup_nginx() {
    log "Configurando Nginx..."
    
    # Criar configuração do site
    cat > /etc/nginx/sites-available/jp-sistemas <<EOF
server {
    listen 80;
    server_name $DOMAIN www.$DOMAIN;
    
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
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
    ln -sf /etc/nginx/sites-available/jp-sistemas /etc/nginx/sites-enabled/
    
    # Remover site padrão
    rm -f /etc/nginx/sites-enabled/default
    
    # Testar configuração
    nginx -t
    
    # Reiniciar Nginx
    systemctl restart nginx
}

# Função para configurar firewall
setup_firewall() {
    log "Configurando firewall..."
    
    # Habilitar UFW
    ufw --force enable
    
    # Permitir SSH
    ufw allow ssh
    
    # Permitir HTTP e HTTPS
    ufw allow 80
    ufw allow 443
    
    log "Firewall configurado"
}

# Função para configurar SSL (se domínio fornecido)
setup_ssl() {
    if [ -n "$DOMAIN" ]; then
        log "Configurando SSL para $DOMAIN..."
        
        # Instalar Certbot
        apt install -y certbot python3-certbot-nginx
        
        # Obter certificado SSL
        certbot --nginx -d $DOMAIN -d www.$DOMAIN --non-interactive --agree-tos --email admin@$DOMAIN
        
        # Configurar renovação automática
        (crontab -l 2>/dev/null; echo "0 12 * * * /usr/bin/certbot renew --quiet") | crontab -
        
        log "SSL configurado com sucesso"
    else
        warn "Domínio não fornecido. SSL não será configurado."
    fi
}

# Função para criar scripts de manutenção
create_maintenance_scripts() {
    log "Criando scripts de manutenção..."
    
    cd $APP_DIR
    
    # Script de deploy
    cat > deploy.sh <<'EOF'
#!/bin/bash
echo "🚀 Iniciando deploy do J.P Sistemas..."
pm2 stop jp-sistemas
git pull origin main
npm install
pm2 restart jp-sistemas
echo "✅ Deploy concluído!"
EOF
    
    # Script de backup
    cat > backup.sh <<EOF
#!/bin/bash
BACKUP_DIR="/var/backups/jp-sistemas"
DATE=\$(date +%Y%m%d_%H%M%S)
mkdir -p \$BACKUP_DIR
mysqldump -u jpsistemas -p$DB_PASSWORD --all-databases > \$BACKUP_DIR/db_backup_\$DATE.sql
tar -czf \$BACKUP_DIR/app_backup_\$DATE.tar.gz /var/www/jp.sistemas
find \$BACKUP_DIR -name "*.sql" -mtime +7 -delete
find \$BACKUP_DIR -name "*.tar.gz" -mtime +7 -delete
echo "Backup criado: \$BACKUP_DIR"
EOF
    
    # Tornar executáveis
    chmod +x deploy.sh backup.sh
    
    # Adicionar backup ao crontab
    (crontab -l 2>/dev/null; echo "0 2 * * * $APP_DIR/backup.sh") | crontab -
}

# Função para testar instalação
test_installation() {
    log "Testando instalação..."
    
    # Verificar serviços
    systemctl is-active --quiet nginx && log "✅ Nginx está rodando" || error "❌ Nginx não está rodando"
    systemctl is-active --quiet mysql && log "✅ MySQL está rodando" || error "❌ MySQL não está rodando"
    pm2 list | grep -q "jp-sistemas" && log "✅ Aplicação está rodando" || error "❌ Aplicação não está rodando"
    
    # Testar aplicação
    if curl -s http://localhost:3000 > /dev/null; then
        log "✅ Aplicação responde na porta 3000"
    else
        error "❌ Aplicação não responde na porta 3000"
    fi
    
    if [ -n "$DOMAIN" ]; then
        if curl -s http://$DOMAIN > /dev/null; then
            log "✅ Aplicação responde via Nginx"
        else
            warn "⚠️ Aplicação não responde via Nginx (pode ser DNS)"
        fi
    fi
}

# Função principal
main() {
    log "🚀 Iniciando deploy do J.P Sistemas na VPS..."
    
    # Solicitar domínio
    read -p "Digite seu domínio (ou pressione Enter para pular): " DOMAIN
    
    # Executar etapas
    update_system
    install_mysql
    setup_database
    install_nodejs
    install_nginx
    setup_application
    setup_pm2
    setup_nginx
    setup_firewall
    
    if [ -n "$DOMAIN" ]; then
        setup_ssl
    fi
    
    create_maintenance_scripts
    test_installation
    
    log "🎉 Deploy concluído com sucesso!"
    log "📱 Acesse: http://localhost:3000"
    if [ -n "$DOMAIN" ]; then
        log "🌐 Acesse: https://$DOMAIN"
    fi
    log "📊 Monitoramento: pm2 monit"
    log "📝 Logs: pm2 logs jp-sistemas"
}

# Executar função principal
main "$@"