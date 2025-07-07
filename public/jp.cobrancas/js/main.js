// Configurações da API
const API_BASE_URL = '/api';

// Estado global da aplicação
const appState = {
  isLoading: false,
  data: {
    dashboard: null,
    emprestimos: [],
    cobrancas: []
  }
};

// Sistema de autenticação usando o mesmo padrão do sistema principal
const authSystem = {
  // Verificar se está logado (usando sessionStorage como o sistema principal)
  checkAuth() {
    return sessionStorage.getItem('loggedIn') === 'true';
  },

  // Fazer logout (usando o mesmo padrão do sistema principal)
  async logout() {
    try {
      // Limpar sessionStorage (mesmo padrão do sistema principal)
      sessionStorage.removeItem('loggedIn');
      sessionStorage.removeItem('username');
      sessionStorage.removeItem('loginTime');
      
      // Tentar fazer logout no servidor (opcional)
      try {
        await fetch(`${API_BASE_URL}/cobrancas/logout`, {
          method: 'POST',
          credentials: 'include'
        });
      } catch (error) {
        console.log('Logout do servidor falhou, mas sessionStorage foi limpo');
      }
      
      // Redirecionar para login
      window.location.href = 'login.html';
    } catch (error) {
      console.error('Erro ao fazer logout:', error);
      // Mesmo com erro, limpar sessionStorage e redirecionar
      sessionStorage.clear();
      window.location.href = 'login.html';
    }
  },

  // Configurar logout automático (simplificado)
  setupAutoLogout() {
    // Logout por inatividade (30 minutos)
    let inactivityTimer;
    const INACTIVITY_TIMEOUT = 30 * 60 * 1000; // 30 minutos

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
        }, 15 * 60 * 1000); // 15 minutos
      } else {
        clearTimeout(hiddenTimer);
      }
    });
  },

  // Exibir mensagem de boas-vindas
  showWelcomeMessage() {
    const welcomeElement = document.getElementById('welcomeMessage');
    if (welcomeElement) {
      const username = sessionStorage.getItem('username') || 'Usuário';
      // Capitalizar primeira letra do nome
      const capitalizedUsername = username.charAt(0).toUpperCase() + username.slice(1).toLowerCase();
      welcomeElement.textContent = `Bem-vindo(a), ${capitalizedUsername}!`;
    }
  }
};

