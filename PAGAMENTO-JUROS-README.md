# Pagamento de Juros - JP-Cobranças

## Como Funciona

O sistema permite que clientes paguem apenas os juros acumulados de um empréstimo, o que resulta em:

1. **Valor da dívida volta ao valor inicial** do empréstimo
2. **Prazo é estendido em 30 dias**
3. **Status do empréstimo volta para "Ativo"**

## Exemplo Prático

### Cenário Inicial
- **Empréstimo:** R$ 1.000,00
- **Juros:** 30% ao mês
- **Juros Acumulados:** R$ 300,00
- **Valor Total Devido:** R$ 1.300,00
- **Vencimento:** 15/01/2024
- **Status:** Em Atraso

### Após Pagamento de Juros
- **Valor Pago:** R$ 300,00 (apenas juros)
- **Novo Valor da Dívida:** R$ 1.000,00 (volta ao valor inicial)
- **Novo Vencimento:** 14/02/2024 (+30 dias)
- **Status:** Ativo

## Fluxo no Sistema

### 1. Acesso à Funcionalidade
- Vá para a página "Histórico de Empréstimos"
- Clique em "Ver Detalhes" em qualquer empréstimo
- Clique no botão "Só Juros" no modal de detalhes

### 2. Modal de Pagamento
O sistema exibe:
- **Resumo do empréstimo** com valores atuais
- **Cálculo dos juros acumulados**
- **Previsão do novo vencimento** (+30 dias)
- **Valor da dívida após pagamento** (volta ao inicial)
- **Formulário para preenchimento** dos dados do pagamento

### 3. Validações
- **Valor mínimo:** Deve ser igual ou superior aos juros acumulados
- **Data do pagamento:** Obrigatória
- **Forma de pagamento:** Opcional
- **Observações:** Opcional

### 4. Processamento
Após confirmar o pagamento:
1. **Registra o pagamento** na tabela de pagamentos
2. **Atualiza o empréstimo:**
   - Valor volta ao valor inicial
   - Data de vencimento +30 dias
   - Status volta para "Ativo"
3. **Atualiza a cobrança relacionada**
4. **Exibe confirmação** com novos dados

## Vantagens

### Para o Cliente
- **Flexibilidade:** Pode pagar apenas os juros quando não consegue quitar a dívida
- **Renovação automática:** Prazo é estendido automaticamente
- **Valor controlado:** Dívida não cresce indefinidamente

### Para o Credor
- **Receita de juros:** Garante recebimento dos juros
- **Controle de risco:** Mantém o cliente ativo no sistema
- **Fluxo de caixa:** Recebe parte do valor devido

## Regras Técnicas

### Cálculo dos Juros
```
Juros Acumulados = Valor Inicial × (Juros Mensal / 100)
```

### Extensão do Prazo
```
Novo Vencimento = Vencimento Atual + 30 dias
```

### Atualização do Valor
```
Novo Valor da Dívida = Valor Inicial do Empréstimo
```

## Teste da Funcionalidade

Para testar a funcionalidade, execute:

```bash
node scripts/test-pagamento-juros.js
```

Este script irá:
1. Verificar se há empréstimos ativos
2. Calcular os juros acumulados
3. Simular um pagamento de juros
4. Verificar se as regras foram aplicadas corretamente

## Observações Importantes

- **Valor mínimo:** O cliente deve pagar pelo menos o valor dos juros acumulados
- **Prazo fixo:** A extensão é sempre de 30 dias
- **Status automático:** Sempre volta para "Ativo"
- **Histórico:** Todos os pagamentos são registrados para auditoria
- **Cobranças:** As cobranças relacionadas são atualizadas automaticamente

## Casos de Uso

### Caso 1: Cliente em Atraso
- Cliente não consegue pagar a dívida total
- Paga apenas os juros para "renovar" o empréstimo
- Ganha mais 30 dias para organizar o pagamento

### Caso 2: Renovação Antecipada
- Cliente quer estender o prazo antes do vencimento
- Paga os juros antecipadamente
- Renova o empréstimo por mais 30 dias

### Caso 3: Gestão de Risco
- Credor quer garantir recebimento dos juros
- Oferece flexibilidade ao cliente
- Mantém o relacionamento comercial 