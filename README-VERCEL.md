# 🚀 J.P Sistemas - Deploy no Vercel

Sistema de Gestão Comercial Multi-Tenancy otimizado para deploy no Vercel com suporte a múltiplos bancos de dados individuais.

## ✨ Características

- **Multi-Tenancy**: Cada usuário possui seu próprio banco de dados isolado
- **Escalabilidade**: Suporte a múltiplos provedores de banco de dados
- **Performance**: Otimizado para serverless functions do Vercel
- **Segurança**: Isolamento total de dados entre usuários
- **Interface Moderna**: UI responsiva e intuitiva

## 🗄️ Provedores de Banco de Dados Suportados

### 1. PlanetScale (Recomendado) ⭐
- Integração nativa com Vercel
- MySQL/MariaDB compatível
- Escalabilidade automática
- Backup automático

### 2. Railway
- Deploy automático
- Suporte a MySQL
- Preços competitivos

### 3. Clever Cloud
- Suporte a MySQL/MariaDB
- Serviços europeus
- Boa performance

## 🚀 Deploy Rápido

### Passo 1: Preparar o Repositório

```bash
# Clone o repositório
git clone https://github.com/seu-usuario/jpsistemas.git
cd jpsistemas

# Instale as dependências
npm install
```

### Passo 2: Configurar Banco de Dados

1. **Crie uma conta no PlanetScale**:
   - Acesse [planetscale.com](https://planetscale.com)
   - Crie uma conta gratuita
   - Crie um novo banco de dados

2. **Configure as variáveis de ambiente**:
   ```env
   DATABASE_PROVIDER=planetscale
   PLANETSCALE_HOST=aws.connect.psdb.cloud
   PLANETSCALE_USERNAME=seu_username
   PLANETSCALE_PASSWORD=sua_senha
   NODE_ENV=production
   JWT_SECRET=SeuJWTSecretMuitoForte123!
   SESSION_SECRET=SeuSessionSecretMuitoForte123!
   ```

### Passo 3: Deploy no Vercel

#### Opção A: Via CLI (Recomendado)

```bash
# Instale o Vercel CLI
npm i -g vercel

# Faça login
vercel login

# Deploy
vercel

# Para produção
vercel --prod
```

#### Opção B: Via GitHub

1. Push para GitHub:
```bash
git add .
git commit -m "Preparando deploy no Vercel"
git push origin main
```

2. No Vercel:
   - Acesse [vercel.com](https://vercel.com)
   - Clique em "New Project"
   - Importe seu repositório
   - Configure as variáveis de ambiente

### Passo 4: Inicializar Banco de Dados

Após o deploy, execute o script de inicialização:

```bash
npm run init-vercel
```

## 🔧 Configuração Detalhada

### Variáveis de Ambiente

Configure no painel do Vercel em **Settings > Environment Variables**:

```env
# Provedor de Banco
DATABASE_PROVIDER=planetscale

# PlanetScale
PLANETSCALE_HOST=aws.connect.psdb.cloud
PLANETSCALE_USERNAME=seu_username
PLANETSCALE_PASSWORD=sua_senha

# Aplicação
NODE_ENV=production
JWT_SECRET=SeuJWTSecretMuitoForte123!
SESSION_SECRET=SeuSessionSecretMuitoForte123!

# Segurança
CORS_ORIGIN=https://seu-dominio.vercel.app
```

### Estrutura de Bancos

O sistema cria automaticamente:

```
📊 Estrutura Multi-Tenancy
├── jpsistemas_users (Banco principal)
│   └── users (Tabela de autenticação)
├── jpsistemas_sessions (Sessões)
│   └── sessions (Sessões ativas)
├── jpsistemas_admin (Banco do admin)
│   ├── clientes
│   ├── produtos
│   ├── pedidos
│   └── pedido_itens
├── jpsistemas_usuario1 (Banco do usuário 1)
│   ├── clientes
│   ├── produtos
│   ├── pedidos
│   └── pedido_itens
└── ... (um banco por usuário)
```

## 🔑 Acesso Inicial

Após a inicialização, você terá acesso com:

- **Usuário**: `admin`
- **Senha**: `admin123`

⚠️ **IMPORTANTE**: Altere a senha após o primeiro login!

## 📊 Monitoramento

### Logs do Vercel

Acesse **Functions > server.js** no painel do Vercel para ver logs em tempo real.

### Métricas Automáticas

- Performance
- Uptime
- Requisições
- Erros

## 🔄 Atualizações

### Deploy Automático

```bash
# Desenvolvimento
git add .
git commit -m "Nova funcionalidade"
git push origin main

# O Vercel fará deploy automático
```

### Rollback

No painel do Vercel, você pode fazer rollback para versões anteriores.

## 🛠️ Troubleshooting

### Problemas Comuns

1. **Erro de Conexão com Banco**:
   - Verifique as variáveis de ambiente
   - Confirme se o banco está acessível
   - Para PlanetScale, verifique SSL

2. **Erro de Build**:
   - Verifique Node.js 18+
   - Confirme dependências no `package.json`

3. **Erro de Sessão**:
   - Verifique se `jpsistemas_sessions` existe
   - Confirme configurações de sessão

### Logs de Debug

```javascript
// Adicione no código para debug
console.log('Configuração:', getDatabaseConfig());
```

## 📈 Escalabilidade

### Multi-Tenancy

- Cada usuário tem banco isolado
- Dados completamente separados
- Escalabilidade individual

### Performance

- **Vercel Edge Network**: Distribuição global
- **Serverless Functions**: Escala automática
- **Connection Pooling**: Conexões otimizadas

## 💰 Custos

### Vercel (Gratuito)
- 100GB de banda/mês
- 100GB de storage
- 100GB de função serverless
- Domínios ilimitados

### PlanetScale (Gratuito)
- 1GB de storage
- 1 bilhão de reads/mês
- 10 milhões de writes/mês
- 1 branch de desenvolvimento

## 🆘 Suporte

### Recursos Úteis

- [Documentação do Vercel](https://vercel.com/docs)
- [Documentação do PlanetScale](https://planetscale.com/docs)
- [Guia Completo de Deploy](DEPLOY-VERCEL.md)

### Contato

Para suporte específico:
- WhatsApp: [Fale Conosco](https://whatsa.me/5548996852138)
- Email: suporte@jpsistemas.com

## ✅ Checklist de Deploy

- [ ] Conta no Vercel criada
- [ ] Provedor de banco configurado
- [ ] Variáveis de ambiente configuradas
- [ ] Banco de dados inicializado
- [ ] Deploy realizado com sucesso
- [ ] Domínio personalizado configurado (opcional)
- [ ] Testes realizados
- [ ] Monitoramento configurado

---

**🎉 Seu sistema está pronto para produção!**

Para mais detalhes, consulte o [Guia Completo de Deploy](DEPLOY-VERCEL.md). 