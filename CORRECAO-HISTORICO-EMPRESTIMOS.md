# Correção do Histórico de Empréstimos - JP.Cobranças

## Problemas Identificados

Na página `emprestimos.html`, o histórico de empréstimos apresentava dois problemas:

1. **Status incorreto**: Empréstimos aparecendo como "Atrasado" mesmo quando suas parcelas estavam em dia
2. **Duplicatas**: Empréstimos aparecendo duplicados na listagem

O problema estava na função `renderHistoricoEmprestimos()` que:
- Usava apenas a data de vencimento do empréstimo para determinar status
- Não controlava duplicatas por ID do empréstimo

## Correção Implementada

### Arquivo Modificado
- `public/jp.cobrancas/js/main.js` - Função `renderHistoricoEmprestimos()` (linha 1825)

### Lógica Corrigida

**Antes:**
```javascript
// Sem controle de duplicatas
emprestimos.forEach(emprestimo => {
  if (dataVencimento && dataVencimento < hoje && status !== 'QUITADO') {
    status = 'ATRASADO';
  }
});
```

**Depois:**
```javascript
// Usar Map para eliminar duplicatas por ID
const emprestimosUnicos = new Map();

for (const emprestimo of emprestimos) {
  // Verificar se já processamos este empréstimo
  if (emprestimosUnicos.has(emprestimo.id)) {
    console.log(`Empréstimo duplicado ignorado: ID ${emprestimo.id}`);
    continue;
  }
  
  // Verificar status baseado em parcelas para empréstimos parcelados
  try {
    const parcelas = await apiService.getParcelasEmprestimo(emprestimo.id);
    if (parcelas && parcelas.length > 0) {
      // Tem parcelas - verificar status das parcelas individuais
      const parcelasAtrasadas = parcelas.filter(p => {
        const dataVencParcela = new Date(p.data_vencimento);
        return dataVencParcela < hoje && (p.status !== 'Paga');
      });
      
      const parcelasPagas = parcelas.filter(p => p.status === 'Paga');
      
      // Determinar status real baseado nas parcelas
      if (parcelasPagas.length === parcelas.length) {
        status = 'QUITADO';
      } else if (parcelasAtrasadas.length > 0) {
        status = 'ATRASADO';
      } else {
        status = 'ATIVO';
      }
    }
  } catch (error) {
    console.error('Erro ao verificar parcelas', error);
  }
  
  // Marcar empréstimo como processado para evitar duplicatas
  emprestimosUnicos.set(emprestimo.id, true);
}
```

### Regras Implementadas

#### Controle de Duplicatas
1. **Map de controle**: Usa `Map` para rastrear IDs já processados
2. **Verificação prévia**: Verifica se o ID já foi processado antes de renderizar
3. **Log de debug**: Registra duplicatas ignoradas no console
4. **Unicidade garantida**: Cada empréstimo aparece apenas uma vez

#### Status Baseado em Parcelas
1. **QUITADO**: Todas as parcelas foram pagas
2. **ATRASADO**: Pelo menos uma parcela vencida e não paga
3. **ATIVO**: Parcelas existem mas nenhuma está vencida
4. **Fallback**: Para empréstimos sem parcelas, usa data de vencimento do empréstimo

## Como Testar

### Execução do Teste
```bash
chmod +x corrigir-historico-emprestimos.sh
./corrigir-historico-emprestimos.sh
```

### Verificação Manual
1. Acesse `emprestimos.html` no navegador
2. Verifique o histórico de empréstimos
3. Confirme que apenas empréstimos com parcelas realmente vencidas aparecem como "Atrasado"

## Cenários Testados

### Empréstimo Parcelado com Parcelas em Dia
- **Antes**: Status "Atrasado" (baseado na data final do empréstimo)
- **Depois**: Status "Ativo" (baseado nas parcelas individuais)

### Empréstimo Parcelado com Parcelas Atrasadas
- **Antes**: Status "Atrasado" ✅
- **Depois**: Status "Atrasado" ✅ (mas agora por motivo correto)

### Empréstimo Parcelado Totalmente Pago
- **Antes**: Status baseado na data final
- **Depois**: Status "Quitado" (todas as parcelas pagas)

## Scripts Criados

1. **`scripts/test-historico-emprestimos-corrigido.js`** - Teste detalhado dos dados
2. **`scripts/test-duplicatas-historico-emprestimos.js`** - Teste específico para duplicatas
3. **`corrigir-historico-emprestimos.sh`** - Script de execução e verificação
4. **`corrigir-duplicatas-historico-emprestimos.sh`** - Script específico para duplicatas

## Resultado Final

O histórico de empréstimos agora:

1. **Elimina duplicatas**: Cada empréstimo aparece apenas uma vez
2. **Status correto**: Baseado no estado real das parcelas
3. **Sem falsos positivos**: Apenas empréstimos com parcelas vencidas aparecem como "Atrasado"
4. **Logs de debug**: Console mostra duplicatas ignoradas para debug
5. **Informações precisas**: Dados confiáveis para tomada de decisões

### Exemplo de Correção

**Antes:**
```
testeprazo    | R$ 10.000,20 | 20/07/2025 | ATIVO
testeprazo    | R$ 10.000,20 | 20/07/2025 | ATIVO  ← DUPLICATA
teste         | R$ 1.300,00  | 08/07/2025 | ATIVO
teste         | R$ 1.300,00  | 08/07/2025 | ATIVO  ← DUPLICATA
```

**Depois:**
```
testeprazo    | R$ 10.000,20 | 20/07/2025 | ATIVO
teste         | R$ 1.300,00  | 08/07/2025 | ATIVO
testeparcelado| R$ 8.100,00  | 30/06/2025 | ATIVO
```

---

**Data da Correção**: Implementada em resposta ao problema reportado pelo usuário
**Compatibilidade**: Funciona tanto para empréstimos parcelados quanto de parcela única
**Impacto**: Melhora significativa na precisão das informações exibidas no histórico 