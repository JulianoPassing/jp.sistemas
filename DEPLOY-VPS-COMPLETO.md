# 🚀 Guia Completo de Deploy para VPS - J.P Sistemas

## 📋 Pré-requisitos

### 1. VPS Configurada
- **Sistema Operacional**: Ubuntu 20.04+ ou Debian 11+
- **RAM**: Mínimo 1GB (recomendado 2GB+)
- **Armazenamento**: Mínimo 10GB
- **Acesso**: SSH habilitado

### 2. Domínio (Opcional)
- Domínio configurado com DNS apontando para o IP da VPS
- Certificado SSL (Let's Encrypt)

## 🔧 Configuração Inicial da VPS

### 1. Conectar via SSH
```bash
ssh root@SEU_IP_VPS
```

### 2. Atualizar o sistema
```bash
apt update && apt upgrade -y
```

### 3. Instalar dependências básicas
```bash
apt install -y curl wget git unzip software-properties-common apt-transport-https ca-certificates gnupg lsb-release
```

## 🗄️ Instalação do MySQL

### 1. Instalar MySQL 8.0
```bash
# Adicionar repositório MySQL
wget https://dev.mysql.com/get/mysql-apt-config_0.8.24-1_all.deb
dpkg -i mysql-apt-config_0.8.24-1_all.deb
apt update

# Instalar MySQL
apt install -y mysql-server mysql-client

# Configurar MySQL
mysql_secure_installation
```

### 2. Criar banco de dados e usuário
```bash
mysql -u root -p
```

```sql
-- Criar banco de dados principal
CREATE DATABASE jpsistemas_users CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE DATABASE jpsistemas_sessions CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE DATABASE jpsistemas_admin CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Criar usuário do sistema
CREATE USER 'jpsistemas'@'localhost' IDENTIFIED BY 'SuaSenhaForte123!';
GRANT ALL PRIVILEGES ON jpsistemas_users.* TO 'jpsistemas'@'localhost';
GRANT ALL PRIVILEGES ON jpsistemas_sessions.* TO 'jpsistemas'@'localhost';
GRANT ALL PRIVILEGES ON jpsistemas_admin.* TO 'jpsistemas'@'localhost';
GRANT CREATE ON *.* TO 'jpsistemas'@'localhost';
FLUSH PRIVILEGES;
EXIT;
```

## 🟢 Instalação do Node.js

### 1. Instalar Node.js 18+
```bash
# Adicionar repositório NodeSource
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -

# Instalar Node.js
apt install -y nodejs

# Verificar instalação
node --version
npm --version
```

### 2. Instalar PM2 (Process Manager)
```bash
npm install -g pm2
```

## 📁 Deploy da Aplicação

### 1. Clonar o repositório
```bash
cd /var/www
git clone https://github.com/seu-usuario/jp.sistemas.git
cd jp.sistemas
```

### 2. Instalar dependências
```bash
npm install
```

### 3. Configurar variáveis de ambiente
```bash
# Copiar arquivo de exemplo
cp env.example .env

# Editar configurações
nano .env
```

### 4. Configuração do .env para VPS
```env
# ========================================
# CONFIGURAÇÃO DO PROVEDOR DE BANCO DE DADOS
# ========================================
DATABASE_PROVIDER=local

# ========================================
# CONFIGURAÇÃO LOCAL (VPS)
# ========================================
DB_HOST=localhost
DB_USER=jpsistemas
DB_PASSWORD=SuaSenhaForte123!
DB_PORT=3306

# ========================================
# CONFIGURAÇÕES DA APLICAÇÃO
# ========================================
NODE_ENV=production
PORT=3000
JWT_SECRET=SeuJWTSecretMuitoForte123!
SESSION_SECRET=SeuSessionSecretMuitoForte123!

# ========================================
# CONFIGURAÇÕES DE SEGURANÇA
# ========================================
CORS_ORIGIN=https://seu-dominio.com
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
```

### 5. Inicializar banco de dados
```bash
# Executar script de inicialização
node scripts/init-db.js
node scripts/init-produtos.js
```

### 6. Configurar PM2
```bash
# Criar arquivo de configuração PM2
cat > ecosystem.config.js << 'EOF'
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
```

## 🌐 Configuração do Nginx

### 1. Instalar Nginx
```bash
apt install -y nginx
```

### 2. Configurar site
```bash
# Criar configuração do site
cat > /etc/nginx/sites-available/jp-sistemas << 'EOF'
server {
    listen 80;
    server_name SEU_DOMINIO.com www.SEU_DOMINIO.com;
    
    # Redirecionar para HTTPS (descomente após configurar SSL)
    # return 301 https://$server_name$request_uri;
    
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
ln -s /etc/nginx/sites-available/jp-sistemas /etc/nginx/sites-enabled/

# Remover site padrão
rm -f /etc/nginx/sites-enabled/default

# Testar configuração
nginx -t

# Reiniciar Nginx
systemctl restart nginx
systemctl enable nginx
```

## 🔒 Configuração SSL (Let's Encrypt)

### 1. Instalar Certbot
```bash
apt install -y certbot python3-certbot-nginx
```

### 2. Obter certificado SSL
```bash
certbot --nginx -d SEU_DOMINIO.com -d www.SEU_DOMINIO.com
```

### 3. Configurar renovação automática
```bash
# Testar renovação
certbot renew --dry-run

# Adicionar ao crontab
crontab -e
# Adicionar linha: 0 12 * * * /usr/bin/certbot renew --quiet
```

## 🔥 Configuração do Firewall

### 1. Configurar UFW
```bash
# Habilitar UFW
ufw enable

# Permitir SSH
ufw allow ssh

# Permitir HTTP e HTTPS
ufw allow 80
ufw allow 443

# Verificar status
ufw status
```

## 📊 Monitoramento e Logs

### 1. Configurar logs do sistema
```bash
# Criar diretório de logs da aplicação
mkdir -p /var/log/jp-sistemas

# Configurar rotação de logs
cat > /etc/logrotate.d/jp-sistemas << 'EOF'
/var/log/jp-sistemas/*.log {
    daily
    missingok
    rotate 52
    compress
    delaycompress
    notifempty
    create 644 www-data www-data
}
EOF
```

### 2. Monitoramento com PM2
```bash
# Ver status da aplicação
pm2 status

# Ver logs em tempo real
pm2 logs jp-sistemas

# Monitorar recursos
pm2 monit
```

## 🔄 Scripts de Deploy

### 1. Script de Deploy Automático
```bash
# Criar script de deploy
cat > deploy.sh << 'EOF'
#!/bin/bash

echo "🚀 Iniciando deploy do J.P Sistemas..."

# Parar aplicação
pm2 stop jp-sistemas

# Atualizar código
git pull origin main

# Instalar dependências
npm install

# Executar migrações (se necessário)
# node scripts/init-db.js

# Reiniciar aplicação
pm2 restart jp-sistemas

echo "✅ Deploy concluído!"
EOF

# Tornar executável
chmod +x deploy.sh
```

### 2. Script de Backup
```bash
# Criar script de backup
cat > backup.sh << 'EOF'
#!/bin/bash

BACKUP_DIR="/var/backups/jp-sistemas"
DATE=$(date +%Y%m%d_%H%M%S)

mkdir -p $BACKUP_DIR

# Backup do banco de dados
mysqldump -u jpsistemas -p'SuaSenhaForte123!' --all-databases > $BACKUP_DIR/db_backup_$DATE.sql

# Backup da aplicação
tar -czf $BACKUP_DIR/app_backup_$DATE.tar.gz /var/www/jp.sistemas

# Manter apenas os últimos 7 backups
find $BACKUP_DIR -name "*.sql" -mtime +7 -delete
find $BACKUP_DIR -name "*.tar.gz" -mtime +7 -delete

echo "Backup criado: $BACKUP_DIR"
EOF

# Tornar executável
chmod +x backup.sh

# Adicionar ao crontab (backup diário às 2h)
crontab -e
# Adicionar linha: 0 2 * * * /var/www/jp.sistemas/backup.sh
```

## 🧪 Testes Pós-Deploy

### 1. Verificar serviços
```bash
# Verificar status dos serviços
systemctl status nginx
systemctl status mysql
pm2 status

# Verificar portas
netstat -tlnp | grep :80
netstat -tlnp | grep :443
netstat -tlnp | grep :3000
```

### 2. Testar aplicação
```bash
# Testar localmente
curl http://localhost:3000

# Testar via Nginx
curl http://SEU_DOMINIO.com
```

## 🔧 Comandos Úteis

### Gerenciamento da Aplicação
```bash
# Reiniciar aplicação
pm2 restart jp-sistemas

# Ver logs
pm2 logs jp-sistemas

# Parar aplicação
pm2 stop jp-sistemas

# Iniciar aplicação
pm2 start jp-sistemas
```

### Gerenciamento do Banco
```bash
# Acessar MySQL
mysql -u jpsistemas -p

# Backup manual
mysqldump -u jpsistemas -p --all-databases > backup.sql

# Restaurar backup
mysql -u jpsistemas -p < backup.sql
```

### Logs e Monitoramento
```bash
# Logs do Nginx
tail -f /var/log/nginx/access.log
tail -f /var/log/nginx/error.log

# Logs da aplicação
pm2 logs jp-sistemas

# Status do sistema
htop
df -h
free -h
```

## 🆘 Troubleshooting

### Problemas Comuns

1. **Aplicação não inicia**
   ```bash
   pm2 logs jp-sistemas
   node server.js
   ```

2. **Erro de conexão com banco**
   ```bash
   mysql -u jpsistemas -p
   SHOW DATABASES;
   ```

3. **Nginx não carrega**
   ```bash
   nginx -t
   systemctl status nginx
   ```

4. **SSL não funciona**
   ```bash
   certbot certificates
   certbot renew --dry-run
   ```

## 📞 Suporte

Para suporte técnico:
- **WhatsApp**: https://whatsa.me/5548996852138
- **Email**: suporte@jp-sistemas.com

---

**🎉 Parabéns! Seu J.P Sistemas está rodando na VPS!** 