# Configuração Mercado Pago - Pagamentos na Página de Preços

## O que foi implementado

Na página **precos.html**, ao clicar em um plano, o usuário pode escolher:

1. **PIX** – Exibe o QR Code existente para cada plano (pagamento via transferência)
2. **Cartão / Boleto** – Redireciona para o Checkout Pro do Mercado Pago

## Configuração necessária

### 1. Criar conta no Mercado Pago

1. Acesse [Mercado Pago Developers](https://www.mercadopago.com.br/developers/)
2. Crie ou acesse sua conta de vendedor
3. Crie uma aplicação em **Suas integrações**
4. Em **Credenciais**, copie o **Access Token** (Produção para pagamentos reais, Teste para testes)

### 2. Variáveis de ambiente

Adicione no arquivo `.env` na raiz do projeto:

```
MP_ACCESS_TOKEN=seu_access_token_aqui
MP_BASE_URL=https://jp-sistemas.com
```

- **MP_ACCESS_TOKEN**: Access Token do Mercado Pago (obrigatório)
- **MP_BASE_URL**: URL base do site para retorno após pagamento (recomendado em VPS com proxy). Ex: `https://jp-sistemas.com` (sem barra no final)

**Importante:** Nunca coloque o Access Token no código ou em repositório público.

### 3. Instalar dependência

```bash
npm install
```

(O pacote `mercadopago` já está listado no `package.json`.)

### 4. URLs de retorno

O Checkout Pro está configurado para redirecionar para:

- Sucesso: `/precos.html?status=success`
- Falha: `/precos.html?status=failure`
- Pendente: `/precos.html?status=pending`

## Fluxo do usuário

1. Usuário clica em um plano (Mensal, Trimestral, Semestral ou Anual)
2. Preenche nome, CPF, e-mail e telefone
3. Escolhe a forma de pagamento:
   - **PIX**: exibe QR Code e dados bancários; usuário escaneia e paga
   - **Cartão / Boleto**: é redirecionado ao Mercado Pago para concluir o pagamento

## API utilizada

- **Endpoint:** `POST /api/mercadopago/preference`
- **Body:** `{ planName, amount, quantity, payer }`
- **Resposta:** `{ init_point, preference_id }`

## Sem Mercado Pago configurado

Se `MP_ACCESS_TOKEN` não estiver definido, o botão "Cartão / Boleto" mostra uma mensagem de erro ao ser clicado. O PIX continua funcionando normalmente.
