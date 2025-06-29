# 🚀 Deploy no Debian 12 + MariaDB + Vercel - J.P Sistemas

Guia completo para configurar e fazer deploy do sistema J.P Sistemas em um servidor Debian 12 com MariaDB e Vercel.

## 📋 Pré-requisitos

- Servidor Debian 12 (físico ou VPS)
- Acesso root ou sudo
- Conexão com internet
- Domínio (opcional)

## 🗄️ Arquitetura

```
Debian 12 Server
├── MariaDB (Banco de dados local)
│   ├── jpsistemas_users (Usuários e autenticação)
│   ├── jpsistemas_sessions (Sessões ativas)
│   └── jpsistemas_* (Bancos individuais por usuário)
├── Node.js 18+ (Runtime)
├── J.P Sistemas (Aplicação)
└── Vercel (Deploy e CDN)
```

## 🚀 Deploy Automatizado

### Opção 1: Script Automatizado (Recomendado)

```bash
# Clone o repositório
git clone https://github.com/seu-usuario/jpsistemas.git
cd jpsistemas

# Torne o script executável
chmod +x deploy-debian-vercel.sh

# Execute o script
./deploy-debian-vercel.sh
```

### Opção 2: Deploy Manual

Siga os passos abaixo se preferir fazer manualmente.

## 🔧 Configuração Manual

### Passo 1: Atualizar Sistema

```bash
# Atualizar sistema
sudo apt update && sudo apt upgrade -y

# Instalar dependências
sudo apt install -y curl wget git build-essential software-properties-common
```

### Passo 2: Instalar Node.js 18+

```bash
# Adicionar repositório NodeSource
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -

# Instalar Node.js
sudo apt-get install -y nodejs

# Verificar instalação
node --version
npm --version
```

### Passo 3: Instalar MariaDB

```bash
# Instalar MariaDB
sudo apt install -y mariadb-server mariadb-client

# Habilitar e iniciar serviço
sudo systemctl enable mariadb
sudo systemctl start mariadb

# Configurar segurança
sudo mysql_secure_installation
```

### Passo 4: Configurar MariaDB

```bash
# Acessar MariaDB como root
sudo mysql

# Criar bancos e usuário
CREATE DATABASE jpsistemas_users CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE DATABASE jpsistemas_sessions CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'jpsistemas'@'localhost' IDENTIFIED BY 'SuaSenhaForte123!';
GRANT ALL PRIVILEGES ON jpsistemas_users.* TO 'jpsistemas'@'localhost';
GRANT ALL PRIVILEGES ON jpsistemas_sessions.* TO 'jpsistemas'@'localhost';
GRANT CREATE ON *.* TO 'jpsistemas'@'localhost';
FLUSH PRIVILEGES;
EXIT;
```

### Passo 5: Configurar Projeto

```bash
# Instalar dependências
npm install

# Copiar arquivo de configuração
cp env.example .env

# Editar configurações
nano .env
```

Configuração do `.env`:

```env
# Provedor de Banco
DATABASE_PROVIDER=local

# MariaDB Local
DB_HOST=localhost
DB_USER=jpsistemas
DB_PASSWORD=SuaSenhaForte123!
DB_PORT=3306

# Aplicação
NODE_ENV=production
JWT_SECRET=SeuJWTSecretMuitoForte123!
SESSION_SECRET=SeuSessionSecretMuitoForte123!

# Segurança
CORS_ORIGIN=https://seu-dominio.vercel.app
```

### Passo 6: Inicializar Banco de Dados

```bash
# Executar script de inicialização
npm run init-vercel
```

### Passo 7: Instalar Vercel CLI

```bash
# Instalar Vercel CLI globalmente
sudo npm install -g vercel

# Fazer login
vercel login
```

### Passo 8: Configurar Firewall

```bash
# Instalar UFW
sudo apt install -y ufw

# Configurar regras
sudo ufw allow ssh
sudo ufw allow 3000
sudo ufw --force enable
```