// Utilitários
const utils = {
  // Formatação de moeda
  formatCurrency: (value) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  },

  // Formatação de data
  formatDate: (date) => {
    return new Intl.DateTimeFormat('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    }).format(new Date(date));
  },

  // Formatação de data e hora
  formatDateTime: (date) => {
    return new Intl.DateTimeFormat('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(new Date(date));
  },

  // Cálculo de dias de atraso
  calculateDaysLate: (dueDate) => {
    const today = new Date();
    const due = new Date(dueDate);
    const diffTime = today - due;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays > 0 ? diffDays : 0;
  },

  // Debounce para otimizar requisições
  debounce: (func, wait) => {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  },

  // Animações suaves
  animateValue: (element, start, end, duration) => {
    const startTime = performance.now();
    const startValue = parseFloat(start) || 0;
    const endValue = parseFloat(end) || 0;
    
    function updateValue(currentTime) {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      
      const currentValue = startValue + (endValue - startValue) * progress;
      element.textContent = utils.formatCurrency(currentValue);
      
      if (progress < 1) {
        requestAnimationFrame(updateValue);
      }
    }
    
    requestAnimationFrame(updateValue);
  }
};

// API Service
const apiService = {
  async request(endpoint, options = {}) {
    const url = `${API_BASE_URL}${endpoint}`;
    const config = {
      credentials: 'include', // Sempre incluir cookies de sessão
      headers: {
        'Content-Type': 'application/json',
        ...options.headers
      },
      ...options
    };

    try {
      const response = await fetch(url, config);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error('API Error:', error);
      throw error;
    }
  },

  // Dashboard
  async getDashboardData() {
    return this.request('/cobrancas/dashboard');
  },

  // Clientes
  async getClientes() {
    return this.request('/cobrancas/clientes');
  },

  async createCliente(clienteData) {
    return this.request('/cobrancas/clientes', {
      method: 'POST',
      body: JSON.stringify(clienteData)
    });
  },

  // Empréstimos
  async getEmprestimos() {
    return this.request('/cobrancas/emprestimos');
  },

  async createEmprestimo(emprestimoData) {
    console.log('Dados sendo enviados para criar empréstimo:', emprestimoData);
    return this.request('/cobrancas/emprestimos', {
      method: 'POST',
      body: JSON.stringify(emprestimoData)
    });
  },

  // Cobranças
  async getCobrancas() {
    return this.request('/cobrancas/cobrancas');
  }
};

// UI Components
const ui = {
  // Loading states
  showLoading(element) {
    if (element && element.classList) {
      element.classList.add('loading');
    }
  },

  hideLoading(element) {
    if (element && element.classList) {
      element.classList.remove('loading');
    }
  },

  // Notificações
  showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.innerHTML = `
      <div class="notification-content">
        <span>${message}</span>
        <button class="notification-close">&times;</button>
      </div>
    `;

    document.body.appendChild(notification);

    // Auto remove após 5 segundos
    setTimeout(() => {
      notification.remove();
    }, 5000);

    // Close button
    notification.querySelector('.notification-close').addEventListener('click', () => {
      notification.remove();
    });
  },

  // Modal
  showModal(content, title = '') {
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.innerHTML = `
      <div class="modal-overlay"></div>
      <div class="modal-content">
        <div class="modal-header">
          <h3>${title}</h3>
          <button class="modal-close">&times;</button>
        </div>
        <div class="modal-body">
          ${content}
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    // Close handlers
    const closeModal = () => modal.remove();
    modal.querySelector('.modal-close').addEventListener('click', closeModal);
    modal.querySelector('.modal-overlay').addEventListener('click', closeModal);

    return modal;
  },

  // Table helpers (mantido para compatibilidade)
  createTableRow(data, actions = []) {
    const row = document.createElement('tr');
    row.innerHTML = Object.values(data).map(value => `<td>${value}</td>`).join('');
    
    if (actions.length > 0) {
      const actionsCell = document.createElement('td');
      actionsCell.innerHTML = actions.map(action => 
        `<button class="btn btn-${action.type} btn-sm" onclick="${action.onclick}">${action.text}</button>`
      ).join(' ');
      row.appendChild(actionsCell);
    }
    
    return row;
  }
};

// Dashboard Controller
const dashboardController = {
  async loadDashboardData() {
    try {
      const dashboardElement = document.querySelector('.dashboard') || document.querySelector('main');
      if (dashboardElement) {
        ui.showLoading(dashboardElement);
      }
      
      const data = await apiService.getDashboardData();
      // Buscar todos os empréstimos para calcular o valor total a receber com juros em aberto
      const emprestimos = await apiService.getEmprestimos();
      let valorTotalReceber = 0;
      const hoje = new Date();
      hoje.setHours(0,0,0,0);
      emprestimos.forEach(emprestimo => {
        // Validação e fallback seguro para campos numéricos
        const valorInvestido = Number(emprestimo.valor_inicial || emprestimo.valor || 0);
        const jurosPercent = Number(emprestimo.juros_mensal || 0);
        const jurosTotal = valorInvestido * (jurosPercent / 100);
        const dataVencimento = new Date(emprestimo.data_vencimento);
        let valorAtualizado = valorInvestido + jurosTotal;
        if (dataVencimento < hoje && (emprestimo.status || '').toUpperCase() !== 'QUITADO') {
          const diffTime = hoje.getTime() - dataVencimento.getTime();
          const diasAtraso = Math.floor(diffTime / (1000 * 60 * 60 * 24));
          const jurosDiario = Math.ceil(jurosTotal / 30);
          const jurosAplicado = jurosDiario * diasAtraso;
          valorAtualizado = valorInvestido + jurosTotal + jurosAplicado;
        }
        if ((emprestimo.status || '').toUpperCase() !== 'QUITADO') {
          valorTotalReceber += valorAtualizado;
        }
      });
      // Substituir o valor do card por esse valor calculado
      data.cobrancas = data.cobrancas || {};
      data.cobrancas.valor_total_cobrancas = valorTotalReceber;
      appState.data.dashboard = data;
      this.updateDashboardCards(data);
      this.updateRecentEmprestimos(data.emprestimosRecentes || []);
      this.updateCobrancasPendentes(data.cobrancasPendentes || []);
      
      // Calcular clientes em atraso: recalcula status localmente
      const clientesEmAtrasoSet = new Set();
      emprestimos.forEach(emprestimo => {
        const dataVencimento = new Date(emprestimo.data_vencimento);
        let status = (emprestimo.status || '').toUpperCase();
        if (dataVencimento < hoje && status !== 'QUITADO') {
          status = 'ATRASADO';
        }
        const clienteId = emprestimo.cliente_id || emprestimo.cliente || emprestimo.cliente_nome || null;
        if (status === 'ATRASADO' && clienteId) {
          clientesEmAtrasoSet.add(clienteId);
        }
      });
      data.cobrancas.clientes_em_atraso = clientesEmAtrasoSet.size;
      
    } catch (error) {
      console.error('Erro ao carregar dashboard:', error);
      ui.showNotification('Erro ao carregar dados do dashboard', 'error');
    } finally {
      const dashboardElement = document.querySelector('.dashboard') || document.querySelector('main');
      if (dashboardElement) {
        ui.hideLoading(dashboardElement);
      }
    }
  },

  updateDashboardCards(data) {
    // Atualizar cards com animação baseado no formato da API
    const cards = {
      'total-clientes': data.clientes?.total_clientes || 0,
      'total-emprestimos': data.emprestimos?.total_emprestimos || 0,
      'valor-receber': data.cobrancas?.valor_total_cobrancas || 0,
      'clientes-atraso': (data.clientesEmAtraso ?? data.cobrancas?.clientes_em_atraso) || 0,
      'emprestimos-atraso': data.emprestimosEmAtraso || 0,
      'clientes-ativos': data.clientesAtivos || 0,
      'emprestimos-ativos': data.emprestimosAtivos || 0,
      'total-investido': data.emprestimos?.valor_total_emprestimos || 0
    };

    Object.entries(cards).forEach(([id, value]) => {
      const element = document.getElementById(id);
      if (element) {
        if (id === 'valor-receber' || id === 'total-investido') {
          // Formatar como moeda
          const formattedValue = new Intl.NumberFormat('pt-BR', {
            style: 'currency',
            currency: 'BRL'
          }).format(value || 0);
          element.textContent = formattedValue;
        } else {
          // Animar números
          const startValue = parseInt(element.textContent) || 0;
          const duration = 1000;
          const startTime = performance.now();
          
          function animateNumber(currentTime) {
            const elapsed = currentTime - startTime;
            const progress = Math.min(elapsed / duration, 1);
            
            const currentValue = Math.floor(startValue + (value - startValue) * progress);
            element.textContent = currentValue;
            
            if (progress < 1) {
              requestAnimationFrame(animateNumber);
            }
          }
          
          requestAnimationFrame(animateNumber);
        }
      }
    });
  },

  updateRecentEmprestimos(emprestimos) {
    const tbody = document.getElementById('emprestimos-recentes');
    if (!tbody) return;

    tbody.innerHTML = '';

    if (emprestimos.length === 0) {
      tbody.innerHTML = '<tr><td colspan="5" class="text-center text-gray-500">Nenhum empréstimo recente</td></tr>';
      return;
    }

    emprestimos.forEach(emprestimo => {
      // Validação e fallback seguro para campos numéricos
      const valorInvestido = Number(emprestimo.valor || 0);
      const jurosPercent = Number(emprestimo.juros_mensal || 0);
      const jurosTotal = valorInvestido * (jurosPercent / 100);
      const dataVencimento = emprestimo.data_vencimento ? new Date(emprestimo.data_vencimento) : null;
      const hoje = new Date();
      hoje.setHours(0,0,0,0);
      let status = (emprestimo.status || '').toUpperCase();
      let valorAtualizado = valorInvestido + jurosTotal;
      let infoJuros = '';
      let diasAtraso = 0;
      let jurosDiario = 0;
      let jurosAplicado = 0;
      if (dataVencimento && dataVencimento < hoje && status !== 'QUITADO') {
        status = 'ATRASADO';
        // Calcular dias de atraso
        const diffTime = hoje.getTime() - dataVencimento.getTime();
        diasAtraso = Math.floor(diffTime / (1000 * 60 * 60 * 24));
        // Juros diário: juros total dividido por 30 dias, arredondado para cima
        jurosDiario = Math.ceil(jurosTotal / 30);
        jurosAplicado = jurosDiario * diasAtraso;
        valorAtualizado = valorInvestido + jurosTotal + jurosAplicado;
        infoJuros = `<br><small style='color:#ef4444'>Juros diário: +R$ ${jurosDiario.toFixed(2)} (${diasAtraso} dias)</small>`;
      }
      const valor = new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL'
      }).format(valorAtualizado);
      const data = new Date(emprestimo.data_emprestimo).toLocaleDateString('pt-BR');
      const statusClass = status === 'ATRASADO' ? 'danger' : (status === 'PENDENTE' ? 'warning' : (status === 'ATIVO' ? 'success' : 'info'));
      const row = document.createElement('tr');
      row.innerHTML = `
        <td>${emprestimo.cliente_nome || 'N/A'}</td>
        <td>${valor}${infoJuros}</td>
        <td>${emprestimo.parcelas || '-'}</td>
        <td>${data}</td>
        <td>${emprestimo.data_vencimento ? new Date(emprestimo.data_vencimento).toLocaleDateString('pt-BR') : '-'}</td>
        <td><span class="badge badge-${statusClass}">${status}</span></td>
        <td>
          <button class="btn btn-primary btn-sm" onclick="viewEmprestimo(${emprestimo.id})">Ver</button>
        </td>
      `;
      tbody.appendChild(row);
    });
  },

  updateCobrancasPendentes(cobrancas) {
    const tbody = document.getElementById('cobrancas-pendentes');
    if (!tbody) return;

    tbody.innerHTML = '';

    // Filtrar apenas cobranças atrasadas
    const atrasadas = cobrancas.filter(cobranca => {
      const dataVencimento = cobranca.data_vencimento ? new Date(cobranca.data_vencimento) : null;
      const hoje = new Date();
      hoje.setHours(0,0,0,0);
      let status = (cobranca.status || '').toUpperCase();
      if (dataVencimento && dataVencimento < hoje && status !== 'QUITADO') {
        status = 'ATRASADO';
      }
      return status === 'ATRASADO';
    });

    if (atrasadas.length === 0) {
      tbody.innerHTML = '<tr><td colspan="6" class="text-center text-gray-500">Nenhuma cobrança pendente</td></tr>';
      return;
    }

    atrasadas.forEach(cobranca => {
      // Cálculo de atraso e juros diário para cobranças
      const valorInvestido = Number(cobranca.valor_inicial || cobranca.valor_original || cobranca.valor || 0);
      const jurosPercent = Number(cobranca.juros_mensal || cobranca.juros || cobranca.juros_percentual || 0);
      const jurosTotal = valorInvestido * (jurosPercent / 100);
      const dataVencimento = cobranca.data_vencimento ? new Date(cobranca.data_vencimento) : null;
      const hoje = new Date();
      hoje.setHours(0,0,0,0);
      let status = (cobranca.status || '').toUpperCase();
      let valorAtualizado = valorInvestido + jurosTotal;
      let diasAtraso = 0;
      let jurosDiario = 0;
      let jurosAplicado = 0;
      if (dataVencimento && dataVencimento < hoje && status !== 'QUITADO') {
        status = 'ATRASADO';
        const diffTime = hoje.getTime() - dataVencimento.getTime();
        diasAtraso = Math.floor(diffTime / (1000 * 60 * 60 * 24));
        jurosDiario = Math.ceil(jurosTotal / 30);
        jurosAplicado = jurosDiario * diasAtraso;
        valorAtualizado = valorInvestido + jurosTotal + jurosAplicado;
      }
      const valor = new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL'
      }).format(valorAtualizado);
      const vencimento = cobranca.data_vencimento ? new Date(cobranca.data_vencimento).toLocaleDateString('pt-BR') : '-';
      const statusClass = status === 'ATRASADO' ? 'danger' : (status === 'PENDENTE' ? 'warning' : (status === 'ATIVO' ? 'success' : 'info'));
      const row = document.createElement('tr');
      row.innerHTML = `
        <td>${cobranca.cliente_nome || 'N/A'}</td>
        <td>${valor}</td>
        <td>${vencimento}</td>
        <td>${diasAtraso > 0 ? `${diasAtraso} dias` : 'No prazo'}</td>
        <td><span class="badge badge-${statusClass}">${status}</span></td>
        <td>
          <button class="btn btn-secondary btn-sm" onclick="cobrancaController.cobrar(${cobranca.id})">Cobrar</button>
        </td>
      `;
      tbody.appendChild(row);
    });
  }
};

// Mobile Menu Controller
const mobileMenuController = {
  init() {
    const menuToggle = document.getElementById('menuToggle');
    const nav = document.querySelector('nav');
    
    if (menuToggle && nav) {
      menuToggle.addEventListener('click', () => {
        nav.classList.toggle('nav-open');
        menuToggle.classList.toggle('active');
      });

      // Fechar menu ao clicar em um link
      nav.querySelectorAll('.nav-link').forEach(link => {
        link.addEventListener('click', () => {
          nav.classList.remove('nav-open');
          menuToggle.classList.remove('active');
        });
      });

      // Fechar menu ao redimensionar para desktop
      window.addEventListener('resize', utils.debounce(() => {
        if (window.innerWidth > 768) {
          nav.classList.remove('nav-open');
          menuToggle.classList.remove('active');
        }
      }, 250));
    }
  }
};

// Inicialização da aplicação
const app = {
  async init() {
    try {
      const path = window.location.pathname;
      
      // Se estiver na página de login, não verificar autenticação
      if (path.includes('login.html')) {
        this.setCurrentDate();
        this.addNotificationStyles();
        return;
      }
      
      // Verificar autenticação usando sessionStorage (mesmo padrão do sistema principal)
      const isAuthenticated = authSystem.checkAuth();
      if (!isAuthenticated) {
        console.log('Usuário não autenticado, redirecionando...');
        window.location.href = 'login.html';
        return;
      }
      
      // Configurar sistema de logout automático apenas se autenticado
      authSystem.setupAutoLogout();
      
      // Exibir mensagem de boas-vindas
      authSystem.showWelcomeMessage();
      
      // Configurar data atual
      this.setCurrentDate();
      
      // Inicializar menu mobile
      mobileMenuController.init();
      
      // Carregar dados do dashboard apenas se estivermos na página do dashboard
      if (path.includes('dashboard.html') || path.endsWith('/') || path.includes('index.html')) {
        await dashboardController.loadDashboardData();
        
        // Configurar auto-refresh a cada 5 minutos
        setInterval(() => {
          dashboardController.loadDashboardData();
        }, 5 * 60 * 1000);
      }
      
      // Adicionar estilos para notificações
      this.addNotificationStyles();
      
      // Carregar dados específicos de cada página
      this.loadPageSpecificData();
      
    } catch (error) {
      console.error('Erro na inicialização:', error);
      ui.showNotification('Erro ao inicializar a aplicação', 'error');
    }
  },

  async loadPageSpecificData() {
    const path = window.location.pathname;
    
    // Página de cobranças
    if (path.includes('cobrancas.html')) {
      try {
        await renderCobrancasEmAbertoLista();
      } catch (error) {
        console.error('Erro ao carregar cobranças:', error);
      }
    }
    
    // Página de empréstimos
    if (path.includes('emprestimos.html')) {
      if (document.getElementById('historico-emprestimos')) {
        await renderHistoricoEmprestimos();
      }
    }
    
    // Página de clientes
    if (path.includes('clientes.html')) {
      if (document.getElementById('lista-clientes')) {
        await renderClientesLista();
      }
    }
    
    // Página de atrasados
    if (path.includes('atrasados.html')) {
      if (document.getElementById('atrasados-lista')) {
        await renderAtrasadosLista();
      }
    }
    
    // Atualizar cards de estatísticas nas páginas específicas
    await this.updateStatisticsCards();
  },

  async updateStatisticsCards() {
    try {
      const data = await apiService.getDashboardData();
      
      // Cards de atraso
      if (document.getElementById('total-atraso')) {
        document.getElementById('total-atraso').textContent = data.emprestimosEmAtraso || 0;
      }
      if (document.getElementById('valor-atraso')) {
        document.getElementById('valor-atraso').textContent = utils.formatCurrency(data.cobrancas?.valor_atrasado || 0);
      }
      
      // Cards de clientes
      if (document.getElementById('clientes-ativos')) {
        document.getElementById('clientes-ativos').textContent = data.clientesAtivos || 0;
      }
      if (document.getElementById('clientes-atraso')) {
        document.getElementById('clientes-atraso').textContent = data.clientesEmAtraso || 0;
      }
      
      // Cards de empréstimos
      if (document.getElementById('emprestimos-ativos')) {
        document.getElementById('emprestimos-ativos').textContent = data.emprestimosAtivos || 0;
      }
      if (document.getElementById('emprestimos-atraso')) {
        document.getElementById('emprestimos-atraso').textContent = data.emprestimosEmAtraso || 0;
      }
      
      // Card de valor total
      if (document.getElementById('valor-total')) {
        const emprestimos = await apiService.getEmprestimos();
        const total = (emprestimos || []).reduce((acc, emp) => {
          const status = (emp.status || '').toLowerCase();
          if ((status === 'ativo' || status === 'pendente') && status !== 'quitado') {
            const valor = Number(emp.valor || 0);
            const juros = Number(emp.juros_mensal || 0);
            acc += valor + (valor * (juros / 100));
          }
          return acc;
        }, 0);
        document.getElementById('valor-total').textContent = utils.formatCurrency(total);
      }
      
    } catch (error) {
      console.error('Erro ao atualizar cards de estatísticas:', error);
    }
  },

  setCurrentDate() {
    const currentDateElement = document.getElementById('currentDate');
    if (currentDateElement) {
      const now = new Date();
      const month = now.toLocaleDateString('pt-BR', { month: 'long' });
      const year = now.getFullYear();
      currentDateElement.textContent = `${month}/${year}`;
    }
  },

  addNotificationStyles() {
    const style = document.createElement('style');
    style.textContent = `
      .notification {
        position: fixed;
        top: 20px;
        right: 20px;
        background: white;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        z-index: 1000;
        max-width: 400px;
        animation: slideIn 0.3s ease-out;
      }
      
      .notification-content {
        padding: 1rem;
        display: flex;
        justify-content: space-between;
        align-items: center;
      }
      
      .notification-close {
        background: none;
        border: none;
        font-size: 1.5rem;
        cursor: pointer;
        color: #666;
      }
      
      .notification-success {
        border-left: 4px solid #10b981;
      }
      
      .notification-error {
        border-left: 4px solid #ef4444;
      }
      
      .notification-warning {
        border-left: 4px solid #f59e0b;
      }
      
      .notification-info {
        border-left: 4px solid #3b82f6;
      }
      
      @keyframes slideIn {
        from {
          transform: translateX(100%);
          opacity: 0;
        }
        to {
          transform: translateX(0);
          opacity: 1;
        }
      }
      
      .modal {
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        z-index: 1000;
        display: flex;
        align-items: center;
        justify-content: center;
      }
      
      .modal-overlay {
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0,0,0,0.5);
      }
      
      .modal-content {
        background: white;
        border-radius: 8px;
        max-width: 500px;
        width: 90%;
        max-height: 80vh;
        overflow-y: auto;
        position: relative;
        z-index: 1;
      }
      
      .modal-header {
        padding: 1rem;
        border-bottom: 1px solid #e5e7eb;
        display: flex;
        justify-content: space-between;
        align-items: center;
      }
      
      .modal-body {
        padding: 1rem;
      }
      
      .modal-close {
        background: none;
        border: none;
        font-size: 1.5rem;
        cursor: pointer;
        color: #666;
      }
      
      .nav-open {
        display: flex !important;
        flex-direction: column;
        position: absolute;
        top: 100%;
        left: 0;
        right: 0;
        background: var(--terciary);
        padding: 1rem;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      }
      
      @media (max-width: 768px) {
        nav {
          display: none;
        }
        
        .menu-toggle {
          display: block;
        }
      }
    `;
    document.head.appendChild(style);
  }
};

async viewEmprestimo(id) {
  try {
    // Buscar detalhes do empréstimo
    const emprestimoResp = await fetch(`/api/cobrancas/emprestimos/${id}`);
    if (!emprestimoResp.ok) throw new Error('Empréstimo não encontrado');
    const emp = await emprestimoResp.json();
    // Buscar todas as parcelas (cobrancas) deste emprestimo
    const cobrancasResp = await fetch(`/api/cobrancas/cobrancas?emprestimo_id=${id}`);
    if (!cobrancasResp.ok) throw new Error('Erro ao buscar parcelas');
    const cobrancas = await cobrancasResp.json();
    cobrancas.sort((a, b) => new Date(a.data_vencimento) - new Date(b.data_vencimento));
    // Montar HTML das parcelas
    let parcelasHtml = '';
    if (cobrancas.length > 0) {
      parcelasHtml = `<div style="margin-bottom:1.2em; font-size:1.1rem; font-weight:700; color:#061058;">Parcelas</div>`;
      parcelasHtml += cobrancas.map((parc, idx) => {
        const status = (parc.status || '').toUpperCase();
        let badgeColor = '#fbbf24';
        if (status === 'PAGA') badgeColor = '#10b981';
        if (status === 'ATRASADA') badgeColor = '#ef4444';
        return `
          <div style="box-shadow:0 2px 8px #002f4b11; border-radius:10px; padding:1.1em 1.2em; margin-bottom:1.1em; background:#fff; display:flex; align-items:center; justify-content:space-between; gap:1em; border:1px solid #e5e7eb;">
            <div style="flex:1;">
              <div style="font-size:1rem; font-weight:600; color:#061058; margin-bottom:0.2em;">Parcela ${idx+1} de ${cobrancas.length}</div>
              <div style="font-size:1.3rem; font-weight:700; color:#002f4b; margin-bottom:0.2em;">💰 R$ ${utils.formatCurrency(parc.valor_original)}</div>
              <div style="font-size:0.98rem; color:#374151; margin-bottom:0.2em;">📅 ${utils.formatDate(parc.data_vencimento)}</div>
              <span style="display:inline-block; padding:0.2em 0.8em; border-radius:12px; background:${badgeColor}; color:#fff; font-weight:600; font-size:0.95rem; margin-bottom:0.2em;">${status}</span>
            </div>
            <div style="display:flex; flex-direction:column; gap:0.5em; align-items:flex-end;">
              <button class="btn" style="background:#10b981;color:#fff; font-size:1.1rem; padding:0.4em 1.2em; border-radius:8px; display:flex; align-items:center; gap:0.5em;" onclick="window.quitarParcela(${parc.id})" ${status==='PAGA'?'disabled':''}>✔️ Quitar</button>
              <button class="btn" style="background:#6366f1;color:#fff; font-size:1.1rem; padding:0.4em 1.2em; border-radius:8px; display:flex; align-items:center; gap:0.5em;" onclick="window.editarParcela(${parc.id})">✏️ Editar</button>
            </div>
          </div>
        `;
      }).join('');
    } else {
      parcelasHtml = '<div style="color:#888; text-align:center;">Nenhuma parcela encontrada.</div>';
    }
    // Dados do empréstimo
    const valorInvestido = Number(emp.valor || 0);
    const jurosPercent = Number(emp.juros_mensal || 0);
    const jurosTotal = valorInvestido * (jurosPercent / 100);
    const status = (emp.status || '').toUpperCase();
    const valorAtualizado = valorInvestido + jurosTotal;
    const infoJuros = '';
    const telefone = emp.telefone || emp.celular || emp.whatsapp || '';
    const nome = emp.cliente_nome || '';
    const valorTotalJuros = jurosTotal;
    const msgWhatsapp = encodeURIComponent(
      `Olá ${nome}, seu empréstimo está vencendo hoje. O valor total é de R$ ${utils.formatCurrency(valorAtualizado)}. Caso venha enviar somente o juros o valor é R$ ${utils.formatCurrency(valorTotalJuros)}.`
    );
    const linkWhatsapp = telefone ? `https://wa.me/55${telefone.replace(/\D/g,'')}?text=${msgWhatsapp}` : '#';
    const detalhes = `
      <div class="emprestimo-modal-box" style="padding: 1.5rem; max-width: 420px; margin: 0 auto; background: #fff; border-radius: 16px; box-shadow: 0 2px 16px #002f4b22;">
        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 1rem;">
          <span class="badge" style="background: ${status === 'ATRASADO' ? '#fbbf24' : status === 'QUITADO' ? '#10b981' : status === 'SÓ JUROS' ? '#6366f1' : '#002f4b'}; color: #fff; font-weight: 600; font-size: 1rem; padding: 0.4em 1em; border-radius: 8px; letter-spacing: 1px;">${status || '-'}</span>
          <button class="btn" style="background: #10b981; color: #fff; font-weight: 600; border-radius: 8px; padding: 0.4em 1.2em; font-size: 1rem;" id="modal-btn-editar">Editar</button>
        </div>
        <div style="margin-bottom: 1.2rem;">
          <h2 style="font-size: 1.4rem; font-weight: bold; margin-bottom: 0.2em; color: #002f4b;">${emp.cliente_nome || 'N/A'}</h2>
          <div style="font-size: 1.1rem; font-weight: 600; color: #222; margin-bottom: 0.2em;">PCL-Nº #${emp.id}</div>
          <div style="font-size: 1rem; color: #444; margin-bottom: 0.2em;">Deve ser pago em <b>${emp.data_vencimento ? utils.formatDate(emp.data_vencimento) : '-'}</b></div>
          <div style="font-size: 1rem; color: #444;">Valor Investido <b>R$ ${utils.formatCurrency(valorInvestido)}</b></div>
          <div style="font-size: 1rem; color: #444;">Juros <b>${jurosPercent}%</b> (R$ ${utils.formatCurrency(jurosTotal)})</div>
          ${infoJuros}
        </div>
        <hr style="margin: 1.2rem 0; border: none; border-top: 1px solid #eee;">
        ${parcelasHtml}
        <div style="display: flex; flex-direction: column; gap: 0.7rem; margin-top: 1.5rem;">
          <a class="btn" style="background: #25d366; color: #fff; font-weight: 600; font-size: 1.1rem; border-radius: 8px;" id="modal-notificar" href="${linkWhatsapp}" target="_blank" rel="noopener noreferrer">Notificar <b>WhatsApp</b></a>
          <div style="display: flex; gap: 0.7rem; flex-wrap: wrap;">
            <button class="btn" style="background: #10b981; color: #fff; flex:1; font-weight: 600; border-radius: 8px;" id="modal-btn-quitado" type="button">Quitado</button>
            <button class="btn" style="background: #6366f1; color: #fff; flex:1; font-weight: 600; border-radius: 8px;" id="modal-btn-sojuros" type="button">Só Juros</button>
          </div>
          <button class="btn" style="background: #ef4444; color: #fff; font-weight: 600; border-radius: 8px; font-size: 1.1rem;" id="modal-btn-naopagou" type="button">Não Pagou</button>
          <button class="btn" style="background: #ff2222; color: #fff; font-weight: 600; border-radius: 8px; font-size: 1.1rem;" id="modal-btn-remover" type="button">REMOVER</button>
        </div>
      </div>
    `;
    const modal = ui.showModal(detalhes, 'Detalhes do Empréstimo');
    // Botões e ações do modal (mantém igual ao original)
    const btnWhats = modal.querySelector('#modal-notificar');
    btnWhats.addEventListener('click', (e) => { e.stopPropagation(); });
    modal.querySelector('#modal-btn-quitado').onclick = async (e) => { e.preventDefault(); /* ... */ };
    modal.querySelector('#modal-btn-sojuros').onclick = async (e) => { e.preventDefault(); /* ... */ };
    modal.querySelector('#modal-btn-naopagou').onclick = async (e) => { e.preventDefault(); /* ... */ };
    modal.querySelector('#modal-btn-remover').onclick = async (e) => { e.preventDefault(); /* ... */ };
  } catch (err) {
    ui.showNotification('Erro ao buscar ou exibir empréstimo. Verifique os dados do empréstimo.', 'error');
  }
}
          // Processar pagamento de juros
          formJuros.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const valorJuros = parseFloat(document.getElementById('valor-juros').value);
            const dataPagamento = document.getElementById('data-pagamento').value;
            const formaPagamento = document.getElementById('forma-pagamento').value;
            const observacoes = document.getElementById('observacoes-juros').value;
            
            if (valorJuros < jurosAcumulados) {
              alert(`Valor insuficiente. O mínimo é R$ ${utils.formatCurrency(jurosAcumulados)}`);
              return;
            }
            
            try {
              const submitBtn = formJuros.querySelector('button[type="submit"]');
              const originalText = submitBtn.textContent;
              submitBtn.textContent = 'Processando...';
              submitBtn.disabled = true;
              
              const response = await fetch(`/api/cobrancas/emprestimos/${emp.id}/pagamento-juros`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({
                  valor_juros_pago: valorJuros,
                  data_pagamento: dataPagamento,
                  forma_pagamento: formaPagamento,
                  observacoes: observacoes
                })
              });
              
              if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Erro ao processar pagamento');
              }
              
              const result = await response.json();
              
              // Fechar modais
              modalJuros.remove();
              modal.remove();
              
              // Mostrar sucesso
              ui.showNotification(`Pagamento de juros registrado! Novo vencimento: ${utils.formatDate(result.nova_data_vencimento)}`, 'success');
              
              // Recarregar dados
              setTimeout(async () => {
                await recarregarDadosPagina();
              }, 1000);
              
            } catch (error) {
              console.error('Erro ao processar pagamento de juros:', error);
              alert('Erro ao processar pagamento: ' + error.message);
            } finally {
              const submitBtn = formJuros.querySelector('button[type="submit"]');
              submitBtn.textContent = originalText;
              submitBtn.disabled = false;
            }
          });
        };
        // Botão Não Pagou
        modal.querySelector('#modal-btn-naopagou').onclick = async (e) => {
          e.preventDefault();
          try {
            await fetch(`/api/cobrancas/emprestimos/${emp.id}/status`, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              credentials: 'include',
              body: JSON.stringify({ status: 'Em Atraso' })
            });
            ui.showNotification('Status alterado para Em Atraso!', 'success');
            modal.remove();
            if (document.getElementById('emprestimos-lista')) renderEmprestimosLista();
          } catch (err) {
            ui.showNotification('Erro ao atualizar status', 'error');
          }
        };
        // Botão Remover
        modal.querySelector('#modal-btn-remover').onclick = async (e) => {
          e.preventDefault();
          if (!confirm('Tem certeza que deseja remover este empréstimo?')) return;
          try {
            await fetch(`/api/cobrancas/emprestimos/${emp.id}`, {
              method: 'DELETE',
              credentials: 'include'
            });
            ui.showNotification('Empréstimo removido!', 'success');
            modal.remove();
            if (document.getElementById('emprestimos-lista')) renderEmprestimosLista();
          } catch (err) {
            ui.showNotification('Erro ao remover empréstimo', 'error');
          }
        };
      } catch (err) {
        console.error('Erro real ao exibir modal:', err, emp);
        ui.showNotification('Erro ao exibir detalhes do empréstimo. Veja o console para detalhes.', 'error');
      }
    } catch (err) {
      ui.showNotification('Erro ao buscar ou exibir empréstimo. Verifique os dados do empréstimo.', 'error');
    }
  }
};

