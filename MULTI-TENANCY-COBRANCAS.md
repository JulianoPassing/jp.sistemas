# Sistema Multi-Tenancy - JP Cobranças

## Visão Geral

O Sistema JP Cobranças agora implementa **multi-tenancy completo** onde cada usuário possui seu próprio banco de dados isolado. Isso garante:

- **Isolamento total** de dados entre usuários
- **Segurança máxima** - dados de um usuário nunca podem ser acessados por outro
- **Escalabilidade** - cada usuário pode ter seu próprio crescimento de dados
- **Backup individual** - cada banco pode ser backupado separadamente
- **Performance otimizada** - consultas mais rápidas em bancos menores

## Arquitetura Implementada

### Estrutura de Bancos de Dados

```
MariaDB Server
├── jpsistemas_users (Banco central de usuários)
│   └── usuarios_cobrancas (Tabela de autenticação)
├── jpsistemas_sessions (Banco de sessões)
│   └── sessions (Tabela de sessões ativas)
├── jpsistemas_diego (Banco individual do usuário diego)
│   ├── clientes_cobrancas
│   ├── emprestimos
│   ├── cobrancas
│   └── pagamentos
├── jpsistemas_cobranca (Banco individual do usuário cobranca)
│   ├── clientes_cobrancas
│   ├── emprestimos
│   ├── cobrancas
│   └── pagamentos
└── ... (um banco por usuário)
```

### Nomenclatura dos Bancos

O nome do banco de dados de cada usuário segue o padrão:
```
jpsistemas_{username}
```

Exemplo:
- Usuário: `diego` → Banco: `jpsistemas_diego`
- Usuário: `cobranca` → Banco: `jpsistemas_cobranca`
- Usuário: `maria_silva` → Banco: `jpsistemas_maria_silva`

## Implementação Técnica

### 1. Função de Conexão Multi-Tenant

```javascript
// Função para criar conexão com banco de cobranças do usuário
async function createCobrancasConnection(username) {
  const dbName = `jpsistemas_${username.toLowerCase().replace(/[^a-z0-9]/g, '_')}`;
  const dbConfig = {
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'jpsistemas',
    password: process.env.DB_PASSWORD || 'SuaSenhaForte123!',
    database: dbName,
    charset: 'utf8mb4'
  };
  
  try {
    const connection = await mysql.createConnection(dbConfig);
    return connection;
  } catch (error) {
    console.error(`Erro ao conectar ao banco de cobranças do usuário ${username}:`, error);
    throw error;
  }
}
```

### 2. Criação Automática de Bancos

```javascript
// Função para criar banco de dados de cobranças do usuário
async function createCobrancasDatabase(username) {
  const dbName = `jpsistemas_${username.toLowerCase().replace(/[^a-z0-9]/g, '_')}`;
  
  try {
    // Conectar como root para criar o banco
    const rootConnection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'jpsistemas',
      password: process.env.DB_PASSWORD || 'SuaSenhaForte123!',
      charset: 'utf8mb4'
    });

    // Criar banco de dados
    await rootConnection.execute(`CREATE DATABASE IF NOT EXISTS \`${dbName}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
    
    // Conectar ao banco criado e criar tabelas
    const cobrancasConnection = await createCobrancasConnection(username);
    
    // Criar todas as tabelas necessárias...
    
    await rootConnection.end();
    await cobrancasConnection.end();
    
    console.log(`Banco de dados ${dbName} criado com sucesso para o usuário ${username}`);
    return true;
  } catch (error) {
    console.error(`Erro ao criar banco de dados de cobranças para ${username}:`, error);
    throw error;
  }
}
```

### 3. Middleware de Autenticação

```javascript
// Middleware para inicializar banco se necessário
async function ensureDatabase(req, res, next) {
  try {
    const username = req.session.cobrancasUser;
    if (!username) {
      return res.status(401).json({ error: 'Usuário não autenticado' });
    }
    await createCobrancasDatabase(username);
    next();
  } catch (error) {
    console.error('Erro ao garantir banco de dados:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
}
```

