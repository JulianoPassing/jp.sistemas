# Configuração do Backup por E-mail (JP-Cobranças)

O backup por e-mail é enviado **do e-mail de suporte** (suporte.jpsistemas@gmail.com) **para o e-mail cadastrado do usuário** no perfil do sistema. O usuário deve ter um e-mail cadastrado em **Configurações > Perfil** para receber o backup.

---

## O que é enviado

- **Backup de Empréstimos** — planilha Excel e relatório PDF (mesmo padrão dos botões “Backup Excel” e “Backup PDF”).
- **Carteira de Clientes** — planilha Excel e relatório PDF com todos os clientes do usuário (ID, Nome, CPF/CNPJ, Email, Telefone, Endereço, Cidade, Estado, CEP, Status, Observações, Data Cadastro).

O corpo do e-mail é em HTML, com logo do sistema, data e hora da solicitação do backup.

---

## Configuração no servidor (Gmail)

Para o envio ser feito a partir de **suporte.jpsistemas@gmail.com**, configure as variáveis de ambiente no servidor (arquivo `.env` ou painel da VPS/Vercel).

### 1. Usar o Gmail com “Senha de app”

O Gmail exige **Senha de app** (não a senha normal da conta) quando o acesso é por SMTP em aplicações.

1. Acesse sua conta Google: https://myaccount.google.com/  
2. Ative a **verificação em duas etapas** (se ainda não estiver ativa):  
   - Segurança > Verificação em duas etapas > Ativar  
3. Gere uma **Senha de app**:  
   - Segurança > Verificação em duas etapas > Senhas de app  
   - Ou direto: https://myaccount.google.com/apppasswords  
   - Selecione “Outro (nome personalizado)” e digite por exemplo: `JP-Cobranças Backup`  
   - Copie a senha de 16 caracteres gerada (ex.: `abcd efgh ijkl mnop`).

### 2. Variáveis no `.env`

No mesmo `.env` do projeto, adicione ou ajuste:

```env
# E-mail de envio do backup (remetente)
SMTP_USER=suporte.jpsistemas@gmail.com
SMTP_PASS=abcdefghijklmnop
```

- **SMTP_USER**: e-mail que envia (no seu caso, `suporte.jpsistemas@gmail.com`).  
- **SMTP_PASS**: **Senha de app** do Gmail (a de 16 caracteres, pode colar com ou sem espaços).

Opcionalmente, para deixar explícito que é para o backup:

```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=suporte.jpsistemas@gmail.com
SMTP_PASS=sua_senha_de_app_16_caracteres
```

Se não definir `SMTP_USER`, o código usa como padrão `suporte.jpsistemas@gmail.com`.  
Se não definir `SMTP_PASS` (ou `BACKUP_EMAIL_APP_PASSWORD`), a rota de backup por e-mail retorna erro informando que o serviço de e-mail não está configurado.

### 3. Alternativa: variáveis só para backup

Se quiser usar outras variáveis apenas para esse recurso:

```env
BACKUP_EMAIL_USER=suporte.jpsistemas@gmail.com
BACKUP_EMAIL_APP_PASSWORD=sua_senha_de_app_16_caracteres
```

O backend usa, nessa ordem: `SMTP_PASS` ou `BACKUP_EMAIL_APP_PASSWORD`; e `SMTP_USER` ou `BACKUP_EMAIL_USER` (e, se não definir usuário, o padrão é `suporte.jpsistemas@gmail.com`).

---

## Resumo do que você precisa

| Onde | O quê |
|------|--------|
| **Conta Google** | Conta `suporte.jpsistemas@gmail.com` com **verificação em duas etapas** ativada |
| **Google – Senha de app** | Gerar uma “Senha de app” em https://myaccount.google.com/apppasswords |
| **Servidor (.env)** | `SMTP_USER=suporte.jpsistemas@gmail.com` e `SMTP_PASS=senha_de_16_caracteres` (ou usar `BACKUP_EMAIL_*`) |

Depois de salvar o `.env`, reinicie a aplicação (ex.: `pm2 restart all` ou reiniciar o processo do Node) para as variáveis passarem a valer.

---

## Erro 413 (Content Too Large)

Se ao clicar em **Backup via E-mail** aparecer **413** no navegador (F12), o envio dos 4 arquivos está sendo bloqueado por limite de tamanho. O backup pode passar de **10–50 MB** no total.

### Se usar Nginx na frente do Node (ex.: VPS, jp-sistemas.com)

No arquivo de configuração do site (ex.: `/etc/nginx/sites-available/jp-sistemas` ou dentro do `server { ... }`), adicione ou altere:

```nginx
client_max_body_size 70M;
```

Exemplo completo dentro do `server`:

```nginx
server {
    listen 80;
    server_name jp-sistemas.com www.jp-sistemas.com;
    client_max_body_size 70M;   # permite upload de até 70 MB (backup por e-mail)

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

Depois, recarregue o Nginx:

```bash
sudo nginx -t && sudo systemctl reload nginx
```

### Já ajustado no Node

No `server.js` o limite de corpo da requisição foi aumentado para **70 MB** (`express.json` e `express.urlencoded`). O 413 em produção costuma vir do Nginx; ajuste o `client_max_body_size` como acima.

---

## Onde fica o botão

O botão **“Backup via E-mail”** está na tela **Empréstimos** (`emprestimos.html`), ao lado de “Backup Excel” e “Backup PDF”. Ao clicar, o sistema gera os 4 arquivos (Empréstimos Excel/PDF e Carteira de Clientes Excel/PDF) e envia para o e-mail cadastrado do usuário logado.