const cobrancaController = {
  cobrar(id) {
    // Redirecionar para página de cobranças
    console.log(`Registrando cobrança #${id}`);
    window.location.href = 'cobrancas.html';
  }
};

// Função para adicionar cliente à lista negra
async function adicionarListaNegra(id) {
  try {
    if (!confirm('Tem certeza que deseja adicionar este cliente à lista negra?')) {
      return;
    }
    
    const response = await fetch(`/api/cobrancas/clientes/${id}/lista-negra`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ 
        status: 'Lista Negra',
        motivo: 'Adicionado manualmente pelo usuário'
      })
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Erro ao adicionar à lista negra');
    }
    
    ui.showNotification('Cliente adicionado à lista negra com sucesso!', 'success');
    
    // Recarregar lista de clientes
    if (document.getElementById('lista-clientes')) {
      await renderClientesLista();
    }
    
  } catch (error) {
    console.error('Erro ao adicionar à lista negra:', error);
    ui.showNotification('Erro ao adicionar à lista negra: ' + error.message, 'error');
  }
}

const clienteController = {
  async viewCliente(id) {
    try {
      const response = await fetch(`/api/cobrancas/clientes/${id}`, {
        credentials: 'include'
      });
      const cliente = await response.json();
      
      if (!response.ok) {
        ui.showNotification('Cliente não encontrado', 'error');
        return;
      }
      
      const modalContent = `
        <div class="cliente-modal-box" style="padding: 1.5rem; max-width: 500px; margin: 0 auto;">
          <h3 style="margin-bottom: 1rem; color: #002f4b;">${cliente.nome}</h3>
          <div style="margin-bottom: 1rem;">
            <p><strong>CPF/CNPJ:</strong> ${cliente.cpf_cnpj || 'Não informado'}</p>
            <p><strong>Telefone:</strong> ${cliente.telefone || 'Não informado'}</p>
            <p><strong>Email:</strong> ${cliente.email || 'Não informado'}</p>
            <p><strong>Endereço:</strong> ${cliente.endereco || 'Não informado'}</p>
            <p><strong>Cidade:</strong> ${cliente.cidade || 'Não informada'}</p>
            <p><strong>Estado:</strong> ${cliente.estado || 'Não informado'}</p>
            <p><strong>CEP:</strong> ${cliente.cep || 'Não informado'}</p>
          </div>
          <div style="margin-top: 1.5rem;">
            <h4>Empréstimos Ativos: ${cliente.emprestimos?.length || 0}</h4>
            ${cliente.emprestimos && cliente.emprestimos.length > 0 ? 
              cliente.emprestimos.map(emp => `
                <div style="border: 1px solid #eee; padding: 0.5rem; margin: 0.5rem 0; border-radius: 4px;">
                  <p><strong>Valor:</strong> ${utils.formatCurrency(emp.valor)}</p>
                  <p><strong>Vencimento:</strong> ${utils.formatDate(emp.data_vencimento)}</p>
                  <p><strong>Status:</strong> <span class="badge badge-${emp.status === 'Ativo' ? 'success' : 'warning'}">${emp.status}</span></p>
                </div>
              `).join('') : '<p>Nenhum empréstimo ativo</p>'
            }
          </div>
        </div>
      `;
      
      ui.showModal(modalContent, 'Detalhes do Cliente');
    } catch (error) {
      console.error('Erro ao buscar cliente:', error);
      ui.showNotification('Erro ao buscar dados do cliente', 'error');
    }
  },

  async deleteCliente(id) {
    if (!confirm('Tem certeza que deseja remover este cliente?')) return;
    
    try {
      const response = await fetch(`/api/cobrancas/clientes/${id}`, {
        method: 'DELETE',
        credentials: 'include'
      });
      
      if (!response.ok) {
        const error = await response.json();
        ui.showNotification(error.error || 'Erro ao remover cliente', 'error');
        return;
      }
      
      ui.showNotification('Cliente removido com sucesso!', 'success');
      if (document.getElementById('lista-clientes')) {
        renderClientesLista();
      }
    } catch (error) {
      console.error('Erro ao remover cliente:', error);
      ui.showNotification('Erro ao remover cliente', 'error');
    }
  }
};

