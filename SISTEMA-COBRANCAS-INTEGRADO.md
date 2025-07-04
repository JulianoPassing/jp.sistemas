# Sistema de Cobranças Integrado

## Visão Geral
O sistema de cobranças foi integrado ao servidor principal via proxy/reverse proxy, permitindo que ambos os sistemas rodem no mesmo servidor mas de forma independente.

## Estrutura
```
Servidor Principal (Porta 3000)
├── / (Sistema Principal)
├── /painel
├── /produtos
└── /jpcobranca (Sistema de Cobranças)
    ├── /jpcobranca/api/* → Proxy para localhost:3001/api/*
    └── /jpcobranca/* → Arquivos estáticos do frontend

Sistema de Cobranças (Porta 3001)
├── Backend API
└── Frontend (servido pelo proxy)
```

## Como Usar

### 1. Iniciar Apenas o Sistema Principal
```bash
npm start
# ou
npm run dev
```

### 2. Iniciar Apenas o Sistema de Cobranças
```bash
npm run start:cobrancas
# ou
npm run dev:cobrancas
```

### 3. Iniciar Ambos os Sistemas (Recomendado)
```bash
npm run dev:all
```

## URLs de Acesso

### Sistema Principal
- **Dashboard**: `http://localhost:3000/`
- **Painel**: `http://localhost:3000/painel`
- **Produtos**: `http://localhost:3000/produtos`
- **Pedidos**: `http://localhost:3000/pedidos`

### Sistema de Cobranças
- **Dashboard**: `http://localhost:3000/jpcobranca`
- **Clientes**: `http://localhost:3000/jpcobranca/clientes.html`
- **Empréstimos**: `http://localhost:3000/jpcobranca/emprestimos.html`
- **Cobranças**: `http://localhost:3000/jpcobranca/cobrancas.html`
- **Atrasados**: `http://localhost:3000/jpcobranca/atrasados.html`

## APIs

### Sistema Principal
- **Base URL**: `http://localhost:3000/api/`

### Sistema de Cobranças
- **Base URL**: `http://localhost:3000/jpcobranca/api/`
- **Endpoints**:
  - `/clientes` - Gerenciamento de clientes
  - `/emprestimos` - Gerenciamento de empréstimos
  - `/cobrancas` - Gerenciamento de cobranças
  - `/dashboard` - Dados do dashboard

## Configuração do Banco de Dados

### Sistema Principal
Usa as configurações do arquivo `.env` principal.

### Sistema de Cobranças
Crie um arquivo `.env` na pasta `public/jpcobrancas/backend/`:
```env
PORT_COBRANCAS=3001
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=sua_senha
DB_NAME=jp_cobrancas
```

## Vantagens da Integração

✅ **Mesmo servidor** - Economia de recursos  
✅ **Separação clara** - Cada sistema em sua porta  
✅ **Proxy inteligente** - URLs amigáveis  
✅ **Desenvolvimento independente** - Pode trabalhar em cada sistema separadamente  
✅ **Escalabilidade** - Fácil mover um sistema para outro servidor  
✅ **Manutenção simplificada** - Scripts organizados  

## Troubleshooting

### Erro: "Sistema de cobranças temporariamente indisponível"
- Verifique se o sistema de cobranças está rodando na porta 3001
- Execute: `npm run start:cobrancas`

### Erro de conexão com banco de dados
- Verifique as configurações no arquivo `.env` do sistema de cobranças
- Certifique-se de que o banco `jp_cobrancas` existe

### Problemas de CORS
- O proxy já está configurado para lidar com CORS
- Se persistir, verifique as configurações no `app.js` do sistema de cobranças

## Scripts Disponíveis

- `npm start` - Inicia apenas o sistema principal
- `npm run dev` - Inicia o sistema principal em modo desenvolvimento
- `npm run start:cobrancas` - Inicia apenas o sistema de cobranças
- `npm run dev:cobrancas` - Inicia o sistema de cobranças em modo desenvolvimento
- `npm run dev:all` - Inicia ambos os sistemas em modo desenvolvimento 