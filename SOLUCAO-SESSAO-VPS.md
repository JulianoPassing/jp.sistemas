# 🔧 Solução para Problemas de Sessão em VPS

## 🚨 Problema Identificado

**Sintoma:** F5 em guia normal pede login novamente (não deveria acontecer)

**Causa:** Configuração de sessão inadequada para ambiente VPS

## 🔍 Diagnóstico Rápido

### **1. Verificar se o problema é de sessão**

```bash
# Execute este comando na VPS
node scripts/diagnose-session-issue.js
```

### **2. Verificar banco de sessões**

```bash
# Testar se o banco de sessões está funcionando
node scripts/test-session-db.js
```

## 🛠️ Solução Completa

### **Passo 1: Executar Correção Automática**

```bash
# Execute este script na VPS
node scripts/fix-vps-session.js
```

Este script vai:
- ✅ Criar banco `jpsistemas_sessions` se não existir
- ✅ Criar tabela `sessions` se não existir
- ✅ Limpar sessões expiradas
- ✅ Testar operações de sessão
- ✅ Verificar configurações

### **Passo 2: Reiniciar o Servidor**

```bash
# Se estiver usando PM2
pm2 restart jp-sistemas

# Se estiver rodando diretamente
# Pare o servidor (Ctrl+C) e execute:
node server.js
```

### **Passo 3: Testar a Correção**

1. **Abra uma guia normal** (não anônima)
2. **Acesse:** `http://sua-vps:3000/jp.cobrancas/login.html`
3. **Faça login:** `cobranca` / `cobranca123`
4. **Navegue para dashboard**
5. **Pressione F5**
6. **✅ Deve permanecer logado**

## 🔧 Configurações Específicas para VPS

### **Arquivo .env (VPS)**

```env
# Configurações de Banco
DB_HOST=localhost
DB_USER=jpsistemas
DB_PASSWORD=SuaSenhaForte123!

# Configurações de Sessão
SESSION_SECRET=SeuSessionSecretMuitoForte123!

# Configurações de Produção
NODE_ENV=production
PORT=3000

# Configurações de Segurança
CORS_ORIGIN=*
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
```

### **Configuração de Sessão (server.js)**

```javascript
// Configuração de sessão para VPS
const sessionStore = new MySQLStore({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: 'jpsistemas_sessions',
  clearExpired: true,
  checkExpirationInterval: 900000, // 15 minutos
  expiration: 86400000 // 24 horas
});

app.use(session({
  name: 'connect.sid',
  secret: process.env.SESSION_SECRET || 'SeuSessionSecretMuitoForte123!',
  resave: true,
  saveUninitialized: true,
  store: sessionStore,
  cookie: {
    secure: false, // false para VPS sem HTTPS
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 24 * 60 * 60 * 1000, // 24 horas
    path: '/',
    domain: undefined // Deixa o navegador definir o domínio
  },
  rolling: true
}));
```

## 🐛 Troubleshooting

### **Problema 1: Erro de Acesso ao Banco**

```bash
# Erro: ER_ACCESS_DENIED_ERROR
# Solução: Dar permissões ao usuário

mysql -u root -p
```

```sql
-- No MySQL/MariaDB
GRANT ALL PRIVILEGES ON jpsistemas_sessions.* TO 'jpsistemas'@'%';
FLUSH PRIVILEGES;
```

### **Problema 2: MariaDB Não Está Rodando**

```bash
# Verificar status
systemctl status mariadb

# Iniciar se necessário
systemctl start mariadb

# Configurar para iniciar automaticamente
systemctl enable mariadb
```

### **Problema 3: Banco Não Existe**

```bash
# Criar banco manualmente
mysql -u root -p

CREATE DATABASE jpsistemas_sessions CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

### **Problema 4: Tabela Sessions Não Existe**

```bash
# Conectar ao banco de sessões
mysql -u jpsistemas -p jpsistemas_sessions

# Criar tabela
CREATE TABLE sessions (
  session_id VARCHAR(128) NOT NULL PRIMARY KEY,
  expires INT UNSIGNED NOT NULL,
  data TEXT,
  INDEX idx_expires (expires)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

## 📊 Verificação de Funcionamento

### **Teste 1: Verificar Sessões no Banco**

```bash
# Conectar ao banco
mysql -u jpsistemas -p jpsistemas_sessions

# Verificar sessões ativas
SELECT session_id, expires, LENGTH(data) as data_size 
FROM sessions 
WHERE expires > UNIX_TIMESTAMP();
```

### **Teste 2: Verificar Logs do Servidor**

```bash
# Se estiver usando PM2
pm2 logs jp-sistemas

# Verificar se há erros de sessão
```

### **Teste 3: Teste Manual**

1. **Login em guia normal**
2. **Verificar cookies no navegador:**
   - F12 → Application → Cookies
   - Deve haver cookie `connect.sid`

3. **F5 deve manter login**
4. **Navegação deve manter login**

## 🔄 Comportamento Esperado Após Correção

| **Ação** | **Guia Normal** | **Guia Anônima** |
|----------|-----------------|-------------------|
| **F5** | ✅ Mantém login | ❌ Pede login |
| **Navegação** | ✅ Mantém login | ✅ Mantém login |
| **Fechar/abrir** | ✅ Mantém login | ❌ Pede login |

## 🚀 Comandos de Deploy

### **Deploy Completo na VPS**

```bash
# 1. Parar servidor atual
pm2 stop jp-sistemas

# 2. Executar correção de sessão
node scripts/fix-vps-session.js

# 3. Reiniciar servidor
pm2 start jp-sistemas

# 4. Verificar logs
pm2 logs jp-sistemas
```

### **Verificação Final**

```bash
# Testar se tudo está funcionando
node scripts/test-refresh-behavior.js
```

## 📝 Checklist de Correção

- [ ] Banco `jpsistemas_sessions` existe
- [ ] Tabela `sessions` existe e tem estrutura correta
- [ ] Usuário tem permissões no banco
- [ ] Configuração de sessão está correta
- [ ] Servidor foi reiniciado
- [ ] F5 em guia normal mantém login
- [ ] Navegação mantém login
- [ ] Logout funciona corretamente

## 🎯 Resultado Esperado

Após aplicar todas as correções:

- ✅ **F5 em guia normal:** Mantém login
- ✅ **Navegação entre páginas:** Mantém login  
- ✅ **Sessão dura 24 horas**
- ✅ **Logout funciona corretamente**
- ✅ **Guia anônima:** Comportamento esperado (pede login)

**O problema de sessão na VPS deve estar resolvido!** 🎉 