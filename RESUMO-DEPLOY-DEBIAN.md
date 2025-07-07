# 🚀 Resumo: Deploy J.P Sistemas - Debian 12 + MariaDB + Vercel

## 📋 Visão Geral

Este resumo contém todas as informações necessárias para fazer deploy do sistema J.P Sistemas em um servidor Debian 12 com MariaDB e Vercel.

## 🗄️ Arquitetura Final

```
Debian 12 Server
├── MariaDB (Banco local)
│   ├── jpsistemas_users (Autenticação)
│   ├── jpsistemas_sessions (Sessões)
│   └── jpsistemas_* (Bancos individuais por usuário)
├── Node.js 18+ (Runtime)
├── J.P Sistemas (Aplicação)
└── Vercel (Deploy e CDN)
```

## 🚀 Deploy Rápido (3 Passos)

### 1. Preparar Servidor Debian 12

```bash
# Clone o projeto
git clone https://github.com/seu-usuario/jpsistemas.git
cd jpsistemas

# Execute o script automatizado
chmod +x deploy-debian-vercel.sh
./deploy-debian-vercel.sh
```

### 2. Configurar Vercel

```bash
# Login no Vercel
vercel login

# Configure as variáveis no painel do Vercel:
# DATABASE_PROVIDER=local
# DB_HOST=localhost
# DB_USER=jpsistemas
# DB_PASSWORD=SuaSenhaForte123!
# DB_PORT=3306
# NODE_ENV=production
# JWT_SECRET=SeuJWTSecretMuitoForte123!
# SESSION_SECRET=SeuSessionSecretMuitoForte123!

# Deploy
vercel --prod
```

### 3. Acessar Sistema

- **URL**: https://seu-projeto.vercel.app
- **Usuário**: `admin`
- **Senha**: `admin123`

⚠️ **IMPORTANTE**: Altere a senha após o primeiro login!

## 📁 Arquivos de Configuração

### Principais Arquivos

| Arquivo | Descrição |
|---------|-----------|
| `deploy-debian-vercel.sh` | Script automatizado de deploy |
| `database-config.js` | Configurações de banco de dados |
| `scripts/init-vercel-db.js` | Inicialização do banco |
| `scripts/backup-debian.sh` | Backup automático |
| `vercel.json` | Configuração do Vercel |
| `env.example` | Exemplo de variáveis de ambiente |

### Scripts Disponíveis

```bash
# Deploy automatizado
./deploy-debian-vercel.sh

# Inicializar banco
npm run init-vercel

# Backup manual
npm run backup-debian

# Backup automático (crontab)
0 2 * * * /usr/local/bin/backup-jpsistemas.sh
```

## 🔧 Configurações Importantes

### MariaDB

```sql
-- Bancos criados automaticamente
jpsistemas_users     (Usuários e autenticação)
jpsistemas_sessions  (Sessões ativas)
jpsistemas_admin     (Banco do administrador)
jpsistemas_usuario1  (Banco do usuário 1)
-- ... (um banco por usuário)
```

### Variáveis de Ambiente

```env
# Provedor
DATABASE_PROVIDER=local

# MariaDB
DB_HOST=localhost
DB_USER=jpsistemas
DB_PASSWORD=SuaSenhaForte123!
DB_PORT=3306

# Aplicação
NODE_ENV=production
JWT_SECRET=SeuJWTSecretMuitoForte123!
SESSION_SECRET=SeuSessionSecretMuitoForte123!
```

### Serviços Systemd

```bash
# Status dos serviços
sudo systemctl status mariadb
sudo systemctl status jpsistemas

# Comandos úteis
sudo systemctl start jpsistemas
sudo systemctl stop jpsistemas
sudo systemctl restart jpsistemas
```

## 📊 Monitoramento

### Logs

```bash
# Logs da aplicação
sudo journalctl -u jpsistemas -f

# Logs do MariaDB
sudo tail -f /var/log/mysql/error.log

# Logs do Vercel
# Acesse: Functions > server.js no painel do Vercel
```

### Backup

