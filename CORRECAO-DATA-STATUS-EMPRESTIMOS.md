# Correção - Problemas de Data e Status dos Empréstimos

## Problema Identificado

Usuários relataram que ao editar a data de vencimento de um empréstimo:

1. **Data sendo salva incorretamente**: Data escolhida (dia 15) era salva como dia 14
2. **Status não atualizando**: Mesmo alterando a data, o status continuava como "Em Atraso"

## Causas dos Problemas

### 1. Problema de Fuso Horário
**Causa**: A função `formatDateForInput()` no frontend usava `toISOString()` que converte para UTC, causando perda de um dia em alguns fusos horários.

**Código problemático:**
```javascript
// ANTES (PROBLEMÁTICO)
formatDateForInput: (dateString) => {
  const date = new Date(dateString);
  return date.toISOString().split('T')[0]; // ❌ Perde um dia no fuso horário
}
```

**Exemplo do problema:**
```javascript
// Usuário seleciona: 2024-01-15
// Sistema salva: 2024-01-14 (um dia a menos)
```

### 2. Falta de Recálculo de Status
**Causa**: A API não recalculava o status automaticamente quando a data de vencimento era alterada.

**Comportamento problemático:**
```javascript
// 1. Empréstimo com data vencida → Status: "Em Atraso"
// 2. Usuário edita data para o futuro → Status: "Em Atraso" (não mudou)
// 3. Sistema não recalcula automaticamente
```

## Soluções Implementadas

### 1. Correção da Função de Formatação de Data

**Arquivo:** `public/jp.cobrancas/js/main.js`

```javascript
// DEPOIS (CORRIGIDO)
formatDateForInput: (dateString) => {
  if (!dateString) return '';
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return '';
    
    // ✅ CORREÇÃO: Evitar problema de fuso horário
    // Usar componentes locais em vez de toISOString()
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  } catch (error) {
    console.error('Erro ao formatar data para input:', error);
    return '';
  }
}
```

### 2. Recálculo Automático de Status

**Arquivo:** `api/cobrancas.js`

Adicionado no endpoint `PUT /emprestimos/:id`:

```javascript
// ✅ CORREÇÃO: Recalcular status automaticamente quando data é alterada
try {
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const dataVencimento = new Date(data_vencimento);
  dataVencimento.setHours(0, 0, 0, 0);
  
  let novoStatus = status;
  
  // Só recalcular se não foi explicitamente definido como 'Quitado'
  if (status !== 'Quitado') {
    if (numeroParcelasNum > 1) {
      // Para empréstimos parcelados, verificar status das parcelas
      const [parcelas] = await connection.execute(`
        SELECT COUNT(*) as total,
               SUM(CASE WHEN status = 'Paga' THEN 1 ELSE 0 END) as pagas,
               SUM(CASE WHEN data_vencimento < CURDATE() AND status != 'Paga' THEN 1 ELSE 0 END) as atrasadas
        FROM parcelas WHERE emprestimo_id = ?
      `, [id]);
      
      if (parcelas[0].pagas === parcelas[0].total) {
        novoStatus = 'Quitado';
      } else if (parcelas[0].atrasadas > 0) {
        novoStatus = 'Em Atraso';
      } else {
        novoStatus = 'Ativo';
      }
    } else {
      // Para empréstimos de parcela única, usar data de vencimento
      if (dataVencimento < hoje) {
        novoStatus = 'Em Atraso';
      } else {
        novoStatus = 'Ativo';
      }
    }
    
    // Atualizar status se mudou
    if (novoStatus !== status) {
      await connection.execute(`
        UPDATE emprestimos 
        SET status = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `, [novoStatus, id]);
      
      console.log(`Status do empréstimo ${id} recalculado: ${status} → ${novoStatus}`);
    }
  }
} catch (statusError) {
  console.warn('Erro ao recalcular status:', statusError);
}
```

## Scripts de Correção

### 1. Script de Teste
**Arquivo:** `scripts/test-problema-data-status.js`

- Testa o problema de fuso horário
- Identifica empréstimos com status inconsistente
- Simula o processo de edição problemática

**Execução:**
```bash
node scripts/test-problema-data-status.js
```

### 2. Script de Correção
**Arquivo:** `scripts/fix-data-status-emprestimos.js`

- Corrige empréstimos com status inconsistente
- Recalcula status baseado na data atual
- Diferencia empréstimos parcelados de valor único

**Execução:**
```bash
node scripts/fix-data-status-emprestimos.js
```

## Fluxo Corrigido

### Antes da Correção ❌
```
1. Usuário seleciona data: 15/01/2024
2. Sistema salva: 14/01/2024 (problema de fuso horário)
3. Status permanece: "Em Atraso" (não recalcula)
4. Usuário confuso com data e status incorretos
```

### Depois da Correção ✅
```
1. Usuário seleciona data: 15/01/2024
2. Sistema salva: 15/01/2024 (data correta)
3. Status recalculado: "Ativo" (se data no futuro)
4. Interface mostra dados corretos
```

## Tipos de Empréstimos Suportados

### 1. Empréstimos de Parcela Única
- Status baseado na data de vencimento
- Se data < hoje → "Em Atraso"
- Se data ≥ hoje → "Ativo"

### 2. Empréstimos Parcelados
- Status baseado no estado das parcelas
- Se todas pagas → "Quitado"
- Se alguma atrasada → "Em Atraso"
- Se nenhuma atrasada → "Ativo"

## Verificação da Correção

Para verificar se a correção está funcionando:

1. **Teste de Data:**
   - Edite um empréstimo e altere a data
   - Verifique se a data salva é exatamente a selecionada

2. **Teste de Status:**
   - Edite data vencida para data futura
   - Verifique se status muda de "Em Atraso" para "Ativo"

3. **Teste de Parcelas:**
   - Edite empréstimo parcelado
   - Verifique se status reflete estado das parcelas

## Impacto da Correção

- ✅ Datas são salvas corretamente
- ✅ Status é recalculado automaticamente
- ✅ Interface mostra informações precisas
- ✅ Usuários não precisam mais editar status manualmente
- ✅ Consistência entre data e status

## Compatibilidade

A correção é **totalmente compatível** com:
- Empréstimos existentes
- Funcionalidades atuais
- Outros módulos do sistema
- Diferentes fusos horários

## Próximos Passos

1. **Testar** a correção em ambiente de produção
2. **Monitorar** logs para identificar outros problemas
3. **Aplicar** script de correção para dados existentes
4. **Documentar** para equipe técnica 