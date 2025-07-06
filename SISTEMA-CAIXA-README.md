# Sistema de Caixa - JP Sistemas

## 📋 Visão Geral

O Sistema de Caixa é uma solução completa para gestão de vendas e controle de estoque, desenvolvido seguindo o mesmo padrão visual e funcional do sistema de cobranças. Ideal para mercados, lojas e estabelecimentos comerciais.

## 🚀 Funcionalidades

### 🔐 Autenticação
- Sistema de login seguro
- Controle de sessão
- Usuários específicos para o sistema de caixa

### 📊 Painel de Controle
- Dashboard com estatísticas em tempo real
- Cards informativos com métricas importantes
- Ações rápidas para funcionalidades principais
- Vendas recentes
- Produtos em baixa

### 🛍️ Sistema de Caixa
- Interface completa de vendas
- Busca rápida de produtos
- Carrinho de compras funcional
- Controle de quantidade
- Aplicação de descontos
- Múltiplas formas de pagamento
- Cálculo automático de troco
- Controle de estoque em tempo real

### 📦 Gestão de Produtos
- Cadastro completo de produtos
- Categorização (Alimentos, Bebidas, Limpeza, Higiene, Outros)
- Controle de estoque mínimo
- Edição e exclusão de produtos
- Busca e filtros avançados

### 📈 Histórico de Vendas
- Registro completo de todas as vendas
- Detalhes de cada transação
- Filtros por data, forma de pagamento
- Exportação de dados
- Impressão de comprovantes

## 🏗️ Estrutura do Projeto

```
public/jp.caixa/
├── index.html          # Página inicial (redirecionamento)
├── login.html          # Página de login
├── painel.html         # Dashboard principal
├── caixa.html          # Sistema de vendas
├── produtos.html       # Gestão de produtos
├── vendas.html         # Histórico de vendas
├── css/
│   └── style.css       # Estilos do sistema
└── js/
    └── main.js         # Funções utilitárias
```

## 🗄️ Banco de Dados

### Tabelas Principais

#### `produtos`
- `id` - Identificador único
- `codigo` - Código do produto (único)
- `nome` - Nome do produto
- `categoria` - Categoria (alimentos, bebidas, limpeza, higiene, outros)
- `preco` - Preço de venda
- `estoque` - Quantidade em estoque
- `estoque_minimo` - Estoque mínimo para alertas
- `descricao` - Descrição do produto

#### `vendas`
- `id` - ID da venda
- `data` - Data e hora da venda
- `subtotal` - Subtotal da venda
- `desconto` - Valor do desconto aplicado
- `total` - Valor total final
- `forma_pagamento` - Forma de pagamento
- `valor_recebido` - Valor recebido (para dinheiro)
- `troco` - Valor do troco

#### `vendas_itens`
- `id` - Identificador único
- `venda_id` - ID da venda (FK)
- `produto_id` - ID do produto (FK)
- `codigo` - Código do produto
- `nome` - Nome do produto
- `preco` - Preço unitário
- `quantidade` - Quantidade vendida

## 🔧 Instalação e Configuração

### 1. Pré-requisitos
- Node.js 14+
- MySQL 5.7+
- Dependências do projeto principal

### 2. Inicialização do Banco de Dados

Execute o script de inicialização:

```bash
node scripts/init-caixa-db.js
```

Este script irá:
- Criar as tabelas necessárias
- Inserir usuário padrão (caixa/caixa123)
- Adicionar produtos de exemplo

### 3. Configuração do Servidor

O sistema já está integrado ao servidor principal. As rotas estão disponíveis em:
- `/api/caixa/*` - APIs do sistema
- `/jp.caixa/*` - Páginas do sistema

### 4. Acesso ao Sistema

Acesse: `http://seu-dominio/jp.caixa/`

**Usuário padrão:**
- Username: `caixa`
- Senha: `caixa123`

## 📱 Interface do Usuário

### Design Responsivo
- Interface adaptável para desktop e mobile
- Navegação intuitiva
- Cores e estilos consistentes com o sistema de cobranças

### Componentes Principais

#### Header
- Logo do sistema
- Menu de navegação
- Botão de logout

#### Cards Informativos
- Vendas do dia
- Total de produtos
- Vendas do mês
- Produtos em baixa

#### Sistema de Caixa
- Grid de produtos
- Carrinho lateral
- Controles de quantidade
- Aplicação de descontos
- Finalização de vendas

## 🔌 APIs Disponíveis

### Autenticação
- `POST /api/caixa/login` - Login do usuário
- `POST /api/caixa/logout` - Logout

### Estatísticas
- `GET /api/caixa/estatisticas` - Estatísticas gerais
- `GET /api/caixa/vendas-recentes` - Vendas recentes
- `GET /api/caixa/produtos-baixa` - Produtos em baixa

### Produtos
- `GET /api/caixa/produtos` - Listar produtos
- `GET /api/caixa/produtos/:id` - Obter produto específico
- `POST /api/caixa/produtos` - Criar produto
- `PUT /api/caixa/produtos/:id` - Atualizar produto
- `DELETE /api/caixa/produtos/:id` - Excluir produto

### Vendas
- `GET /api/caixa/vendas` - Listar vendas
- `GET /api/caixa/vendas/:id` - Obter venda específica
- `POST /api/caixa/vendas` - Registrar nova venda

## 🎯 Fluxo de Venda

1. **Acesso ao Caixa**
   - Login no sistema
   - Navegação para página do caixa

2. **Seleção de Produtos**
   - Busca por nome ou código
   - Filtro por categoria
   - Adição ao carrinho

3. **Gestão do Carrinho**
   - Ajuste de quantidades
   - Remoção de itens
   - Aplicação de descontos

4. **Finalização**
   - Seleção da forma de pagamento
   - Cálculo de troco (se necessário)
   - Confirmação da venda

5. **Registro**
   - Atualização automática do estoque
   - Registro da venda no banco
   - Geração de comprovante

## 🔒 Segurança

- Autenticação obrigatória
- Validação de dados
- Controle de sessão
- Sanitização de inputs
- Transações de banco de dados

## 📊 Relatórios e Estatísticas

### Métricas Disponíveis
- Vendas por período
- Produtos mais vendidos
- Controle de estoque
- Faturamento
- Formas de pagamento

### Exportação
- Dados em CSV
- Relatórios personalizados
- Histórico completo

## 🛠️ Manutenção

### Backup
- Backup regular das tabelas
- Preservação de dados históricos

### Atualizações
- Sistema modular
- Fácil atualização de componentes
- Compatibilidade com versões anteriores

## 🐛 Troubleshooting

### Problemas Comuns

1. **Erro de conexão com banco**
   - Verificar configurações do banco
   - Executar script de inicialização

2. **Produtos não aparecem**
   - Verificar se existem produtos cadastrados
   - Verificar permissões de usuário

3. **Erro ao finalizar venda**
   - Verificar estoque dos produtos
   - Verificar dados obrigatórios

### Logs
- Logs de erro no console do servidor
- Logs de transações no banco de dados

## 📞 Suporte

Para suporte técnico ou dúvidas:
- Verificar documentação
- Consultar logs do sistema
- Contatar equipe de desenvolvimento

## 🔄 Versões

### v1.0.0
- Sistema básico de caixa
- Gestão de produtos
- Controle de vendas
- Interface responsiva

### Próximas Versões
- Integração com impressoras
- Relatórios avançados
- Múltiplos usuários
- Backup automático

---

**Desenvolvido por JP Sistemas**
*Sistema completo para gestão comercial* 