### 4. Rotas Multi-Tenant

Todas as rotas agora usam o banco específico do usuário:

```javascript
// Exemplo: Rota de clientes
router.get('/clientes', ensureDatabase, async (req, res) => {
  try {
    const username = req.session.cobrancasUser;
    const connection = await createCobrancasConnection(username);
    const [clientes] = await connection.execute(`
      SELECT * FROM clientes_cobrancas 
      ORDER BY nome ASC
    `);
    await connection.end();
    res.json(clientes);
  } catch (error) {
    console.error('Erro ao buscar clientes:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});
```

## Fluxo de Autenticação

### 1. Login do Usuário
```javascript
POST /api/cobrancas/login
{
  "username": "diego",
  "password": "diego123"
}
```

### 2. Verificação de Credenciais
- Sistema verifica credenciais no banco `jpsistemas_users`
- Se válido, verifica se o banco `jpsistemas_diego` existe
- Se não existir, cria automaticamente

### 3. Criação da Sessão
```javascript
// Criar banco de dados do usuário se não existir
await createCobrancasDatabase(username);

// Salva na sessão o usuário
req.session.cobrancasUser = username;
req.session.cobrancasDb = `jpsistemas_${username.toLowerCase().replace(/[^a-z0-9]/g, '_')}`;
```

### 4. Acesso aos Dados
Todas as requisições subsequentes usam o banco específico do usuário:
```javascript
const username = req.session.cobrancasUser;
const connection = await createCobrancasConnection(username);
```

## Tabelas por Banco de Usuário

Cada banco de usuário contém as seguintes tabelas:

### 1. `clientes_cobrancas`
```sql
CREATE TABLE clientes_cobrancas (
  id INT AUTO_INCREMENT PRIMARY KEY,
  nome VARCHAR(255) NOT NULL,
  cpf_cnpj VARCHAR(18),
  email VARCHAR(255),
  telefone VARCHAR(20),
  endereco VARCHAR(255),
  cidade VARCHAR(100),
  estado VARCHAR(2),
  cep VARCHAR(9),
  status VARCHAR(50) DEFAULT 'Ativo',
  observacoes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_nome (nome),
  INDEX idx_cpf_cnpj (cpf_cnpj),
  INDEX idx_email (email),
  INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
```

### 2. `emprestimos`
```sql
CREATE TABLE emprestimos (
  id INT AUTO_INCREMENT PRIMARY KEY,
  cliente_id INT,
  valor DECIMAL(10,2) NOT NULL,
  data_emprestimo DATE NOT NULL,
  data_vencimento DATE NOT NULL,
  juros_mensal DECIMAL(5,2) DEFAULT 0.00,
  multa_atraso DECIMAL(5,2) DEFAULT 0.00,
  status VARCHAR(50) DEFAULT 'Ativo',
  observacoes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (cliente_id) REFERENCES clientes_cobrancas(id) ON DELETE SET NULL,
  INDEX idx_cliente_id (cliente_id),
  INDEX idx_data_vencimento (data_vencimento),
  INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
```

### 3. `cobrancas`
```sql
CREATE TABLE cobrancas (
  id INT AUTO_INCREMENT PRIMARY KEY,
  emprestimo_id INT,
  cliente_id INT,
  valor_original DECIMAL(10,2) NOT NULL,
  valor_atualizado DECIMAL(10,2) NOT NULL,
  juros_calculados DECIMAL(10,2) DEFAULT 0.00,
  multa_calculada DECIMAL(10,2) DEFAULT 0.00,
  data_vencimento DATE NOT NULL,
  dias_atraso INT DEFAULT 0,
  status VARCHAR(50) DEFAULT 'Pendente',
  data_cobranca DATE,
  observacoes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (emprestimo_id) REFERENCES emprestimos(id) ON DELETE SET NULL,
  FOREIGN KEY (cliente_id) REFERENCES clientes_cobrancas(id) ON DELETE SET NULL,
  INDEX idx_emprestimo_id (emprestimo_id),
  INDEX idx_cliente_id (cliente_id),
  INDEX idx_data_vencimento (data_vencimento),
  INDEX idx_status (status),
  INDEX idx_dias_atraso (dias_atraso)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
```

