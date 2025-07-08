# 🔧 Correção de Empréstimos Antigos

## Problema
Os empréstimos criados antes da correção têm `data_emprestimo` igual a `data_vencimento`, causando confusão na visualização.

## Solução
Execute o script de correção para ajustar as datas dos empréstimos antigos.

## Como Executar

### 1. Via Node.js (Recomendado)
```bash
# No terminal, dentro da pasta jp.sistemas
node scripts/corrigir-datas-emprestimos-antigos.js
```

### 2. Via npm script (Se houver)
```bash
npm run corrigir-datas-emprestimos
```

## O que o Script Faz

1. **Identifica empréstimos problemáticos**: Busca registros onde `data_emprestimo = data_vencimento`

2. **Corrige usando `created_at`**: Se disponível, usa a data de criação real do registro

3. **Fallback inteligente**: Se não há `created_at`, assume que foi criado 1 dia antes do vencimento

4. **Processa todos os usuários**: Atualiza automaticamente todos os bancos `jpcobrancas_*`

## Exemplo de Saída
```
🔧 Iniciando correção de datas dos empréstimos antigos...
📋 Encontrados 3 bancos de cobranças para corrigir

🔍 Processando banco: jpcobrancas_usuario1
  📊 Encontrados 5 empréstimos para corrigir
    ✅ Empréstimo ID 1: 2025-01-08 → 2025-01-07
    ✅ Empréstimo ID 3: 2025-01-08 → 2025-01-06
    
🎉 Correção concluída! Total de empréstimos corrigidos: 12
✨ Script de correção finalizado!
```

## Resultado Esperado

Após executar o script:

- ✅ **Empréstimos antigos**: Datas corrigidas (`data_emprestimo` ≠ `data_vencimento`)
- ✅ **Empréstimos novos**: Já criados corretamente
- ✅ **Visualização**: Ambas as colunas mostrarão informações distintas

## Backup Automático
O script é seguro e apenas corrige registros problemáticos. Não deleta dados.

## Verificação
Após executar, verifique no sistema se as datas estão aparecendo corretamente nas tabelas. 