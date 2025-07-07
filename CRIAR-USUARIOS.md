# Como Criar Usuários no Sistema J.P Sistemas

## Visão Geral

O Sistema J.P Sistemas utiliza um modelo **multi-tenancy** onde cada usuário possui seu próprio banco de dados isolado. Este documento explica como criar novos usuários de forma simples e segura.

## Método Simplificado (Recomendado)

### 1. Usando o Script Automatizado

O sistema agora possui um script automatizado que facilita a criação de usuários:

```bash
# Criar usuário comum
node scripts/create-user.js joao_silva joao@empresa.com senha123

# Criar usuário administrador
node scripts/create-user.js admin admin@empresa.com senha123 admin
```

#### Parâmetros do Script:
- `username`: Nome do usuário (apenas letras, números e underscore)
- `email`: Email válido do usuário
- `password`: Senha (mínimo 6 caracteres)
- `admin` (opcional): Adicione "admin" para criar usuário administrador

#### Exemplos de Uso:

```bash
# Usuário comum
node scripts/create-user.js maria_silva maria@empresa.com MinhaSenha123

# Usuário administrador
node scripts/create-user.js gerente gerente@empresa.com SenhaForte456 admin

# Usuário com underscore
node scripts/create-user.js joao_empresa joao@empresa.com senha123
```

### 2. O que o Script Faz Automaticamente:

1. ✅ **Valida os dados** (username, email, senha)
2. ✅ **Cria o usuário** no banco `jpsistemas_users`
3. ✅ **Criptografa a senha** com bcrypt
4. ✅ **Cria o banco de dados** específico do usuário
5. ✅ **Cria todas as tabelas** necessárias (clientes, produtos, pedidos, etc.)
6. ✅ **Configura índices** para performance
7. ✅ **Exibe informações** do usuário criado

## Método Manual (Para Administradores Avançados)

### 1. Criar o Banco de Dados do Usuário

```sql
-- Acesse o MariaDB como root
mysql -u root -p

-- Crie o banco de dados (substitua 'novousuario' pelo nome desejado)
CREATE DATABASE jpsistemas_novousuario CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Crie um usuário do banco (opcional, para isolamento adicional)
CREATE USER 'novousuario'@'%' IDENTIFIED BY 'senha_segura';
GRANT ALL PRIVILEGES ON jpsistemas_novousuario.* TO 'novousuario'@'%';
FLUSH PRIVILEGES;
```

### 2. Popular o Banco com a Estrutura Padrão

```bash
# Execute o script de inicialização
node scripts/init-db.js

# Ou use o script específico para criar usuários
node scripts/create-user.js novousuario email@empresa.com senha123
```

### 3. Cadastrar o Usuário no Sistema

```sql
-- Conecte ao banco de usuários
USE jpsistemas_users;

-- Inserir usuário (senha deve ser criptografada com bcrypt)
INSERT INTO users (username, email, password, is_admin, is_active) 
VALUES ('novousuario', 'email@empresa.com', 'senha_criptografada', FALSE, TRUE);
```

## Estrutura de Bancos de Dados

### Banco Principal de Usuários (`jpsistemas_users`)
```sql
CREATE TABLE users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(50) UNIQUE NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  is_admin BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
```

### Banco Individual do Usuário (`jpsistemas_username`)
Cada usuário possui seu próprio banco com as seguintes tabelas:

- **clientes**: Cadastro de clientes
- **produtos**: Controle de estoque
- **pedidos**: Pedidos de vendas
- **pedido_itens**: Itens dos pedidos

## Validações e Regras

### Username
- ✅ Apenas letras, números e underscore
- ✅ Mínimo 3 caracteres
- ✅ Máximo 50 caracteres
- ✅ Deve ser único no sistema

### Email
- ✅ Formato válido de email
- ✅ Deve ser único no sistema
- ✅ Máximo 255 caracteres

### Senha
- ✅ Mínimo 6 caracteres
- ✅ Recomendado: letras, números e símbolos
- ✅ Será criptografada automaticamente

## Comandos Úteis

### Listar Todos os Usuários
```sql
USE jpsistemas_users;
SELECT username, email, is_admin, is_active, created_at FROM users;
```

### Listar Todos os Bancos de Usuários
```sql
SHOW DATABASES LIKE 'jpsistemas_%';
```

