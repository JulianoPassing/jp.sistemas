# Configuração de Variáveis de Ambiente no Vercel

## 🔧 **Variáveis Necessárias**

Configure as seguintes variáveis de ambiente no painel do Vercel:

### **Banco de Dados**
```
DB_HOST=seu_host_do_banco
DB_USER=seu_usuario_do_banco
DB_PASSWORD=sua_senha_do_banco
DB_PORT=3306
```

### **Sessão**
```
SESSION_SECRET=sua_chave_secreta_muito_forte
```

## 📋 **Como Configurar**

### **Opção 1: Via Painel Web do Vercel**
1. Acesse https://vercel.com
2. Vá para seu projeto
3. Clique em "Settings"
4. Vá para "Environment Variables"
5. Adicione cada variável

### **Opção 2: Via CLI**
```bash
vercel env add DB_HOST
vercel env add DB_USER
vercel env add DB_PASSWORD
vercel env add SESSION_SECRET
```

## 🗄️ **Provedores de Banco Recomendados**

### **PlanetScale (Gratuito)**
- Host: aws.connect.psdb.cloud
- SSL: Obrigatório

### **Railway (Gratuito)**
- Host: fornecido pelo Railway
- SSL: Automático

### **Clever Cloud (Gratuito)**
- Host: fornecido pelo Clever Cloud
- SSL: Automático

## ✅ **Após Configurar**

1. Faça redeploy: `vercel --prod`
2. Teste criar um produto
3. Verifique os logs no painel do Vercel

## 🔍 **Verificar Configuração**

Para verificar se as variáveis estão configuradas:

```bash
vercel env ls
``` 