// Função para renderizar o histórico de empréstimos
async function renderHistoricoEmprestimos() {
  const tbody = document.getElementById('historico-emprestimos');
  if (!tbody) return;
  tbody.innerHTML = '<tr><td colspan="6">Carregando...</td></tr>';
  try {
    const emprestimos = await apiService.getEmprestimos();
    if (!emprestimos || emprestimos.length === 0) {
      tbody.innerHTML = '<tr><td colspan="6" class="text-center text-gray-500">Nenhum empréstimo encontrado</td></tr>';
      return;
    }
    tbody.innerHTML = '';
    emprestimos.forEach(emprestimo => {
      // Cálculo de atraso e juros diário
      const valorInvestido = Number(emprestimo.valor_inicial || emprestimo.valor || 0);
      const jurosPercent = Number(emprestimo.juros_mensal || 0);
      const jurosTotal = valorInvestido * (jurosPercent / 100);
      const dataVencimento = emprestimo.data_vencimento ? new Date(emprestimo.data_vencimento) : null;
      const hoje = new Date();
      hoje.setHours(0,0,0,0);
      let status = (emprestimo.status || '').toUpperCase();
      let valorAtualizado = valorInvestido + jurosTotal;
      let infoJuros = '';
      let diasAtraso = 0;
      let jurosDiario = 0;
      let jurosAplicado = 0;
      if (dataVencimento && dataVencimento < hoje && status !== 'QUITADO') {
        status = 'ATRASADO';
        // Calcular dias de atraso
        const diffTime = hoje.getTime() - dataVencimento.getTime();
        diasAtraso = Math.floor(diffTime / (1000 * 60 * 60 * 24));
        // Juros diário: juros total dividido por 30 dias, arredondado para cima
        jurosDiario = Math.ceil(jurosTotal / 30);
        jurosAplicado = jurosDiario * diasAtraso;
        valorAtualizado = valorInvestido + jurosTotal + jurosAplicado;
        infoJuros = `<br><small style='color:#ef4444'>Juros diário: +R$ ${jurosDiario.toFixed(2)} (${diasAtraso} dias)</small>`;
      }
      const valor = new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL'
      }).format(valorAtualizado);
      const data = emprestimo.data_emprestimo ? new Date(emprestimo.data_emprestimo).toLocaleDateString('pt-BR') : '-';
      const vencimento = emprestimo.data_vencimento ? new Date(emprestimo.data_vencimento).toLocaleDateString('pt-BR') : '-';
      const statusClass = status === 'ATRASADO' ? 'danger' : (status === 'PENDENTE' ? 'warning' : (status === 'ATIVO' ? 'success' : (status === 'QUITADO' ? 'info' : 'secondary')));
      const row = document.createElement('tr');
      row.innerHTML = `
        <td>${emprestimo.cliente_nome || 'N/A'}</td>
        <td>${valor}${infoJuros}</td>
        <td>${data}</td>
        <td>${vencimento}</td>
        <td><span class="badge badge-${statusClass}">${status}</span></td>
        <td>
            <button class="btn btn-primary btn-sm" onclick="emprestimoController.viewEmprestimo(${emprestimo.id})">Ver</button>
        </td>
      `;
      tbody.appendChild(row);
    });
  } catch (err) {
    tbody.innerHTML = '<tr><td colspan="6" class="text-center text-red-500">Erro ao carregar empréstimos</td></tr>';
  }
}

