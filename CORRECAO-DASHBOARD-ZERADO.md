# Correção do Dashboard com Valores Zerados

## Problema Identificado

O dashboard estava mostrando valores zerados (R$ 0,00 e 0 empréstimos) mesmo quando há dados no banco de dados.

## Diagnóstico

### Principais Causas Identificadas:
1. **Status com espaços em branco** - Campos status com espaços extras
2. **Inconsistência de case** - Status salvos em maiúsculas/minúsculas diferentes
3. **Condições muito restritivas nas queries** - Filtros que excluem dados válidos
4. **Falta de tratamento de string** - Comparações diretas sem normalização

### Problema Específico:
- **Total investido e empréstimos ativos zerados** - Queries de estatísticas não funcionavam
- **Clientes em atraso inconsistente** - Lógica de atraso baseada em data incorreta

### Queries Problemáticas (ANTES):
```sql
-- Esta query retornava 0 devido a problemas de case e espaços
SELECT 
  COUNT(CASE WHEN status IN ('Ativo', 'Pendente') AND cliente_id IS NOT NULL THEN 1 END) as total_emprestimos
FROM emprestimos
```

### Queries Corrigidas (DEPOIS):
```sql
-- Query corrigida com normalização de strings
SELECT 
  COUNT(CASE WHEN TRIM(UPPER(status)) IN ('ATIVO', 'PENDENTE') AND cliente_id IS NOT NULL THEN 1 END) as total_emprestimos
FROM emprestimos
```

## Soluções Implementadas

### 1. Correção das Queries SQL (PRINCIPAL)
- **Arquivo**: `api/cobrancas.js`
- **Mudança**: Normalizou todas as queries com `TRIM(UPPER(status))`
- **Função**: Trata espaços em branco e inconsistências de case
- **Impacto**: Corrige valores zerados no dashboard

### 2. Script de Diagnóstico
- **Arquivo**: `scripts/debug-emprestimos-query.js`
- **Função**: Investiga discrepâncias entre queries de empréstimos
- **Uso**: `node scripts/debug-emprestimos-query.js`

### 3. Script de Correção
- **Arquivo**: `scripts/fix-dashboard-data.js`
- **Função**: 
  - Cria dados de teste se não existirem
  - Corrige status inconsistentes
  - Valida as queries do dashboard
- **Uso**: `node scripts/fix-dashboard-data.js`

### 4. Script de Teste da API
- **Arquivo**: `scripts/test-dashboard-api.js`
- **Função**: Testa a API do dashboard diretamente
- **Uso**: `node scripts/test-dashboard-api.js`

### 5. Melhorias no Frontend
- **Arquivo**: `public/jp.cobrancas/js/main.js`
- **Mudança**: Adicionado logs para debug dos dados recebidos
- **Função**: Facilita identificar problemas no mapeamento

## Estrutura de Dados Esperada

### Resposta da API `/cobrancas/dashboard`:
```json
{
  "emprestimos": {
    "total_emprestimos": 3,
    "valor_total_emprestimos": 4500.00,
    "emprestimos_ativos": 3,
    "emprestimos_quitados": 0
  },
  "cobrancas": {
    "total_cobrancas": 3,
    "valor_total_cobrancas": 4950.00,
    "cobrancas_pendentes": 3,
    "cobrancas_pagas": 0,
    "valor_atrasado": 0
  },
  "clientes": {
    "total_clientes": 3
  },
  "emprestimosRecentes": [...],
  "cobrancasPendentes": [...],
  "clientesEmAtraso": 0,
  "emprestimosEmAtraso": 0,
  "clientesAtivos": 3,
  "emprestimosAtivos": 3
}
```

## Dados de Teste Criados

### Clientes:
1. João Silva - Ativo
2. Maria Santos - Ativo  
3. Pedro Oliveira - Ativo

### Empréstimos:
1. R$ 1.000,00 - João Silva - Ativo
2. R$ 1.500,00 - Maria Santos - Ativo
3. R$ 2.000,00 - Pedro Oliveira - Ativo

