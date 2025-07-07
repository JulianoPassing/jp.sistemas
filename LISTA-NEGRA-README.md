# Lista Negra - JP-Cobranças

## Como Funciona

A funcionalidade de Lista Negra permite marcar clientes problemáticos no sistema, facilitando a identificação e gestão de riscos.

## Funcionalidades Implementadas

### 1. Adicionar Cliente à Lista Negra
- **Localização:** Página "Clientes" → Botão "Lista Negra" nas ações
- **Ação:** Altera o status do cliente para "Lista Negra"
- **Registro:** Salva observações sobre o motivo da inclusão

### 2. Visualizar Lista Negra
- **Localização:** Página "Lista Negra" no menu principal
- **Exibe:** Todos os clientes com status "Lista Negra"
- **Informações:** Nome, CPF, motivo, data de inclusão, ações

### 3. Remover da Lista Negra
- **Localização:** Página "Lista Negra" → Botão "Remover da Lista"
- **Ação:** Volta o status do cliente para "Ativo"
- **Registro:** Atualiza observações com motivo da remoção

## Interface do Usuário

### Página de Clientes
- **Botão "Lista Negra":** Aparece para clientes ativos
- **Botão "Remover da Lista":** Aparece para clientes na lista negra
- **Status Visual:** Badge vermelho para "Lista Negra", verde para "Ativo"

### Página de Lista Negra
- **Tabela Completa:** Lista todos os clientes na lista negra
- **Colunas:** Cliente, CPF, Motivo, Data Inclusão, Status, Ações
- **Ações:** Ver detalhes, Remover da lista

## Fluxo de Uso

### Adicionar à Lista Negra
1. Acesse "Clientes" no menu
2. Localize o cliente desejado
3. Clique em "Lista Negra" nas ações
4. Confirme a ação
5. Cliente é marcado como "Lista Negra"

### Visualizar Lista Negra
1. Acesse "Lista Negra" no menu
2. Visualize todos os clientes marcados
3. Use as ações para gerenciar cada cliente

### Remover da Lista Negra
1. Acesse "Lista Negra" no menu
2. Localize o cliente desejado
3. Clique em "Remover da Lista"
4. Confirme a ação
5. Cliente volta ao status "Ativo"

## Estrutura Técnica

### Backend (API)
- **Rota:** `PUT /api/cobrancas/clientes/:id/lista-negra`
- **Parâmetros:** `status` (Lista Negra/Ativo), `motivo`
- **Ação:** Atualiza status e observações do cliente

### Frontend (JavaScript)
- **Função:** `adicionarListaNegra(id)`
- **Função:** `removerListaNegra(id)`
- **Função:** `renderListaNegra()`
- **Integração:** Atualização automática das listas

### Banco de Dados
- **Campo:** `status` na tabela `clientes_cobrancas`
- **Campo:** `observacoes` para registrar motivos
- **Campo:** `updated_at` para data de alteração

## Casos de Uso

### Caso 1: Cliente Problemático
- Cliente com histórico de não pagamento
- Adicionar à lista negra para evitar novos empréstimos
- Registrar motivo: "Histórico de inadimplência"

### Caso 2: Cliente Recuperado
- Cliente que resolveu pendências
- Remover da lista negra
- Registrar motivo: "Pendências resolvidas"

### Caso 3: Gestão de Risco
- Identificar clientes de alto risco
- Centralizar informações na página de lista negra
- Facilitar tomada de decisão

## Vantagens

### Para o Negócio
- **Controle de Risco:** Identifica clientes problemáticos
- **Prevenção:** Evita novos empréstimos para clientes de risco
- **Gestão:** Centraliza informações de clientes problemáticos

### Para o Usuário
- **Interface Intuitiva:** Botões claros e ações simples
- **Feedback Visual:** Status coloridos e badges
- **Histórico:** Registro de motivos e datas

## Teste da Funcionalidade

Para testar a funcionalidade, execute:

```bash
node scripts/test-lista-negra.js
```

Este script irá:
1. Verificar se há clientes ativos
2. Adicionar um cliente à lista negra
3. Verificar se aparece na página de lista negra
4. Remover o cliente da lista negra
5. Verificar se voltou ao status ativo

## Observações Importantes

- **Confirmação:** Todas as ações requerem confirmação do usuário
- **Notificações:** Sistema exibe mensagens de sucesso/erro
- **Atualização Automática:** Listas são recarregadas após ações
- **Histórico:** Todas as alterações são registradas com data/hora
- **Segurança:** Apenas usuários autenticados podem gerenciar lista negra

## Integração com Outras Funcionalidades

### Dashboard
- Estatísticas podem incluir contagem de clientes na lista negra
- Alertas para novos clientes adicionados

### Empréstimos
- Validação para impedir empréstimos para clientes na lista negra
- Alertas durante criação de empréstimos

### Relatórios
- Inclusão de clientes na lista negra em relatórios
- Análise de tendências de inadimplência 