// Função para renderizar a lista de empréstimos
async function renderEmprestimosLista() {
  const tbody = document.getElementById('emprestimos-lista');
  if (!tbody) return;
  tbody.innerHTML = '<tr><td colspan="7">Carregando...</td></tr>';
  try {
    const emprestimos = await apiService.getEmprestimos();
    // Filtrar apenas empréstimos ativos
    const ativos = (emprestimos || []).filter(e => (e.status || '').toLowerCase() === 'ativo');
    if (!ativos || ativos.length === 0) {
      tbody.innerHTML = '<tr><td colspan="7" class="text-center text-gray-500">Nenhum empréstimo ativo encontrado</td></tr>';
      return;
    }
    tbody.innerHTML = '';
    ativos.forEach(emprestimo => {
      // Cálculo de atraso e juros diário
      const valorInvestido = Number(emprestimo.valor_inicial || emprestimo.valor || 0);
      const jurosPercent = Number(emprestimo.juros_mensal || 0);
      const jurosTotal = valorInvestido * (jurosPercent / 100);
      const dataVencimento = new Date(emprestimo.data_vencimento);
      const hoje = new Date();
      hoje.setHours(0,0,0,0);
      let status = (emprestimo.status || '').toUpperCase();
      let valorAtualizado = valorInvestido + jurosTotal;
      let infoJuros = '';
      let diasAtraso = 0;
      let jurosDiario = 0;
      let jurosAplicado = 0;
      if (dataVencimento < hoje && status !== 'QUITADO') {
        status = 'ATRASADO';
        // Calcular dias de atraso
        const diffTime = hoje.getTime() - dataVencimento.getTime();
        diasAtraso = Math.floor(diffTime / (1000 * 60 * 60 * 24));
        // Juros diário: juros total dividido por 30 dias, arredondado para cima
        jurosDiario = Math.ceil(jurosTotal / 30);
        jurosAplicado = jurosDiario * diasAtraso;
        valorAtualizado = valorInvestido + jurosTotal + jurosAplicado;
        infoJuros = `<br><small style='color:#ef4444'>Juros diário: +R$ ${jurosDiario.toFixed(2)} (${diasAtraso} dias)</small>`;
      }
      const valor = new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL'
      }).format(valorAtualizado);
      const data = new Date(emprestimo.data_emprestimo).toLocaleDateString('pt-BR');
      const statusClass = status === 'ATRASADO' ? 'danger' : (status === 'PENDENTE' ? 'warning' : (status === 'ATIVO' ? 'success' : 'info'));
      const row = document.createElement('tr');
      row.innerHTML = `
        <td>${emprestimo.cliente_nome || 'N/A'}</td>
        <td>${valor}${infoJuros}</td>
        <td>${emprestimo.parcelas || '-'}</td>
        <td>${data}</td>
        <td>${emprestimo.data_vencimento ? new Date(emprestimo.data_vencimento).toLocaleDateString('pt-BR') : '-'}</td>
        <td><span class="badge badge-${statusClass}">${status}</span></td>
        <td>
          <button class="btn btn-primary btn-sm" onclick="viewEmprestimo(${emprestimo.id})">Ver</button>
        </td>
      `;
      tbody.appendChild(row);
    });
  } catch (err) {
    tbody.innerHTML = '<tr><td colspan="7" class="text-center text-red-500">Erro ao carregar empréstimos</td></tr>';
  }
}

