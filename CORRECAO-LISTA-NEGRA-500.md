# 🚨 Correção: Erro 500 na Lista Negra

## ❌ Problema Identificado

**Erro**: `Error 500` ao tentar adicionar cliente à lista negra
**Função**: `adicionarListaNegra()` no arquivo `main.js:1610`
**API**: `PUT /api/cobrancas/clientes/:id/lista-negra`

## 🔍 Causa Raiz

O erro 500 pode ter várias causas possíveis:

1. **Tabela clientes_cobrancas inexistente ou vazia**
2. **Colunas ausentes** (`observacoes`, `updated_at`)
3. **Cliente não encontrado** (tentativa de atualizar ID inexistente)
4. **Problema de conexão/permissões** no banco

## 📊 Diagnóstico

### 1. **Scripts de Debug**

#### Investigar o problema:
```bash
node scripts/debug-lista-negra-error.js
```

#### Corrigir automaticamente:
```bash
node scripts/fix-lista-negra-500.js
```

### 2. **Verificações Manuais**

```sql
-- Verificar se tabela existe
SHOW TABLES LIKE 'clientes_cobrancas';

-- Verificar estrutura
DESCRIBE clientes_cobrancas;

-- Verificar clientes
SELECT id, nome, status FROM clientes_cobrancas LIMIT 5;
```

## ✅ Soluções Aplicadas

### 1. **Criação de Clientes Automática**
- Script cria clientes baseados nos empréstimos existentes
- Vincula `cliente_id` dos empréstimos aos clientes

### 2. **Correção da Estrutura da Tabela**
```sql
-- Adiciona coluna observacoes se não existir
ALTER TABLE clientes_cobrancas 
ADD COLUMN observacoes TEXT NULL;

-- Adiciona coluna updated_at se não existir
ALTER TABLE clientes_cobrancas 
ADD COLUMN updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP;
```

### 3. **Validação da API**
- Verifica se cliente existe antes de atualizar
- Adiciona logs detalhados para debug
- Tratamento de erros melhorado

## 🔧 Implementação da Correção

### Frontend (`main.js`)
```javascript
async function adicionarListaNegra(id) {
  try {
    if (!confirm('Tem certeza que deseja adicionar este cliente à lista negra?')) {
      return;
    }
    
    const response = await fetch(`/api/cobrancas/clientes/${id}/lista-negra`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ 
        status: 'Lista Negra',
        motivo: 'Adicionado manualmente pelo usuário'
      })
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Erro ao adicionar à lista negra');
    }
    
    ui.showNotification('Cliente adicionado à lista negra com sucesso!', 'success');
    
    // Recarregar lista de clientes
    if (document.getElementById('lista-clientes')) {
      await renderClientesLista();
    }
    
  } catch (error) {
    console.error('Erro ao adicionar à lista negra:', error);
    ui.showNotification('Erro ao adicionar à lista negra: ' + error.message, 'error');
  }
}
```

### Backend (`api/cobrancas.js`)
```javascript
router.put('/clientes/:id/lista-negra', ensureDatabase, async (req, res) => {
  try {
    const { id } = req.params;
    const { status, motivo } = req.body;
    
    console.log(`DEBUG: Gerenciando lista negra para cliente ${id}`);
    
    const username = req.session.cobrancasUser;
    const connection = await createCobrancasConnection(username);
    
    // Verificar se o cliente existe
    const [clienteRows] = await connection.execute(`
      SELECT id, nome, status FROM clientes_cobrancas WHERE id = ?
    `, [id]);
    
    if (clienteRows.length === 0) {
      await connection.end();
      return res.status(404).json({ error: 'Cliente não encontrado' });
    }
    
    // Atualizar status do cliente
    await connection.execute(`
      UPDATE clientes_cobrancas 
      SET 
        status = ?,
        observacoes = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [status, motivo, id]);
    
    await connection.end();
    res.json({ 
      message: `Cliente ${status === 'Lista Negra' ? 'adicionado à' : 'removido da'} lista negra com sucesso`,
      cliente_id: id,
      novo_status: status
    });
  } catch (error) {
    console.error('Erro ao gerenciar lista negra:', error);
    res.status(500).json({ 
      error: 'Erro interno do servidor',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});
```

## 🚀 Como Corrigir

### 1. **Execute o script de correção:**
```bash
node scripts/fix-lista-negra-500.js
```

### 2. **Reinicie o servidor:**
```bash
pm2 restart ecosystem.config.js
```

### 3. **Teste a funcionalidade:**
- Acesse a lista de clientes
- Tente adicionar um cliente à lista negra
- Verifique se não há mais erro 500

### 4. **Se ainda houver erro:**
```bash
# Verificar logs do servidor
pm2 logs ecosystem.config.js

# Debug detalhado
node scripts/debug-lista-negra-error.js
```

## 📋 Verificação Final

### ✅ Checklist de Funcionamento:
- [ ] Tabela `clientes_cobrancas` existe
- [ ] Clientes estão cadastrados
- [ ] Colunas `observacoes` e `updated_at` existem
- [ ] API retorna sucesso (200) ao invés de erro (500)
- [ ] Frontend mostra notificação de sucesso
- [ ] Cliente aparece na lista negra

### 🔍 Logs Esperados:
```
DEBUG: Gerenciando lista negra para cliente X
DEBUG: Status: Lista Negra, Motivo: Adicionado manualmente
DEBUG: Cliente encontrado: Nome do Cliente (Status atual: Ativo)
DEBUG: Cliente atualizado com sucesso
```

## 💡 Prevenção

Para evitar este erro no futuro:

1. **Sempre cadastre clientes** antes de usar a lista negra
2. **Mantenha a estrutura** da tabela atualizada
3. **Monitor logs** regularmente
4. **Teste funcionalidades** após mudanças no banco

---
**Data**: Janeiro 2025  
**Status**: ✅ Corrigido  
**Usuário**: cobranca  
**Banco**: jpcobrancas_cobranca 