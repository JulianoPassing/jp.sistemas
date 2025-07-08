# Correção do Dashboard com Valores Zerados

## Problema Identificado

O dashboard está mostrando valores zerados (R$ 0,00 e 0 empréstimos) mesmo quando há dados no banco de dados.

## Diagnóstico

### Possíveis Causas:
1. **Falta de dados de teste** - Banco de dados vazio
2. **Condições muito restritivas nas queries** - Filtros que excluem dados válidos
3. **Inconsistência nos status** - Dados com status diferentes do esperado
4. **Problema na conexão de banco** - Não conectando ao banco correto
5. **Mapeamento incorreto no frontend** - JavaScript não mapeando corretamente os dados

### Queries Problemáticas:
```sql
-- Esta query pode retornar 0 se:
-- 1. Não há empréstimos com status 'Ativo' ou 'Pendente'
-- 2. Não há empréstimos com cliente_id preenchido
SELECT 
  COUNT(CASE WHEN status IN ('Ativo', 'Pendente') AND cliente_id IS NOT NULL THEN 1 END) as total_emprestimos
FROM emprestimos
```

## Soluções Implementadas

### 1. Script de Diagnóstico
- **Arquivo**: `scripts/test-dashboard-data.js`
- **Função**: Verifica se há dados no banco e testa as queries específicas
- **Uso**: `node scripts/test-dashboard-data.js`

### 2. Script de Correção
- **Arquivo**: `scripts/fix-dashboard-data.js`
- **Função**: 
  - Cria dados de teste se não existirem
  - Corrige status inconsistentes
  - Valida as queries do dashboard
- **Uso**: `node scripts/fix-dashboard-data.js`

### 3. Script de Teste da API
- **Arquivo**: `scripts/test-dashboard-api.js`
- **Função**: Testa a API do dashboard diretamente
- **Uso**: `node scripts/test-dashboard-api.js`

### 4. Melhorias no Frontend
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

## Verificação dos Resultados

### Passo 1: Executar Diagnóstico
```bash
cd scripts
node test-dashboard-data.js
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