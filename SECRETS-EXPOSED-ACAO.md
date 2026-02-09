# ⚠️ Credenciais SMTP expostas no GitHub (GitGuardian)

O GitGuardian detectou que **credenciais SMTP** (senha de app do Gmail) foram enviadas para o repositório no GitHub.

---

## O que fazer **agora** (em ordem)

### 1. Revogar a senha de app do Gmail

A senha que estava no código **não é mais segura**. Revogue-a:

1. Acesse: https://myaccount.google.com/apppasswords  
2. Entre com a conta **suporte.jpsistemas@gmail.com**  
3. Localize a senha de app usada para o backup (ex.: "JP-Cobranças" ou "Mail")  
4. Clique em **Remover** / **Revogar**

### 2. Criar uma **nova** senha de app

1. No mesmo endereço, crie uma **nova** senha de app  
2. Use um nome como "JP-Cobranças Backup (nova)"  
3. Copie a senha de 16 caracteres (guarde só no servidor, veja abaixo)

### 3. Atualizar **apenas no servidor** (nunca no GitHub)

No servidor onde a aplicação roda (VPS, etc.):

- Edite o arquivo **`.env`** (fora do Git ou em um local que **não** seja commitado)  
- Coloque a **nova** senha:

```env
SMTP_USER=suporte.jpsistemas@gmail.com
SMTP_PASS=nova_senha_de_16_caracteres
```

- Reinicie a aplicação (ex.: `pm2 restart all`)

**Nunca** commite o `.env` ou qualquer arquivo com a senha real no repositório.

### 4. Garantir que `.env` não seja commitado

Foi criado um **`.gitignore`** na raiz do projeto com:

- `.env`  
- `env.pronto.txt`  
- outros arquivos sensíveis  

Se o `.env` **já foi commitado** no passado:

- Remova-o do controle do Git (sem apagar o arquivo no servidor):  
  `git rm --cached .env`  
- Faça commit:  
  `git add .gitignore` e `git commit -m "chore: add .gitignore, stop tracking .env"`  
- O `.env` continuará existindo na sua máquina/servidor, mas não será mais versionado.

### 5. (Opcional) Limpar a senha antiga do histórico do Git

A senha antiga continua no **histórico** de commits. Para tentar removê-la:

- Use ferramentas como **BFG Repo-Cleaner** ou `git filter-repo` para reescrever o histórico e remover o arquivo/trecho que continha a senha.  
- Isso reescreve commits; se o repositório for compartilhado, avise a equipe e siga um fluxo de “force push” combinado.

Se o repositório for só seu e você aceitar reescrever o histórico, posso indicar os comandos básicos para BFG ou `git filter-repo` em um próximo passo.

---

## Resumo

| Ação                         | Onde / Como                                      |
|-----------------------------|---------------------------------------------------|
| Revogar senha de app antiga | Google → Senhas de app → Remover a usada no backup |
| Criar nova senha de app     | Google → Senhas de app → Criar nova               |
| Atualizar senha             | Apenas no `.env` **no servidor** (nunca no GitHub) |
| Não commitar `.env`         | Usar o `.gitignore` e `git rm --cached .env` se já tiver sido commitado |

Depois disso, o backup por e-mail continuará funcionando com a nova senha, e novas exposições serão evitadas pelo `.gitignore`.
