# Busca de Empréstimos - JP-Cobranças

## Como Funciona

A funcionalidade de busca permite filtrar e encontrar empréstimos rapidamente na página de histórico de empréstimos, facilitando a localização de informações específicas.

## Funcionalidades Implementadas

### 1. Busca por Texto
- **Campo de busca:** Input de texto livre
- **Busca em:** Nome do cliente, valor, status, datas
- **Funcionamento:** Busca em tempo real conforme o usuário digita
- **Case-insensitive:** Não diferencia maiúsculas/minúsculas

### 2. Filtro por Status
- **Dropdown:** Seleção de status específico
- **Opções:** Todos os Status, Ativo, Pendente, Em Atraso, Quitado, Cancelado
- **Funcionamento:** Filtra apenas empréstimos com o status selecionado

### 3. Combinação de Filtros
- **Busca + Status:** Pode combinar busca por texto com filtro de status
- **Resultados:** Mostra empréstimos que atendem ambos os critérios

### 4. Botão Limpar
- **Função:** Remove todos os filtros aplicados
- **Resultado:** Mostra todos os empréstimos novamente

## Interface do Usuário

### Caixa de Busca
```
┌─────────────────────────────────────────────────────────────┐
│ 🔍 Buscar por cliente, valor, status...                    │
│ [Todos os Status ▼] [Limpar]                               │
│ Mostrando 15 de 25 empréstimos                             │
└─────────────────────────────────────────────────────────────┘
```

### Elementos Visuais
- **Container:** Fundo cinza claro com bordas arredondadas
- **Input:** Campo de texto com placeholder informativo
- **Select:** Dropdown para filtro de status
- **Botão:** Botão "Limpar" para resetar filtros
- **Contador:** Informação sobre resultados encontrados

## Como Usar

### Busca Simples
1. Digite no campo de busca
2. Os resultados são filtrados automaticamente
3. Veja o contador de resultados atualizado

### Filtro por Status
1. Selecione um status no dropdown
2. Apenas empréstimos com esse status são mostrados
3. O contador é atualizado

### Busca Combinada
1. Digite um termo de busca
2. Selecione um status
3. Veja empréstimos que atendem ambos os critérios

### Limpar Filtros
1. Clique no botão "Limpar"
2. Todos os filtros são removidos
3. Todos os empréstimos são mostrados

## Campos de Busca

### Nome do Cliente
- Busca por nome completo ou parcial
- Exemplo: "João" encontra "João Silva", "João Paulo"

### Valor
- Busca por valor exato ou parcial
- Exemplo: "1000" encontra "R$ 1.000,00", "R$ 10.000,00"

### Status
- Busca por status do empréstimo
- Exemplo: "ativo" encontra empréstimos com status "Ativo"

### Datas
- Busca por data de empréstimo ou vencimento
- Exemplo: "2024" encontra empréstimos de 2024

## Responsividade

### Desktop
- Layout horizontal com todos os elementos na mesma linha
- Campo de busca ocupa espaço disponível
- Filtros e botão alinhados à direita

### Tablet (768px)
- Layout vertical para melhor usabilidade
- Campo de busca em linha separada
- Filtros e botão em linha abaixo

### Mobile (480px)
- Layout totalmente vertical
- Botão "Limpar" ocupa largura total
- Melhor experiência em telas pequenas

## Performance

### Busca em Tempo Real
- Filtros aplicados conforme o usuário digita
- Sem necessidade de pressionar Enter ou clicar em botão
- Experiência fluida e responsiva

### Otimização
- Busca apenas nos dados já carregados
- Não faz requisições adicionais ao servidor
- Filtros aplicados no frontend para velocidade

## Casos de Uso

### Caso 1: Buscar Cliente Específico
- Digite o nome do cliente
- Encontre rapidamente todos os empréstimos dele
- Útil para análise de histórico

### Caso 2: Filtrar por Status
- Selecione "Em Atraso" para ver apenas empréstimos atrasados
- Foque na gestão de cobranças
- Identifique problemas rapidamente

### Caso 3: Buscar por Valor
- Digite um valor para encontrar empréstimos específicos
- Útil para auditoria e controle
- Identifique padrões de valores

### Caso 4: Análise por Período
- Digite uma data para filtrar por período
- Análise de tendências temporais
- Relatórios por período específico

## Vantagens

### Para o Usuário
- **Rapidez:** Encontra informações em segundos
- **Flexibilidade:** Múltiplas formas de busca
- **Simplicidade:** Interface intuitiva
- **Eficiência:** Não precisa navegar por muitas páginas

### Para o Negócio
- **Produtividade:** Usuários trabalham mais rápido
- **Controle:** Melhor gestão de empréstimos
- **Análise:** Facilita identificação de padrões
- **Satisfação:** Interface mais amigável

## Teste da Funcionalidade

Para testar a funcionalidade, execute:

```bash
node scripts/test-busca-emprestimos.js
```

Este script irá:
1. Verificar se há empréstimos cadastrados
2. Testar diferentes cenários de busca
3. Mostrar estatísticas dos dados
4. Validar se a busca funciona corretamente

## Observações Importantes

- **Dados em Tempo Real:** A busca funciona apenas nos dados já carregados
- **Case-insensitive:** Não diferencia maiúsculas/minúsculas
- **Busca Parcial:** Encontra termos dentro de textos maiores
- **Combinação:** Filtros podem ser combinados
- **Limpeza:** Botão "Limpar" remove todos os filtros
- **Responsivo:** Funciona em todos os tamanhos de tela

## Integração com Outras Funcionalidades

### Dashboard
- Busca pode ser integrada com estatísticas
- Filtros podem afetar gráficos e relatórios

### Relatórios
- Filtros aplicados podem ser exportados
- Busca pode ser incluída em relatórios

### Notificações
- Alertas podem ser baseados em filtros
- Notificações para empréstimos específicos 