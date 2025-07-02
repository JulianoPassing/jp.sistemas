# Scripts do Sistema J.P Sistemas

Este diretório contém scripts utilitários para gerenciar o sistema J.P Sistemas.

## Scripts Disponíveis

### 1. `create-user.js` - Criar Novos Usuários

Script automatizado para criar novos usuários no sistema multi-tenancy.

```bash
# Criar usuário comum
node scripts/create-user.js joao_silva joao@empresa.com senha123

# Criar usuário administrador
node scripts/create-user.js admin admin@empresa.com senha123 admin
```

**O que o script faz:**
- ✅ Valida dados do usuário (username, email, senha)
- ✅ Cria usuário no banco `jpsistemas_users`
- ✅ Criptografa senha com bcrypt
- ✅ Cria banco de dados específico do usuário
- ✅ Cria todas as tabelas necessárias
- ✅ Configura índices para performance

### 2. `manage-users.js` - Gerenciar Usuários Existentes

Script para gerenciar usuários já criados no sistema.

```bash
# Listar todos os usuários
node scripts/manage-users.js list

# Verificar usuário específico
node scripts/manage-users.js check joao_silva

# Ativar/desativar usuário
node scripts/manage-users.js activate maria
node scripts/manage-users.js deactivate joao

# Alterar senha
node scripts/manage-users.js password joao NovaSenha123

# Gerenciar privilégios de administrador
node scripts/manage-users.js make-admin gerente
node scripts/manage-users.js remove-admin gerente

# Verificar bancos de dados
node scripts/manage-users.js databases

# Mostrar estatísticas
node scripts/manage-users.js stats
```

### 3. `init-db.js` - Inicializar Banco de Dados

Script para inicializar os bancos principais do sistema.

```bash
# Inicializar bancos principais
node scripts/init-db.js
```

**O que o script faz:**
- ✅ Cria bancos principais (`jpsistemas_users`, `jpsistemas_sessions`, `jpsistemas_admin`)
- ✅ Cria tabela de usuários
- ✅ Cria tabela de sessões
- ✅ Cria usuário administrador padrão (admin/admin123)

### 4. `init-vercel-db.js` - Inicializar Banco para Vercel

Script específico para inicializar bancos em provedores cloud (Vercel, PlanetScale, etc.).

```bash
# Inicializar para Vercel
node scripts/init-vercel-db.js
```

### 5. `init-produtos.js` - Inicializar Produtos

Script para popular o banco com produtos de exemplo.

```bash
# Adicionar produtos de exemplo
node scripts/init-produtos.js
```

### 6. `check-produtos.js` - Verificar Produtos

Script para verificar e validar produtos no banco.

```bash
# Verificar produtos
node scripts/check-produtos.js
```

### 7. `backup.sh` - Backup do Sistema

Script para fazer backup dos bancos de dados.

```bash
# Backup completo
./scripts/backup.sh

# Backup específico (Debian)
./scripts/backup-debian.sh
```

## Estrutura dos Scripts

```
scripts/
├── create-user.js          # Criar novos usuários
├── manage-users.js         # Gerenciar usuários existentes
├── init-db.js             # Inicializar bancos principais
├── init-vercel-db.js      # Inicializar para Vercel
├── init-produtos.js       # Popular produtos de exemplo
├── check-produtos.js      # Verificar produtos
├── backup.sh              # Backup do sistema
├── backup-debian.sh       # Backup específico para Debian
└── README.md              # Este arquivo
```

## Configuração

### Variáveis de Ambiente

Os scripts utilizam as seguintes variáveis de ambiente:

```bash
# Configurações do banco de dados
DB_HOST=localhost
DB_USER=jpsistemas
DB_PASSWORD=SuaSenhaForte123!
DB_PORT=3306

# Provedor de banco (para Vercel)
DATABASE_PROVIDER=local  # local, planetscale, railway, neon, etc.

# Banco de usuários
DB_USERS_DATABASE=jpsistemas_users
```

### Arquivo .env

Crie um arquivo `.env` na raiz do projeto:

```env
DB_HOST=localhost
DB_USER=jpsistemas
DB_PASSWORD=SuaSenhaForte123!
DATABASE_PROVIDER=local
DB_USERS_DATABASE=jpsistemas_users
```

## Exemplos de Uso

### Cenário 1: Primeira Instalação

```bash
# 1. Inicializar bancos principais
node scripts/init-db.js

# 2. Criar usuário administrador
node scripts/create-user.js admin admin@empresa.com SenhaForte123 admin

# 3. Criar usuários comuns
node scripts/create-user.js joao_silva joao@empresa.com senha123
node scripts/create-user.js maria maria@empresa.com senha456

# 4. Verificar usuários criados
node scripts/manage-users.js list
```

### Cenário 2: Gerenciamento Diário

```bash
# Verificar status dos usuários
node scripts/manage-users.js stats

# Listar usuários ativos
node scripts/manage-users.js list

# Alterar senha de usuário
node scripts/manage-users.js password joao_silva NovaSenha123

# Promover usuário a administrador
node scripts/manage-users.js make-admin gerente
```

### Cenário 3: Troubleshooting

```bash
# Verificar se usuário existe
node scripts/manage-users.js check joao_silva

# Verificar bancos de dados
node scripts/manage-users.js databases

# Reativar usuário desativado
node scripts/manage-users.js activate joao_silva
```

## Validações

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

## Segurança

### Boas Práticas
1. **Execute scripts como usuário apropriado**
2. **Use senhas fortes** (mínimo 8 caracteres)
3. **Mantenha backups regulares**
4. **Monitore logs de acesso**
5. **Altere senhas padrão** após primeiro login

### Permissões de Arquivos
```bash
# Tornar scripts executáveis
chmod +x scripts/*.sh

# Proteger arquivos de configuração
chmod 600 .env
```

## Troubleshooting

### Erro: "Access denied"
```bash
# Verificar permissões do usuário do banco
mysql -u root -p -e "SHOW GRANTS FOR 'jpsistemas'@'localhost';"
```

### Erro: "Database not found"
```bash
# Verificar se bancos principais existem
mysql -u jpsistemas -p -e "SHOW DATABASES LIKE 'jpsistemas_%';"
```

### Erro: "User already exists"
```bash
# Verificar usuários existentes
node scripts/manage-users.js list
```

### Erro: "Connection refused"
```bash
# Verificar se MariaDB está rodando
sudo systemctl status mariadb
```

## Logs e Monitoramento

### Verificar Logs do Sistema
```bash
# Logs do MariaDB
sudo tail -f /var/log/mysql/error.log

# Logs da aplicação
tail -f /var/log/jpsistemas/app.log
```

### Monitoramento de Performance
```bash
# Verificar conexões ativas
mysql -u jpsistemas -p -e "SHOW STATUS LIKE 'Threads_connected';"

# Verificar queries lentas
sudo tail -f /var/log/mysql/slow.log
```

## Suporte

Para dúvidas sobre os scripts:
- 📞 WhatsApp: https://whatsa.me/5548996852138
- 📧 Email: suporte@jpsistemas.com
- 📚 Documentação: `CRIAR-USUARIOS.md` e `MULTI-TENANCY.md`

## Contribuição

Para contribuir com melhorias nos scripts:
1. Teste em ambiente de desenvolvimento
2. Documente mudanças
3. Mantenha compatibilidade com versões anteriores
4. Siga as convenções de nomenclatura 