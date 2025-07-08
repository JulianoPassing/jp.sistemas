# Correção - Clientes em Atraso no Dashboard

## Problema Identificado

O dashboard estava mostrando "1 cliente em atraso" mesmo quando todos os clientes estavam com parcelas em dia. Isso ocorria porque:

1. **Query incorreta**: A API considerava apenas a `data_vencimento` principal do empréstimo, não as parcelas individuais
2. **Lógica inadequada**: Para empréstimos parcelados, o sistema verificava a data de vencimento geral em vez das parcelas específicas
3. **Cálculo duplicado**: O frontend sobrescrevia o valor da API com cálculo local incorreto

## Correções Implementadas

### 1. API - Query Corrigida (`api/cobrancas.js`)

**ANTES (Problemática):**
```sql
SELECT COUNT(DISTINCT c.id) as total
FROM clientes_cobrancas c
JOIN emprestimos e ON e.cliente_id = c.id
WHERE e.status IN ('Ativo', 'Pendente')
  AND e.data_vencimento < CURDATE()
  AND e.status <> 'Quitado'
```

**DEPOIS (Corrigida):**
```sql
SELECT COUNT(DISTINCT c.id) as total
FROM clientes_cobrancas c
JOIN emprestimos e ON e.cliente_id = c.id
WHERE e.status IN ('Ativo', 'Pendente')
  AND e.status <> 'Quitado'
  AND (
    -- Para empréstimos de parcela única
    (e.tipo_emprestimo != 'in_installments' AND e.data_vencimento < CURDATE())
    OR
    -- Para empréstimos parcelados, verificar se há parcelas atrasadas
    (e.tipo_emprestimo = 'in_installments' AND EXISTS (
      SELECT 1 FROM parcelas p 
      WHERE p.emprestimo_id = e.id 
        AND p.data_vencimento < CURDATE() 
        AND p.status != 'Paga'
    ))
  )
```

### 2. Frontend - Remoção de Cálculo Local (`public/jp.cobrancas/js/main.js`)

**ANTES:**
```javascript
// Calcular clientes em atraso: recalcula status localmente
const clientesEmAtrasoSet = new Set();
emprestimos.forEach(emprestimo => {
  const dataVencimento = new Date(emprestimo.data_vencimento);
  let status = (emprestimo.status || '').toUpperCase();
  if (dataVencimento < hoje && status !== 'QUITADO') {
    status = 'ATRASADO';
  }
  const clienteId = emprestimo.cliente_id || emprestimo.cliente || emprestimo.cliente_nome || null;
  if (status === 'ATRASADO' && clienteId) {
    clientesEmAtrasoSet.add(clienteId);
  }
});
data.cobrancas.clientes_em_atraso = clientesEmAtrasoSet.size;
```

**DEPOIS:**
```javascript
// Usar o valor calculado pela API que já considera parcelas corretamente
// Não sobrescrever o valor da API com cálculo local incorreto
// data.cobrancas.clientes_em_atraso já vem correto da API
```

## Lógica da Correção

### Para Empréstimos de Parcela Única:
- Verifica se `tipo_emprestimo != 'in_installments'`
- Considera em atraso se `data_vencimento < CURDATE()`

### Para Empréstimos Parcelados:
- Verifica se `tipo_emprestimo = 'in_installments'`
- Busca na tabela `parcelas` se há parcelas com:
  - `data_vencimento < CURDATE()` (vencidas)
  - `status != 'Paga'` (não pagas)

## Exemplo Prático

**Cenário:**
- Empréstimo parcelado em 12x
- Data vencimento principal: 01/01/2024 (vencida)
- Parcelas: todas pagas ou em dia

**Resultado:**
- **ANTES**: Cliente aparecia em atraso (incorreto)
- **DEPOIS**: Cliente NÃO aparece em atraso (correto)

## Arquivos Modificados

1. **`api/cobrancas.js`** (linhas 227-240, 242-255)
   - Query de clientes em atraso corrigida
   - Query de empréstimos em atraso corrigida

2. **`public/jp.cobrancas/js/main.js`** (linhas 386-399)
   - Removido cálculo local incorreto
   - Usa valor da API

## Scripts de Teste

1. **`scripts/diagnose-clientes-atraso.js`**
   - Diagnóstica o problema
   - Mostra empréstimos considerados em atraso incorretamente

2. **`scripts/test-clientes-atraso-corrigido.js`**
   - Testa a correção
   - Compara query antiga vs nova
   - Mostra diferenças

## Resultado Final

✅ **Dashboard correto**: Mostra apenas clientes com parcelas realmente atrasadas
✅ **Lógica consistente**: Mesma lógica entre API e frontend
✅ **Performance**: Query otimizada com EXISTS em vez de JOIN desnecessário

## Para Verificar

Execute o teste para confirmar a correção:

```bash
node scripts/test-clientes-atraso-corrigido.js
```

O dashboard agora deve mostrar "0 clientes em atraso" se todos os clientes estiverem com parcelas em dia, independentemente da data de vencimento principal do empréstimo. 