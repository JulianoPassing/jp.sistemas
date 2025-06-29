# Sistema Multi-Tenancy - J.P Sistemas (MariaDB)

## Visão Geral

O Sistema J.P Sistemas implementa um modelo de **multi-tenancy** onde cada usuário possui seu próprio banco de dados isolado usando **MariaDB**. Isso garante:

- **Isolamento total** de dados entre usuários
- **Segurança máxima** - dados de um usuário nunca podem ser acessados por outro
- **Escalabilidade** - cada usuário pode ter seu próprio crescimento de dados
- **Backup individual** - cada banco pode ser backupado separadamente
- **Performance otimizada** - MariaDB oferece melhor performance para multi-tenancy

## Arquitetura do Sistema

### Estrutura de Bancos de Dados

```
MariaDB Server
├── jpsistemas_users (Banco principal de usuários)
│   └── users (Tabela de autenticação)
├── jpsistemas_sessions (Banco de sessões)
│   └── sessions (Tabela de sessões ativas)
├── jpsistemas_usuario1 (Banco individual do usuário 1)
│   ├── clientes
│   ├── produtos
│   ├── pedidos
│   └── pedido_itens
├── jpsistemas_usuario2 (Banco individual do usuário 2)
│   ├── clientes
│   ├── produtos
│   ├── pedidos
│   └── pedido_itens
└── ... (um banco por usuário)
```

### Nomenclatura dos Bancos

O nome do banco de dados de cada usuário segue o padrão:
```
jpsistemas_{username}
```

Exemplo:
- Usuário: `joao_silva` → Banco: `jpsistemas_joao_silva`
- Usuário: `maria123` → Banco: `jpsistemas_maria123`
- Usuário: `admin` → Banco: `jpsistemas_admin`

### Tabelas por Banco de Usuário

Cada banco de usuário contém as seguintes tabelas:

