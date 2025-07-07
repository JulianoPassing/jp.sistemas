# 📋 Script para Criar Usuários no Sistema JP Cobranças

Este script cria um novo usuário completo no sistema de cobranças, incluindo:
- ✅ Banco de dados específico para o usuário
- ✅ Todas as tabelas necessárias
- ✅ Usuário no sistema de autenticação
- ✅ Configuração completa

## 🚀 Como Usar

### **Sintaxe Básica**
```bash
node scripts/create-cobrancas-user.js <username> <email> <password> [isAdmin]
```

### **Exemplos de Uso**

#### **1. Criar usuário comum**
```bash
node scripts/create-cobrancas-user.js joao joao@empresa.com senha123
```

#### **2. Criar usuário administrador**
```bash
node scripts/create-cobrancas-user.js admin admin@empresa.com admin123 true
```

#### **3. Criar usuário com nome composto**
```bash
node scripts/create-cobrancas-user.js "maria_silva" maria@empresa.com senha456
```

## 📋 O que o Script Faz

### **1. Validação de Dados**
- ✅ Username com pelo menos 3 caracteres
- ✅ Email válido
- ✅ Senha com pelo menos 6 caracteres

### **2. Criação do Banco de Dados**
- 📦 Cria banco: `jpcobrancas_<username>`
- 🔧 Configura charset: `utf8mb4`
- 🎯 Collation: `utf8mb4_unicode_ci`

### **3. Criação das Tabelas**
- 👥 `clientes_cobrancas` - Cadastro de clientes
- 💰 `emprestimos` - Controle de empréstimos
- 📊 `cobrancas` - Sistema de cobranças
- 💳 `pagamentos` - Registro de pagamentos
- 👤 `users` - Usuários do banco específico
- 🔐 `sessions` - Sessões de usuário

### **4. Criação do Usuário**
- 🔑 Senha criptografada com bcrypt
- 📝 Registro na tabela `usuarios_cobrancas`
- 🔗 Vinculação com o banco específico

## 🗂️ Estrutura Criada

### **Banco de Dados**
```
jpcobrancas_<username>/
├── clientes_cobrancas/
├── emprestimos/
├── cobrancas/
├── pagamentos/
├── users/
└── sessions/
```

### **Tabela de Usuários**
```sql
usuarios_cobrancas (
  id INT AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(50) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  db_name VARCHAR(100) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
)
```

## 🔧 Configuração Necessária

### **Arquivo .env**
```env
DB_HOST=localhost
DB_USER=jpsistemas
DB_PASSWORD=Juliano@95
DB_PORT=3306
```

### **Dependências**
```bash
npm install mysql2 bcryptjs dotenv
```

## 📊 Exemplos de Saída

### **Sucesso**
```
🚀 Iniciando criação de usuário no sistema JP Cobranças...

📋 Dados do usuário:
   Username: joao
   Email: joao@empresa.com
   Admin: Não

🔍 Verificando banco de usuários...
✅ Banco de usuários verificado/criado

📦 Criando banco de dados: jpcobrancas_joao
✅ Banco de dados jpcobrancas_joao criado com sucesso

📋 Criando tabelas no banco jpcobrancas_joao...
✅ Tabela clientes_cobrancas criada
✅ Tabela emprestimos criada
✅ Tabela cobrancas criada
✅ Tabela pagamentos criada
✅ Tabela users criada
✅ Tabela sessions criada

👤 Criando usuário: joao
✅ Usuário joao criado com sucesso

🎉 Usuário criado com sucesso!

📋 Informações do usuário:
   Username: joao
   Email: joao@empresa.com
   Senha: senha123
   Banco de dados: jpcobrancas_joao
   Admin: Não

🔗 URLs de acesso:
   Login: http://localhost:3000/jp.cobrancas/login.html
   Dashboard: http://localhost:3000/jp.cobrancas/dashboard.html

⚠️  IMPORTANTE: Guarde essas informações em local seguro!
```

### **Erro - Usuário já existe**
```
❌ Erro: Usuário já existe no sistema
```

### **Erro - Dados inválidos**
```
❌ Erro: Username deve ter pelo menos 3 caracteres
```

## 🔍 Verificação Pós-Criação

### **1. Verificar no MariaDB**
```sql
-- Verificar usuário criado
USE jpsistemas_users;
SELECT * FROM usuarios_cobrancas WHERE username = 'joao';

-- Verificar banco criado
SHOW DATABASES LIKE 'jpcobrancas_joao';

-- Verificar tabelas
USE jpcobrancas_joao;
SHOW TABLES;
```

### **2. Testar Login**
1. Acesse: `http://localhost:3000/jp.cobrancas/login.html`
2. Usuário: `joao`
3. Senha: `senha123`

## 🛠️ Comandos Úteis

### **Listar Todos os Usuários**
```sql
USE jpsistemas_users;
SELECT username, db_name, created_at FROM usuarios_cobrancas ORDER BY created_at DESC;
```

### **Verificar Bancos Criados**
```sql
SHOW DATABASES LIKE 'jpcobrancas_%';
```

### **Remover Usuário (se necessário)**
```sql
-- Remover usuário
USE jpsistemas_users;
DELETE FROM usuarios_cobrancas WHERE username = 'joao';

-- Remover banco (CUIDADO!)
DROP DATABASE jpcobrancas_joao;
```

## 🔒 Segurança

### **Boas Práticas**
- ✅ Use senhas fortes (mínimo 8 caracteres)
- ✅ Combine letras, números e símbolos
- ✅ Não reutilize senhas
- ✅ Guarde as credenciais em local seguro

### **Exemplo de Senha Forte**
```bash
node scripts/create-cobrancas-user.js joao joao@empresa.com "Jo@o2024#Seguro"
```

## 🆘 Troubleshooting

### **Erro de Conexão**
```
❌ Erro: connect ECONNREFUSED 127.0.0.1:3306
```
**Solução:** Verificar se o MariaDB está rodando

### **Erro de Permissão**
```
❌ Erro: ER_ACCESS_DENIED_ERROR
```
**Solução:** Verificar usuário e senha no arquivo .env

### **Erro de Banco Existente**
```
❌ Erro: Usuário já existe no sistema
```
**Solução:** Use um username diferente ou remova o usuário existente

## 📞 Suporte

Para dúvidas ou problemas:
1. Verifique os logs de erro
2. Confirme a configuração do .env
3. Teste a conexão com o MariaDB
4. Verifique se todas as dependências estão instaladas 