# Funcionalidade de Edição de Empréstimos

## Visão Geral

A funcionalidade de edição de empréstimos permite modificar todos os aspectos de um empréstimo existente, incluindo valores, parcelas, datas e status.

## Como Usar

### 1. Acessar a Edição
1. Vá para a página de **Empréstimos** ou **Dashboard**
2. Clique em **"Ver"** em qualquer empréstimo
3. No modal de detalhes, clique no botão **"Editar"** (verde, no canto superior direito)

### 2. Campos Editáveis

#### Informações Básicas
- **Cliente**: Selecione um cliente diferente da lista
- **Valor do Empréstimo**: Valor principal (com máscara de moeda)
- **Juros Mensal**: Percentual de juros aplicado mensalmente
- **Data de Vencimento**: Data de vencimento do empréstimo
- **Frequência de Pagamento**: Mensal, Semanal, Diário ou Quinzenal
- **Número de Parcelas**: Quantidade de parcelas (mínimo 1)
- **Status**: Ativo, Quitado, Em Atraso ou Cancelado
- **Observações**: Notas adicionais sobre o empréstimo

### 3. Validações

O sistema valida automaticamente:
- ✅ Cliente deve ser selecionado
- ✅ Valor deve ser maior que zero
- ✅ Juros deve ser maior ou igual a zero
- ✅ Data de vencimento é obrigatória
- ✅ Número de parcelas deve ser maior que zero

### 4. Comportamentos Especiais

#### Alteração de Parcelas
- **Mudança no número de parcelas**: Remove parcelas antigas e cria novas
- **Parcelas múltiplas**: Recalcula valor de cada parcela automaticamente
- **Datas de vencimento**: Recalcula baseado na frequência escolhida

#### Atualização de Cobranças
- **Valores**: Atualiza cobranças relacionadas com novos valores
- **Datas**: Sincroniza datas de vencimento
- **Status**: Mantém consistência entre empréstimo e cobranças

## Implementação Técnica

### Frontend (`js/main.js`)

```javascript
// Função principal de edição
async editarEmprestimo(id) {
  // Busca dados do empréstimo
  // Cria modal de edição
  // Aplica máscara de moeda
  // Processa formulário
  // Valida dados
  // Envia para API
}

// Funções auxiliares
aplicarMascaraMoeda(input) // Formata valores monetários
parseMoeda(valor)          // Converte string para número
```

### Backend (`api/cobrancas.js`)

```javascript
// Rota de atualização
router.put('/emprestimos/:id', async (req, res) => {
  // Verifica se empréstimo existe
  // Atualiza dados principais
  // Recria parcelas se necessário
  // Atualiza cobranças relacionadas
  // Retorna sucesso
})
```

### Estrutura do Banco

```sql
-- Tabela principal
UPDATE emprestimos SET 
  cliente_id = ?, 
  valor = ?, 
  juros_mensal = ?, 
  data_vencimento = ?, 
  frequencia_pagamento = ?, 
  numero_parcelas = ?, 
  status = ?, 
  observacoes = ?,
  updated_at = CURRENT_TIMESTAMP
WHERE id = ?;

-- Recriação de parcelas
DELETE FROM parcelas WHERE emprestimo_id = ?;
INSERT INTO parcelas (...) VALUES (...);

-- Atualização de cobranças
UPDATE cobrancas SET 
  valor_original = ?, 
  valor_atualizado = ?, 
  data_vencimento = ?
WHERE emprestimo_id = ?;
```

## Casos de Uso

### 1. Correção de Valor
**Cenário**: Valor digitado incorretamente
- Abrir edição do empréstimo
- Corrigir campo "Valor do Empréstimo"
- Salvar alterações
- ✅ Parcelas e cobranças são recalculadas automaticamente

### 2. Alteração de Parcelas
**Cenário**: Mudar de 1 para 3 parcelas
- Abrir edição do empréstimo
- Alterar "Número de Parcelas" de 1 para 3
- Salvar alterações
- ✅ Sistema cria 3 parcelas com valores divididos igualmente

### 3. Mudança de Cliente
**Cenário**: Empréstimo foi registrado para cliente errado
- Abrir edição do empréstimo
- Selecionar cliente correto no dropdown
- Salvar alterações
- ✅ Empréstimo é transferido para o novo cliente

### 4. Atualização de Status
**Cenário**: Marcar empréstimo como quitado
- Abrir edição do empréstimo
- Alterar status para "Quitado"
- Salvar alterações
- ✅ Status é atualizado em todas as tabelas relacionadas

## Segurança

### Validações de Entrada
- Sanitização de dados
- Verificação de tipos
- Validação de ranges
- Prevenção de SQL injection

### Controle de Acesso
- Verificação de sessão ativa
- Validação de permissões
- Logs de auditoria

## Tratamento de Erros

### Erros Comuns
- **Empréstimo não encontrado**: HTTP 404
- **Dados inválidos**: Validação frontend + backend
- **Erro de conexão**: Retry automático
- **Erro de permissão**: Redirecionamento para login

### Mensagens de Feedback
- ✅ **Sucesso**: "Empréstimo atualizado com sucesso!"
- ❌ **Erro**: "Erro ao atualizar empréstimo: [detalhes]"
- ⚠️ **Validação**: "Campo obrigatório não preenchido"

## Teste

### Script de Teste
```bash
node scripts/test-editar-emprestimo.js
```

### Casos de Teste
1. ✅ Edição de valor
2. ✅ Alteração de parcelas
3. ✅ Mudança de cliente
4. ✅ Atualização de status
5. ✅ Validação de campos
6. ✅ Tratamento de erros

## Integração

### Páginas Relacionadas
- **Dashboard**: Visualização de empréstimos
- **Empréstimos**: Lista completa
- **Cobranças**: Sincronização automática
- **Parcelas**: Recriação automática

### APIs Relacionadas
- `GET /emprestimos` - Buscar empréstimos
- `GET /clientes` - Lista de clientes
- `PUT /emprestimos/:id` - Atualizar empréstimo
- `GET /emprestimos/:id/parcelas` - Buscar parcelas

## Melhorias Futuras

### Funcionalidades Planejadas
- [ ] Histórico de alterações
- [ ] Aprovação de mudanças críticas
- [ ] Notificações automáticas
- [ ] Backup antes de editar
- [ ] Edição em lote

### Otimizações
- [ ] Cache de dados
- [ ] Validação assíncrona
- [ ] Interface mais intuitiva
- [ ] Suporte a mobile

---

## Conclusão

A funcionalidade de edição de empréstimos oferece controle total sobre os dados, mantendo a integridade do sistema e proporcionando uma experiência de usuário fluida e segura. 