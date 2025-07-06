# JP Gestão - Sistema de Gestão Empresarial

## Visão Geral

O JP Gestão é um sistema moderno de gestão empresarial desenvolvido com foco em restaurantes, bares e estabelecimentos similares. O sistema oferece uma interface intuitiva e funcionalidades completas para gerenciar produtos, pedidos, clientes, mesas, caixa e relatórios.

## Características Principais

### 🎨 Design Moderno
- Interface responsiva e moderna
- Padrão visual consistente baseado no JP Cobranças
- Suporte a modo escuro
- Animações suaves e transições elegantes

### 📱 Responsividade
- Funciona perfeitamente em desktop, tablet e mobile
- Menu adaptativo para dispositivos móveis
- Layout otimizado para diferentes tamanhos de tela

### 🔐 Segurança
- Sistema de autenticação robusto
- Controle de sessão
- Validação de dados
- Proteção contra ataques comuns

## Módulos do Sistema

### 1. Dashboard
- Visão geral do negócio
- Estatísticas em tempo real
- Cards informativos
- Menu principal de navegação

### 2. Produtos
- Cadastro e edição de produtos
- Controle de estoque
- Categorização
- Ajuste de estoque
- Alertas de estoque baixo

### 3. Pedidos
- Criação de pedidos
- Seleção de produtos
- Atribuição de mesas
- Controle de status
- Histórico de pedidos

### 4. Clientes
- Cadastro de clientes
- Histórico de compras
- Informações de contato
- Segmentação

### 5. Mesas
- Controle de ocupação
- Status das mesas (Livre, Ocupada, Reservada)
- Capacidade configurável
- Localização

### 6. Caixa
- Controle financeiro
- Registro de pagamentos
- Retiradas e despesas
- Transferências
- Relatórios financeiros

### 7. Relatórios
- Relatórios de vendas
- Análise de produtos
- Relatórios de clientes
- Relatórios financeiros
- Exportação de dados

### 8. Configurações
- Dados da empresa
- Configurações do sistema
- Gerenciamento de usuários
- Backup e segurança

## Tecnologias Utilizadas

### Frontend
- HTML5
- CSS3 (com variáveis CSS)
- JavaScript (ES6+)
- Font Awesome (ícones)
- Google Fonts (Poppins)

### Backend
- Node.js
- Express.js
- MySQL/PostgreSQL
- JWT para autenticação

## Estrutura de Arquivos

```
public/jp.gestao/
├── css/
│   └── style.css          # Estilos principais
├── js/
│   └── main.js           # JavaScript principal
├── index.html            # Página inicial
├── login.html            # Tela de login
├── dashboard.html        # Dashboard principal
├── produtos.html         # Gerenciamento de produtos
├── pedidos.html          # Gerenciamento de pedidos
├── clientes.html         # Gerenciamento de clientes
├── mesas.html            # Controle de mesas
├── caixa.html            # Controle financeiro
├── relatorios.html       # Relatórios e análises
├── configuracoes.html    # Configurações do sistema
├── ajuda.html            # Central de ajuda
└── README.md             # Esta documentação
```

## Funcionalidades Principais

### Sistema de Autenticação
- Login seguro com validação
- Controle de sessão
- Logout automático
- Proteção de rotas

### Interface Responsiva
- Menu mobile adaptativo
- Cards informativos
- Tabelas responsivas
- Modais interativos

### Notificações
- Sistema de notificações em tempo real
- Alertas de sucesso, erro e aviso
- Auto-hide configurável

### Validação de Dados
- Validação client-side
- Feedback visual de erros
- Prevenção de dados inválidos

### Exportação de Dados
- Exportação para CSV
- Relatórios personalizáveis
- Filtros avançados

## Configuração e Instalação

### Pré-requisitos
- Node.js 14+
- MySQL 5.7+ ou PostgreSQL 10+
- Navegador moderno

### Instalação
1. Clone o repositório
2. Instale as dependências: `npm install`
3. Configure o banco de dados
4. Configure as variáveis de ambiente
5. Execute o servidor: `npm start`

### Configuração do Banco de Dados
```sql
-- Exemplo de estrutura básica
CREATE DATABASE jp_gestao;
USE jp_gestao;

-- Tabelas principais
CREATE TABLE usuarios (...);
CREATE TABLE produtos (...);
CREATE TABLE pedidos (...);
CREATE TABLE clientes (...);
CREATE TABLE mesas (...);
CREATE TABLE movimentacoes (...);
```

## API Endpoints

### Autenticação
- `POST /api/auth/login` - Login
- `POST /api/auth/logout` - Logout

### Produtos
- `GET /api/produtos` - Listar produtos
- `POST /api/produtos` - Criar produto
- `PUT /api/produtos/:id` - Atualizar produto
- `DELETE /api/produtos/:id` - Excluir produto
- `POST /api/produtos/:id/estoque` - Ajustar estoque

### Pedidos
- `GET /api/pedidos` - Listar pedidos
- `POST /api/pedidos` - Criar pedido
- `PUT /api/pedidos/:id` - Atualizar pedido
- `PUT /api/pedidos/:id/status` - Atualizar status

### Clientes
- `GET /api/clientes` - Listar clientes
- `POST /api/clientes` - Criar cliente
- `PUT /api/clientes/:id` - Atualizar cliente
- `DELETE /api/clientes/:id` - Excluir cliente

### Mesas
- `GET /api/mesas` - Listar mesas
- `POST /api/mesas` - Criar mesa
- `PUT /api/mesas/:id` - Atualizar mesa
- `PUT /api/mesas/:id/status` - Atualizar status

### Caixa
- `GET /api/caixa/stats` - Estatísticas
- `GET /api/caixa/movimentacoes` - Movimentações
- `POST /api/caixa/movimentacoes` - Nova movimentação

### Relatórios
- `POST /api/relatorios/geral` - Relatório geral
- `GET /api/relatorios/vendas` - Relatório de vendas
- `GET /api/relatorios/produtos` - Relatório de produtos

## Personalização

### Cores
O sistema usa variáveis CSS para fácil personalização:

```css
:root {
  --terciary: #002f4b;         /* Azul principal */
  --primary: #43A047;          /* Verde principal */
  --secondary: #388E3C;        /* Verde escuro */
  /* ... outras cores */
}
```

### Configurações
- Modo escuro
- Notificações push
- Auto-refresh
- Moeda e fuso horário
- Idioma

## Suporte e Manutenção

### Contato
- Email: suporte@jpgestao.com
- Telefone: (11) 99999-9999
- WhatsApp: (11) 99999-9999

### Horário de Atendimento
- Segunda a Sexta: 8h às 18h
- Tempo de resposta: Até 24h em dias úteis

### Documentação
- Manual do usuário disponível na seção Ajuda
- Guias rápidos para funcionalidades principais
- FAQ com perguntas frequentes

## Atualizações e Versões

### Versão 1.0.0 (Atual)
- Sistema base completo
- Interface moderna
- Funcionalidades principais
- Responsividade total

### Próximas Versões
- Integração com iFood
- Integração com WhatsApp
- Sistema de delivery
- App mobile
- Relatórios avançados
- Backup na nuvem

## Licença

Este software é propriedade da JP Sistemas. Todos os direitos reservados.

---

**JP Gestão** - Transformando a gestão do seu negócio 