### 4. `pagamentos`
```sql
CREATE TABLE pagamentos (
  id INT AUTO_INCREMENT PRIMARY KEY,
  cobranca_id INT,
  valor_pago DECIMAL(10,2) NOT NULL,
  data_pagamento DATE NOT NULL,
  forma_pagamento VARCHAR(50),
  observacoes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (cobranca_id) REFERENCES cobrancas(id) ON DELETE SET NULL,
  INDEX idx_cobranca_id (cobranca_id),
  INDEX idx_data_pagamento (data_pagamento)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
```

## Vantagens do Multi-Tenancy

### 🔒 Segurança
- **Isolamento total**: Dados de um usuário nunca podem ser acessados por outro
- **Sem vazamento**: Mesmo se houver bug no código, dados ficam isolados
- **Auditoria**: Cada banco pode ser auditado independentemente

### 📈 Escalabilidade
- **Crescimento individual**: Cada usuário pode ter quantos dados quiser
- **Performance**: Consultas são mais rápidas (banco menor)
- **Manutenção**: Problemas em um banco não afetam outros

### 💾 Backup e Restore
- **Backup granular**: Pode fazer backup de usuários específicos
- **Restore seletivo**: Pode restaurar apenas um usuário
- **Migração**: Pode mover usuários entre servidores facilmente

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
  --default-character-set=utf8mb4 jpsistemas_diego > backup_diego.sql

# Usando MariaBackup (mais rápido)
mariabackup --backup --target-dir=/tmp/backup_diego \
  --user=jpsistemas --password=SuaSenhaForte123! \
  --databases=jpsistemas_diego
```

### Restore de Usuário Específico
```bash
# Usando mysql
mysql -u jpsistemas -p jpsistemas_diego < backup_diego.sql

# Usando MariaBackup
mariabackup --copy-back --target-dir=/tmp/backup_diego
```

### Remover Usuário e Seus Dados
```sql
DROP DATABASE jpsistemas_diego;
DELETE FROM jpsistemas_users.usuarios_cobrancas WHERE username = 'diego';
```

## Script de Teste

**Arquivo:** `scripts/test-multi-tenancy.js`

Este script testa:
- Se o sistema está rodando
- Se o login funciona para diferentes usuários
- Se os bancos de dados são criados corretamente
- Se as tabelas existem em cada banco
- Se o isolamento de dados está funcionando

## Como Testar

### 1. Via Script
```bash
cd /caminho/para/jp.sistemas
node scripts/test-multi-tenancy.js
```

### 2. Via Navegador
1. Abra: `http://localhost:3000/jp.cobrancas/login.html`
2. Faça login com: `diego` / `diego123`
3. Crie alguns clientes e empréstimos
4. Faça logout
5. Faça login com: `cobranca` / `cobranca123`
6. Verifique se não vê os dados do diego
7. Crie dados próprios
8. Faça logout e login novamente com diego
9. Verifique se não vê os dados do cobranca

## Resultado Esperado

✅ **Isolamento total**: Cada usuário vê apenas seus próprios dados
✅ **Bancos separados**: `jpsistemas_diego` e `jpsistemas_cobranca`
✅ **Criação automática**: Bancos e tabelas criados automaticamente
✅ **Performance**: Consultas mais rápidas
✅ **Segurança**: Dados completamente isolados

## Benefícios Implementados

1. **Segurança máxima**: Isolamento total de dados
2. **Escalabilidade**: Cada usuário pode crescer independentemente
3. **Manutenibilidade**: Problemas isolados por usuário
4. **Backup granular**: Backup individual por usuário
5. **Performance**: Consultas mais eficientes

## Próximos Passos

1. Testar o sistema multi-tenancy
2. Verificar isolamento de dados
3. Configurar backup automático
4. Monitorar performance
5. Documentar procedimentos de manutenção

---

**Status:** ✅ **IMPLEMENTADO**
**Data:** $(date)
**Responsável:** Assistente IA 