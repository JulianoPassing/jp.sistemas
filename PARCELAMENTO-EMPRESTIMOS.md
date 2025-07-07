# Sistema de Parcelamento de Empréstimos

## Visão Geral

O sistema agora suporta empréstimos parcelados, permitindo dividir um empréstimo em múltiplas parcelas com datas de vencimento diferentes conforme configurado.

## Funcionalidades Implementadas

### 1. Tipos de Empréstimo
- **Fixo**: Empréstimo único com uma parcela
- **Parcelado**: Empréstimo dividido em múltiplas parcelas

### 2. Configurações de Parcelamento
- **Número de Parcelas**: Quantidade de parcelas (1-60)
- **Frequência**: 
  - Diário
  - Semanal
  - Quinzenal
  - Mensal (padrão)
- **Data da Primeira Parcela**: Data de vencimento da primeira parcela
- **Valor da Parcela**: Valor individual de cada parcela

### 3. Cálculo Automático
- **Valor Fixo**: Define o valor total a ser cobrado
- **Parcela Fixa**: Define o valor de cada parcela
- **Porcentagem**: Aplica juros percentual sobre o valor principal

## Estrutura do Banco de Dados

### Tabela `emprestimos` (Atualizada)
```sql
ALTER TABLE emprestimos 
ADD COLUMN tipo_emprestimo ENUM('fixed', 'in_installments') DEFAULT 'fixed',
ADD COLUMN numero_parcelas INT DEFAULT 1,
ADD COLUMN frequencia ENUM('daily', 'weekly', 'biweekly', 'monthly') DEFAULT 'monthly',
ADD COLUMN valor_parcela DECIMAL(10,2) DEFAULT 0.00
```

### Nova Tabela `parcelas`
```sql
CREATE TABLE parcelas (
  id INT AUTO_INCREMENT PRIMARY KEY,
  emprestimo_id INT NOT NULL,
  numero_parcela INT NOT NULL,
  valor_parcela DECIMAL(10,2) NOT NULL,
  data_vencimento DATE NOT NULL,
  status ENUM('Pendente', 'Paga', 'Atrasada') DEFAULT 'Pendente',
  valor_pago DECIMAL(10,2) DEFAULT 0.00,
  data_pagamento DATE NULL,
  juros_aplicados DECIMAL(10,2) DEFAULT 0.00,
  multa_aplicada DECIMAL(10,2) DEFAULT 0.00,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (emprestimo_id) REFERENCES emprestimos(id) ON DELETE CASCADE,
  UNIQUE KEY unique_emprestimo_parcela (emprestimo_id, numero_parcela)
);
```

## Como Usar

### 1. Criar Empréstimo Parcelado

1. Acesse a página de empréstimos
2. Preencha os dados do cliente
3. Selecione "Parcelado" como tipo de empréstimo
4. Configure:
   - Número de parcelas
   - Frequência
   - Data da primeira parcela
   - Tipo de cálculo (valor fixo, parcela fixa ou porcentagem)
5. Clique em "Simular Empréstimo" para ver o resumo
6. Clique em "Salvar Empréstimo"

### 2. Visualizar Parcelas

1. Na lista de empréstimos, clique em "Ver" em um empréstimo parcelado
2. O modal mostrará informações sobre as parcelas
3. Clique em "Ver Todas as Parcelas" para ver a lista completa

### 3. Acompanhar Status

- **Pendente**: Parcela ainda não venceu
- **Paga**: Parcela foi quitada
- **Atrasada**: Parcela venceu e não foi paga

## APIs Implementadas

### Criar Empréstimo
```http
POST /api/cobrancas/emprestimos
Content-Type: application/json

{
  "cliente_id": 1,
  "valor": 1000.00,
  "data_emprestimo": "2024-01-15",
  "tipo_emprestimo": "in_installments",
  "numero_parcelas": 12,
  "frequencia": "monthly",
  "data_primeira_parcela": "2024-02-15",
  "juros_mensal": 5.0,
  "observacoes": "Empréstimo parcelado"
}
```

### Buscar Parcelas
```http
GET /api/cobrancas/emprestimos/{id}/parcelas
```

## Atualização do Banco de Dados

Para atualizar bancos existentes, execute:

```bash
node scripts/update-emprestimos-parcelamento.js
```

Este script irá:
1. Adicionar os novos campos à tabela `emprestimos`
2. Criar a tabela `parcelas`
3. Migrar empréstimos existentes criando parcelas únicas

## Melhorias na Interface

### Lista de Empréstimos
- Mostra "1x" para empréstimos fixos
- Mostra "Nx" para empréstimos parcelados (ex: "12x")

### Modal de Detalhes
- Informações sobre parcelas (total, pagas, atrasadas)
- Botão para visualizar todas as parcelas
- Status individual de cada parcela

### Simulação
- Preview das parcelas antes de salvar
- Cálculo automático de valores
- Validação de dados

## Compatibilidade

- Empréstimos existentes continuam funcionando normalmente
- Novos empréstimos podem ser criados como fixos ou parcelados
- Interface retrocompatível com o sistema anterior

## Próximas Funcionalidades

- Pagamento individual de parcelas
- Relatórios de parcelas
- Notificações por parcela
- Histórico de pagamentos por parcela 