// Função para renderizar a lista de clientes
async function renderClientesLista() {
  const tbody = document.getElementById('lista-clientes');
  if (!tbody) return;
  tbody.innerHTML = '<tr><td colspan="5">Carregando...</td></tr>';
  try {
    const clientes = await apiService.getClientes();
    const emprestimos = await apiService.getEmprestimos();
    if (!clientes || clientes.length === 0) {
      tbody.innerHTML = '<tr><td colspan="5" class="text-center text-gray-500">Nenhum cliente encontrado</td></tr>';
      return;
    }
    tbody.innerHTML = '';
    clientes.forEach(cliente => {
      // Verifica se o cliente tem empréstimo vencido
      const emprestimosCliente = (emprestimos || []).filter(e => e.cliente_id === cliente.id);
      const hoje = new Date();
      hoje.setHours(0,0,0,0);
      let status = cliente.status || 'Ativo';
      if (status === 'Ativo') {
        const temVencido = emprestimosCliente.some(e => {
          if (!e.data_vencimento) return false;
          const dataVenc = new Date(e.data_vencimento);
          return dataVenc < hoje && (e.status || '').toLowerCase() !== 'quitado';
        });
        if (temVencido) status = 'Em Atraso';
      }
      const badgeClass = status === 'Lista Negra' ? 'danger' : (status === 'Em Atraso' ? 'warning' : 'success');
      const row = document.createElement('tr');
      row.innerHTML = `
        <td>${cliente.nome || 'N/A'}</td>
        <td>${cliente.cpf_cnpj || '-'}</td>
        <td>${cliente.telefone || '-'}</td>
        <td><span class="badge badge-${badgeClass}">${status}</span></td>
        <td>
          <button class="btn btn-primary btn-sm" onclick="viewCliente(${cliente.id})">Ver</button>
          ${cliente.status === 'Lista Negra' 
            ? '<button class="btn btn-success btn-sm" onclick="removerListaNegra(' + cliente.id + ')">Remover da Lista</button>'
            : '<button class="btn btn-warning btn-sm" onclick="adicionarListaNegra(' + cliente.id + ')">Lista Negra</button>'
          }
          <button class="btn btn-danger btn-sm" onclick="deleteCliente(${cliente.id})">Remover</button>
        </td>
      `;
      tbody.appendChild(row);
    });
  } catch (err) {
    tbody.innerHTML = '<tr><td colspan="5" class="text-center text-red-500">Erro ao carregar clientes</td></tr>';
  }
}