```bash
# Backup manual
npm run backup-debian

# Backup automático (diário às 2h)
# Configurado automaticamente pelo script

# Restaurar backup
tar -xzf backup_20241201_020000.tar.gz
mysql -u jpsistemas -p < users_20241201_020000.sql
```

## 🔒 Segurança

### Firewall (UFW)

```bash
# Status
sudo ufw status

# Regras configuradas
- SSH (porta 22)
- Aplicação (porta 3000)
- MariaDB (porta 3306 - apenas localhost)
```

### MariaDB

```bash
# Configurações de segurança
bind-address = 127.0.0.1
max_connections = 100
query_cache_size = 64M
```

## 🛠️ Manutenção

### Atualizações

```bash
# Sistema
sudo apt update && sudo apt upgrade -y

# Node.js
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Aplicação
git pull origin main
npm install
sudo systemctl restart jpsistemas
```

### Limpeza

```bash
# Logs antigos
sudo journalctl --vacuum-time=7d

# Cache npm
npm cache clean --force

# Backups antigos (automático)
# Remove backups com mais de 7 dias
```

## 🚨 Troubleshooting

### Problemas Comuns

1. **Erro de Conexão MariaDB**
   ```bash
   sudo systemctl restart mariadb
   sudo tail -f /var/log/mysql/error.log
   ```

2. **Erro de Permissão**
   ```bash
   sudo chown -R mysql:mysql /var/lib/mysql/
   ```

3. **Erro de Memória**
   ```bash
   free -h
   # Ajustar innodb_buffer_pool_size no MariaDB
   ```

4. **Erro de Disco**
   ```bash
   df -h
   sudo journalctl --vacuum-time=3d
   ```

### Comandos de Debug

```bash
# Verificar status dos serviços
sudo systemctl status mariadb jpsistemas

# Verificar logs em tempo real
sudo journalctl -u jpsistemas -f

# Verificar conexão com banco
mysql -u jpsistemas -p -e "SELECT 1;"

# Verificar uso de recursos
htop
```

## 📈 Performance

### Otimizações MariaDB

```ini
[mysqld]
query_cache_type = 1
query_cache_size = 64M
innodb_buffer_pool_size = 256M
slow_query_log = 1
long_query_time = 2
```

### Otimizações Node.js

```bash
export NODE_OPTIONS="--max-old-space-size=512"
```

## 💰 Custos

### Vercel (Gratuito)
- 100GB de banda/mês
- 100GB de storage
- 100GB de função serverless
- Domínios ilimitados

### Debian + MariaDB (Gratuito)
- Sistema operacional: Gratuito
- MariaDB: Gratuito
- Node.js: Gratuito

## 🆘 Suporte

### Recursos

- [Guia Completo](DEPLOY-DEBIAN-VERCEL.md)
- [Documentação Vercel](https://vercel.com/docs)
- [Documentação MariaDB](https://mariadb.com/kb/en/)

### Contato

- **WhatsApp**: [Fale Conosco](https://whatsa.me/5548996852138)
- **Email**: suporte@jpsistemas.com

## ✅ Checklist Final

- [ ] Debian 12 instalado e atualizado
- [ ] Node.js 18+ instalado
- [ ] MariaDB instalado e configurado
- [ ] Script de deploy executado
- [ ] Bancos de dados criados
- [ ] Usuário admin criado
- [ ] Vercel CLI instalado
- [ ] Login no Vercel realizado
- [ ] Variáveis de ambiente configuradas
- [ ] Deploy realizado com sucesso
- [ ] Sistema acessível via URL
- [ ] Login funcionando
- [ ] Backup configurado
- [ ] Monitoramento ativo
- [ ] Senhas alteradas
- [ ] Firewall configurado

## 🎉 Resultado Final

Após seguir todos os passos, você terá:

✅ **Sistema funcionando** em https://seu-projeto.vercel.app  
✅ **Multi-tenancy** com bancos isolados por usuário  
✅ **Backup automático** diário  
✅ **Monitoramento** ativo  
✅ **Segurança** configurada  
✅ **Performance** otimizada  

**🚀 Seu sistema está pronto para produção!** 