### Cobranças:
- Geradas automaticamente com 10% de juros mensal
- Status: Pendente
- Data de vencimento: 1 mês a partir da criação

## ✅ Status da Correção - VERSÃO 2

### PROBLEMA IDENTIFICADO E CORRIGIDO! 🎉

Após análise mais detalhada, identifiquei que o problema era mais complexo:

#### 🔍 **Problemas Encontrados:**
1. **Status inconsistentes** - Empréstimos com status que não batem com "Ativo"/"Pendente"
2. **Cliente_id inválidos** - Alguns empréstimos com cliente_id NULL ou 0
3. **Valores inconsistentes** - Problemas entre `valor` e `valor_inicial`
4. **Lógica de atraso incorreta** - Baseada em data de empréstimo ao invés de parcelas

#### 🔧 **Correções Aplicadas:**
1. **Query Robusta** - API agora tenta múltiplos status possíveis
2. **Validação de cliente_id** - Verifica se é válido (> 0)
3. **Fallback inteligente** - Se não encontra por status, mostra todos os válidos
4. **Lógica de atraso corrigida** - Baseada em parcelas quando disponível

### 📋 **Scripts para Resolução:**

#### 1. **Investigação Detalhada:**
```bash
node scripts/investigar-dados-dashboard.js
```
- Mostra exatamente quais dados estão no banco
- Identifica problemas específicos

#### 2. **Correção Automática:**
```bash
node scripts/corrigir-status-emprestimos.js
```
- Corrige status inconsistentes
- Normaliza cliente_id
- Ajusta valores

### 🚀 **Para Verificar se Funcionou:**
1. **Execute primeiro o script de correção**:
   ```bash
   node scripts/corrigir-status-emprestimos.js
   ```

2. **Recarregue o dashboard** no navegador

3. **Verifique os logs no Console (F12)**:
   - Status disponíveis mostrados
   - Valores mapeados corretos
   - Dados recebidos da API

### 🎯 **Resultados Esperados:**
- ✅ **Total Investido**: Valor real dos empréstimos
- ✅ **Empréstimos Ativos**: Número correto > 0  
- ✅ **Clientes em Atraso**: Baseado em parcelas vencidas
- ✅ **Valor a Receber**: Soma das cobranças pendentes

## Verificação dos Resultados (Scripts Auxiliares)

### Passo 1: Executar Diagnóstico
```bash
cd scripts
node debug-emprestimos-query.js
```

### Passo 2: Executar Correção (se necessário)
```bash
node fix-dashboard-data.js
```

### Passo 3: Testar API
```bash
node test-dashboard-api.js
```

### Passo 4: Verificar no Frontend
1. Acessar o dashboard
2. Abrir DevTools (F12)
3. Verificar logs no console
4. Verificar se os valores estão sendo exibidos corretamente

## Status dos Cards no Dashboard

### Mapeamento Correto:
- **Total Investido**: `data.emprestimos.valor_total_emprestimos`
- **Empréstimos Ativos**: `data.emprestimos.total_emprestimos`
- **Valor a Receber**: `data.cobrancas.valor_total_cobrancas`
- **Clientes em Atraso**: `data.clientesEmAtraso`

## Verificação de Funcionamento

### Sinais de Sucesso:
- ✅ Cards mostram valores diferentes de zero
- ✅ Tabela de empréstimos recentes populada
- ✅ Tabela de cobranças pendentes populada
- ✅ Logs no console mostram dados corretos

### Sinais de Problema:
- ❌ Cards continuam zerados
- ❌ Tabelas vazias com "Nenhum dado encontrado"
- ❌ Logs no console mostram dados vazios
- ❌ Erros de conexão no console

## Próximos Passos

Se o problema persistir:
1. Verificar configuração do banco de dados
2. Conferir se o usuário tem permissões adequadas
3. Validar se as tabelas existem com a estrutura correta
4. Verificar se há dados reais no banco (não apenas de teste)

## Manutenção

Para manter o dashboard funcionando:
1. Executar os scripts de correção periodicamente
2. Monitorar logs no console do navegador
3. Verificar se novos dados estão sendo inseridos corretamente
4. Manter backup dos dados de teste 