// Configurações da API
const API_BASE_URL = 'http://localhost:3000/api/cobrancas';

// Estado global da aplicação
const appState = {
  isLoading: false,
  data: {
    dashboard: null,
    emprestimos: [],
    cobrancas: []
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
    return this.request('/dashboard');
  },

  // Clientes
  async getClientes() {
    return this.request('/clientes');
  },

  async createCliente(clienteData) {
    return this.request('/clientes', {
      method: 'POST',
      body: JSON.stringify(clienteData)
    });
  },

  // Empréstimos
  async getEmprestimos() {
    return this.request('/emprestimos');
  },

  async createEmprestimo(emprestimoData) {
    return this.request('/emprestimos', {
      method: 'POST',
      body: JSON.stringify(emprestimoData)
    });
  },

  // Cobranças
  async getCobrancas() {
    return this.request('/cobrancas');
  }
};

// UI Components
const ui = {
  // Loading states
  showLoading(element) {
    element.classList.add('loading');
  },

  hideLoading(element) {
    element.classList.remove('loading');
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

  // Table helpers
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
      ui.showLoading(document.querySelector('.dashboard'));
      
      const data = await apiService.getDashboardData();
      appState.data.dashboard = data;
      
      this.updateDashboardCards(data);
      this.updateRecentEmprestimos(data.recentEmprestimos || []);
      this.updateCobrancasPendentes(data.cobrancasPendentes || []);
      
    } catch (error) {
      console.error('Erro ao carregar dashboard:', error);
      ui.showNotification('Erro ao carregar dados do dashboard', 'error');
    } finally {
      ui.hideLoading(document.querySelector('.dashboard'));
    }
  },

  updateDashboardCards(data) {
    // Atualizar cards com animação
    const cards = {
      'total-clientes': data.totalClientes || 0,
      'total-emprestimos': data.totalEmprestimos || 0,
      'valor-receber': data.valorReceber || 0,
      'clientes-atraso': data.clientesAtraso || 0
    };

    Object.entries(cards).forEach(([id, value]) => {
      const element = document.getElementById(id);
      if (element) {
        if (id === 'valor-receber') {
          utils.animateValue(element, 0, value, 1000);
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
      const row = ui.createTableRow({
        cliente: emprestimo.cliente.nome,
        valor: utils.formatCurrency(emprestimo.valor),
        data: utils.formatDate(emprestimo.data),
        status: `<span class="badge badge-${emprestimo.status === 'ativo' ? 'success' : 'warning'}">${emprestimo.status}</span>`
      }, [
        {
          type: 'primary',
          text: 'Ver',
          onclick: `emprestimoController.viewEmprestimo(${emprestimo.id})`
        }
      ]);
      
      tbody.appendChild(row);
    });
  },

  updateCobrancasPendentes(cobrancas) {
    const tbody = document.getElementById('cobrancas-pendentes');
    if (!tbody) return;

    tbody.innerHTML = '';

    if (cobrancas.length === 0) {
      tbody.innerHTML = '<tr><td colspan="6" class="text-center text-gray-500">Nenhuma cobrança pendente</td></tr>';
      return;
    }

    cobrancas.forEach(cobranca => {
      const diasAtraso = utils.calculateDaysLate(cobranca.vencimento);
      const statusClass = diasAtraso > 30 ? 'danger' : diasAtraso > 7 ? 'warning' : 'info';
      
      const row = ui.createTableRow({
        cliente: cobranca.cliente.nome,
        valor: utils.formatCurrency(cobranca.valor),
        vencimento: utils.formatDate(cobranca.vencimento),
        diasAtraso: diasAtraso > 0 ? `${diasAtraso} dias` : 'No prazo',
        status: `<span class="badge badge-${statusClass}">${cobranca.status}</span>`
      }, [
        {
          type: 'secondary',
          text: 'Cobrar',
          onclick: `cobrancaController.cobrar(${cobranca.id})`
        }
      ]);
      
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
      // Configurar data atual
      this.setCurrentDate();
      
      // Inicializar menu mobile
      mobileMenuController.init();
      
      // Carregar dados do dashboard
      await dashboardController.loadDashboardData();
      
      // Configurar auto-refresh a cada 5 minutos
      setInterval(() => {
        dashboardController.loadDashboardData();
      }, 5 * 60 * 1000);
      
      // Adicionar estilos para notificações
      this.addNotificationStyles();
      
    } catch (error) {
      console.error('Erro na inicialização:', error);
      ui.showNotification('Erro ao inicializar a aplicação', 'error');
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

// Inicializar quando o DOM estiver pronto
document.addEventListener('DOMContentLoaded', () => {
  app.init();
});

// Exportar para uso global
window.app = app;
window.dashboardController = dashboardController;
window.ui = ui;
window.utils = utils; 