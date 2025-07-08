# Dashboard - Valor Total Investido (Sem Juros)

## Alteração Implementada

O campo **"TOTAL INVESTIDO"** no dashboard agora exibe apenas o valor inicial dos empréstimos (sem juros), conforme solicitado.

## Modificação Realizada

### Arquivo: `api/cobrancas.js`
**Linha 204** - Query do dashboard modificada:

**ANTES:**
```sql
SUM(CASE WHEN status IN ('Ativo', 'Pendente') AND cliente_id IS NOT NULL THEN valor ELSE 0 END) as valor_total_emprestimos
```

**DEPOIS:**
```sql
SUM(CASE WHEN status IN ('Ativo', 'Pendente') AND cliente_id IS NOT NULL THEN COALESCE(valor_inicial, valor) ELSE 0 END) as valor_total_emprestimos
```

## Lógica da Alteração

1. **COALESCE(valor_inicial, valor)**: Prioriza o campo `valor_inicial` se existir, caso contrário usa `valor`
2. **Compatibilidade**: Mantém compatibilidade com empréstimos antigos que podem não ter o campo `valor_inicial`
3. **Filtros**: Considera apenas empréstimos com status 'Ativo' ou 'Pendente' e que tenham cliente associado

## Diferença Entre os Campos

- **`valor_inicial`**: Valor que o cliente pegou emprestado (sem juros)
- **`valor`**: Valor total a ser pago (com juros incluídos)

## Exemplo Prático

**Empréstimo:**
- Valor inicial: R$ 1.000,00
- Juros mensal: 5%
- Valor total: R$ 1.050,00

**Dashboard:**
- **ANTES**: Mostrava R$ 1.050,00 (com juros)
- **DEPOIS**: Mostra R$ 1.000,00 (valor inicial investido)

## Impacto

✅ **TOTAL INVESTIDO**: Agora mostra apenas o valor inicial (sem juros)
✅ **VALOR A RECEBER**: Continua mostrando o valor total com juros e multas
✅ **Compatibilidade**: Mantida para empréstimos antigos

## Teste

Execute o script de teste para verificar a alteração:

```bash
node scripts/test-dashboard-valor-inicial.js
```

O script mostra:
- Comparação entre valor com juros vs valor inicial
- Diferença calculada (juros removidos)
- Resultado final do dashboard

## Resultado

O dashboard agora exibe corretamente:
- **Total Investido**: Soma dos valores iniciais dos empréstimos ativos/pendentes
- **Valor a Receber**: Soma dos valores totais a receber (com juros e multas)

Esta alteração permite ao usuário distinguir claramente entre:
1. Quanto foi **investido** (capital inicial)
2. Quanto será **recebido** (capital + juros + multas) 