// Função para renderizar a lista negra
async function renderListaNegra() {
  const tbody = document.getElementById('lista-negra-clientes');
  if (!tbody) return;
  tbody.innerHTML = '<tr><td colspan="6">Carregando...</td></tr>';
  try {
    const clientes = await apiService.getClientes();
    if (!clientes || clientes.length === 0) {
      tbody.innerHTML = '<tr><td colspan="6" class="text-center text-gray-500">Nenhum cliente encontrado</td></tr>';
      return;
    }
    
    // Filtrar apenas clientes na lista negra
    const listaNegra = clientes.filter(cliente => cliente.status === 'Lista Negra');
    
    if (listaNegra.length === 0) {
      tbody.innerHTML = '<tr><td colspan="6" class="text-center text-gray-500">Nenhum cliente na lista negra</td></tr>';
      return;
    }
    
    tbody.innerHTML = '';
    listaNegra.forEach(cliente => {
      const row = document.createElement('tr');
      row.innerHTML = `
        <td>${cliente.nome || 'N/A'}</td>
        <td>${cliente.cpf_cnpj || '-'}</td>
        <td>${cliente.observacoes || 'Adicionado manualmente'}</td>
        <td>${cliente.updated_at ? utils.formatDate(cliente.updated_at) : '-'}</td>
        <td><span class="badge badge-danger">Lista Negra</span></td>
        <td>
          <button class="btn btn-primary btn-sm" onclick="viewCliente(${cliente.id})">Ver</button>
          <button class="btn btn-success btn-sm" onclick="removerListaNegra(${cliente.id})">Remover da Lista</button>
        </td>
      `;
      tbody.appendChild(row);
    });
  } catch (err) {
    tbody.innerHTML = '<tr><td colspan="6" class="text-center text-red-500">Erro ao carregar lista negra</td></tr>';
  }
}

// Função para remover cliente da lista negra
async function removerListaNegra(id) {
  try {
    if (!confirm('Tem certeza que deseja remover este cliente da lista negra?')) {
      return;
    }
    
    const response = await fetch(`/api/cobrancas/clientes/${id}/lista-negra`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ 
        status: 'Ativo',
        motivo: 'Removido da lista negra'
      })
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Erro ao remover da lista negra');
    }
    
    ui.showNotification('Cliente removido da lista negra com sucesso!', 'success');
    
    // Recarregar lista negra
    if (document.getElementById('lista-negra-clientes')) {
      await renderListaNegra();
    }
    
  } catch (error) {
    console.error('Erro ao remover da lista negra:', error);
    ui.showNotification('Erro ao remover da lista negra: ' + error.message, 'error');
  }
}

// Função para renderizar cobranças (empréstimos em aberto)
async function renderCobrancasEmAbertoLista() {
  const tbody = document.getElementById('cobrancas-lista');
  if (!tbody) return;
  tbody.innerHTML = '<tr><td colspan="5">Carregando...</td></tr>';
  try {
    const emprestimos = await apiService.getEmprestimos();
    // Filtrar apenas em aberto (status Ativo ou Pendente)
    const emAberto = (emprestimos || []).filter(e => {
      const status = (e.status || '').toLowerCase();
      return status === 'ativo' || status === 'pendente';
    });
    if (emAberto.length === 0) {
      tbody.innerHTML = '<tr><td colspan="5" class="text-center text-gray-500">Nenhuma cobrança em aberto</td></tr>';
      return;
    }
    tbody.innerHTML = '';
    emAberto.forEach(emp => {
      const valor = utils.formatCurrency(emp.valor || 0);
      const vencimento = emp.data_vencimento ? utils.formatDate(emp.data_vencimento) : '-';
      const diasAtraso = emp.dias_atraso || 0;
      let badge = '';
      let status = (emp.status || '').toLowerCase();
      // Verifica se está vencido
      const hoje = new Date();
      hoje.setHours(0,0,0,0);
      const dataVenc = emp.data_vencimento ? new Date(emp.data_vencimento) : null;
      if (dataVenc && dataVenc < hoje) {
        status = 'atrasado';
      }
      if (status === 'quitado') {
        badge = '<span class="badge" style="background:#10b981;color:#fff;">Quitado</span>';
      } else if (status === 'em atraso' || status === 'atrasado') {
        badge = '<span class="badge" style="background:#ef4444;color:#fff;">Em Atraso</span>';
      } else if (status === 'ativo' || status === 'pendente') {
        badge = '<span class="badge" style="background:#6366f1;color:#fff;">Pendente</span>';
      } else {
        badge = `<span class="badge" style="background:#888;color:#fff;">${emp.status || '-'}</span>`;
      }
      tbody.innerHTML += `
        <tr>
          <td>${emp.cliente_nome || 'N/A'}</td>
          <td>${valor}</td>
          <td>${vencimento}</td>
          <td>${badge}</td>
          <td>
            <button class="btn btn-primary btn-sm" onclick="viewEmprestimo(${emp.id})">Ver</button>
            <button class="btn btn-warning btn-sm" onclick="cobrar(${emp.id})">Cobrar</button>
          </td>
        </tr>
      `;
    });
  } catch (err) {
    console.error('Erro ao carregar cobranças:', err);
    tbody.innerHTML = '<tr><td colspan="5" class="text-center text-red-500">Erro ao carregar cobranças</td></tr>';
  }
}

// Função global para recarregar dados da página atual
async function recarregarDadosPagina() {
  try {
    console.log('Recarregando dados da página...');
    
    // Recarregar lista de cobranças se estiver na página de cobranças
    if (document.getElementById('cobrancas-lista')) {
      await renderCobrancasEmAbertoLista();
    }
    
    // Recarregar histórico de empréstimos se estiver na página de emprestimos
    if (document.getElementById('historico-emprestimos')) {
      await renderHistoricoEmprestimos();
    }
    
    // Recarregar lista de clientes se estiver na página de clientes
    if (document.getElementById('lista-clientes')) {
      await renderClientesLista();
    }
    
    // Recarregar dashboard se estiver na página principal
    if (document.getElementById('dashboard-stats')) {
      await app.loadDashboardData();
    }
    
    // Recarregar atrasados se estiver na página de atrasados
    if (document.getElementById('atrasados-lista')) {
      await renderAtrasadosLista();
    }
    
    // Recarregar lista negra se estiver na página de lista negra
    if (document.getElementById('lista-negra-clientes')) {
      await renderListaNegra();
    }
    
    console.log('Dados recarregados com sucesso!');
    return true;
  } catch (error) {
    console.error('Erro ao recarregar dados:', error);
    return false;
  }
}

// Função para logout (mesmo padrão do sistema principal)
function sair() {
  if (confirm('Tem certeza que deseja sair?')) {
    // Limpar sessionStorage (mesmo padrão do sistema principal)
    sessionStorage.removeItem('loggedIn');
    sessionStorage.removeItem('username');
    sessionStorage.removeItem('loginTime');
    
    // Redirecionar para login
    window.location.href = 'login.html';
  }
}

// Inicializar quando o DOM estiver pronto
document.addEventListener('DOMContentLoaded', () => {
  app.init();

  // O formulário de novo empréstimo agora está integrado diretamente no HTML
  // A lógica foi movida para o arquivo emprestimos.html para melhor organização  
});

// Exportar para uso global
window.app = app;
window.dashboardController = dashboardController;
window.emprestimoController = emprestimoController;
window.cobrancaController = cobrancaController;
window.clienteController = clienteController;
window.ui = ui;
window.utils = utils;
window.authSystem = authSystem;

// Exportar funções globais
window.viewEmprestimo = viewEmprestimo;
window.viewCliente = viewCliente;
window.deleteCliente = deleteCliente;
window.cobrar = cobrar;
window.sair = sair;
window.renderHistoricoEmprestimos = renderHistoricoEmprestimos;
window.renderClientesLista = renderClientesLista;
window.renderCobrancasEmAbertoLista = renderCobrancasEmAbertoLista;
window.renderAtrasadosLista = renderAtrasadosLista;
window.renderListaNegra = renderListaNegra;
window.recarregarDadosPagina = recarregarDadosPagina;
window.adicionarListaNegra = adicionarListaNegra;
window.removerListaNegra = removerListaNegra;