### Verificar Tamanho dos Bancos
```sql
SELECT 
  table_schema AS 'Usuario',
  ROUND(SUM(data_length + index_length) / 1024 / 1024, 2) AS 'Tamanho (MB)',
  COUNT(*) AS 'Tabelas'
FROM information_schema.tables 
WHERE table_schema LIKE 'jpsistemas_%'
GROUP BY table_schema
ORDER BY SUM(data_length + index_length) DESC;
```

### Desativar Usuário
```sql
USE jpsistemas_users;
UPDATE users SET is_active = FALSE WHERE username = 'nome_do_usuario';
```

### Reativar Usuário
```sql
USE jpsistemas_users;
UPDATE users SET is_active = TRUE WHERE username = 'nome_do_usuario';
```

## Backup e Restore

### Backup de Usuário Específico
```bash
# Backup do banco do usuário
mysqldump -u jpsistemas -p --single-transaction --routines --triggers \
  --default-character-set=utf8mb4 jpsistemas_joao_silva > backup_joao_silva.sql

# Backup do usuário no banco principal
mysqldump -u jpsistemas -p --single-transaction \
  --default-character-set=utf8mb4 jpsistemas_users users \
  --where="username='joao_silva'" > backup_usuario_joao_silva.sql
```

### Restore de Usuário Específico
```bash
# Restaurar banco do usuário
mysql -u jpsistemas -p jpsistemas_joao_silva < backup_joao_silva.sql

# Restaurar dados do usuário
mysql -u jpsistemas -p jpsistemas_users < backup_usuario_joao_silva.sql
```

## Troubleshooting

### Erro: "Usuário já existe"
```bash
# Verificar se o usuário existe
mysql -u jpsistemas -p -e "USE jpsistemas_users; SELECT username, email FROM users WHERE username = 'nome_do_usuario';"
```

### Erro: "Banco de dados já existe"
```bash
# Verificar bancos existentes
mysql -u jpsistemas -p -e "SHOW DATABASES LIKE 'jpsistemas_%';"
```

### Erro: "Acesso negado"
```bash
# Verificar permissões do usuário do banco
mysql -u root -p -e "SHOW GRANTS FOR 'jpsistemas'@'localhost';"
```

## Segurança

### Boas Práticas
1. **Senhas fortes**: Use senhas com pelo menos 8 caracteres, incluindo letras, números e símbolos
2. **Usernames seguros**: Evite usernames óbvios como "admin", "test", "user"
3. **Emails únicos**: Cada usuário deve ter um email único
4. **Privilégios mínimos**: Use apenas privilégios necessários
5. **Backup regular**: Faça backup dos dados regularmente

### Monitoramento
```bash
# Verificar usuários ativos
mysql -u jpsistemas -p -e "USE jpsistemas_users; SELECT username, email, last_login FROM users WHERE is_active = TRUE;"

# Verificar tentativas de login
tail -f /var/log/mysql/error.log | grep "Access denied"
```

## Suporte

Para dúvidas sobre criação de usuários:
- 📞 WhatsApp: https://whatsa.me/5548996852138
- 📧 Email: suporte@jpsistemas.com
- 📚 Documentação: Este arquivo e `MULTI-TENANCY.md`

## Gerenciamento de Usuários

### Script de Gerenciamento

O sistema também possui um script para gerenciar usuários existentes:

```bash
# Listar todos os usuários
node scripts/manage-users.js list

# Verificar usuário específico
node scripts/manage-users.js check joao_silva

# Ativar usuário
node scripts/manage-users.js activate maria

# Desativar usuário
node scripts/manage-users.js deactivate joao

# Alterar senha
node scripts/manage-users.js password joao NovaSenha123

# Tornar usuário administrador
node scripts/manage-users.js make-admin gerente

# Remover privilégios de administrador
node scripts/manage-users.js remove-admin gerente

# Listar bancos de usuários
node scripts/manage-users.js databases

# Mostrar estatísticas
node scripts/manage-users.js stats
```

## Resumo dos Comandos Principais

```bash
# Criar usuário comum
node scripts/create-user.js username email@empresa.com senha123

# Criar usuário administrador
node scripts/create-user.js admin admin@empresa.com senha123 admin

# Listar usuários
node scripts/manage-users.js list

# Verificar usuário
node scripts/manage-users.js check username

# Alterar senha
node scripts/manage-users.js password username nova_senha

# Backup de usuário
mysqldump -u jpsistemas -p jpsistemas_username > backup_username.sql
``` 