### Passo 9: Configurar Serviço Systemd

```bash
# Criar arquivo de serviço
sudo nano /etc/systemd/system/jpsistemas.service
```

Conteúdo do arquivo:

```ini
[Unit]
Description=J.P Sistemas
After=network.target mariadb.service

[Service]
Type=simple
User=seu_usuario
WorkingDirectory=/caminho/para/jpsistemas
Environment=NODE_ENV=production
ExecStart=/usr/bin/node server.js
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

```bash
# Habilitar e iniciar serviço
sudo systemctl daemon-reload
sudo systemctl enable jpsistemas
sudo systemctl start jpsistemas
```

## 🚀 Deploy no Vercel

### Passo 1: Configurar Variáveis no Vercel

No painel do Vercel, configure as variáveis de ambiente:

```env
DATABASE_PROVIDER=local
DB_HOST=localhost
DB_USER=jpsistemas
DB_PASSWORD=SuaSenhaForte123!
DB_PORT=3306
NODE_ENV=production
JWT_SECRET=SeuJWTSecretMuitoForte123!
SESSION_SECRET=SeuSessionSecretMuitoForte123!
```

### Passo 2: Deploy

```bash
# Deploy para preview
vercel

# Deploy para produção
vercel --prod
```

## 🔒 Configurações de Segurança

### 1. MariaDB

```bash
# Configurar bind-address (se necessário)
sudo nano /etc/mysql/mariadb.conf.d/50-server.cnf

# Adicionar/modificar:
bind-address = 127.0.0.1
```

### 2. Firewall

```bash
# Verificar status
sudo ufw status

# Adicionar regras específicas se necessário
sudo ufw allow from seu_ip_vercel
```

### 3. SSL/TLS

Para HTTPS, configure no Vercel ou use Let's Encrypt:

```bash
# Instalar Certbot
sudo apt install -y certbot

# Obter certificado
sudo certbot certonly --standalone -d seu-dominio.com
```

## 📊 Monitoramento

### 1. Logs do Sistema

```bash
# Logs do serviço
sudo journalctl -u jpsistemas -f

# Logs do MariaDB
sudo tail -f /var/log/mysql/error.log
```

### 2. Status dos Serviços

```bash
# Verificar status
sudo systemctl status mariadb
sudo systemctl status jpsistemas

# Reiniciar se necessário
sudo systemctl restart mariadb
sudo systemctl restart jpsistemas
```

### 3. Monitoramento de Recursos

```bash
# Instalar htop
sudo apt install -y htop

# Monitorar recursos
htop
```

## 💾 Backup

### 1. Backup Automático

Criar script de backup:

```bash
sudo nano /usr/local/bin/backup-jpsistemas.sh
```

```bash
#!/bin/bash
BACKUP_DIR="/var/backups/jpsistemas"
DATE=$(date +%Y%m%d_%H%M%S)

# Criar diretório se não existir
mkdir -p $BACKUP_DIR

# Backup dos bancos
mysqldump -u jpsistemas -p'SuaSenhaForte123!' jpsistemas_users > $BACKUP_DIR/users_$DATE.sql
mysqldump -u jpsistemas -p'SuaSenhaForte123!' jpsistemas_sessions > $BACKUP_DIR/sessions_$DATE.sql

# Backup dos bancos de usuários
mysql -u jpsistemas -p'SuaSenhaForte123!' -e "SHOW DATABASES LIKE 'jpsistemas_%'" | grep -v Database | while read db; do
    mysqldump -u jpsistemas -p'SuaSenhaForte123!' $db > $BACKUP_DIR/${db}_$DATE.sql
done

