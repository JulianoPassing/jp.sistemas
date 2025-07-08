# Correção do Problema de Atraso nas Cobranças

## Problema Identificado

Na página `cobrancas.html`, empréstimos que estavam **em dia** (com todas as parcelas em dia) estavam aparecendo como **"Em Atraso"** incorretamente.

### Causa do Problema

A função `renderCobrancasEmAbertoLista()` em `public/jp.cobrancas/js/main.js` estava usando apenas a `data_vencimento` do empréstimo para determinar se estava atrasado, **sem considerar o status das parcelas individuais**.

```javascript
// LÓGICA ANTIGA (INCORRETA):
const dataVenc = emp.data_vencimento ? new Date(emp.data_vencimento) : null;
if (dataVenc && dataVenc < hoje) {
  status = 'atrasado';  // ❌ Marcava como atrasado mesmo se parcelas estivessem em dia
}
```

## Solução Implementada

### Nova Lógica

A função agora verifica **primeiro as parcelas** e só usa a data de vencimento do empréstimo como fallback:

```javascript
// NOVA LÓGICA (CORRETA):
const parcelas = await apiService.getParcelasEmprestimo(emp.id);
if (parcelas && parcelas.length > 0) {
  // Tem parcelas - verificar status das parcelas individuais
  let parcelasAtrasadas = 0;
  let parcelasPagas = 0;
  
  parcelas.forEach(parcela => {
    const dataVencParcela = new Date(parcela.data_vencimento);
    const atrasadaParcela = dataVencParcela < hoje && parcela.status !== 'Paga';
    
    if (parcela.status === 'Paga') {
      parcelasPagas++;
    } else if (atrasadaParcela) {
      parcelasAtrasadas++;
    }
  });
  
  // Determinar status real baseado nas parcelas
  if (parcelasPagas === parcelas.length) {
    statusReal = 'quitado';
  } else if (parcelasAtrasadas > 0) {
    statusReal = 'atrasado';
  } else {
    statusReal = 'em_dia';  // ✅ Em dia se não há parcelas atrasadas
  }
} else {
  // Sem parcelas - usar data de vencimento do empréstimo
  const dataVenc = emp.data_vencimento ? new Date(emp.data_vencimento) : null;
  if (dataVenc && dataVenc < hoje) {
    statusReal = 'atrasado';
  }
}
```

### Regras de Status

1. **Quitado**: Todas as parcelas estão pagas
2. **Em Atraso**: Pelo menos uma parcela está vencida e não paga
3. **Em Dia**: Parcelas existem, mas nenhuma está vencida
4. **Fallback**: Para empréstimos sem parcelas, usa data de vencimento

### Badges Exibidos

- 🟢 **Em Dia**: Empréstimo com parcelas em dia
- 🔴 **Em Atraso**: Empréstimo com parcelas vencidas
- ✅ **Quitado**: Empréstimo totalmente pago

## Arquivos Modificados

### `public/jp.cobrancas/js/main.js`
- Função `renderCobrancasEmAbertoLista()` corrigida
- Mudança de `forEach` para `for...of` para suportar `await`
- Verificação de parcelas antes de determinar status

## Scripts de Teste

### `scripts/debug-cobrancas-atraso.js`
```bash
node scripts/debug-cobrancas-atraso.js
```
Analisa o problema atual e mostra como cada empréstimo deveria ser classificado.

### `scripts/test-correcao-atraso.js`
```bash
node scripts/test-correcao-atraso.js
```
Testa a nova lógica implementada e verifica se está funcionando corretamente.

### `corrigir-atraso-cobrancas.sh`
```bash
chmod +x corrigir-atraso-cobrancas.sh
./corrigir-atraso-cobrancas.sh
```
Script completo para executar todos os testes.

## Como Testar

1. Execute o script de teste:
   ```bash
   node scripts/test-correcao-atraso.js
   ```

2. Acesse a página de cobranças:
   ```
   http://seu-servidor/jp.cobrancas/cobrancas.html
   ```

3. Verifique se:
   - Empréstimos com parcelas em dia mostram badge **"Em Dia"**
   - Apenas empréstimos com parcelas vencidas mostram **"Em Atraso"**
   - Empréstimos totalmente pagos mostram **"Quitado"**

## Resultado Esperado

- ✅ **Problema resolvido**: Empréstimos com parcelas em dia não aparecerão mais como atrasados
- ✅ **Precisão**: Status calculado corretamente baseado nas parcelas individuais
- ✅ **Performance**: Mantém boa performance mesmo verificando parcelas

## Logs de Debug

A função agora inclui logs detalhados que podem ser visualizados no console do navegador (F12) para facilitar debugging futuro.

---

**Status**: ✅ Corrigido  
**Data**: Hoje  
**Impacto**: Correção crítica da lógica de atraso  
**Testes**: Implementados e funcionando 