#### 1. `clientes`
```sql
CREATE TABLE clientes (
  id INT AUTO_INCREMENT PRIMARY KEY,
  razao VARCHAR(255) NOT NULL,
  cnpj VARCHAR(18),
  ie VARCHAR(20),
  endereco VARCHAR(255),
  bairro VARCHAR(100),
  cidade VARCHAR(100),
  estado VARCHAR(2),
  cep VARCHAR(9),
  email VARCHAR(255),
  telefone VARCHAR(20),
  transporte VARCHAR(100),
  prazo VARCHAR(50),
  obs TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_razao (razao),
  INDEX idx_cnpj (cnpj),
  INDEX idx_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

#### 2. `produtos`
```sql
CREATE TABLE produtos (
  id INT AUTO_INCREMENT PRIMARY KEY,
  nome VARCHAR(255) NOT NULL,
  descricao TEXT,
  preco DECIMAL(10,2),
  categoria VARCHAR(100),
  codigo VARCHAR(50),
  estoque INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_nome (nome),
  INDEX idx_categoria (categoria),
  INDEX idx_codigo (codigo)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

#### 3. `pedidos`
```sql
CREATE TABLE pedidos (
  id INT AUTO_INCREMENT PRIMARY KEY,
  cliente_id INT,
  data_pedido DATE,
  status VARCHAR(50) DEFAULT 'pendente',
  valor_total DECIMAL(10,2),
  observacoes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (cliente_id) REFERENCES clientes(id) ON DELETE SET NULL,
  INDEX idx_data_pedido (data_pedido),
  INDEX idx_status (status),
  INDEX idx_cliente_id (cliente_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

#### 4. `pedido_itens`
```sql
CREATE TABLE pedido_itens (
  id INT AUTO_INCREMENT PRIMARY KEY,
  pedido_id INT,
  produto_id INT,
  quantidade INT,
  preco_unitario DECIMAL(10,2),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (pedido_id) REFERENCES pedidos(id) ON DELETE CASCADE,
  FOREIGN KEY (produto_id) REFERENCES produtos(id) ON DELETE SET NULL,
  INDEX idx_pedido_id (pedido_id),
  INDEX idx_produto_id (produto_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

## Fluxo de Autenticação

### 1. Login do Usuário
```javascript
POST /api/auth/login
{
  "username": "joao_silva",
  "password": "senha123"
}
```

### 2. Verificação de Credenciais
- Sistema verifica credenciais no banco `jpsistemas_users`
- Se válido, verifica se o banco `jpsistemas_joao_silva` existe
- Se não existir, cria automaticamente

### 3. Criação da Sessão
```javascript
req.session.user = {
  id: user.id,
  username: user.username,
  email: user.email,
  isAdmin: user.is_admin,
  dbName: 'jpsistemas_joao_silva'
};
```

### 4. Acesso aos Dados
Todas as requisições subsequentes usam o banco específico do usuário:
```javascript
// Middleware injeta a conexão correta
req.dbConnection = await createUserDatabaseConnection(req.session.user.username);
```

## Vantagens do Multi-Tenancy com MariaDB

### 🔒 Segurança
- **Isolamento total**: Dados de um usuário nunca podem ser acessados por outro
- **Sem vazamento**: Mesmo se houver bug no código, dados ficam isolados
- **Auditoria**: Cada banco pode ser auditado independentemente
- **Criptografia**: MariaDB oferece criptografia de dados em repouso

### 📈 Escalabilidade
- **Crescimento individual**: Cada usuário pode ter quantos dados quiser
- **Performance**: Consultas são mais rápidas (banco menor)
- **Manutenção**: Problemas em um banco não afetam outros
- **Query cache**: MariaDB tem query cache mais eficiente

### 💾 Backup e Restore
- **Backup granular**: Pode fazer backup de usuários específicos
- **Restore seletivo**: Pode restaurar apenas um usuário
- **Migração**: Pode mover usuários entre servidores facilmente
- **MariaBackup**: Backup mais rápido que mysqldump

### 🛠️ Manutenção
- **Atualizações**: Pode atualizar esquemas individualmente
- **Limpeza**: Pode limpar dados antigos por usuário
- **Monitoramento**: Pode monitorar uso de recursos por usuário
- **Audit plugin**: Monitoramento avançado de atividades

## Comandos de Administração

### Listar Todos os Bancos de Usuários
```sql
SHOW DATABASES LIKE 'jpsistemas_%';
```

### Verificar Tamanho dos Bancos
```sql
SELECT 
  table_schema AS 'Database',
  ROUND(SUM(data_length + index_length) / 1024 / 1024, 2) AS 'Size (MB)',
  COUNT(*) AS 'Tables'
FROM information_schema.tables 
WHERE table_schema LIKE 'jpsistemas_%'
GROUP BY table_schema
ORDER BY SUM(data_length + index_length) DESC;
```

### Backup de Usuário Específico
```bash
# Usando mysqldump
mysqldump -u jpsistemas -p --single-transaction --routines --triggers \
  --default-character-set=utf8mb4 jpsistemas_joao_silva > backup_joao_silva.sql

# Usando MariaBackup (mais rápido)
mariabackup --backup --target-dir=/tmp/backup_joao_silva \
  --user=jpsistemas --password=SuaSenhaForte123! \
  --databases=jpsistemas_joao_silva
```

### Restore de Usuário Específico
```bash
# Usando mysql
mysql -u jpsistemas -p jpsistemas_joao_silva < backup_joao_silva.sql

# Usando MariaBackup
mariabackup --copy-back --target-dir=/tmp/backup_joao_silva
```

### Remover Usuário e Seus Dados
```sql
DROP DATABASE jpsistemas_joao_silva;
DELETE FROM jpsistemas_users.users WHERE username = 'joao_silva';
```

## Monitoramento

### Script de Monitoramento
```bash
#!/bin/bash
# Monitorar uso de espaço por usuário

mysql -u jpsistemas -p -e "
SELECT 
  table_schema AS 'Usuario',
  ROUND(SUM(data_length + index_length) / 1024 / 1024, 2) AS 'Tamanho (MB)',
  COUNT(*) AS 'Tabelas',
  MAX(updated_at) AS 'Ultima_Atualizacao'
FROM information_schema.tables t
LEFT JOIN (
  SELECT table_schema, MAX(updated_at) as updated_at
  FROM information_schema.tables 
  WHERE table_schema LIKE 'jpsistemas_%'
  GROUP BY table_schema
) u ON t.table_schema = u.table_schema
WHERE t.table_schema LIKE 'jpsistemas_%'
GROUP BY t.table_schema
ORDER BY SUM(data_length + index_length) DESC;
"
```

### Alertas de Espaço
```bash
# Alertar se usuário usar mais de 100MB
mysql -u jpsistemas -p -e "
SELECT 
  table_schema AS 'Usuario',
  ROUND(SUM(data_length + index_length) / 1024 / 1024, 2) AS 'Tamanho (MB)'
FROM information_schema.tables 
WHERE table_schema LIKE 'jpsistemas_%'
GROUP BY table_schema
HAVING SUM(data_length + index_length) > 100 * 1024 * 1024;
"
```

### Monitoramento de Performance
```bash
# Verificar queries lentas
sudo tail -f /var/log/mysql/slow.log

# Verificar status do MariaDB
mysql -u root -p -e "SHOW STATUS LIKE 'Threads_connected';"
mysql -u root -p -e "SHOW STATUS LIKE 'Queries';"
mysql -u root -p -e "SHOW STATUS LIKE 'Slow_queries';"
```

## Considerações de Performance

### Índices Recomendados
```sql
-- Para cada banco de usuário
CREATE INDEX idx_clientes_razao ON clientes(razao);
CREATE INDEX idx_clientes_cnpj ON clientes(cnpj);
CREATE INDEX idx_clientes_email ON clientes(email);
CREATE INDEX idx_produtos_nome ON produtos(nome);
CREATE INDEX idx_produtos_categoria ON produtos(categoria);
CREATE INDEX idx_pedidos_data ON pedidos(data_pedido);
CREATE INDEX idx_pedidos_status ON pedidos(status);
```

### Configurações MariaDB Otimizadas
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

# Configurações específicas do MariaDB
aria_pagecache_buffer_size = 128M
aria_log_file_size = 64M
```

## Backup e Recuperação

### Backup Automático Diário
O sistema inclui script de backup que:
- Faz backup de todos os bancos de usuários
- Usa charset utf8mb4 para compatibilidade
- Compacta os arquivos
- Remove backups antigos
- Envia notificação por email

### Recuperação de Desastre
```bash
# Restaurar todos os bancos
for backup in /var/backups/jpsistemas/*.sql; do
  dbname=$(basename $backup .sql)
  mysql -u jpsistemas -p < $backup
done

# Verificar integridade
mysqlcheck -u jpsistemas -p --all-databases
```

### Backup com MariaBackup
```bash
#!/bin/bash
# Backup mais rápido usando MariaBackup

BACKUP_DIR="/var/backups/jpsistemas/mariabackup"
DATE=$(date +%Y%m%d_%H%M%S)

# Criar backup completo
mariabackup --backup \
  --target-dir=$BACKUP_DIR/full_$DATE \
  --user=jpsistemas \
  --password=SuaSenhaForte123!

# Preparar backup
mariabackup --prepare \
  --target-dir=$BACKUP_DIR/full_$DATE

# Compactar
tar -czf $BACKUP_DIR/full_$DATE.tar.gz -C $BACKUP_DIR full_$DATE
rm -rf $BACKUP_DIR/full_$DATE
```

## Limitações e Considerações

### Limitações
- **Mais bancos**: Maior complexidade de administração
- **Mais conexões**: Cada usuário pode ter múltiplas conexões
- **Backup maior**: Mais arquivos para gerenciar

### Mitigações
- **Pool de conexões**: Reutilizar conexões quando possível
- **Backup incremental**: Fazer backup apenas de mudanças
- **Monitoramento**: Acompanhar uso de recursos
- **MariaBackup**: Backup mais eficiente que mysqldump

## Vantagens Específicas do MariaDB

### 🚀 Performance
- **Query cache** mais eficiente que MySQL
- **Otimizações** específicas para multi-tenancy
- **Melhor performance** em consultas complexas
- **MariaBackup** mais rápido que mysqldump

### 🔒 Segurança
- **Audit plugin** nativo
- **Criptografia** de dados em repouso
- **Controle de acesso** granular
- **Segurança aprimorada** por padrão

### 🔧 Manutenção
- **Backup mais rápido** com MariaBackup
- **Recuperação** mais eficiente
- **Monitoramento** avançado
- **Compatibilidade** 100% com MySQL

### 📊 Compatibilidade
- **100% compatível** com MySQL
- **Suporte a JSON** nativo
- **UTF8MB4** por padrão
- **Migração fácil** de MySQL

## Suporte

Para dúvidas sobre o sistema multi-tenancy com MariaDB:
- 📞 WhatsApp: https://whatsa.me/5548996852138
- 📧 Email: suporte@jpsistemas.com
- 📚 Documentação: Este arquivo e `deploy-guide.md` 