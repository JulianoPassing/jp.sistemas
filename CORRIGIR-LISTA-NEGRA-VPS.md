# Corrigir Problema da Lista Negra - VPS

## 🚨 Problema Identificado

O erro 500 ao adicionar clientes à lista negra está ocorrendo porque a tabela `clientes_cobrancas` não possui o campo `observacoes` que é necessário para armazenar o motivo da inclusão na lista negra.

## 🔧 Solução

### Opção 1: Executar Script SQL (Recomendado)

1. **Conecte-se ao MySQL da VPS:**
   ```bash
   mysql -u jpsistemas -p jpsistemas_cobrancas
   ```

2. **Execute o script SQL:**
   ```sql
   -- Verificar se o campo observacoes já existe
   SELECT COLUMN_NAME 
   FROM INFORMATION_SCHEMA.COLUMNS 
   WHERE TABLE_SCHEMA = 'jpsistemas_cobrancas' 
   AND TABLE_NAME = 'clientes_cobrancas' 
   AND COLUMN_NAME = 'observacoes';
   
   -- Adicionar campo observacoes se não existir
   ALTER TABLE clientes_cobrancas 
   ADD COLUMN IF NOT EXISTS observacoes TEXT AFTER status;
   
   -- Verificar estrutura da tabela
   DESCRIBE clientes_cobrancas;
   ```

3. **Ou execute o arquivo SQL diretamente:**
   ```bash
   mysql -u jpsistemas -p jpsistemas_cobrancas < scripts/fix-lista-negra.sql
   ```

### Opção 2: Executar Script Node.js

1. **Na VPS, navegue até o diretório do projeto:**
   ```bash
   cd /caminho/para/jp.sistemas
   ```

2. **Execute o script de correção:**
   ```bash
   node scripts/fix-lista-negra-vps.js
   ```

### Opção 3: Comando SQL Manual

Se preferir executar manualmente:

```sql
USE jpsistemas_cobrancas;

-- Adicionar campo observacoes
ALTER TABLE clientes_cobrancas 
ADD COLUMN observacoes TEXT AFTER status;

-- Verificar se foi adicionado
DESCRIBE clientes_cobrancas;
```

## ✅ Verificação

Após executar a correção, verifique se:

1. **O campo foi adicionado:**
   ```sql
   DESCRIBE clientes_cobrancas;
   ```
   Deve mostrar o campo `observacoes` na lista.

2. **Teste a funcionalidade:**
   - Acesse a página de clientes
   - Tente adicionar um cliente à lista negra
   - Não deve mais aparecer erro 500

## 🐛 Troubleshooting

### Se o comando MySQL não funcionar:

1. **Verifique se o MySQL está rodando:**
   ```bash
   sudo systemctl status mysql
   ```

2. **Verifique as credenciais:**
   ```bash
   mysql -u root -p
   ```

3. **Crie o usuário se necessário:**
   ```sql
   CREATE USER 'jpsistemas'@'localhost' IDENTIFIED BY 'Juliano@95';
   GRANT ALL PRIVILEGES ON jpsistemas_cobrancas.* TO 'jpsistemas'@'localhost';
   FLUSH PRIVILEGES;
   ```

### Se o banco não existir:

```sql
CREATE DATABASE IF NOT EXISTS jpsistemas_cobrancas;
USE jpsistemas_cobrancas;
```

### Se a tabela não existir:

A tabela será criada automaticamente quando o sistema for usado pela primeira vez, mas você pode criá-la manualmente:

```sql
CREATE TABLE IF NOT EXISTS clientes_cobrancas (
  id INT AUTO_INCREMENT PRIMARY KEY,
  nome VARCHAR(255) NOT NULL,
  cpf_cnpj VARCHAR(20),
  telefone VARCHAR(20),
  email VARCHAR(255),
  endereco TEXT,
  cidade VARCHAR(100),
  estado VARCHAR(50),
  cep VARCHAR(10),
  status VARCHAR(50) DEFAULT 'Ativo',
  observacoes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
```

## 📋 Comandos Rápidos

### Para executar tudo de uma vez:

```bash
# Conectar ao MySQL e executar correção
mysql -u jpsistemas -p jpsistemas_cobrancas -e "
ALTER TABLE clientes_cobrancas 
ADD COLUMN IF NOT EXISTS observacoes TEXT AFTER status;
DESCRIBE clientes_cobrancas;
"
```

### Para verificar se funcionou:

```bash
# Verificar estrutura da tabela
mysql -u jpsistemas -p jpsistemas_cobrancas -e "DESCRIBE clientes_cobrancas;"
```

## 🎯 Resultado Esperado

Após a correção:

- ✅ Campo `observacoes` adicionado à tabela `clientes_cobrancas`
- ✅ Funcionalidade de lista negra funcionando sem erro 500
- ✅ Clientes podem ser adicionados e removidos da lista negra
- ✅ Motivo da inclusão na lista negra é salvo no campo `observacoes`

## 📞 Suporte

Se ainda houver problemas:

1. Verifique os logs do servidor: `tail -f /var/log/nginx/error.log`
2. Verifique os logs da aplicação: `pm2 logs`
3. Teste a conexão com o banco: `mysql -u jpsistemas -p jpsistemas_cobrancas`

---

**Versão**: 1.0  
**Data**: Dezembro 2024  
**Autor**: JP-Sistemas 