# Empréstimos - Nova Coluna Valor Final

## 🎯 Funcionalidade Implementada

Adicionada nova coluna **"Valor Final"** na lista de empréstimos em `emprestimos.html`, mostrando o valor total que será recebido do cliente.

## 📋 Estrutura da Tabela

A tabela agora possui as seguintes colunas:

1. **Cliente** - Nome do cliente
2. **Valor Inicial** - Valor emprestado ao cliente
3. **Valor Final** - Valor total a receber (com juros)
4. **Data Empréstimo** - Data em que o empréstimo foi concedido
5. **Vencimento** - Data de vencimento do empréstimo
6. **Status** - Status atual do empréstimo
7. **Ações** - Botões de ação (Ver)

## 🧮 Cálculo do Valor Final

### Para Empréstimos Parcelados (`in_installments`):
```
Valor Final = Valor da Parcela × Número de Parcelas
```

### Para Empréstimos Fixos (`fixed`):
```
Valor Final = Valor Inicial × (1 + Juros Mensal ÷ 100)
```

## 🔧 Modificações Implementadas

### 1. API (`api/cobrancas.js`)
```sql
-- Query atualizada para incluir valor_final
SELECT DISTINCT e.*, c.nome as cliente_nome, c.telefone as telefone,
       CASE 
         WHEN e.tipo_emprestimo = 'in_installments' THEN (e.valor_parcela * e.numero_parcelas)
         ELSE e.valor * (1 + (e.juros_mensal / 100))
       END as valor_final
FROM emprestimos e
LEFT JOIN clientes_cobrancas c ON e.cliente_id = c.id
ORDER BY e.created_at DESC
```

### 2. Frontend (`emprestimos.html`)
- Adicionada coluna "Valor Final" na tabela
- Atualizado HTML para mostrar o valor_final
- Ajustado colspan para 7 colunas em todas as linhas
- Mantidas funcionalidades de busca e filtros

## 📊 Exemplo de Resultado

```
┌─────────────────┬──────────────┬─────────────┬────────────────┬─────────────┬────────┬─────────┐
│ Cliente         │ Valor Inicial│ Valor Final │ Data Empréstimo│ Vencimento  │ Status │ Ações   │
├─────────────────┼──────────────┼─────────────┼────────────────┼─────────────┼────────┼─────────┤
│ testeprazo      │ R$ 10.000,20 │ R$ 10.500,21│ 20/07/2025     │ 20/07/2025  │ ATIVO  │ Ver     │
│ testeparcelado  │ R$ 8.100,00  │ R$ 8.100,00 │ 30/06/2025     │ 30/06/2025  │ ATIVO  │ Ver     │
│ teste           │ R$ 1.300,00  │ R$ 1.365,00 │ 08/07/2025     │ 08/07/2025  │ ATIVO  │ Ver     │
└─────────────────┴──────────────┴─────────────┴────────────────┴─────────────┴────────┴─────────┘
```

## 💡 Benefícios

1. **Visibilidade Financeira**: Comparação clara entre valor emprestado e valor total a receber
2. **Cálculo Automático**: Valor final calculado automaticamente baseado no tipo de empréstimo
3. **Análise de Rentabilidade**: Facilita análise de lucro por empréstimo
4. **Compatibilidade**: Mantém todas as funcionalidades existentes (filtros, busca, etc.)

## 🧪 Como Testar

### Executar Script de Teste:
```bash
bash testar-emprestimos-valor-final.sh
```

### Teste Manual:
1. Reinicie o servidor
2. Abra `emprestimos.html` no navegador
3. Verifique se a tabela possui 7 colunas
4. Confirme que os valores finais são calculados corretamente
5. Teste os filtros de busca

## 📈 Cálculos Esperados

### Exemplo com Empréstimo Fixo:
- **Valor Inicial**: R$ 1.000,00
- **Juros Mensal**: 5%
- **Valor Final**: R$ 1.000,00 × (1 + 5%) = R$ 1.050,00

### Exemplo com Empréstimo Parcelado:
- **Valor Inicial**: R$ 1.000,00
- **Parcelas**: 10x R$ 120,00
- **Valor Final**: 10 × R$ 120,00 = R$ 1.200,00

## 🔍 Arquivos Modificados

- `api/cobrancas.js` - Query atualizada para incluir valor_final
- `public/jp.cobrancas/emprestimos.html` - Tabela atualizada com nova coluna
- `scripts/test-emprestimos-valor-final.js` - Script de teste
- `testar-emprestimos-valor-final.sh` - Script de execução

## ✅ Compatibilidade

- Mantém funcionalidade de remoção de duplicatas
- Mantém verificação de status baseado em parcelas
- Mantém funcionalidades de busca e filtros
- Responsiva para diferentes tamanhos de tela

A nova funcionalidade está totalmente integrada ao sistema existente e não afeta outras funcionalidades. 