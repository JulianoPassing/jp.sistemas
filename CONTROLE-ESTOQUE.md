# Controle de Estoque - J.P Sistemas

## Funcionalidade Implementada

Foi implementado o controle automático de estoque que retira produtos do estoque quando um pedido é concluído através dos módulos:

- **Pedidos** (`pedidos.html`)
- **Caixa** (`caixa.html`) 
- **Mesas** (`mesas.html`)

## Como Funciona

### 1. Atualização Automática do Estoque

Quando um pedido é marcado como "Concluído", o sistema automaticamente:

1. **Busca o estoque atual** de cada produto no pedido
2. **Subtrai a quantidade vendida** do estoque atual
3. **Atualiza o estoque** no banco de dados
4. **Permite estoque negativo** conforme solicitado

### 2. Pontos de Ativação

O controle de estoque é ativado nos seguintes momentos:

#### Via Pedidos (`pedidos.html`)
- Quando o usuário clica em "Concluir Pedido"
- Quando o status é alterado para "Concluído"

#### Via Caixa (`caixa.html`)
- Quando uma venda é finalizada (status "Concluído" é definido automaticamente)

#### Via Mesas (`mesas.html`)
- Quando uma mesa é finalizada (status "Concluído" é definido automaticamente)

### 3. APIs Modificadas

#### POST `/api/pedidos`
- **Antes**: Apenas criava o pedido
- **Depois**: Cria o pedido E atualiza o estoque se status for "Concluído"

#### PUT `/api/pedidos/:id`
- **Antes**: Apenas atualizava o pedido
- **Depois**: Atualiza o pedido E atualiza o estoque se status mudar para "Concluído"

### 4. Lógica de Controle

```javascript
// Verifica se está concluindo o pedido
const estaConcluindo = statusNormalizado === 'Concluído' && statusAnterior !== 'Concluído';

// Para cada item do pedido
if (estaConcluindo && item.produto_id && item.quantidade) {
  // Busca estoque atual
  const estoqueAtual = produtoResult[0].estoque || 0;
  
  // Calcula novo estoque
  const novaQuantidade = estoqueAtual - item.quantidade;
  
  // Atualiza no banco (permite negativo)
  await connection.execute(
    'UPDATE produtos SET estoque = ? WHERE id = ?',
    [novaQuantidade, item.produto_id]
  );
}
```

### 5. Características Importantes

✅ **Estoque Negativo Permitido**: O sistema permite que o estoque fique negativo conforme solicitado

✅ **Transação Segura**: Todas as operações são feitas dentro de transações para garantir consistência

✅ **Logs Detalhados**: O sistema registra no console todas as atualizações de estoque

✅ **Compatibilidade**: Funciona com todos os módulos existentes sem quebrar funcionalidades

✅ **Multi-tenant**: Funciona corretamente com o sistema multi-tenant existente

### 6. Exemplo de Log

```
Estoque atualizado: Produto ID 123, estoque anterior: 50, quantidade vendida: 10, novo estoque: 40
Estoque atualizado: Produto ID 456, estoque anterior: 5, quantidade vendida: 8, novo estoque: -3
```

### 7. Benefícios

1. **Controle Automático**: Não é necessário atualizar estoque manualmente
2. **Rastreabilidade**: Logs detalhados de todas as movimentações
3. **Flexibilidade**: Permite estoque negativo para vendas futuras
4. **Integração**: Funciona perfeitamente com todos os módulos existentes
5. **Segurança**: Transações garantem consistência dos dados

## Teste da Funcionalidade

Para testar:

1. Crie um produto com estoque inicial (ex: 100 unidades)
2. Faça uma venda via qualquer módulo (Pedidos, Caixa ou Mesas)
3. Conclua o pedido
4. Verifique que o estoque foi reduzido automaticamente
5. Teste com estoque insuficiente para verificar que permite negativo

## Arquivos Modificados

- `server.js`: APIs de pedidos atualizadas com controle de estoque
- `CONTROLE-ESTOQUE.md`: Esta documentação

## Status

✅ **Implementado e Funcionando**
- Controle automático de estoque
- Compatibilidade com todos os módulos
- Logs detalhados
- Transações seguras
- Estoque negativo permitido 