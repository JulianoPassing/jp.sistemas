# 💰 Dashboard - Valor Inicial dos Empréstimos

## ✅ Configuração Aplicada

O dashboard do JP.Cobranças agora mostra o **VALOR INICIAL** dos empréstimos no campo "Total Investido".

### 📊 Como Funciona

#### 1. **Coluna Utilizada**
- **Tabela**: `emprestimos`
- **Coluna**: `valor` (representa o valor inicial do empréstimo)
- **Query**: `SUM(valor)` - soma todos os valores iniciais

#### 2. **Exemplo com Seus Dados**
```sql
-- Seus empréstimos no banco jpcobrancas_cobranca:
ID 4: R$ 6.000,00 (valor inicial)
ID 3: R$ 1.000,00 (valor inicial)  
ID 2: R$ 8.100,00 (valor inicial)

-- Total exibido no dashboard:
Total Investido: R$ 15.100,00
```

### 🔧 **Implementação**

#### API (api/cobrancas.js)
```javascript
// Query para somar o VALOR INICIAL de todos os empréstimos
[emprestimosStats] = await connection.execute(`
  SELECT 
    COUNT(*) as total_emprestimos,
    COALESCE(SUM(valor), 0) as valor_total_emprestimos,
    COUNT(*) as emprestimos_ativos,
    0 as emprestimos_quitados
  FROM emprestimos
  WHERE valor > 0
`);
```

#### Frontend
- **Campo**: "Total Investido"
- **Valor**: Soma de todos os valores iniciais
- **Fonte**: `valor_total_emprestimos` da API

### 🎯 **Diferenças Importantes**

| Campo | Significado |
|-------|------------|
| **Valor Inicial** | O valor que foi emprestado originalmente |
| **Valor Atual** | Valor com juros, multas e correções |
| **Valor a Receber** | Valor que ainda falta ser pago |

### 📱 **Como Verificar**

1. **Teste conexão**:
   ```bash
   node scripts/test-cobranca-dashboard.js
   ```

2. **Resultado esperado**:
   ```
   💰 VALOR INICIAL TOTAL: R$ 15.100,00
   ```

3. **Reinicie o servidor**:
   ```bash
   pm2 restart ecosystem.config.js
   ```

4. **Acesse o dashboard** e verifique se mostra **R$ 15.100,00** em "Total Investido"

### ✅ **Confirmação**

O dashboard agora mostra corretamente o **valor inicial** dos empréstimos, que é o valor que foi realmente investido/emprestado aos clientes.

---
**Data**: Janeiro 2025  
**Status**: ✅ Configurado  
**Banco**: jpcobrancas_cobranca  
**Usuário**: cobranca 