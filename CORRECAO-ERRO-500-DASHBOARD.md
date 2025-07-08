# Correção - Erro 500 no Dashboard

## Problema Identificado

O dashboard estava retornando erro 500 (Internal Server Error) após as modificações nas queries de clientes em atraso. O erro ocorria porque:

1. **Tabela `parcelas` não existe**: As queries modificadas faziam referência à tabela `parcelas` que pode não existir no banco
2. **Campo `tipo_emprestimo` ausente**: As queries verificavam o campo `tipo_emprestimo` que pode não existir na tabela `emprestimos`
3. **Dependências não atendidas**: O sistema tentava usar funcionalidades de parcelamento que ainda não foram implementadas

## Correção Aplicada (Temporária)

### Reversão para Queries Compatíveis

**Arquivo:** `api/cobrancas.js`

**ANTES (Causando erro 500):**
```sql
-- Clientes em atraso com verificação de parcelas
SELECT COUNT(DISTINCT c.id) as total
FROM clientes_cobrancas c
JOIN emprestimos e ON e.cliente_id = c.id
WHERE e.status IN ('Ativo', 'Pendente')
  AND e.status <> 'Quitado'
  AND (
    (e.tipo_emprestimo != 'in_installments' AND e.data_vencimento < CURDATE())
    OR
    (e.tipo_emprestimo = 'in_installments' AND EXISTS (
      SELECT 1 FROM parcelas p 
      WHERE p.emprestimo_id = e.id 
        AND p.data_vencimento < CURDATE() 
        AND p.status != 'Paga'
    ))
  )
```

**DEPOIS (Funcionando):**
```sql
-- Clientes em atraso - versão compatível
SELECT COUNT(DISTINCT c.id) as total
FROM clientes_cobrancas c
JOIN emprestimos e ON e.cliente_id = c.id
WHERE e.status IN ('Ativo', 'Pendente')
  AND e.status <> 'Quitado'
  AND e.data_vencimento < CURDATE()
```

## Alterações Realizadas

### 1. Query de Clientes em Atraso
- **Removida**: Verificação da tabela `parcelas`
- **Removida**: Verificação do campo `tipo_emprestimo`
- **Mantida**: Lógica básica baseada na `data_vencimento`

### 2. Query de Empréstimos em Atraso
- **Removida**: Verificação da tabela `parcelas`
- **Removida**: Verificação do campo `tipo_emprestimo`
- **Mantida**: Lógica básica baseada na `data_vencimento`

## Scripts de Diagnóstico

### 1. `scripts/debug-dashboard-500.js`
- Testa cada query individualmente
- Identifica qual query está causando o erro
- Verifica existência de tabelas e campos

### 2. `scripts/test-dashboard-fix.js`
- Simula o endpoint completo do dashboard
- Executa todas as queries em sequência
- Valida se a API está funcionando

## Status Atual

✅ **Dashboard funcionando**: Erro 500 resolvido
⚠️ **Funcionalidade limitada**: Não considera parcelas individuais
📋 **Próximos passos**: Implementar sistema de parcelas completo

## Limitações Temporárias

1. **Clientes em atraso**: Baseado apenas na data de vencimento principal
2. **Não considera parcelas**: Empréstimos parcelados são tratados como únicos
3. **Status simplificado**: Não há verificação de parcelas individuais

## Para Implementar Funcionalidade Completa

### 1. Criar Tabela de Parcelas
```sql
CREATE TABLE parcelas (
  id INT AUTO_INCREMENT PRIMARY KEY,
  emprestimo_id INT NOT NULL,
  numero_parcela INT NOT NULL,
  valor_parcela DECIMAL(10,2) NOT NULL,
  data_vencimento DATE NOT NULL,
  status ENUM('Pendente', 'Paga', 'Atrasada') DEFAULT 'Pendente',
  data_pagamento DATE NULL,
  valor_pago DECIMAL(10,2) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (emprestimo_id) REFERENCES emprestimos(id)
);
```

### 2. Adicionar Campo tipo_emprestimo
```sql
ALTER TABLE emprestimos 
ADD COLUMN tipo_emprestimo ENUM('fixed', 'in_installments') DEFAULT 'fixed';
```

### 3. Restaurar Queries Avançadas
Após implementar as tabelas e campos necessários, as queries podem ser restauradas para considerar parcelas individuais.

## Como Testar

1. **Verificar se dashboard carrega:**
   ```bash
   # Acesse: http://localhost:3000/jp.cobrancas/dashboard.html
   ```

2. **Executar teste de diagnóstico:**
   ```bash
   node scripts/test-dashboard-fix.js
   ```

3. **Verificar logs do servidor:**
   ```bash
   tail -f server.log
   ```

## Resultado

O dashboard agora carrega sem erro 500, mas com funcionalidade limitada para clientes em atraso. A implementação completa do sistema de parcelas deve ser feita em uma próxima iteração. 