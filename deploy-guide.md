# Guia de Deploy - Sistema J.P Sistemas em VPS Linux (MariaDB)

## Visão Geral
Este guia explica como configurar o sistema J.P Sistemas em uma VPS Linux com banco de dados individual para cada usuário usando **MariaDB**.

## Pré-requisitos
- VPS Linux (Ubuntu 20.04+ recomendado)
- Acesso root ou sudo
- Domínio configurado (opcional, mas recomendado)

## 1. Configuração Inicial da VPS

### Atualizar o sistema
```bash
sudo apt update && sudo apt upgrade -y
```

### Instalar dependências básicas
```bash
sudo apt install -y curl wget git nginx mariadb-server nodejs npm
```

### Configurar firewall
```bash
sudo ufw allow ssh
sudo ufw allow 'Nginx Full'
sudo ufw allow 3000
sudo ufw enable
```

## 2. Configuração do MariaDB

### Configurar MariaDB
```bash
sudo mysql_secure_installation
```

### Criar usuário MariaDB para o sistema
```bash
sudo mysql -u root -p
```

```sql
CREATE USER 'jpsistemas'@'localhost' IDENTIFIED BY 'SuaSenhaForte123!';
GRANT ALL PRIVILEGES ON *.* TO 'jpsistemas'@'localhost';
FLUSH PRIVILEGES;
EXIT;
```

### Configurações otimizadas do MariaDB
```bash
sudo nano /etc/mysql/conf.d/jpsistemas.cnf
```

Conteúdo:
```ini
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
```

```bash
sudo systemctl restart mariadb
```

## 3. Configuração do Node.js

### Instalar Node.js via NVM (recomendado)
```bash
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
source ~/.bashrc
nvm install 18
nvm use 18
```

### Verificar instalação
```bash
node --version
npm --version
```

## 4. Deploy da Aplicação

### Clonar o projeto
```bash
cd /var/www
sudo git clone https://github.com/seu-usuario/jpsistemas.git
sudo chown -R $USER:$USER jpsistemas
cd jpsistemas
```

### Instalar dependências
```bash
npm install
```

### Configurar variáveis de ambiente
```bash
cp env.example .env
nano .env
```

Conteúdo do `.env`:
```env
# Configurações do Banco de Dados (MariaDB)
DB_HOST=localhost
DB_USER=jpsistemas
DB_PASSWORD=SuaSenhaForte123!
DB_ROOT_PASSWORD=SuaSenhaRootForte123!

# Configurações da Aplicação
NODE_ENV=production
PORT=3000
JWT_SECRET=SeuJWTSecretMuitoForte123!
SESSION_SECRET=SeuSessionSecretMuitoForte123!

# Configurações de Email (opcional)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=seu-email@gmail.com
SMTP_PASS=sua-senha-app

# Configurações de Segurança
CORS_ORIGIN=https://seu-dominio.com
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100

# Configurações de Backup
BACKUP_PATH=/var/backups/jpsistemas
BACKUP_RETENTION_DAYS=30
```

## 5. Configuração do Sistema de Multi-tenancy

### Criar script de inicialização de banco de dados
```bash
nano scripts/init-db.js
```

### Configurar PM2 para gerenciamento de processos
```bash
npm install -g pm2
pm2 startup
pm2 start server.js --name "jpsistemas"
pm2 save
```

## 6. Configuração do Nginx

### Criar configuração do Nginx
```bash
sudo nano /etc/nginx/sites-available/jpsistemas
```

Conteúdo:
```nginx
server {
    listen 80;
    server_name seu-dominio.com www.seu-dominio.com;

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
```

### Ativar o site
```bash
sudo ln -s /etc/nginx/sites-available/jpsistemas /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

## 7. Configuração SSL (HTTPS)

### Instalar Certbot
```bash
sudo apt install certbot python3-certbot-nginx
```

### Obter certificado SSL
```bash
sudo certbot --nginx -d seu-dominio.com -d www.seu-dominio.com
```

## 8. Scripts de Manutenção

### Backup automático
```bash
nano scripts/backup.sh
```

### Monitoramento
```bash
pm2 install pm2-logrotate
pm2 set pm2-logrotate:max_size 10M
pm2 set pm2-logrotate:retain 7
```

## 9. Segurança

### Configurar fail2ban
```bash
sudo apt install fail2ban
sudo systemctl enable fail2ban
sudo systemctl start fail2ban
```

### Configurar atualizações automáticas
```bash
sudo apt install unattended-upgrades
sudo dpkg-reconfigure -plow unattended-upgrades
```

## 10. Monitoramento e Logs

### Verificar status dos serviços
```bash
sudo systemctl status nginx
sudo systemctl status mariadb
pm2 status
```

### Verificar logs
```bash
pm2 logs jpsistemas
sudo tail -f /var/log/nginx/access.log
sudo tail -f /var/log/nginx/error.log
sudo tail -f /var/log/mysql/error.log
```

## Comandos Úteis

### Reiniciar serviços
```bash
sudo systemctl restart nginx
sudo systemctl restart mariadb
pm2 restart jpsistemas
```

### Verificar uso de recursos
```bash
htop
df -h
free -h
```

### Backup manual
```bash
./scripts/backup.sh
```

### Comandos MariaDB específicos
```bash
# Conectar ao MariaDB
mysql -u jpsistemas -p

# Verificar versão
mysql -V

# Verificar status
sudo systemctl status mariadb

# Verificar configurações
mysql -u root -p -e "SHOW VARIABLES LIKE 'character_set%';"
mysql -u root -p -e "SHOW VARIABLES LIKE 'collation%';"

# Listar bancos de usuários
mysql -u jpsistemas -p -e "SHOW DATABASES LIKE 'jpsistemas_%';"

# Verificar tamanho dos bancos
mysql -u jpsistemas -p -e "
SELECT 
  table_schema AS 'Database',
  ROUND(SUM(data_length + index_length) / 1024 / 1024, 2) AS 'Size (MB)'
FROM information_schema.tables 
WHERE table_schema LIKE 'jpsistemas_%'
GROUP BY table_schema;
"
```

## Vantagens do MariaDB

### 🚀 Performance
- **Melhor performance** em consultas complexas
- **Query cache** mais eficiente
- **Otimizações** específicas para multi-tenancy

### 🔒 Segurança
- **Audit plugin** nativo
- **Criptografia** de dados em repouso
- **Controle de acesso** granular

### 🔧 Manutenção
- **Backup mais rápido** com MariaBackup
- **Recuperação** mais eficiente
- **Monitoramento** avançado

### 📊 Compatibilidade
- **100% compatível** com MySQL
- **Suporte a JSON** nativo
- **UTF8MB4** por padrão

## Suporte

Para suporte técnico, entre em contato:
- WhatsApp: https://whatsa.me/5548996852138
- Email: suporte@jpsistemas.com 