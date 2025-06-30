# 🚀 Guia de Deploy no Vercel - J.P Sistemas Multi-Tenancy

## 📋 Pré-requisitos

- Conta no [Vercel](https://vercel.com)
- Conta em um provedor de banco de dados (recomendamos PlanetScale)
- Git configurado no seu computador
- Node.js 18+ instalado

## 🗄️ Escolhendo o Provedor de Banco de Dados

### 1. PlanetScale (Recomendado) ⭐
- **Vantagens**: 
  - Integração nativa com Vercel
  - Suporte a MySQL/MariaDB
  - Escalabilidade automática
  - Backup automático
  - Interface web amigável

- **Setup**:
  1. Acesse [planetscale.com](https://planetscale.com)
  2. Crie uma conta gratuita
  3. Crie um novo banco de dados
  4. Copie as credenciais de conexão

### 2. Railway
- **Vantagens**: 
  - Deploy automático
  - Suporte a MySQL
  - Preços competitivos

### 3. Clever Cloud
- **Vantagens**: 
  - Suporte a MySQL/MariaDB
  - Serviços europeus
  - Boa performance

## 🔧 Configuração do Projeto

### 1. Clone e Prepare o Repositório

```bash
# Clone o repositório
git clone https://github.com/seu-usuario/jpsistemas.git
cd jpsistemas

# Instale as dependências
npm install

# Copie o arquivo de exemplo de variáveis
cp env.example .env
```

### 2. Configure as Variáveis de Ambiente

Edite o arquivo `.env` com suas configurações:

```env
# Escolha o provedor
DATABASE_PROVIDER=planetscale

# Configurações do PlanetScale
PLANETSCALE_HOST=aws.connect.psdb.cloud
PLANETSCALE_USERNAME=seu_username
PLANETSCALE_PASSWORD=sua_senha

# Configurações da aplicação
NODE_ENV=production
JWT_SECRET=SeuJWTSecretMuitoForte123!
SESSION_SECRET=SeuSessionSecretMuitoForte123!
```

### 3. Inicialize o Banco de Dados

```bash
# Execute o script de inicialização
npm run init-db
```

## 🚀 Deploy no Vercel

### Método 1: Deploy via CLI (Recomendado)

```bash
# Instale o Vercel CLI
npm i -g vercel

# Faça login no Vercel
vercel login

# Deploy do projeto
vercel

# Para produção
vercel --prod
```

### Método 2: Deploy via GitHub

1. **Push para GitHub**:
```bash
git add .
git commit -m "Preparando deploy no Vercel"
git push origin main
```

2. **Conecte no Vercel**:
   - Acesse [vercel.com](https://vercel.com)
   - Clique em "New Project"
   - Importe seu repositório do GitHub
   - Configure as variáveis de ambiente

### 3. Configure as Variáveis de Ambiente no Vercel

No painel do Vercel, vá em **Settings > Environment Variables** e adicione:

```env
DATABASE_PROVIDER=planetscale
PLANETSCALE_HOST=aws.connect.psdb.cloud
PLANETSCALE_USERNAME=seu_username
PLANETSCALE_PASSWORD=sua_senha
NODE_ENV=production
JWT_SECRET=SeuJWTSecretMuitoForte123!
SESSION_SECRET=SeuSessionSecretMuitoForte123!
```

## 🗄️ Configuração do Banco de Dados

### Para PlanetScale:

1. **Crie o banco principal**:
```sql
-- Banco de usuários
CREATE DATABASE jpsistemas_users;

-- Banco de sessões
CREATE DATABASE jpsistemas_sessions;
```

2. **Execute o script de inicialização**:
```bash
npm run init-db
```

### Para outros provedores:

Siga as instruções específicas do seu provedor para criar os bancos necessários.

## 🔒 Configurações de Segurança

### 1. Domínio Personalizado (Opcional)

No Vercel, vá em **Settings > Domains** e adicione seu domínio.

### 2. HTTPS Automático

O Vercel fornece HTTPS automaticamente para todos os domínios.

### 3. Rate Limiting

O sistema já inclui rate limiting configurado. Você pode ajustar em `server.js`.

## 📊 Monitoramento

### 1. Logs do Vercel

Acesse **Functions > server.js** no painel do Vercel para ver os logs.

### 2. Métricas

O Vercel fornece métricas automáticas de:
- Performance
- Uptime
- Requisições
- Erros

## 🔄 Atualizações

### Deploy de Atualizações

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
   - Verifique se o provedor suporta SSL

2. **Erro de Build**:
   - Verifique se o Node.js 18+ está sendo usado
   - Confirme se todas as dependências estão no `package.json`

3. **Erro de Sessão**:
   - Verifique se o banco `jpsistemas_sessions` existe
   - Confirme as configurações de sessão

### Logs de Debug

Para debug, adicione logs no código:

```javascript
console.log('Configuração do banco:', getDatabaseConfig());
```

## 📈 Escalabilidade

### Multi-Tenancy

O sistema suporta múltiplos usuários com bancos isolados:

- Cada usuário tem seu próprio banco: `jpsistemas_username`
- Dados completamente isolados
- Escalabilidade individual por usuário

### Performance

- **Vercel Edge Network**: Distribuição global
- **Serverless Functions**: Escala automática
- **Database Connection Pooling**: Conexões otimizadas

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
- [Comunidade Vercel](https://github.com/vercel/vercel/discussions)

### Contato

Para suporte específico do J.P Sistemas:
- WhatsApp: [Link do WhatsApp](https://whatsa.me/5548996852138)
- Email: suporte@jpsistemas.com

---

## ✅ Checklist de Deploy

- [ ] Conta no Vercel criada
- [ ] Provedor de banco configurado
- [ ] Variáveis de ambiente configuradas
- [ ] Banco de dados inicializado
- [ ] Deploy realizado com sucesso
- [ ] Domínio personalizado configurado (opcional)
- [ ] Testes realizados
- [ ] Monitoramento configurado

**🎉 Seu sistema está pronto para produção!** 