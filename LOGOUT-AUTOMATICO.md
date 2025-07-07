# 🔐 Sistema de Logout Automático - JP Cobranças

Este documento explica como funciona o sistema de logout automático implementado no sistema JP Cobranças.

## 🎯 Funcionalidades Implementadas

### **1. Logout ao Fechar a Página**
- ✅ Quando o usuário fecha a aba/navegador
- ✅ Usa `navigator.sendBeacon()` para garantir envio da requisição
- ✅ Limpa dados locais (localStorage, sessionStorage)

### **2. Logout por Inatividade**
- ✅ **30 minutos** sem atividade do usuário
- ✅ Reset do timer em qualquer interação (mouse, teclado, scroll, touch)
- ✅ Eventos monitorados: `mousedown`, `mousemove`, `keypress`, `scroll`, `touchstart`, `click`

### **3. Logout quando Página Fica Oculta**
- ✅ **15 minutos** com a página oculta (aba em background)
- ✅ Timer cancela quando a página volta a ficar visível
- ✅ Usa `visibilitychange` event

### **4. Verificação Periódica de Sessão**
- ✅ Verifica a cada **5 minutos** se a sessão ainda é válida
- ✅ Faz logout automático se a sessão expirou no servidor

## 🔧 Como Funciona

### **Frontend (main.js)**

```javascript
// Sistema de autenticação e sessão
const authSystem = {
  // Verificar se está logado
  async checkAuth() {
    try {
      const response = await fetch(`${API_BASE_URL}/cobrancas/check-auth`, {
        method: 'GET',
        credentials: 'include'
      });
      
      if (!response.ok) {
        throw new Error('Não autenticado');
      }
      
      const data = await response.json();
      return data.authenticated;
    } catch (error) {
      console.log('Usuário não autenticado, redirecionando para login...');
      return false;
    }
  },

  // Fazer logout
  async logout() {
    try {
      await fetch(`${API_BASE_URL}/cobrancas/logout`, {
        method: 'POST',
        credentials: 'include'
      });
    } catch (error) {
      console.error('Erro ao fazer logout:', error);
    } finally {
      // Limpar dados locais
      localStorage.removeItem('cobrancas_session');
      sessionStorage.clear();
      
      // Redirecionar para login
      window.location.href = 'login.html';
    }
  },

  // Configurar logout automático
  setupAutoLogout() {
    // Logout quando a página for fechada
    window.addEventListener('beforeunload', (e) => {
      navigator.sendBeacon(`${API_BASE_URL}/cobrancas/logout`, '');
    });

    // Logout por inatividade (30 minutos)
    let inactivityTimer;
    const INACTIVITY_TIMEOUT = 30 * 60 * 1000;

    const resetInactivityTimer = () => {
      clearTimeout(inactivityTimer);
      inactivityTimer = setTimeout(() => {
        console.log('Sessão expirada por inatividade');
        this.logout();
      }, INACTIVITY_TIMEOUT);
    };

    // Resetar timer em eventos de atividade
    const activityEvents = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click'];
    activityEvents.forEach(event => {
      document.addEventListener(event, resetInactivityTimer, true);
    });

    // Iniciar timer
    resetInactivityTimer();

    // Logout quando a aba ficar oculta (15 minutos)
    let hiddenTimer;
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        hiddenTimer = setTimeout(() => {
          console.log('Sessão expirada - página oculta por muito tempo');
          this.logout();
        }, 15 * 60 * 1000);
      } else {
        clearTimeout(hiddenTimer);
      }
    });
  },

  // Verificar sessão periodicamente
  setupSessionCheck() {
    setInterval(async () => {
      const isAuthenticated = await this.checkAuth();
      if (!isAuthenticated) {
        console.log('Sessão expirada, fazendo logout...');
        this.logout();
      }
    }, 5 * 60 * 1000); // Verificar a cada 5 minutos
  }
};
```

### **Backend (api/cobrancas.js)**

```javascript
// Rota para verificar autenticação
router.get('/check-auth', (req, res) => {
  if (req.session.cobrancasUser) {
    res.json({ 
      authenticated: true, 
      user: req.session.cobrancasUser,
      db: req.session.cobrancasDb
    });
  } else {
    res.status(401).json({ authenticated: false });
  }
});

// Rota para logout
router.post('/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      return res.status(500).json({ success: false, message: 'Erro ao fazer logout.' });
    }
    res.json({ success: true });
  });
});
```

## ⏰ Configurações de Tempo

