# Sistema de Valor Fixo em Empréstimos

## Visão Geral

O sistema agora suporta três tipos de cálculo para empréstimos, permitindo maior flexibilidade na definição de valores e parcelas.

## Tipos de Cálculo Disponíveis

### 1. Valor Inicial + Juros (Padrão)
- **Como funciona**: Define o valor inicial do empréstimo e aplica juros percentual
- **Exemplo**: 
  - Valor inicial: R$ 1.000,00
  - Juros: 20%
  - Total: R$ 1.200,00
  - 3 parcelas de R$ 400,00

### 2. Valor Final Fixo
- **Como funciona**: Define o valor total a ser pago e divide pelas parcelas
- **Exemplo**:
  - Valor final: R$ 1.500,00
  - 3 parcelas
  - Resultado: 3 parcelas de R$ 500,00

### 3. Valor da Parcela Fixo
- **Como funciona**: Define o valor de cada parcela e calcula o total
- **Exemplo**:
  - Valor da parcela: R$ 1.000,00
  - 10 parcelas
  - Resultado: Total de R$ 10.000,00

## Como Usar

### 1. Acessar o Sistema
1. Faça login no sistema JP-Cobranças
2. Navegue até "Histórico de Empréstimos"
3. Clique em "Novo Empréstimo"

### 2. Configurar o Empréstimo

#### Passo 1: Selecionar Cliente
- Escolha um cliente existente ou preencha os dados de um novo cliente

#### Passo 2: Escolher Tipo de Cálculo
- **Valor Inicial + Juros**: Para empréstimos tradicionais com juros percentual
- **Valor Final Fixo**: Para definir o valor total e dividir em parcelas iguais
- **Valor da Parcela Fixo**: Para definir o valor de cada parcela

#### Passo 3: Preencher Dados Específicos

**Para Valor Inicial + Juros:**
- Valor Inicial (R$)
- Porcentagem de Juros (%)

**Para Valor Final Fixo:**
- Valor Final (R$)

**Para Valor da Parcela Fixo:**
- Valor da Parcela (R$)

#### Passo 4: Configurar Parcelamento
- Tipo de Empréstimo: Fixo ou Parcelado
- Número de Parcelas
- Frequência: Diário, Semanal, Quinzenal ou Mensal
- Data de Vencimento
- Multa por Atraso (%)

#### Passo 5: Simular
- Clique em "Simular" para ver o resumo do empréstimo
- Verifique se os valores estão corretos

#### Passo 6: Salvar
- Clique em "Adicionar Empréstimo" para salvar

## Exemplos Práticos

### Exemplo 1: Valor Final Fixo
```
Cliente: João Silva
Tipo de Cálculo: Valor Final Fixo
Valor Final: R$ 1.500,00
Parcelas: 3
Frequência: Mensal
Data Primeira Parcela: 15/02/2024

Resultado:
- 3 parcelas de R$ 500,00
- Vencimentos: 15/02, 15/03, 15/04
```

### Exemplo 2: Parcela Fixa
```
Cliente: Maria Santos
Tipo de Cálculo: Valor da Parcela Fixo
Valor da Parcela: R$ 1.000,00
Parcelas: 10
Frequência: Mensal
Data Primeira Parcela: 15/02/2024

Resultado:
- 10 parcelas de R$ 1.000,00
- Total: R$ 10.000,00
- Vencimentos: 15/02 a 15/11
```

### Exemplo 3: Valor Inicial + Juros
```
Cliente: Pedro Costa
Tipo de Cálculo: Valor Inicial + Juros
Valor Inicial: R$ 5.000,00
Juros: 15%
Parcelas: 6
Frequência: Mensal

Resultado:
- Valor com juros: R$ 5.750,00
- 6 parcelas de R$ 958,33
```

## Vantagens da Nova Funcionalidade

### 1. Flexibilidade
- Diferentes formas de calcular empréstimos
- Adaptação a diferentes necessidades de negócio

### 2. Simplicidade
- Interface intuitiva
- Simulação antes de salvar
- Cálculos automáticos

### 3. Precisão
- Valores exatos conforme definido
- Sem arredondamentos desnecessários
- Controle total sobre valores finais

## Configuração do Banco de Dados

### Campo Adicionado
A tabela `emprestimos` foi atualizada com o campo:
```sql
tipo_calculo ENUM('valor_inicial', 'valor_final', 'parcela_fixa') DEFAULT 'valor_inicial'
```

### Script de Atualização
Execute o script para adicionar o campo em todos os bancos:
```bash
node scripts/add-tipo-calculo-field.js
```

## Testes

### Script de Teste
Execute o script de teste para verificar a funcionalidade:
```bash
node scripts/test-valor-fixo-emprestimos.js
```

### Cenários Testados
1. Criação de empréstimo com valor final fixo
2. Criação de empréstimo com parcela fixa
3. Verificação de parcelas criadas
4. Validação de cálculos

## Compatibilidade

### Empréstimos Existentes
- Empréstimos criados anteriormente continuam funcionando
- Campo `tipo_calculo` será definido como 'valor_inicial' por padrão
- Nenhuma migração de dados é necessária

### APIs
- APIs existentes continuam funcionando
- Novos campos são opcionais para compatibilidade
- Endpoints mantêm a mesma estrutura

## Suporte

Para dúvidas ou problemas:
1. Verifique a documentação
2. Execute os scripts de teste
3. Consulte os logs do sistema
4. Entre em contato com o suporte técnico

## Changelog

### Versão 1.0
- Adicionado suporte a valor final fixo
- Adicionado suporte a parcela fixa
- Interface atualizada com seletor de tipo de cálculo
- Simulador aprimorado
- Documentação completa 