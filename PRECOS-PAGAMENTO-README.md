# Página de Preços - Pagamento via Mercado Pago

## Resumo das alterações

A página de preços (`precos.html`) foi refatorada com:

1. **Design profissional** – Modal de pagamento com resumo da compra, formulário organizado e validações
2. **Pagamento unificado via Mercado Pago** – PIX, cartão e boleto em um único fluxo
3. **Cupons de desconto** – Sistema de cupons configurável
4. **Email automático** – Após pagamento aprovado, email é enviado para `julianosalm@gmail.com`

## Cupons disponíveis

| Código      | Desconto |
|-------------|----------|
| PROMO10     | 10%      |
| 20PROMO     | 20%      |
| JPSISTEMAS50| 50%      |

### Como adicionar novos cupons

Edite o objeto `CUPONS` em `public/precos.html`:

```javascript
const CUPONS = {
  'PROMO10': { desconto: 10, desc: '10%' },
  'SEUCODIGO': { desconto: 15, desc: '15%' }
};
```

## Configuração necessária

### Mercado Pago
- `MP_ACCESS_TOKEN` no `.env` (já utilizado no projeto)
- `MP_BASE_URL` (opcional) – URL base do site para redirect após pagamento

### Email (para envio de confirmação)
- `SMTP_USER` ou `BACKUP_EMAIL_USER` – ex: `suporte.jpsistemas@gmail.com`
- `SMTP_PASS` ou `BACKUP_EMAIL_APP_PASSWORD` – **obrigatório usar Senha de app do Gmail** (não a senha normal da conta)

**Gmail:** A senha normal não funciona. Crie uma "Senha de app" em: https://myaccount.google.com/apppasswords

**Formato no .env (sem espaços):**
```
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=suporte.jpsistemas@gmail.com
SMTP_PASS=xxxx xxxx xxxx xxxx
```

Se o SMTP não estiver configurado, o pagamento funciona normalmente, mas o email não é enviado.

### Banco de dados
- A tabela `pagamentos_precos` é criada automaticamente no banco `jpsistemas_sessions` na primeira compra
- Para usar outro banco: `DB_PRECOS_DATABASE=nome_do_banco`

## Fluxo do pagamento

1. Usuário clica no plano, preenche dados e aplica cupom (se tiver)
2. Clica em "Ir para pagamento seguro"
3. É redirecionado ao Mercado Pago (PIX, cartão ou boleto)
4. Após pagamento aprovado, retorna ao site
5. Email é enviado automaticamente para `julianosalm@gmail.com` com os dados do cliente e plano