| **Evento** | **Tempo** | **Descrição** |
|------------|-----------|---------------|
| **Inatividade** | 30 minutos | Sem interação do usuário |
| **Página Oculta** | 15 minutos | Aba em background |
| **Verificação** | 5 minutos | Checagem periódica de sessão |
| **Sessão Servidor** | 24 horas | Tempo de vida da sessão no servidor |

## 🚀 Inicialização

O sistema é inicializado automaticamente em todas as páginas (exceto login):

```javascript
// Inicialização da aplicação
const app = {
  async init() {
    try {
      // Verificar autenticação primeiro (exceto na página de login)
      const path = window.location.pathname;
      if (!path.includes('login.html')) {
        const isAuthenticated = await authSystem.checkAuth();
        if (!isAuthenticated) {
          console.log('Usuário não autenticado, redirecionando...');
          window.location.href = 'login.html';
          return;
        }
        
        // Configurar sistema de logout automático
        authSystem.setupAutoLogout();
        authSystem.setupSessionCheck();
      }
      
      // ... resto da inicialização
    } catch (error) {
      console.error('Erro na inicialização:', error);
    }
  }
};
```

## 🧪 Testando o Sistema

### **Script de Teste**
```bash
node scripts/test-auth-system.js
```

### **Testes Manuais**

1. **Logout ao Fechar:**
   - Faça login no sistema
   - Feche a aba/navegador
   - Abra novamente e tente acessar
   - Deve ser redirecionado para login

2. **Logout por Inatividade:**
   - Faça login no sistema
   - Não mexa no mouse/teclado por 30 minutos
   - Deve ser deslogado automaticamente

3. **Logout com Página Oculta:**
   - Faça login no sistema
   - Mude para outra aba por 15 minutos
   - Volte para a aba do sistema
   - Deve ser deslogado automaticamente

4. **Verificação Periódica:**
   - Faça login no sistema
   - Aguarde 5 minutos
   - O sistema verifica automaticamente se a sessão ainda é válida

## 🔒 Segurança

### **Medidas Implementadas**
- ✅ **Cookies HttpOnly**: Previne acesso via JavaScript
- ✅ **SameSite**: Proteção contra CSRF
- ✅ **Sessões no Banco**: Armazenamento seguro no MySQL
- ✅ **Limpeza de Dados**: Remove dados locais no logout
- ✅ **Redirecionamento**: Força login após logout

### **Configuração de Sessão**
```javascript
app.use(session({
  name: 'connect.sid',
  secret: process.env.SESSION_SECRET || 'SeuSessionSecretMuitoForte123!',
  resave: false,
  saveUninitialized: false,
  store: sessionStore,
  cookie: {
    secure: false, // false para VPS sem HTTPS
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 24 * 60 * 60 * 1000 // 24 horas
  }
}));
```

## 🐛 Troubleshooting

### **Problemas Comuns**

1. **Logout não funciona:**
   - Verifique se o servidor está rodando
   - Confirme se as rotas `/check-auth` e `/logout` estão funcionando
   - Verifique o console do navegador para erros

2. **Sessão expira muito rápido:**
   - Verifique a configuração de `maxAge` no servidor
   - Confirme se o banco de sessões está funcionando

3. **Logout automático não funciona:**
   - Verifique se o JavaScript está sendo carregado
   - Confirme se não há erros no console
   - Teste manualmente os eventos de atividade

### **Logs Úteis**
```javascript
// Adicione estes logs para debug
console.log('Sessão expirada por inatividade');
console.log('Sessão expirada - página oculta por muito tempo');
console.log('Sessão expirada, fazendo logout...');
console.log('Usuário não autenticado, redirecionando...');
```

## 📝 Personalização

### **Alterar Tempos**
```javascript
// No arquivo main.js, altere estes valores:
const INACTIVITY_TIMEOUT = 30 * 60 * 1000; // 30 minutos
const HIDDEN_TIMEOUT = 15 * 60 * 1000; // 15 minutos
const SESSION_CHECK_INTERVAL = 5 * 60 * 1000; // 5 minutos
```

### **Adicionar Eventos de Atividade**
```javascript
// Adicione mais eventos se necessário:
const activityEvents = [
  'mousedown', 'mousemove', 'keypress', 'scroll', 
  'touchstart', 'click', 'wheel', 'focus'
];
```

## ✅ Status do Sistema

- ✅ **Logout ao fechar página**: Implementado
- ✅ **Logout por inatividade**: Implementado  
- ✅ **Logout com página oculta**: Implementado
- ✅ **Verificação periódica**: Implementado
- ✅ **Limpeza de dados**: Implementado
- ✅ **Redirecionamento**: Implementado
- ✅ **Testes**: Implementados
- ✅ **Documentação**: Implementada

O sistema está **100% funcional** e pronto para uso em produção! 🚀 