# Compactar
tar -czf $BACKUP_DIR/backup_$DATE.tar.gz $BACKUP_DIR/*.sql

# Remover arquivos SQL
rm $BACKUP_DIR/*.sql

# Manter apenas últimos 7 backups
find $BACKUP_DIR -name "backup_*.tar.gz" -mtime +7 -delete

echo "Backup concluído: $BACKUP_DIR/backup_$DATE.tar.gz"
```

```bash
# Tornar executável
sudo chmod +x /usr/local/bin/backup-jpsistemas.sh

# Adicionar ao crontab
sudo crontab -e

# Adicionar linha:
0 2 * * * /usr/local/bin/backup-jpsistemas.sh
```

### 2. Restore

```bash
# Extrair backup
tar -xzf backup_20241201_020000.tar.gz

# Restaurar bancos
mysql -u jpsistemas -p jpsistemas_users < users_20241201_020000.sql
mysql -u jpsistemas -p jpsistemas_sessions < sessions_20241201_020000.sql
```

## 🔧 Manutenção

### 1. Atualizações

```bash
# Atualizar sistema
sudo apt update && sudo apt upgrade -y

# Atualizar Node.js se necessário
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Atualizar aplicação
git pull origin main
npm install
sudo systemctl restart jpsistemas
```

### 2. Limpeza

```bash
# Limpar logs antigos
sudo journalctl --vacuum-time=7d

# Limpar cache npm
npm cache clean --force

# Limpar backups antigos
find /var/backups/jpsistemas -name "backup_*.tar.gz" -mtime +30 -delete
```

## 🛠️ Troubleshooting

### Problemas Comuns

1. **Erro de Conexão com MariaDB**:
   ```bash
   # Verificar status
   sudo systemctl status mariadb
   
   # Verificar logs
   sudo tail -f /var/log/mysql/error.log
   
   # Reiniciar se necessário
   sudo systemctl restart mariadb
   ```

2. **Erro de Permissão**:
   ```bash
   # Verificar permissões
   ls -la /var/lib/mysql/
   
   # Corrigir se necessário
   sudo chown -R mysql:mysql /var/lib/mysql/
   ```

3. **Erro de Memória**:
   ```bash
   # Verificar uso de memória
   free -h
   
   # Ajustar configurações do MariaDB
   sudo nano /etc/mysql/mariadb.conf.d/50-server.cnf
   ```

4. **Erro de Disco**:
   ```bash
   # Verificar espaço em disco
   df -h
   
   # Limpar logs e backups antigos
   sudo journalctl --vacuum-time=3d
   ```

## 📈 Performance

### 1. Otimizações do MariaDB

```bash
sudo nano /etc/mysql/mariadb.conf.d/50-server.cnf
```

Adicionar/modificar:

```ini
[mysqld]
# Cache de consultas
query_cache_type = 1
query_cache_size = 64M

# Buffer pool
innodb_buffer_pool_size = 256M

# Logs
slow_query_log = 1
slow_query_log_file = /var/log/mysql/slow.log
long_query_time = 2
```

### 2. Otimizações do Node.js

```bash
# Configurar variáveis de ambiente
export NODE_OPTIONS="--max-old-space-size=512"
```

## 🆘 Suporte

### Recursos Úteis

- [Documentação do Debian](https://www.debian.org/doc/)
- [Documentação do MariaDB](https://mariadb.com/kb/en/)
- [Documentação do Vercel](https://vercel.com/docs)

### Contato

Para suporte específico:
- WhatsApp: [Fale Conosco](https://whatsa.me/5548996852138)
- Email: suporte@jpsistemas.com

---

## ✅ Checklist de Deploy

- [ ] Sistema Debian 12 atualizado
- [ ] Node.js 18+ instalado
- [ ] MariaDB instalado e configurado
- [ ] Bancos de dados criados
- [ ] Usuário MariaDB configurado
- [ ] Projeto configurado
- [ ] Banco inicializado
- [ ] Vercel CLI instalado
- [ ] Firewall configurado
- [ ] Serviço systemd criado
- [ ] Variáveis de ambiente configuradas no Vercel
- [ ] Deploy realizado
- [ ] Backup configurado
- [ ] Monitoramento configurado

**🎉 Seu sistema está pronto para produção!** 