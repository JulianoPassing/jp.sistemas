# Guia de Verificação de Autenticação na VPS

## 🔧 Configurações Aplicadas

✅ **Endpoint `/api/auth/user` criado** - Para verificar autenticação via cookie
✅ **Cookies configurados para HTTPS** - `secure: true` e `sameSite: 'none'`
✅ **Frontend atualizado** - Todas as páginas usam autenticação via cookie

## 🚀 Passos para Testar

### 1. Reiniciar o Servidor
```bash
chmod +x restart-server.sh
./restart-server.sh
```

### 2. Verificar se o Servidor Está Rodando
```bash
ps aux | grep "node server.js"
tail -f server.log
```

### 3. Testar a Autenticação
```bash
# Instalar node-fetch se necessário
npm install node-fetch

# Testar com a URL da sua VPS
node test-vps-auth.js https://sua-vps.com
```

## 🔍 Verificação Manual no Navegador

### 1. Abrir DevTools (F12)
- Vá para a aba **Application** > **Cookies**
- Faça login no sistema
- Verifique se aparece um cookie chamado `token`

### 2. Testar Endpoint
- Vá para: `https://sua-vps.com/api/auth/user`
- Se estiver logado, deve retornar JSON com dados do usuário
- Se não estiver logado, deve retornar 401

### 3. Verificar Network
- Na aba **Network**, faça login
- Procure pela requisição `/api/auth/login`
- Verifique se retorna status 200 e seta o cookie

## 🐛 Possíveis Problemas e Soluções

### Problema: Cookie não está sendo setado
**Solução:** Verificar se a VPS tem HTTPS configurado corretamente

### Problema: Cookie não está sendo enviado
**Solução:** Verificar se o frontend está usando `credentials: 'include'`

### Problema: Endpoint retorna 404
**Solução:** Verificar se o servidor foi reiniciado após as mudanças

### Problema: Endpoint retorna 401
**Solução:** Verificar se o JWT_SECRET está configurado no .env

## 📋 Checklist de Verificação

- [ ] Servidor reiniciado após mudanças
- [ ] Cookie `token` aparece após login
- [ ] Endpoint `/api/auth/user` retorna dados do usuário
- [ ] Login permanece após recarregar a página
- [ ] Logout limpa o cookie corretamente

## 🔧 Configurações Importantes

### Variáveis de Ambiente (.env)
```env
JWT_SECRET=sua_chave_secreta_aqui
DB_HOST=localhost
DB_USER=seu_usuario
DB_PASSWORD=sua_senha
```

### Configuração de Cookies (server.js)
```javascript
res.cookie('token', token, {
  httpOnly: true,
  secure: true,        // true para HTTPS
  sameSite: 'none',    // para cross-domain
  maxAge: 24 * 60 * 60 * 1000 // 24 horas
});
```

## 📞 Suporte

Se ainda houver problemas:
1. Verifique os logs: `tail -f server.log`
2. Teste o endpoint: `curl -X GET https://sua-vps.com/api/auth/user`
3. Verifique se o HTTPS está funcionando corretamente 