// Adicionar função para renderizar cobranças pendentes e valor a receber de forma estruturada
function renderCobrancasResumo(lista, targetId) {
  const target = document.getElementById(targetId);
  if (!target) return;
  if (!lista || lista.length === 0) {
    target.innerHTML = '0';
    return;
  }
  const hoje = new Date();
  hoje.setHours(0,0,0,0);
  
  if (targetId === 'cobrancas-pendentes') {
    const totalPendentes = lista.filter(cobranca => {
      const dataVenc = cobranca.data_vencimento ? new Date(cobranca.data_vencimento) : null;
      const status = (cobranca.status || '').toUpperCase();
      return dataVenc && dataVenc <= hoje && (status === 'PENDENTE' || status === 'EM ABERTO');
    }).length;
    target.innerHTML = String(totalPendentes);
    return;
  }
  
  if (targetId === 'valor-receber') {
    const valorTotal = lista.reduce((acc, cobranca) => {
      const valorInvestido = Number(cobranca.valor_inicial || cobranca.valor_original || cobranca.valor || 0);
      const jurosPercent = Number(cobranca.juros_mensal || cobranca.juros || cobranca.juros_percentual || 0);
      const jurosTotal = valorInvestido * (jurosPercent / 100);
      const dataVencimento = cobranca.data_vencimento ? new Date(cobranca.data_vencimento) : null;
      let valorAtualizado = valorInvestido + jurosTotal;
      
      if (dataVencimento && dataVencimento < hoje) {
        const diffTime = hoje.getTime() - dataVencimento.getTime();
        const diasAtraso = Math.floor(diffTime / (1000 * 60 * 60 * 24));
        const jurosDiario = Math.ceil(jurosTotal / 30);
        const jurosAplicado = jurosDiario * diasAtraso;
        valorAtualizado = valorInvestido + jurosTotal + jurosAplicado;
      }
      
      return acc + valorAtualizado;
    }, 0);
    
    target.innerHTML = utils.formatCurrency(valorTotal);
    return;
  }
  
  // Para outros casos, mostrar lista detalhada
  target.innerHTML = lista.map(cobranca => {
    const valorInvestido = Number(cobranca.valor_inicial || cobranca.valor_original || cobranca.valor || 0);
    const jurosPercent = Number(cobranca.juros_mensal || cobranca.juros || cobranca.juros_percentual || 0);
    const jurosTotal = valorInvestido * (jurosPercent / 100);
    const dataVencimento = cobranca.data_vencimento ? new Date(cobranca.data_vencimento) : null;
    let valorAtualizado = valorInvestido + jurosTotal;
    let diasAtraso = 0;
    
    if (dataVencimento && dataVencimento < hoje) {
      const diffTime = hoje.getTime() - dataVencimento.getTime();
      diasAtraso = Math.floor(diffTime / (1000 * 60 * 60 * 24));
      const jurosDiario = Math.ceil(jurosTotal / 30);
      const jurosAplicado = jurosDiario * diasAtraso;
      valorAtualizado = valorInvestido + jurosTotal + jurosAplicado;
    }
    
    return `
      <div class="cobranca-item">
        <span class="cobranca-nome">${cobranca.cliente_nome || 'N/A'}</span>
        <span class="cobranca-valor">${utils.formatCurrency(valorAtualizado)}</span>
        <span class="cobranca-data">${cobranca.data_vencimento ? utils.formatDate(cobranca.data_vencimento) : ''}</span>
        <span class="cobranca-status">${diasAtraso > 0 ? diasAtraso + ' dias de atraso' : 'No prazo'}</span>
      </div>
    `;
  }).join('');
}

async function renderAtrasadosLista() {
  const tbody = document.getElementById('atrasados-lista');
  if (!tbody) return;
  tbody.innerHTML = '<tr><td colspan="8">Carregando...</td></tr>';
  try {
    const emprestimos = await apiService.getEmprestimos();
    const hoje = new Date();
    hoje.setHours(0,0,0,0);
    const atrasados = (emprestimos || []).filter(e => {
      const dataVenc = e.data_vencimento ? new Date(e.data_vencimento) : null;
      let status = (e.status || '').toUpperCase();
      if (dataVenc && dataVenc < hoje && status !== 'QUITADO') {
        status = 'ATRASADO';
      }
      return status === 'ATRASADO';
    });
    if (atrasados.length === 0) {
      tbody.innerHTML = '<tr><td colspan="8" class="text-center text-gray-500">Nenhum empréstimo atrasado</td></tr>';
      return;
    }
    tbody.innerHTML = '';
    atrasados.forEach(emp => {
      const valorInvestido = Number(emp.valor || 0);
      const jurosPercent = Number(emp.juros_mensal || 0);
      const jurosTotal = valorInvestido * (jurosPercent / 100);
      const dataVencimento = emp.data_vencimento ? new Date(emp.data_vencimento) : null;
      let valorAtualizado = valorInvestido + jurosTotal;
      let diasAtraso = 0;
      let jurosDiario = 0;
      let jurosAplicado = 0;
      if (dataVencimento && dataVencimento < hoje) {
        const diffTime = hoje.getTime() - dataVencimento.getTime();
        diasAtraso = Math.floor(diffTime / (1000 * 60 * 60 * 24));
        jurosDiario = Math.ceil(jurosTotal / 30);
        jurosAplicado = jurosDiario * diasAtraso;
        valorAtualizado = valorInvestido + jurosTotal + jurosAplicado;
      }
      const valor = new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL'
      }).format(valorAtualizado);
      const vencimento = emp.data_vencimento ? utils.formatDate(emp.data_vencimento) : '-';
      tbody.innerHTML += `
        <tr>
          <td>${emp.cliente_nome || 'N/A'}</td>
          <td>${emp.id}</td>
          <td>1</td>
          <td>${valor}</td>
          <td>${vencimento}</td>
          <td>${diasAtraso > 0 ? diasAtraso : '-'}</td>
          <td><span class="badge badge-danger">ATRASADO</span></td>
          <td><button class="btn btn-primary btn-sm" onclick="viewEmprestimo(${emp.id})">Ver</button></td>
        </tr>
      `;
    });
  } catch (error) {
    console.error('Erro ao carregar atrasados:', error);
    tbody.innerHTML = '<tr><td colspan="8" class="text-center text-red-500">Erro ao carregar atrasados</td></tr>';
  }
}

// Funções globais para compatibilidade
async function viewEmprestimo(id) {
  if (typeof emprestimoController !== 'undefined' && emprestimoController.viewEmprestimo) {
    return emprestimoController.viewEmprestimo(id);
  } else {
    console.error('emprestimoController não está disponível');
  }
}

async function viewCliente(id) {
  if (typeof clienteController !== 'undefined' && clienteController.viewCliente) {
    return clienteController.viewCliente(id);
  } else {
    console.error('clienteController não está disponível');
  }
}

async function deleteCliente(id) {
  if (typeof clienteController !== 'undefined' && clienteController.deleteCliente) {
    return clienteController.deleteCliente(id);
  } else {
    console.error('clienteController não está disponível');
  }
}

function cobrar(id) {
  if (typeof cobrancaController !== 'undefined' && cobrancaController.cobrar) {
    return cobrancaController.cobrar(id);
  } else {
    console.error('cobrancaController não está disponível');
  }
}

// Funções globais para quitar e editar parcela
window.quitarParcela = async function(id) {
  if (!confirm('Deseja marcar esta parcela como quitada?')) return;
  try {
    await fetch(`/api/cobrancas/${id}/pagamento`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ valor_pago: 0, data_pagamento: new Date().toISOString().split('T')[0], forma_pagamento: 'Manual', observacoes: 'Quitado via sistema' })
    });
    ui.showNotification('Parcela marcada como quitada!', 'success');
    if (document.getElementById('emprestimos-lista')) renderEmprestimosLista();
    if (document.querySelector('.modal')) document.querySelector('.modal').remove();
  } catch (err) {
    ui.showNotification('Erro ao quitar parcela', 'error');
  }
};
window.editarParcela = function(id) {
  // Exemplo de modal de edição simples
  const cobranca = (window.apiService && window.apiService.getCobrancas) ? null : null;
  // Para produção, buscar a cobrança pelo id e exibir modal de edição
  alert('Funcionalidade de edição de parcela em desenvolvimento.');
};

 