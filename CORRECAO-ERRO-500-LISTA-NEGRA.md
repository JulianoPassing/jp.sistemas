# Correção - Erro 500 Lista Negra

## 🚨 Problema Identificado

**Erro:** `PUT https://jp-sistemas.com/api/cobrancas/clientes/6/lista-negra 500 (Internal Server Error)`

**Causa:** A tabela `clientes_cobrancas` não possui o campo `observacoes` que é necessário para armazenar o motivo da inclusão/remoção da lista negra.

## 🔧 Solução Rápida

Execute o script de correção:

```bash
node scripts/fix-lista-negra-error.js
```

## 🔍 Diagnóstico Manual

### 1. Verificar se o campo existe:
```sql
DESCRIBE clientes_cobrancas;
```

### 2. Se não houver campo `observacoes`, adicione:
```sql
ALTER TABLE clientes_cobrancas 
ADD COLUMN observacoes TEXT AFTER status;
```

### 3. Se não houver campo `updated_at`, adicione:
```sql
ALTER TABLE clientes_cobrancas 
ADD COLUMN updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP;
```

## 📋 O que o Script de Correção Faz

1. **Verifica a estrutura da tabela** `clientes_cobrancas`
2. **Adiciona campo `observacoes`** se não existir
3. **Adiciona campo `updated_at`** se não existir
4. **Testa a funcionalidade** completa
5. **Confirma se está funcionando**

## ✅ Verificação

Após executar a correção:

1. **Acesse a página de clientes**
2. **Clique em "Lista Negra"** em qualquer cliente
3. **Confirme a ação**
4. **Verifique se não há mais erro 500**

## 🔧 Estrutura Final da Tabela

Após a correção, a tabela deve ter:

```sql
+--------------+--------------+------+-----+-------------------+
| Field        | Type         | Null | Key | Default           |
+--------------+--------------+------+-----+-------------------+
| id           | int(11)      | NO   | PRI | NULL              |
| nome         | varchar(255) | NO   |     | NULL              |
| cpf_cnpj     | varchar(20)  | YES  |     | NULL              |
| email        | varchar(255) | YES  |     | NULL              |
| telefone     | varchar(20)  | YES  |     | NULL              |
| endereco     | text         | YES  |     | NULL              |
| cidade       | varchar(100) | YES  |     | NULL              |
| estado       | varchar(2)   | YES  |     | NULL              |
| cep          | varchar(10)  | YES  |     | NULL              |
| status       | varchar(50)  | YES  |     | Ativo             |
| observacoes  | text         | YES  |     | NULL              |
| created_at   | timestamp    | NO   |     | CURRENT_TIMESTAMP |
| updated_at   | timestamp    | YES  |     | NULL              |
+--------------+--------------+------+-----+-------------------+
```

## 🐛 Troubleshooting

### Se o script falhar:

1. **Erro de conexão:**
   - Verifique se o MySQL está rodando
   - Confirme credenciais no `.env`

2. **Erro de permissão:**
   - Execute como usuário com privilégios ALTER TABLE
   - Verifique permissões do banco

3. **Campo já existe:**
   - O script detecta e informa se já existe
   - Pode ser executado múltiplas vezes

### Se persistir erro 500:

1. **Verifique logs do servidor**
2. **Teste conexão com banco**
3. **Execute SQL manualmente:**
   ```sql
   ALTER TABLE clientes_cobrancas ADD COLUMN observacoes TEXT AFTER status;
   ```

## 📝 Funcionalidade Após Correção

### Adicionar à Lista Negra:
- ✅ Status muda para "Lista Negra"
- ✅ Motivo é salvo em `observacoes`
- ✅ Data é registrada em `updated_at`

### Remover da Lista Negra:
- ✅ Status volta para "Ativo"
- ✅ Motivo da remoção é salvo
- ✅ Data é atualizada

### Interface:
- ✅ Botões funcionam sem erro
- ✅ Notificações de sucesso
- ✅ Listas são atualizadas automaticamente

## 🎯 Resultado Final

Após a correção:
- ❌ **ANTES:** Erro 500 ao clicar em "Lista Negra"
- ✅ **DEPOIS:** Funcionalidade completa funcionando

A lista negra agora funciona perfeitamente para gerenciar clientes problemáticos no sistema. 