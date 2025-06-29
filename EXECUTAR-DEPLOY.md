# 🚀 Guia Rápido - Executar Deploy na VPS

## ✅ Situação Atual
- ✅ Arquivos já estão na VPS em `~/Desktop/jpsistemas`
- ✅ Script de deploy criado: `deploy-vps.sh`
- ✅ Sistema configurado para MariaDB

## 🎯 Passos para Executar

### 1. Conectar na VPS
```bash
ssh root@vps59663
```

### 2. Navegar para o diretório
```bash
cd ~/Desktop/jpsistemas
```

### 3. Verificar arquivos
```bash
ls -la
```

Você deve ver:
- `server.js`
- `package.json`
- `deploy-vps.sh`
- `scripts/`
- `public/`
- etc.

### 4. Tornar o script executável
```bash
chmod +x deploy-vps.sh
```

### 5. Executar o deploy
```bash
sudo bash deploy-vps.sh
```

## 📋 O que o script fará automaticamente:

### 🔧 Instalação
- ✅ Atualizar sistema
- ✅ Instalar MariaDB, Nginx, Node.js
- ✅ Configurar MariaDB com otimizações
- ✅ Instalar PM2 para gerenciamento

### 🗄️ Banco de Dados
- ✅ Configurar MariaDB seguro
- ✅ Criar usuário `jpsistemas`
- ✅ Inicializar bancos principais
- ✅ Criar usuário admin padrão

### 🌐 Servidor Web
- ✅ Configurar Nginx como proxy
- ✅ Configurar firewall
- ✅ Configurar SSL (se necessário)

### 📁 Aplicação
- ✅ Mover arquivos para `/var/www/jpsistemas`
- ✅ Instalar dependências Node.js
- ✅ Configurar PM2
- ✅ Configurar backup automático

### 🛡️ Segurança
- ✅ Configurar fail2ban
- ✅ Configurar atualizações automáticas
- ✅ Configurar logrotate

## ⏱️ Tempo Estimado
- **Total**: 10-15 minutos
- **Dependências**: 5-7 minutos
- **Configuração**: 3-5 minutos
- **Testes**: 2-3 minutos

## 🔑 Credenciais Padrão
Após o deploy, você poderá acessar com:
- **Usuário**: `admin`
- **Senha**: `admin123`
- **URL**: `http://IP_DA_VPS`

## ⚠️ Importante
1. **Altere a senha** do admin após o primeiro login
2. **Configure SSL/HTTPS** para produção
3. **Monitore os logs** regularmente

## 🆘 Se algo der errado

### Verificar status dos serviços
```bash
pm2 status
sudo systemctl status nginx mariadb
```

### Ver logs
```bash
pm2 logs jpsistemas
sudo tail -f /var/log/nginx/error.log
sudo tail -f /var/log/mysql/error.log
```

### Reiniciar serviços
```bash
pm2 restart jpsistemas
sudo systemctl restart nginx mariadb
```

## 📞 Suporte
- **WhatsApp**: https://whatsa.me/5548996852138
- **Email**: suporte@jpsistemas.com

---

**🎯 Execute o comando e o sistema estará pronto!** 