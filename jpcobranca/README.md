# JP-Cobranças - Sistema Novo

Sistema moderno para gestão de clientes, empréstimos e cobranças com interface responsiva e API REST.

## 🚀 Funcionalidades

- **Dashboard Interativo**: Visão geral com estatísticas em tempo real
- **Gestão de Clientes**: Cadastro, edição, exclusão e busca de clientes
- **Controle de Empréstimos**: Histórico completo de transações
- **Sistema de Cobrança**: Acompanhamento de pagamentos e atrasos
- **Lista de Atrasados**: Controle de inadimplência
- **Interface Responsiva**: Funciona em desktop e mobile
- **API REST**: Backend moderno com Node.js

## 📋 Pré-requisitos

- **Node.js**: 14.0.0 ou superior
- **MariaDB/MySQL**: 10.3+ ou MySQL 8.0+
- **Navegador**: Chrome, Firefox, Safari, Edge (versões recentes)

## 🛠️ Instalação

### 1. Configuração do Banco de Dados

1. **Instale o MariaDB/MySQL**:
   ```bash
   # Ubuntu/Debian
   sudo apt update
   sudo apt install mariadb-server mariadb-client
   
   # Windows
   # Baixe e instale o MariaDB do site oficial
   ```

2. **Configure o MariaDB**:
   ```bash
   sudo mysql_secure_installation
   ```

3. **Execute o script de configuração**:
   ```bash
   mysql -u root -p < ../database_config.sql
   ```

### 2. Configuração do Backend

1. **Entre na pasta backend**:
   ```bash
   cd backend
   ```

2. **Instale as dependências**:
   ```bash
   npm install
   ```

3. **Configure o banco de dados**:
   - Edite o arquivo `db.js` se necessário
   - Padrão: usuário `root`, senha `Juliano@95`, banco `jp_cobranca`

4. **Inicie o backend**:
   ```bash
   npm start
   # ou para desenvolvimento
   npm run dev
   ```

### 3. Acesso ao Frontend

1. **Abra o arquivo** `frontend/index.html` no navegador
2. **Ou use um servidor local**:
   ```bash
   # Python 3
   cd frontend
   python -m http.server 8000
   
   # Node.js
   npx http-server frontend -p 8000
   ```

## 🎯 Como Usar

### 1. Acesso ao Sistema

- **Backend**: http://localhost:3001
- **Frontend**: http://localhost:8000 (se usando servidor) ou abra diretamente o `index.html`

### 2. Navegação

- **Dashboard**: Visão geral do sistema
- **Clientes**: Gerenciamento de clientes
- **Empréstimos**: Controle de empréstimos
- **Cobranças**: Acompanhamento de pagamentos
- **Atrasados**: Clientes em inadimplência

### 3. Funcionalidades Principais

#### Clientes
- ✅ Cadastrar novo cliente
- ✅ Editar dados do cliente
- ✅ Excluir cliente (se não tiver empréstimos ativos)
- ✅ Buscar cliente por nome, CPF ou telefone
- ✅ Visualizar histórico de empréstimos

#### Empréstimos
- ✅ Criar novo empréstimo
- ✅ Editar empréstimo
- ✅ Excluir empréstimo
- ✅ Visualizar empréstimos em atraso
- ✅ Histórico completo

#### Cobranças
- ✅ Registrar pagamento
- ✅ Editar pagamento
- ✅ Excluir pagamento
- ✅ Cobranças pendentes
- ✅ Cobranças em atraso

#### Dashboard
- ✅ Total de clientes
- ✅ Empréstimos ativos
- ✅ Valor a receber
- ✅ Clientes em atraso
- ✅ Empréstimos recentes
- ✅ Cobranças pendentes

## 📁 Estrutura do Projeto

```
jp-cobrancas-novo/
├── backend/
│   ├── app.js                 # Servidor principal
│   ├── db.js                  # Configuração do banco
│   ├── package.json           # Dependências
│   └── routes/
│       ├── clientes.js        # Rotas de clientes
│       ├── emprestimos.js     # Rotas de empréstimos
│       ├── cobrancas.js       # Rotas de cobranças
│       └── dashboard.js       # Rotas do dashboard
├── frontend/
│   ├── index.html             # Dashboard
│   ├── clientes.html          # Página de clientes
│   ├── emprestimos.html       # Página de empréstimos
│   ├── cobrancas.html         # Página de cobranças
│   ├── atrasados.html         # Página de atrasados
│   ├── css/
│   │   └── style.css          # Estilos
│   └── js/
│       ├── main.js            # JavaScript principal
│       └── clientes.js        # JavaScript específico
└── README.md                  # Este arquivo
```

## 🔧 Configuração

### Banco de Dados

O sistema usa as seguintes tabelas:
- `clients`: Dados dos clientes
- `loans`: Empréstimos
- `transactions`: Pagamentos/cobranças
- `users`: Usuários do sistema
- `platform_settings`: Configurações

### API Endpoints

- `GET /api/clientes` - Listar clientes
- `POST /api/clientes` - Criar cliente
- `PUT /api/clientes/:id` - Atualizar cliente
- `DELETE /api/clientes/:id` - Deletar cliente
- `GET /api/emprestimos` - Listar empréstimos
- `POST /api/emprestimos` - Criar empréstimo
- `GET /api/cobrancas` - Listar cobranças
- `POST /api/cobrancas` - Registrar pagamento
- `GET /api/dashboard` - Dados do dashboard

## 🚨 Solução de Problemas

### Backend não inicia
1. Verifique se o Node.js está instalado: `node --version`
2. Verifique se as dependências estão instaladas: `npm install`
3. Verifique se o MariaDB está rodando
4. Verifique as credenciais no arquivo `db.js`

### Frontend não carrega dados
1. Verifique se o backend está rodando na porta 3001
2. Verifique o console do navegador para erros
3. Verifique se a URL da API está correta no `main.js`

### Banco de dados não conecta
1. Verifique se o MariaDB está rodando
2. Verifique as credenciais no `db.js`
3. Execute o script `database_config.sql`

## 📞 Suporte

Para suporte ou dúvidas:
- Verifique os logs do backend no terminal
- Verifique o console do navegador (F12)
- Consulte a documentação da API

## 🔄 Atualizações

Para atualizar o sistema:
1. Pare o backend (Ctrl+C)
2. Faça backup do banco de dados
3. Atualize os arquivos
4. Execute `npm install` se houver novas dependências
5. Reinicie o backend

---

**JP-Cobranças** - Sistema completo para gestão financeira 