# Correção Completa da Página de Cobranças

## Problemas Identificados

### 1. Empréstimos em Dia Aparecendo como Atrasados
- **Problema**: Empréstimos com parcelas em dia estavam sendo marcados como "Em Atraso"
- **Causa**: Lógica baseada apenas na data de vencimento do empréstimo, ignorando parcelas

### 2. Empréstimos Duplicados na Lista
- **Problema**: Cada empréstimo estava aparecendo múltiplas vezes na tabela
- **Causa**: Lógica de renderização que não garantia unicidade por ID

### 3. Vencimento e Valor Incorretos para Empréstimos Parcelados
- **Problema**: Empréstimos parcelados mostravam valor total e vencimento do empréstimo
- **Causa**: Não considerava que se deve cobrar apenas a próxima parcela
- **Impacto**: Confusão na cobrança (cobrar R$ 8.100 quando deveria cobrar R$ 1.000 da parcela)

## Soluções Implementadas

### Correção 1: Lógica de Atraso Baseada em Parcelas

#### Arquivo Modificado
`public/jp.cobrancas/js/main.js` - Função `renderCobrancasEmAbertoLista()`

#### Nova Lógica
```javascript
// Para cada empréstimo, verificar se tem parcelas
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
    statusReal = 'em_dia';
  }
}
```

#### Regras de Status
- **🟢 Em Dia**: Parcelas existem mas nenhuma está vencida
- **🔴 Em Atraso**: Pelo menos uma parcela está vencida e não paga
- **✅ Quitado**: Todas as parcelas estão pagas
- **📅 Fallback**: Para empréstimos sem parcelas, usa data de vencimento

### Correção 2: Eliminação de Duplicatas

#### Arquivo Modificado
`public/jp.cobrancas/js/main.js` - Função `renderCobrancasEmAbertoLista()`

#### Nova Lógica
```javascript
// Criar um Map para garantir que cada empréstimo apareça apenas uma vez
const emprestimosUnicos = new Map();
emAberto.forEach(emp => {
  if (!emprestimosUnicos.has(emp.id)) {
    emprestimosUnicos.set(emp.id, emp);
  }
});

// Array para armazenar as linhas da tabela
const linhasTabela = [];

// Processar apenas empréstimos únicos
for (const emp of emprestimosUnicos.values()) {
  // ... processar cada empréstimo ...
  linhasTabela.push(htmlDaLinha);
}

// Inserir todas as linhas de uma vez
tbody.innerHTML = linhasTabela.join('');
```

#### Melhorias
- **Map**: Garante unicidade por ID
- **Array**: Constrói todas as linhas antes de inserir
- **Performance**: Menor manipulação do DOM
- **Logs**: Debug para verificar quantos empréstimos únicos foram encontrados

### Correção 3: Vencimento e Valor Precisos

#### Arquivo Modificado
`public/jp.cobrancas/js/main.js` - Função `renderCobrancasEmAbertoLista()`

#### Nova Lógica
```javascript
// Variáveis para vencimento e valor corretos
let valorACobrar = emp.valor || 0;
let vencimentoACobrar = emp.data_vencimento;

// Encontrar próxima parcela não paga
const parcelasNaoPagas = parcelas.filter(p => p.status !== 'Paga');
if (parcelasNaoPagas.length > 0) {
  // Ordenar por data de vencimento e pegar a mais próxima
  parcelasNaoPagas.sort((a, b) => new Date(a.data_vencimento) - new Date(b.data_vencimento));
  proximaParcela = parcelasNaoPagas[0];
  
  // Para empréstimos parcelados, usar dados da próxima parcela
  valorACobrar = proximaParcela.valor_parcela || valorACobrar;
  vencimentoACobrar = proximaParcela.data_vencimento || vencimentoACobrar;
}
```

#### Regras de Exibição
- **📅 Vencimento**:
  - Parcelado: Data da próxima parcela não paga
  - Fixo/Juros: Data de vencimento do empréstimo
- **💰 Valor**:
  - Parcelado: Valor da próxima parcela
  - Fixo/Juros: Valor total do empréstimo
- **🎯 Resultado**: Mostra exatamente o que precisa ser cobrado AGORA

## Arquivos Criados

### Scripts de Debug
- `scripts/debug-cobrancas-atraso.js` - Analisa problema de atraso
- `scripts/debug-duplicatas-cobrancas.js` - Analisa duplicatas
- `scripts/test-correcao-atraso.js` - Testa correção de atraso
- `scripts/test-correcao-duplicatas.js` - Testa correção de duplicatas

### Scripts de Execução
- `corrigir-atraso-cobrancas.sh` - Script para corrigir atraso
- `corrigir-duplicatas-cobrancas.sh` - Script para corrigir duplicatas

### Documentação
- `CORRECAO-ATRASO-COBRANCAS.md` - Documentação do problema de atraso
- `CORRECAO-COMPLETA-COBRANCAS.md` - Este arquivo (documentação completa)

## Como Testar

### Teste 1: Atraso Corrigido
```bash
node scripts/test-correcao-atraso.js
```

### Teste 2: Duplicatas Eliminadas
```bash
node scripts/test-correcao-duplicatas.js
```

### Teste Completo
```bash
# Executar ambos os testes
chmod +x corrigir-atraso-cobrancas.sh
chmod +x corrigir-duplicatas-cobrancas.sh

./corrigir-atraso-cobrancas.sh
./corrigir-duplicatas-cobrancas.sh
```

### Teste Manual
1. Acesse: `http://seu-servidor/jp.cobrancas/cobrancas.html`
2. Verifique se:
   - Não há empréstimos duplicados
   - Empréstimos com parcelas em dia mostram "Em Dia"
   - Apenas empréstimos com parcelas vencidas mostram "Em Atraso"
3. Abra o Console (F12) para ver logs de debug

## Resultado Final

### Antes das Correções
- ❌ Empréstimos em dia apareciam como "Em Atraso"
- ❌ Cada empréstimo aparecia múltiplas vezes
- ❌ Interface confusa e incorreta

### Depois das Correções
- ✅ Status calculado corretamente baseado em parcelas
- ✅ Cada empréstimo aparece apenas uma vez
- ✅ Interface limpa e precisa
- ✅ Performance melhorada
- ✅ Logs de debug para futuras manutenções

## Logs de Debug

A página agora inclui logs detalhados no console:
- Quantos empréstimos únicos foram encontrados
- Status calculado para cada empréstimo
- Problemas ao verificar parcelas
- Número de linhas renderizadas

Para ver os logs, abra o Console do navegador (F12) e navegue até a página de cobranças.

---

**Status**: ✅ Correções Completas  
**Data**: Hoje  
**Impacto**: Correção crítica da página de cobranças  
**Arquivos Modificados**: `public/jp.cobrancas/js/main.js`  
**Testes**: Implementados e funcionando 