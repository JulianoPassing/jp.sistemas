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
  },

  // Formatação de data para inputs HTML
  formatDateForInput: (dateString) => {
    if (!dateString) return '';
    try {
      const date = new Date(dateString);
      // Verificar se a data é válida
      if (isNaN(date.getTime())) return '';
      return date.toISOString().split('T')[0];
    } catch (error) {
      console.error('Erro ao formatar data para input:', error);
      return '';
    }
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
        let errorMessage = `HTTP error! status: ${response.status}`;
        try {
          const errorData = await response.json();
          console.error('Error data:', errorData);
          errorMessage = errorData.error || errorData.message || errorMessage;
        } catch (parseError) {
          console.error('Erro ao fazer parse da resposta de erro:', parseError);
          const errorText = await response.text();
          console.error('Texto da resposta de erro:', errorText);
        }
        throw new Error(errorMessage);
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
    return this.request('/cobrancas/emprestimos', {
      method: 'POST',
      body: JSON.stringify(emprestimoData)
    });
  },

  async getParcelasEmprestimo(emprestimoId) {
    return this.request(`/cobrancas/emprestimos/${emprestimoId}/parcelas`);
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
      await this.updateRecentEmprestimos(data.emprestimosRecentes || []);
      await this.updateCobrancasPendentes(data.cobrancasPendentes || []);
      
      // Usar o valor calculado pela API que já considera parcelas corretamente
      // Não sobrescrever o valor da API com cálculo local incorreto
      // data.cobrancas.clientes_em_atraso já vem correto da API
      
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
    console.log('📊 Dados recebidos do dashboard:', data);
    
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
    
    console.log('📊 Valores mapeados para os cards:', cards);

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

  async updateRecentEmprestimos(emprestimos) {
    const tbody = document.getElementById('emprestimos-recentes');
    if (!tbody) return;

    tbody.innerHTML = '';

    if (emprestimos.length === 0) {
      tbody.innerHTML = '<tr><td colspan="5" class="text-center text-gray-500">Nenhum empréstimo recente</td></tr>';
      return;
    }

    // Processar empréstimos em paralelo para melhor performance
    const emprestimosProcessados = await Promise.all(
      emprestimos.map(async (emprestimo) => {
        // Validação e fallback seguro para campos numéricos
        const valorInvestido = Number(emprestimo.valor || 0);
        const jurosPercent = Number(emprestimo.juros_mensal || 0);
        const jurosTotal = valorInvestido * (jurosPercent / 100);
        const hoje = new Date();
        hoje.setHours(0,0,0,0);
        let status = (emprestimo.status || '').toUpperCase();
        let dataVencimento = emprestimo.data_vencimento ? new Date(emprestimo.data_vencimento) : null;
        let valorAtualizado = valorInvestido + jurosTotal;
        let infoJuros = '';
        let diasAtraso = 0;
        let jurosDiario = 0;
        let jurosAplicado = 0;
        
        // Verificar status baseado em parcelas para empréstimos parcelados
        if (emprestimo.tipo_emprestimo === 'in_installments' && emprestimo.numero_parcelas > 1) {
          try {
            const parcelas = await apiService.getParcelasEmprestimo(emprestimo.id);
            const parcelasAtrasadas = parcelas.filter(p => {
              const dataVencParcela = new Date(p.data_vencimento);
              return dataVencParcela < hoje && (p.status !== 'Paga');
            });
            
            const parcelasPagas = parcelas.filter(p => p.status === 'Paga');
            
            if (parcelasPagas.length === parcelas.length) {
              status = 'QUITADO';
            } else if (parcelasAtrasadas.length > 0) {
              status = 'ATRASADO';
              // Usar a data de vencimento da parcela mais atrasada
              const parcelaMaisAtrasada = parcelasAtrasadas.sort((a, b) => 
                new Date(a.data_vencimento) - new Date(b.data_vencimento)
              )[0];
              dataVencimento = new Date(parcelaMaisAtrasada.data_vencimento);
            } else {
              status = 'ATIVO';
            }
          } catch (error) {
            console.error('Erro ao buscar parcelas para empréstimo', emprestimo.id, error);
          }
        } else {
          // Para empréstimos de parcela única, usar lógica original
          if (dataVencimento && dataVencimento < hoje && status !== 'QUITADO') {
            status = 'ATRASADO';
          }
        }
        
        // Calcular juros de atraso se necessário
        if (status === 'ATRASADO' && dataVencimento) {
          const diffTime = hoje.getTime() - dataVencimento.getTime();
          diasAtraso = Math.floor(diffTime / (1000 * 60 * 60 * 24));
          jurosDiario = Math.ceil(jurosTotal / 30);
          jurosAplicado = jurosDiario * diasAtraso;
          valorAtualizado = valorInvestido + jurosTotal + jurosAplicado;
          infoJuros = `<br><small style='color:#ef4444'>Juros diário: +R$ ${jurosDiario.toFixed(2)} (${diasAtraso} dias)</small>`;
        }
        
        return { ...emprestimo, status, valorAtualizado, infoJuros };
      })
    );

    emprestimosProcessados.forEach(emprestimo => {
      const valor = new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL'
      }).format(emprestimo.valorAtualizado);
      const data = new Date(emprestimo.data_emprestimo).toLocaleDateString('pt-BR');
      const statusClass = emprestimo.status === 'ATRASADO' ? 'danger' : (emprestimo.status === 'PENDENTE' ? 'warning' : (emprestimo.status === 'ATIVO' ? 'success' : 'info'));
      const row = document.createElement('tr');
      row.innerHTML = `
        <td>${emprestimo.cliente_nome || 'N/A'}</td>
        <td>${valor}${emprestimo.infoJuros}</td>
        <td>${emprestimo.parcelas || '-'}</td>
        <td>${data}</td>
        <td>${emprestimo.data_vencimento ? new Date(emprestimo.data_vencimento).toLocaleDateString('pt-BR') : '-'}</td>
        <td><span class="badge badge-${statusClass}">${emprestimo.status}</span></td>
        <td>
          <button class="btn btn-primary btn-sm" onclick="viewEmprestimo(${emprestimo.id})">Ver</button>
        </td>
      `;
      tbody.appendChild(row);
    });
  },

  async updateCobrancasPendentes(cobrancas) {
    const tbody = document.getElementById('cobrancas-pendentes');
    if (!tbody) return;

    tbody.innerHTML = '';

    // Filtrar apenas cobranças atrasadas considerando parcelas
    const atrasadas = [];
    for (const cobranca of cobrancas) {
      const hoje = new Date();
      hoje.setHours(0,0,0,0);
      let status = (cobranca.status || '').toUpperCase();
      let isAtrasado = false;
      
      // Verificar se é empréstimo parcelado
      if (cobranca.tipo_emprestimo === 'in_installments' && cobranca.numero_parcelas > 1) {
        try {
          const parcelas = await apiService.getParcelasEmprestimo(cobranca.id);
          const parcelasAtrasadas = parcelas.filter(p => {
            const dataVencParcela = new Date(p.data_vencimento);
            return dataVencParcela < hoje && (p.status !== 'Paga');
          });
          
          if (parcelasAtrasadas.length > 0) {
            isAtrasado = true;
          }
        } catch (error) {
          console.error('Erro ao buscar parcelas para cobrança', cobranca.id, error);
        }
      } else {
        // Para empréstimos de parcela única
        const dataVencimento = cobranca.data_vencimento ? new Date(cobranca.data_vencimento) : null;
        if (dataVencimento && dataVencimento < hoje && status !== 'QUITADO') {
          isAtrasado = true;
        }
      }
      
      if (isAtrasado) {
        atrasadas.push(cobranca);
      }
    }

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

// Controllers para ações específicas
const emprestimoController = {
  renderParcelasDetalhadas(parcelas) {
    const hoje = new Date();
    hoje.setHours(0,0,0,0);
    
    return `
      <div style="margin-bottom: 1.2rem;">
        <div style="font-size: 1.1rem; font-weight: 700; color: #222; margin-bottom: 1em; text-align: center;">
          EMPRÉSTIMO PARCELADO - ${parcelas.length} PARCELAS
        </div>
        <div style="max-height: 400px; overflow-y: auto;">
          ${parcelas.map(parcela => {
            const dataVencimento = new Date(parcela.data_vencimento);
            const isAtrasado = dataVencimento < hoje;
            const status = parcela.status || parcela.cobranca_status || 'Pendente';
            const valorParcela = Number(parcela.valor_parcela || 0);
            
            let statusColor = '#6b7280'; // cinza para pendente
            let statusText = 'Pendente';
            
            if (status === 'Paga') {
              statusColor = '#10b981'; // verde
              statusText = 'Paga';
            } else if (status === 'Atrasada' || isAtrasado) {
              statusColor = '#ef4444'; // vermelho
              statusText = 'Atrasada';
            }
            
            return `
              <div style="border: 1px solid #e5e7eb; border-radius: 8px; padding: 1rem; margin-bottom: 0.5rem; background: ${status === 'Paga' ? '#f0fdf4' : isAtrasado ? '#fef2f2' : '#fff'};" data-emprestimo-id="${parcela.emprestimo_id}" data-numero-parcela="${parcela.numero_parcela}">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
                  <span style="font-weight: 600; color: #374151;">Parcela ${parcela.numero_parcela}</span>
                  <span style="background: ${statusColor}; color: white; padding: 0.25rem 0.75rem; border-radius: 12px; font-size: 0.875rem; font-weight: 500;">
                    ${statusText}
                  </span>
                </div>
                <div style="display: flex; justify-content: space-between; margin-bottom: 0.25rem;">
                  <span style="color: #6b7280;">Valor:</span>
                  <span style="font-weight: 600;">R$ ${utils.formatCurrency(valorParcela)}</span>
                </div>
                <div style="display: flex; justify-content: space-between; margin-bottom: 0.5rem;">
                  <span style="color: #6b7280;">Vencimento:</span>
                  <span style="font-weight: 500; color: ${isAtrasado ? '#ef4444' : '#374151'};">
                    ${utils.formatDate(parcela.data_vencimento)}
                    ${isAtrasado && status !== 'Paga' ? ` (${Math.floor((hoje - dataVencimento) / (1000 * 60 * 60 * 24))} dias)` : ''}
                  </span>
                </div>
                ${parcela.data_pagamento ? `
                  <div style="display: flex; justify-content: space-between; margin-bottom: 0.5rem;">
                    <span style="color: #6b7280;">Pago em:</span>
                    <span style="font-weight: 500; color: #10b981;">
                      ${utils.formatDate(parcela.data_pagamento)}
                    </span>
                  </div>
                ` : ''}
                <div style="display: flex; gap: 0.5rem; margin-top: 0.75rem; flex-wrap: wrap;">
                  ${status !== 'Paga' ? `
                    <button class="btn" style="background: #10b981; color: #fff; font-size: 0.875rem; padding: 0.375rem 0.75rem; border-radius: 6px; flex: 1; min-width: 80px;" onclick="marcarParcelaPaga(${parcela.emprestimo_id}, ${parcela.numero_parcela})">
                      Pagar
                    </button>
                    <button class="btn" style="background: #ef4444; color: #fff; font-size: 0.875rem; padding: 0.375rem 0.75rem; border-radius: 6px; flex: 1; min-width: 80px;" onclick="marcarParcelaAtrasada(${parcela.emprestimo_id}, ${parcela.numero_parcela})">
                      Atraso
                    </button>
                  ` : `
                    <button class="btn" style="background: #6b7280; color: #fff; font-size: 0.875rem; padding: 0.375rem 0.75rem; border-radius: 6px; flex: 1;" onclick="marcarParcelaPendente(${parcela.emprestimo_id}, ${parcela.numero_parcela})">
                      Desfazer
                    </button>
                  `}
                </div>
              </div>
            `;
          }).join('')}
        </div>
        <div style="text-align: center; margin-top: 1rem; padding-top: 1rem; border-top: 1px solid #e5e7eb;">
          <div style="font-size: 1.2rem; font-weight: bold; color: #002f4b;">
            Total do Empréstimo: <span style="color: #10b981;">R$ ${utils.formatCurrency(parcelas.reduce((total, p) => total + Number(p.valor_parcela || 0), 0))}</span>
          </div>
        </div>
      </div>
    `;
  },

  async editarEmprestimo(id) {
    try {
      // Buscar dados do empréstimo
      const emprestimos = await apiService.getEmprestimos();
      const emp = emprestimos.find(e => String(e.id) === String(id));
      
      if (!emp) {
        ui.showNotification('Empréstimo não encontrado', 'error');
        return;
      }

      // Buscar lista de clientes para o select
      const clientes = await apiService.getClientes();
      
      // Criar modal de edição
      const modalEdicao = `
        <div style="padding: 1.5rem; max-width: 600px; margin: 0 auto;">
          <h3 style="margin-bottom: 1.5rem; color: #002f4b; text-align: center;">Editar Empréstimo #${emp.id}</h3>
          
          <form id="form-editar-emprestimo">
            <div class="form-group">
              <label>Cliente *</label>
              <select id="edit-cliente" class="form-input" required>
                <option value="">Selecione um cliente</option>
                ${clientes.map(cliente => `
                  <option value="${cliente.id}" ${cliente.id == emp.cliente_id ? 'selected' : ''}>
                    ${cliente.nome} - ${cliente.telefone || cliente.celular || 'Sem telefone'}
                  </option>
                `).join('')}
              </select>
            </div>
            
            <div class="grid grid-cols-2" style="gap: 1rem;">
                             <div class="form-group">
                 <label>Valor do Empréstimo (R$) *</label>
                 <input type="text" id="edit-valor" class="form-input" value="R$ ${utils.formatCurrency(emp.valor || 0)}" required>
               </div>
              
              <div class="form-group">
                <label>Juros Mensal (%) *</label>
                <input type="number" id="edit-juros" class="form-input" step="0.01" min="0" value="${emp.juros_mensal || ''}" required>
              </div>
            </div>
            
            <div class="grid grid-cols-2" style="gap: 1rem;">
                             <div class="form-group">
                 <label>Data de Vencimento *</label>
                 <input type="date" id="edit-data-vencimento" class="form-input" value="${utils.formatDateForInput(emp.data_vencimento)}" required>
               </div>
              
              <div class="form-group">
                <label>Frequência de Pagamento *</label>
                <select id="edit-frequencia" class="form-input" required>
                  <option value="monthly" ${emp.frequencia_pagamento === 'monthly' ? 'selected' : ''}>Mensal</option>
                  <option value="weekly" ${emp.frequencia_pagamento === 'weekly' ? 'selected' : ''}>Semanal</option>
                  <option value="daily" ${emp.frequencia_pagamento === 'daily' ? 'selected' : ''}>Diário</option>
                  <option value="biweekly" ${emp.frequencia_pagamento === 'biweekly' ? 'selected' : ''}>Quinzenal</option>
                </select>
              </div>
            </div>
            
            <div class="grid grid-cols-2" style="gap: 1rem;">
              <div class="form-group">
                <label>Número de Parcelas *</label>
                <input type="number" id="edit-parcelas" class="form-input" min="1" value="${emp.numero_parcelas || 1}" required>
              </div>
              
              <div class="form-group">
                <label>Status</label>
                <select id="edit-status" class="form-input">
                  <option value="Ativo" ${emp.status === 'Ativo' ? 'selected' : ''}>Ativo</option>
                  <option value="Quitado" ${emp.status === 'Quitado' ? 'selected' : ''}>Quitado</option>
                  <option value="Em Atraso" ${emp.status === 'Em Atraso' ? 'selected' : ''}>Em Atraso</option>
                  <option value="Cancelado" ${emp.status === 'Cancelado' ? 'selected' : ''}>Cancelado</option>
                </select>
              </div>
            </div>
            
            <div class="form-group">
              <label>Observações</label>
              <textarea id="edit-observacoes" class="form-input" rows="3" placeholder="Observações sobre o empréstimo">${emp.observacoes || ''}</textarea>
            </div>
            
            <div style="display: flex; gap: 1rem; margin-top: 2rem;">
              <button type="submit" class="btn btn-primary" style="flex: 1;">Salvar Alterações</button>
              <button type="button" class="btn btn-secondary" onclick="this.closest('.modal').remove()">Cancelar</button>
            </div>
          </form>
        </div>
      `;
      
      const modal = ui.showModal(modalEdicao, 'Editar Empréstimo');
      
      // Aplicar máscara de moeda no campo valor
      const valorInput = modal.querySelector('#edit-valor');
      this.aplicarMascaraMoeda(valorInput);
      
      // Processar formulário de edição
      const form = modal.querySelector('#form-editar-emprestimo');
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const formData = {
          cliente_id: document.getElementById('edit-cliente').value,
          valor: this.parseMoeda(document.getElementById('edit-valor').value),
          juros_mensal: parseFloat(document.getElementById('edit-juros').value),
          data_vencimento: document.getElementById('edit-data-vencimento').value,
          frequencia_pagamento: document.getElementById('edit-frequencia').value,
          numero_parcelas: parseInt(document.getElementById('edit-parcelas').value),
          status: document.getElementById('edit-status').value,
          observacoes: document.getElementById('edit-observacoes').value
        };
        
        // Validações
        if (!formData.cliente_id) {
          ui.showNotification('Selecione um cliente', 'error');
          return;
        }
        
        if (!formData.valor || formData.valor <= 0) {
          ui.showNotification('Valor do empréstimo deve ser maior que zero', 'error');
          return;
        }
        
        if (!formData.juros_mensal || formData.juros_mensal < 0) {
          ui.showNotification('Juros deve ser maior ou igual a zero', 'error');
          return;
        }
        
        if (!formData.data_vencimento) {
          ui.showNotification('Data de vencimento é obrigatória', 'error');
          return;
        }
        
        if (!formData.numero_parcelas || formData.numero_parcelas < 1) {
          ui.showNotification('Número de parcelas deve ser maior que zero', 'error');
          return;
        }
        
        try {
          const submitBtn = form.querySelector('button[type="submit"]');
          const originalText = submitBtn.textContent;
          submitBtn.textContent = 'Salvando...';
          submitBtn.disabled = true;
          
          // Enviar dados para a API
          const response = await fetch(`/api/cobrancas/emprestimos/${id}`, {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json'
            },
            credentials: 'include',
            body: JSON.stringify(formData)
          });
          
          if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Erro ao atualizar empréstimo');
          }
          
          // Sucesso
          modal.remove();
          ui.showNotification('Empréstimo atualizado com sucesso!', 'success');
          
          // Recarregar dados
          setTimeout(async () => {
            await recarregarDadosPagina();
          }, 1000);
          
        } catch (error) {
          console.error('Erro ao atualizar empréstimo:', error);
          ui.showNotification('Erro ao atualizar empréstimo: ' + error.message, 'error');
        } finally {
          const submitBtn = form.querySelector('button[type="submit"]');
          submitBtn.textContent = originalText;
          submitBtn.disabled = false;
        }
      });
      
    } catch (error) {
      console.error('Erro ao carregar dados para edição:', error);
      ui.showNotification('Erro ao carregar dados para edição', 'error');
    }
  },

  aplicarMascaraMoeda(input) {
    input.addEventListener('input', function(e) {
      let value = e.target.value.replace(/\D/g, '');
      value = (value / 100).toFixed(2) + '';
      value = value.replace(".", ",");
      value = value.replace(/(\d)(?=(\d{3})+(?!\d))/g, "$1.");
      e.target.value = 'R$ ' + value;
    });
  },

  parseMoeda(valor) {
    if (!valor) return 0;
    return parseFloat(valor.replace(/[R$\s.]/g, '').replace(',', '.')) || 0;
  },



  async viewEmprestimo(id) {
    try {
      const emprestimos = await apiService.getEmprestimos();
      const emp = emprestimos.find(e => String(e.id) === String(id));
      console.log('DEBUG EMPRESTIMO:', emp);
      if (!emp) {
        ui.showNotification('Empréstimo não encontrado', 'error');
        return;
      }

      // Buscar parcelas se for empréstimo parcelado
      let parcelas = [];
      if (emp.tipo_emprestimo === 'in_installments' && emp.numero_parcelas > 1) {
        try {
          parcelas = await apiService.getParcelasEmprestimo(id);
          console.log('PARCELAS ENCONTRADAS:', parcelas);
        } catch (error) {
          console.error('Erro ao buscar parcelas:', error);
        }
      }
      try {
        // Validação e fallback seguro para campos numéricos
        const valorInvestido = Number(emp.valor || 0);
        const jurosPercent = Number(emp.juros_mensal || 0);
        const multaAtraso = Number(emp.multa_atraso || 0);
        const jurosTotal = valorInvestido * (jurosPercent / 100);
        const hoje = new Date();
        hoje.setHours(0,0,0,0);
        let status = (emp.status || '').toUpperCase();
        let dataVencimento = emp.data_vencimento ? new Date(emp.data_vencimento) : null;
        
        // Para empréstimos parcelados, verificar status baseado nas parcelas
        if (parcelas.length > 0) {
          const parcelasAtrasadas = parcelas.filter(p => {
            const dataVencParcela = new Date(p.data_vencimento);
            return dataVencParcela < hoje && (p.status !== 'Paga');
          });
          
          const parcelasPagas = parcelas.filter(p => p.status === 'Paga');
          
          if (parcelasPagas.length === parcelas.length) {
            status = 'QUITADO';
          } else if (parcelasAtrasadas.length > 0) {
            status = 'ATRASADO';
            // Usar a data de vencimento da parcela mais atrasada
            const parcelaMaisAtrasada = parcelasAtrasadas.sort((a, b) => 
              new Date(a.data_vencimento) - new Date(b.data_vencimento)
            )[0];
            dataVencimento = new Date(parcelaMaisAtrasada.data_vencimento);
          } else {
            status = 'ATIVO';
          }
        } else {
          // Para empréstimos de parcela única, usar lógica original
          if (dataVencimento && dataVencimento < hoje && status !== 'QUITADO') {
            status = 'ATRASADO';
          }
        }
        let valorAtualizado = valorInvestido + jurosTotal;
        let infoJuros = '';
        let diasAtraso = 0;
        let jurosDiario = 0;
        let jurosAplicado = 0;
        if (status === 'ATRASADO') {
          // Calcular dias de atraso
          const diffTime = hoje.getTime() - dataVencimento.getTime();
          diasAtraso = Math.floor(diffTime / (1000 * 60 * 60 * 24));
          // Juros diário: juros total dividido por 30 dias, arredondado para cima
          jurosDiario = Math.ceil(jurosTotal / 30);
          jurosAplicado = jurosDiario * diasAtraso;
          valorAtualizado = valorInvestido + jurosTotal + jurosAplicado;
          infoJuros = `
            <div style='margin-top:1em; color:#ef4444; font-size:1rem;'>
              <b>Em atraso:</b> ${diasAtraso} dia(s)<br>
              Juros total previsto: <b>R$ ${jurosTotal.toFixed(2)}</b><br>
              Juros diário: <b>R$ ${jurosDiario.toFixed(2)}</b><br>
              Juros aplicado (atraso): <b>R$ ${jurosAplicado.toFixed(2)}</b><br>
              <span style='font-size:1.1em;'>Valor atualizado: <b>R$ ${valorAtualizado.toFixed(2)}</b></span>
            </div>
          `;
        }
        // Modal HTML
        const telefone = emp.telefone || emp.celular || emp.whatsapp || '';
        const nome = emp.cliente_nome || '';
        // Calcular valor total dos juros (juros total + juros aplicado por atraso)
        const valorTotalJuros = jurosTotal + jurosAplicado;
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
              <div style="font-size: 1.1rem; font-weight: 600; color: #222; margin-bottom: 0.2em;">PCL-Nº #${emp.id} ${emp.parcelas ? `(${emp.parcelas}ª parcela)` : ''}</div>
              <div style="font-size: 1rem; color: #444; margin-bottom: 0.2em;">Deve ser pago em <b>${emp.data_vencimento ? utils.formatDate(emp.data_vencimento) : '-'}</b></div>
              <div style="font-size: 1rem; color: #444;">Valor Investido <b>R$ ${utils.formatCurrency(valorInvestido)}</b></div>
              <div style="font-size: 1rem; color: #444;">Juros <b>${jurosPercent}%</b> (R$ ${utils.formatCurrency(jurosTotal)})</div>
              ${infoJuros}
            </div>
            <hr style="margin: 1.2rem 0; border: none; border-top: 1px solid #eee;">
            ${parcelas.length > 1 ? this.renderParcelasDetalhadas(parcelas) : `
              <div style="margin-bottom: 1.2rem; text-align: center;">
                <div style="font-size: 1.1rem; font-weight: 700; color: #222; margin-bottom: 0.2em;">PARCELA ÚNICA</div>
                <div style="font-size: 1.3rem; font-weight: bold; color: #002f4b;">Total a Receber: <span style="color: #10b981;">R$ ${utils.formatCurrency(valorAtualizado)}</span></div>
              </div>
            `}
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
        // Corrigir comportamento do botão WhatsApp para nunca recarregar
        const btnWhats = modal.querySelector('#modal-notificar');
        btnWhats.addEventListener('click', (e) => {
          e.stopPropagation();
          // Não faz nada além de abrir o link
        });
        
        // Botão Editar
        modal.querySelector('#modal-btn-editar').onclick = async (e) => {
          e.preventDefault();
          modal.remove();
          await this.editarEmprestimo(emp.id);
        };
        // Botão Quitado
        modal.querySelector('#modal-btn-quitado').onclick = async (e) => {
          e.preventDefault();
          try {
            await fetch(`/api/cobrancas/emprestimos/${emp.id}/status`, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              credentials: 'include',
              body: JSON.stringify({ status: 'Quitado' })
            });
            ui.showNotification('Empréstimo marcado como quitado!', 'success');
            modal.remove();
            if (document.getElementById('emprestimos-lista')) renderEmprestimosLista();
          } catch (err) {
            ui.showNotification('Erro ao atualizar status', 'error');
          }
        };
        // Botão Só Juros
        modal.querySelector('#modal-btn-sojuros').onclick = async (e) => {
          e.preventDefault();
          
          // Calcular juros acumulados
          const valorInicial = Number(emp.valor || 0);
          const jurosPercent = Number(emp.juros_mensal || 0);
          const jurosAcumulados = valorInicial * (jurosPercent / 100);
          
          // Criar modal de pagamento de juros
          const modalPagamento = `
            <div style="padding: 1.5rem; max-width: 500px; margin: 0 auto;">
              <h3 style="margin-bottom: 1rem; color: #002f4b;">Pagamento de Juros com Extensão</h3>
              
              <div style="background: #f8f9fa; padding: 1rem; border-radius: 8px; margin-bottom: 1rem;">
                <h4 style="margin-bottom: 0.5rem; color: #002f4b;">Resumo do Empréstimo</h4>
                <p><strong>Cliente:</strong> ${emp.cliente_nome || 'N/A'}</p>
                <p><strong>Valor Inicial do Empréstimo:</strong> R$ ${utils.formatCurrency(valorInicial)}</p>
                <p><strong>Juros Mensal:</strong> ${jurosPercent}%</p>
                <p><strong>Juros Acumulados a Pagar:</strong> R$ ${utils.formatCurrency(jurosAcumulados)}</p>
                <p><strong>Vencimento Atual:</strong> ${emp.data_vencimento ? utils.formatDate(emp.data_vencimento) : '-'}</p>
                <p><strong>Novo Vencimento:</strong> ${(() => {
                  const dataVenc = new Date(emp.data_vencimento);
                  dataVenc.setDate(dataVenc.getDate() + 30);
                  return utils.formatDate(dataVenc.toISOString().split('T')[0]);
                })()}</p>
                <p><strong>Novo Valor da Dívida:</strong> R$ ${utils.formatCurrency(valorInicial)} <em>(volta ao valor inicial)</em></p>
                <div style="background: #e3f2fd; padding: 0.75rem; border-radius: 6px; margin-top: 0.75rem; border-left: 4px solid #2196f3;">
                  <p style="margin: 0; font-size: 0.9rem; color: #1565c0;">
                    <strong>Como funciona:</strong> Ao pagar apenas os juros, o valor da dívida volta ao valor inicial do empréstimo e o prazo é estendido em 30 dias.
                  </p>
                </div>
              </div>
              
              <form id="form-pagamento-juros">
                <div class="form-group">
                  <label>Valor dos Juros a Pagar (R$) *</label>
                  <input type="number" id="valor-juros" class="form-input" step="0.01" min="${jurosAcumulados}" value="${jurosAcumulados}" required>
                  <small class="text-gray-500">Mínimo: R$ ${utils.formatCurrency(jurosAcumulados)}</small>
                </div>
                
                <div class="form-group">
                  <label>Data do Pagamento *</label>
                  <input type="date" id="data-pagamento" class="form-input" value="${new Date().toISOString().split('T')[0]}" required>
                </div>
                
                <div class="form-group">
                  <label>Forma de Pagamento</label>
                  <select id="forma-pagamento" class="form-input">
                    <option value="Dinheiro">Dinheiro</option>
                    <option value="PIX">PIX</option>
                    <option value="Cartão de Crédito">Cartão de Crédito</option>
                    <option value="Cartão de Débito">Cartão de Débito</option>
                    <option value="Transferência">Transferência</option>
                    <option value="Outro">Outro</option>
                  </select>
                </div>
                
                <div class="form-group">
                  <label>Observações</label>
                  <textarea id="observacoes-juros" class="form-input" rows="3" placeholder="Observações sobre o pagamento"></textarea>
                </div>
                
                <div style="display: flex; gap: 1rem; margin-top: 1.5rem;">
                  <button type="submit" class="btn btn-primary" style="flex: 1;">Confirmar Pagamento</button>
                  <button type="button" class="btn btn-secondary" onclick="this.closest('.modal').remove()">Cancelar</button>
                </div>
              </form>
            </div>
          `;
          
          const modalJuros = ui.showModal(modalPagamento, 'Pagamento de Juros');
          const formJuros = modalJuros.querySelector('#form-pagamento-juros');
          
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
      
      // Buscar todos os empréstimos do cliente
      const emprestimos = await apiService.getEmprestimos();
      const emprestimosCliente = emprestimos.filter(e => e.cliente_id === parseInt(id));
      
      // Processar cada empréstimo para obter informações detalhadas
      const emprestimosDetalhados = await Promise.all(
        emprestimosCliente.map(async (emp) => {
                   const valorInicial = Number(emp.valor || 0) || 0;
         const jurosPercent = Number(emp.juros_mensal || 0) || 0;
         const jurosTotal = valorInicial * (jurosPercent / 100);
         const valorFinal = valorInicial + jurosTotal;
         
         // Determinar tipo de empréstimo
         let tipoEmprestimo = 'Parcela Única';
         let valorParcela = valorFinal;
          let parcelas = [];
          
                     if (emp.tipo_emprestimo === 'in_installments' && emp.numero_parcelas > 1) {
             tipoEmprestimo = `Parcelado (${emp.numero_parcelas}x)`;
             valorParcela = Number(emp.valor_parcela || (valorFinal / emp.numero_parcelas)) || 0;
            
            // Buscar parcelas se for parcelado
            try {
              parcelas = await apiService.getParcelasEmprestimo(emp.id);
            } catch (error) {
              console.error('Erro ao buscar parcelas:', error);
            }
          }
          
          // Determinar status atual baseado em parcelas
          const hoje = new Date();
          hoje.setHours(0,0,0,0);
          let statusAtual = (emp.status || '').toUpperCase();
          
          if (parcelas.length > 0) {
            const parcelasAtrasadas = parcelas.filter(p => {
              const dataVencParcela = new Date(p.data_vencimento);
              return dataVencParcela < hoje && (p.status !== 'Paga');
            });
            
            const parcelasPagas = parcelas.filter(p => p.status === 'Paga');
            
            if (parcelasPagas.length === parcelas.length) {
              statusAtual = 'QUITADO';
            } else if (parcelasAtrasadas.length > 0) {
              statusAtual = 'ATRASADO';
            } else {
              statusAtual = 'ATIVO';
            }
          } else {
            // Para empréstimos de parcela única
            const dataVenc = emp.data_vencimento ? new Date(emp.data_vencimento) : null;
            if (dataVenc && dataVenc < hoje && statusAtual !== 'QUITADO') {
              statusAtual = 'ATRASADO';
            }
          }
          
          return {
            ...emp,
            valorInicial,
            jurosTotal,
            valorFinal,
            valorParcela,
            tipoEmprestimo,
            statusAtual,
            parcelas
          };
        })
      );
      
      const modalContent = `
        <div class="cliente-modal-box" style="padding: 1.5rem; max-width: 800px; margin: 0 auto; max-height: 80vh; overflow-y: auto;">
          <h3 style="margin-bottom: 1rem; color: #002f4b;">${cliente.nome}</h3>
          
          <!-- Dados do Cliente -->
          <div style="background: #f8f9fa; padding: 1rem; border-radius: 8px; margin-bottom: 1.5rem;">
            <h4 style="margin-bottom: 0.5rem; color: #002f4b;">Dados Pessoais</h4>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.5rem;">
              <p><strong>CPF/CNPJ:</strong> ${cliente.cpf_cnpj || 'Não informado'}</p>
              <p><strong>Telefone:</strong> ${cliente.telefone || 'Não informado'}</p>
              <p><strong>Email:</strong> ${cliente.email || 'Não informado'}</p>
              <p><strong>Cidade:</strong> ${cliente.cidade || 'Não informada'}</p>
            </div>
            <p><strong>Endereço:</strong> ${cliente.endereco || 'Não informado'}</p>
          </div>
          
          <!-- Resumo dos Empréstimos -->
          <div style="margin-bottom: 1.5rem;">
            <h4 style="color: #002f4b;">Empréstimos (${emprestimosDetalhados.length})</h4>
            ${emprestimosDetalhados.length === 0 ? 
              '<p style="color: #666; font-style: italic;">Nenhum empréstimo encontrado</p>' :
              emprestimosDetalhados.map((emp, index) => `
                <div style="border: 1px solid #ddd; border-radius: 8px; padding: 1rem; margin: 1rem 0; background: #fff;">
                  <div style="display: flex; justify-content: between; align-items: center; margin-bottom: 1rem;">
                    <h5 style="margin: 0; color: #002f4b;">Empréstimo #${emp.id}</h5>
                    <span class="badge badge-${emp.statusAtual === 'ATIVO' ? 'success' : (emp.statusAtual === 'ATRASADO' ? 'danger' : 'info')}" style="font-size: 0.9rem;">${emp.statusAtual}</span>
                  </div>
                  
                  <!-- Informações Principais -->
                  <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 1rem;">
                    <div>
                      <p style="margin: 0.3rem 0;"><strong>Tipo:</strong> ${emp.tipoEmprestimo}</p>
                                             <p style="margin: 0.3rem 0;"><strong>Valor Inicial:</strong> <span style="color: #10b981; font-weight: bold;">${utils.formatCurrency(emp.valorInicial)}</span></p>
                       <p style="margin: 0.3rem 0;"><strong>Juros (${emp.juros_mensal || 0}%):</strong> <span style="color: #f59e0b; font-weight: bold;">${utils.formatCurrency(emp.jurosTotal)}</span></p>
                       <p style="margin: 0.3rem 0;"><strong>Valor Final:</strong> <span style="color: #ef4444; font-weight: bold;">${utils.formatCurrency(emp.valorFinal)}</span></p>
                    </div>
                    <div>
                      <p style="margin: 0.3rem 0;"><strong>Data Empréstimo:</strong> ${emp.data_emprestimo ? utils.formatDate(emp.data_emprestimo) : 'N/A'}</p>
                      <p style="margin: 0.3rem 0;"><strong>Data Vencimento:</strong> ${emp.data_vencimento ? utils.formatDate(emp.data_vencimento) : 'N/A'}</p>
                                             <p style="margin: 0.3rem 0;"><strong>Valor da Parcela:</strong> <span style="color: #6366f1; font-weight: bold;">${utils.formatCurrency(emp.valorParcela)}</span></p>
                      <p style="margin: 0.3rem 0;"><strong>Frequência:</strong> ${emp.frequencia === 'monthly' ? 'Mensal' : (emp.frequencia === 'weekly' ? 'Semanal' : 'N/A')}</p>
                    </div>
                  </div>
                  
                  <!-- Parcelas (se houver) -->
                  ${emp.parcelas.length > 0 ? `
                    <div style="margin-top: 1rem;">
                      <h6 style="margin-bottom: 0.5rem; color: #002f4b;">Parcelas (${emp.parcelas.length})</h6>
                      <div style="max-height: 200px; overflow-y: auto; border: 1px solid #eee; border-radius: 4px;">
                        ${emp.parcelas.map(parcela => {
                          const dataVenc = new Date(parcela.data_vencimento);
                          const hoje = new Date();
                          hoje.setHours(0,0,0,0);
                          let statusParcela = parcela.status;
                          let corStatus = '#6366f1'; // Pendente
                          
                          if (statusParcela === 'Paga') {
                            corStatus = '#10b981'; // Verde
                          } else if (dataVenc < hoje) {
                            corStatus = '#ef4444'; // Vermelho (atrasada)
                            statusParcela = 'Atrasada';
                          }
                          
                          return `
                            <div style="display: flex; justify-content: space-between; align-items: center; padding: 0.5rem; border-bottom: 1px solid #f0f0f0;">
                              <div>
                                <strong>Parcela ${parcela.numero_parcela}</strong><br>
                                <small>Venc: ${utils.formatDate(parcela.data_vencimento)}</small>
                                ${parcela.data_pagamento ? `<br><small style="color: #10b981;">Pago em: ${utils.formatDate(parcela.data_pagamento)}</small>` : ''}
                              </div>
                              <div style="text-align: right;">
                                <div style="color: ${corStatus}; font-weight: bold;">${utils.formatCurrency(Number(parcela.valor_parcela) || 0)}</div>
                                <span style="background: ${corStatus}; color: white; padding: 0.2rem 0.5rem; border-radius: 4px; font-size: 0.8rem;">${statusParcela}</span>
                              </div>
                            </div>
                          `;
                        }).join('')}
                      </div>
                    </div>
                  ` : ''}
                  
                  <!-- Botões de Ação -->
                  <div style="margin-top: 1rem; text-align: center;">
                    <button class="btn btn-primary btn-sm" onclick="viewEmprestimo(${emp.id})" style="margin-right: 0.5rem;">Ver Detalhes</button>
                    <button class="btn btn-success btn-sm" onclick="cobrar(${emp.id})">Cobrar</button>
                  </div>
                </div>
              `).join('')
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
          <button class="btn btn-primary btn-sm" onclick="viewEmprestimo(${emprestimo.id})">Ver</button>
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
    
    // Processar cada empréstimo
    for (const emprestimo of ativos) {
      // Cálculo de atraso e juros diário
      const valorInvestido = Number(emprestimo.valor_inicial || emprestimo.valor || 0);
      const jurosPercent = Number(emprestimo.juros_mensal || 0);
      const jurosTotal = valorInvestido * (jurosPercent / 100);
      const hoje = new Date();
      hoje.setHours(0,0,0,0);
      let status = (emprestimo.status || '').toUpperCase();
      let dataVencimento = new Date(emprestimo.data_vencimento);
      let valorAtualizado = valorInvestido + jurosTotal;
      let infoJuros = '';
      let diasAtraso = 0;
      let jurosDiario = 0;
      let jurosAplicado = 0;
      
      // Verificar status baseado em parcelas para empréstimos parcelados
      if (emprestimo.tipo_emprestimo === 'in_installments' && emprestimo.numero_parcelas > 1) {
        try {
          const parcelas = await apiService.getParcelasEmprestimo(emprestimo.id);
          const parcelasAtrasadas = parcelas.filter(p => {
            const dataVencParcela = new Date(p.data_vencimento);
            return dataVencParcela < hoje && (p.status !== 'Paga');
          });
          
          const parcelasPagas = parcelas.filter(p => p.status === 'Paga');
          
          if (parcelasPagas.length === parcelas.length) {
            status = 'QUITADO';
          } else if (parcelasAtrasadas.length > 0) {
            status = 'ATRASADO';
            // Usar a data de vencimento da parcela mais atrasada
            const parcelaMaisAtrasada = parcelasAtrasadas.sort((a, b) => 
              new Date(a.data_vencimento) - new Date(b.data_vencimento)
            )[0];
            dataVencimento = new Date(parcelaMaisAtrasada.data_vencimento);
          } else {
            status = 'ATIVO';
          }
        } catch (error) {
          console.error('Erro ao buscar parcelas para empréstimo', emprestimo.id, error);
        }
      } else {
        // Para empréstimos de parcela única, usar lógica original
        if (dataVencimento < hoje && status !== 'QUITADO') {
          status = 'ATRASADO';
        }
      }
      
      // Calcular juros de atraso se necessário
      if (status === 'ATRASADO') {
        const diffTime = hoje.getTime() - dataVencimento.getTime();
        diasAtraso = Math.floor(diffTime / (1000 * 60 * 60 * 24));
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
    }
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
    
    // Processar cada cliente
    for (const cliente of clientes) {
      // Verifica se o cliente tem empréstimo vencido considerando parcelas
      const emprestimosCliente = (emprestimos || []).filter(e => e.cliente_id === cliente.id);
      const hoje = new Date();
      hoje.setHours(0,0,0,0);
      let status = cliente.status || 'Ativo';
      
      if (status === 'Ativo') {
        let temVencido = false;
        
        // Verificar cada empréstimo do cliente
        for (const emprestimo of emprestimosCliente) {
          if ((emprestimo.status || '').toLowerCase() === 'quitado') {
            continue; // Pular empréstimos quitados
          }
          
          // Verificar se é empréstimo parcelado
          if (emprestimo.tipo_emprestimo === 'in_installments' && emprestimo.numero_parcelas > 1) {
            try {
              const parcelas = await apiService.getParcelasEmprestimo(emprestimo.id);
              const parcelasAtrasadas = parcelas.filter(p => {
                const dataVencParcela = new Date(p.data_vencimento);
                return dataVencParcela < hoje && (p.status !== 'Paga');
              });
              
              if (parcelasAtrasadas.length > 0) {
                temVencido = true;
                break;
              }
            } catch (error) {
              console.error('Erro ao buscar parcelas para empréstimo', emprestimo.id, error);
            }
          } else {
            // Para empréstimos de parcela única
            if (!emprestimo.data_vencimento) continue;
            const dataVenc = new Date(emprestimo.data_vencimento);
            if (dataVenc < hoje) {
              temVencido = true;
              break;
            }
          }
        }
        
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
    }
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
    
    // Verificar status de cada empréstimo com base nas parcelas
    for (const emp of emAberto) {
      const valor = utils.formatCurrency(emp.valor || 0);
      const vencimento = emp.data_vencimento ? utils.formatDate(emp.data_vencimento) : '-';
      let badge = '';
      let status = (emp.status || '').toLowerCase();
      
      // Verificar se tem parcelas e determinar status real
      let statusReal = status;
      try {
        const parcelas = await apiService.getParcelasEmprestimo(emp.id);
        if (parcelas && parcelas.length > 0) {
          // Tem parcelas - verificar status das parcelas
          const hoje = new Date();
          hoje.setHours(0,0,0,0);
          
          let parcelasAtrasadas = 0;
          let parcelasPagas = 0;
          
          parcelas.forEach(parcela => {
            const dataVencParcela = new Date(parcela.data_vencimento);
            const atrasadaParcela = dataVencParcela < hoje && parcela.status !== 'Paga';
            
            if (parcela.status === 'Paga') {
              parcelasPagas++;
            } else if (atrasadaParcela) {
              parcelasAtrasadas++;
            }
          });
          
          // Determinar status real baseado nas parcelas
          if (parcelasPagas === parcelas.length) {
            statusReal = 'quitado';
          } else if (parcelasAtrasadas > 0) {
            statusReal = 'atrasado';
          } else {
            statusReal = 'em_dia';
          }
        } else {
          // Sem parcelas - usar data de vencimento do empréstimo
          const hoje = new Date();
          hoje.setHours(0,0,0,0);
          const dataVenc = emp.data_vencimento ? new Date(emp.data_vencimento) : null;
          if (dataVenc && dataVenc < hoje) {
            statusReal = 'atrasado';
          }
        }
      } catch (error) {
        console.error('Erro ao verificar parcelas do empréstimo', emp.id, error);
        // Fallback para verificação pela data de vencimento
        const hoje = new Date();
        hoje.setHours(0,0,0,0);
        const dataVenc = emp.data_vencimento ? new Date(emp.data_vencimento) : null;
        if (dataVenc && dataVenc < hoje) {
          statusReal = 'atrasado';
        }
      }
      
      // Criar badge baseado no status real
      if (statusReal === 'quitado') {
        badge = '<span class="badge" style="background:#10b981;color:#fff;">Quitado</span>';
      } else if (statusReal === 'atrasado' || statusReal === 'em atraso') {
        badge = '<span class="badge" style="background:#ef4444;color:#fff;">Em Atraso</span>';
      } else if (statusReal === 'em_dia' || statusReal === 'ativo' || statusReal === 'pendente') {
        badge = '<span class="badge" style="background:#6366f1;color:#fff;">Em Dia</span>';
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
    }
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

  // Modal de Novo Empréstimo
  const novoEmprestimoBtn = document.getElementById('toggleForm');
  if (novoEmprestimoBtn) {
    novoEmprestimoBtn.addEventListener('click', async () => {
      // Buscar clientes
      let clientes = [];
      try {
        clientes = await apiService.getClientes();
      } catch (e) {
        ui.showNotification('Erro ao carregar clientes', 'error');
      }
      const clienteOptions = clientes.map(c => `<option value=\"${c.id}\">${c.nome || c.razao || c.name}</option>`).join('');
      const modalContent = `
        <form id="modal-emprestimo-form">
          <div class="form-group">
            <label>Cliente (selecione ou preencha manualmente)</label>
            <select name="clienteId" id="modal-cliente-select" class="form-input">
              <option value="">Novo cliente (preencher abaixo)</option>
              ${clienteOptions}
            </select>
          </div>
          <div class="form-group">
            <label>Nome *</label>
            <input type="text" name="nome" id="modal-nome" class="form-input" required placeholder="Nome do cliente">
          </div>
          <div class="form-group">
            <label>CPF (Opcional)</label>
            <input type="text" name="cpf" id="modal-cpf" class="form-input" placeholder="CPF do cliente">
          </div>
          <div class="form-group">
            <label>Telefone</label>
            <input type="text" name="telefone" id="modal-telefone" class="form-input" placeholder="Telefone do cliente">
          </div>
          <div class="form-group">
            <label>Tipo de Empréstimo</label>
            <select name="tipo" id="modal-tipo" class="form-input">
              <option value="fixo">Fixo</option>
              <option value="parcelado">Parcelado</option>
            </select>
          </div>
          <div class="form-group">
            <label>Tipo de Cálculo</label>
            <select name="tipoCalculo" id="modal-tipo-calculo" class="form-input">
              <option value="valor_inicial">Valor Inicial + Juros</option>
              <option value="valor_final">Valor Final Fixo</option>
              <option value="parcela_fixa">Valor da Parcela Fixo</option>
            </select>
          </div>
          <div class="form-group" id="grupo-valor-inicial">
            <label>Valor Inicial (R$)</label>
            <input type="text" name="valor" id="modal-valor" class="form-input" required placeholder="ex.: 1000">
          </div>
          <div class="form-group" id="grupo-valor-final" style="display: none;">
            <label>Valor Inicial (R$)</label>
            <input type="text" name="valorInicialFinal" id="modal-valor-inicial-final" class="form-input" placeholder="ex.: 1000">
            <label>Valor Final (R$)</label>
            <input type="text" name="valorFinal" id="modal-valor-final" class="form-input" placeholder="ex.: 1500">
          </div>
          <div class="form-group" id="grupo-valor-parcela" style="display: none;">
            <label>Valor Inicial (R$)</label>
            <input type="text" name="valorInicialParcela" id="modal-valor-inicial-parcela" class="form-input" placeholder="ex.: 8000">
            <label>Valor da Parcela (R$)</label>
            <input type="text" name="valorParcela" id="modal-valor-parcela" class="form-input" placeholder="ex.: 1000">
          </div>
          <div class="form-group" id="grupo-porcentagem">
            <label>Porcentagem de Juros (%)</label>
            <input type="number" name="porcentagem" id="modal-porcentagem" class="form-input" step="0.01" min="0" placeholder="ex.: 20">
          </div>
          <div class="form-group">
            <label>Multa por Atraso (%)</label>
            <input type="number" name="multa" id="modal-multa" class="form-input" step="0.01" min="0" required placeholder="ex.: 2">
          </div>
          <div class="form-group">
            <label>Data de Vencimento</label>
            <input type="date" name="dataVencimento" id="modal-data-vencimento" class="form-input" required>
          </div>
          <div class="form-group">
            <label>Frequência</label>
            <select name="frequencia" id="modal-frequencia" class="form-input">
              <option value="monthly">Mensal</option>
              <option value="daily">Diário</option>
              <option value="weekly">Semanal</option>
              <option value="biweekly">Quinzenal</option>
            </select>
          </div>
          <div class="form-group">
            <label>Nº de Parcelas</label>
            <input type="number" name="parcelas" id="modal-parcelas" class="form-input" min="1" value="1" required>
          </div>
          <div class="form-group">
            <label>Observações (opcional)</label>
            <textarea name="observacoes" class="form-input" rows="2"></textarea>
          </div>
          <div class="form-group">
            <button type="button" id="btn-simular" class="btn btn-secondary">Simular</button>
          </div>
          <div id="simulador-preview" class="form-group" style="display:none;"></div>
          <div class="form-group">
            <button type="submit" id="btn-adicionar-emprestimo" class="btn btn-primary">Adicionar Empréstimo</button>
          </div>
        </form>
      `;
      const modal = ui.showModal(modalContent, 'Adicionar Empréstimo');
      const form = modal.querySelector('#modal-emprestimo-form');
      // Preencher campos ao selecionar cliente
      const select = modal.querySelector('#modal-cliente-select');
      const nomeInput = modal.querySelector('#modal-nome');
      const cpfInput = modal.querySelector('#modal-cpf');
      const telefoneInput = modal.querySelector('#modal-telefone');
      select.addEventListener('change', () => {
        const selectedId = select.value;
        if (!selectedId) {
          nomeInput.value = '';
          cpfInput.value = '';
          telefoneInput.value = '';
        } else {
          const cliente = clientes.find(c => String(c.id) === String(selectedId));
          nomeInput.value = cliente?.nome || cliente?.razao || cliente?.name || '';
          cpfInput.value = cliente?.cpf || cliente?.cpf_cnpj || '';
          telefoneInput.value = cliente?.telefone || cliente?.phone || '';
        }
      });
      // Controle de exibição dos campos baseado no tipo de cálculo
      const tipoCalculoSelect = modal.querySelector('#modal-tipo-calculo');
      const grupoValorInicial = modal.querySelector('#grupo-valor-inicial');
      const grupoValorFinal = modal.querySelector('#grupo-valor-final');
      const grupoValorParcela = modal.querySelector('#grupo-valor-parcela');
      const grupoPorcentagem = modal.querySelector('#grupo-porcentagem');
      const porcentagemInput = modal.querySelector('#modal-porcentagem');
      const valorInput = modal.querySelector('#modal-valor');
      const valorFinalInput = modal.querySelector('#modal-valor-final');
      const valorParcelaInput = modal.querySelector('#modal-valor-parcela');
      const valorInicialFinalInput = modal.querySelector('#modal-valor-inicial-final');
      const valorInicialParcelaInput = modal.querySelector('#modal-valor-inicial-parcela');

      tipoCalculoSelect.addEventListener('change', () => {
        const tipo = tipoCalculoSelect.value;

        // Esconder todos os grupos
        grupoValorInicial.style.display = 'none';
        grupoValorFinal.style.display = 'none';
        grupoValorParcela.style.display = 'none';
        grupoPorcentagem.style.display = 'none';

        // Remover required de todos os campos
        valorInput.required = false;
        valorFinalInput.required = false;
        valorParcelaInput.required = false;
        valorInicialFinalInput.required = false;
        valorInicialParcelaInput.required = false;
        porcentagemInput.required = false;

        // Mostrar grupos baseado no tipo e definir required apenas nos visíveis
        switch(tipo) {
          case 'valor_inicial':
            grupoValorInicial.style.display = 'block';
            grupoPorcentagem.style.display = 'block';
            valorInput.required = true;
            porcentagemInput.required = true;
            break;
          case 'valor_final':
            grupoValorFinal.style.display = 'block';
            valorInicialFinalInput.required = true;
            valorFinalInput.required = true;
            break;
          case 'parcela_fixa':
            grupoValorParcela.style.display = 'block';
            valorInicialParcelaInput.required = true;
            valorParcelaInput.required = true;
            break;
        }
      });
      
      // Máscara de moeda para todos os campos de valor
      
      function aplicarMascaraMoeda(input) {
        input.addEventListener('input', (e) => {
          let v = e.target.value.replace(/\D/g, '');
          v = (parseInt(v, 10) / 100).toFixed(2);
          e.target.value = v.replace('.', ',');
        });
      }
      
      aplicarMascaraMoeda(valorInput);
      aplicarMascaraMoeda(valorFinalInput);
      aplicarMascaraMoeda(valorParcelaInput);
      aplicarMascaraMoeda(valorInicialFinalInput);
      aplicarMascaraMoeda(valorInicialParcelaInput);
      // Simulador de parcelas
      const btnSimular = modal.querySelector('#btn-simular');
      const previewDiv = modal.querySelector('#simulador-preview');
      const btnAdicionar = modal.querySelector('#btn-adicionar-emprestimo');
      btnSimular.addEventListener('click', () => {
        // Pega valores do formulário
        const tipoCalculo = tipoCalculoSelect.value;
        const parcelas = parseInt(modal.querySelector('#modal-parcelas').value) || 1;
        const tipo = modal.querySelector('#modal-tipo').value;
        
        let valorInicial = 0;
        let valorFinal = 0;
        let valorParcela = 0;
        let juros = 0;
        let jurosValor = 0;
        
        switch(tipoCalculo) {
          case 'valor_inicial':
            valorInicial = parseFloat(valorInput.value.replace(',', '.')) || 0;
            juros = parseFloat(porcentagemInput.value) || 0;
            jurosValor = valorInicial * (juros / 100);
            valorFinal = valorInicial + jurosValor;
            valorParcela = valorFinal / parcelas;
            break;
            
          case 'valor_final':
            valorInicial = parseFloat(valorInicialFinalInput.value.replace(',', '.')) || 0;
            valorFinal = parseFloat(valorFinalInput.value.replace(',', '.')) || 0;
            valorParcela = valorFinal / parcelas;
            jurosValor = valorFinal - valorInicial;
            juros = valorInicial > 0 ? (jurosValor / valorInicial) * 100 : 0;
            break;
            
          case 'parcela_fixa':
            valorInicial = parseFloat(valorInicialParcelaInput.value.replace(',', '.')) || 0;
            valorParcela = parseFloat(valorParcelaInput.value.replace(',', '.')) || 0;
            valorFinal = valorParcela * parcelas;
            jurosValor = valorFinal - valorInicial;
            juros = valorInicial > 0 ? (jurosValor / valorInicial) * 100 : 0;
            break;
        }
        
        previewDiv.style.display = 'block';
        let simulacaoHTML = `
          <div class="simulador-preview-box" style="background: #f8f9fa; padding: 1rem; border-radius: 8px; border-left: 4px solid #007bff;">
            <strong>Resumo da Simulação:</strong><br><br>
        `;
        
        switch(tipoCalculo) {
          case 'valor_inicial':
            simulacaoHTML += `
              Valor Inicial: <b>R$ ${valorInicial.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</b><br>
              Juros: <b>${juros}%</b> (R$ ${jurosValor.toLocaleString('pt-BR', {minimumFractionDigits: 2})})<br>
            `;
            break;
            
          case 'valor_final':
            simulacaoHTML += `
              Valor Inicial: <b>R$ ${valorInicial.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</b><br>
              Valor Final Fixo: <b>R$ ${valorFinal.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</b><br>
              Juros Implícitos: <b>${juros.toFixed(2)}%</b> (R$ ${jurosValor.toLocaleString('pt-BR', {minimumFractionDigits: 2})})<br>
            `;
            break;
            
          case 'parcela_fixa':
            simulacaoHTML += `
              Valor Inicial: <b>R$ ${valorInicial.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</b><br>
              Valor da Parcela Fixo: <b>R$ ${valorParcela.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</b><br>
              Juros Implícitos: <b>${juros.toFixed(2)}%</b> (R$ ${jurosValor.toLocaleString('pt-BR', {minimumFractionDigits: 2})})<br>
            `;
            break;
        }
        
        simulacaoHTML += `
            Total a pagar: <b>R$ ${valorFinal.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</b><br>
            Nº de Parcelas: <b>${parcelas}</b><br>
            Valor da Parcela: <b>R$ ${valorParcela.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</b>
          </div>
        `;
        
        previewDiv.innerHTML = simulacaoHTML;
      });
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const formData = Object.fromEntries(new FormData(form).entries());
        
        // Validação baseada no tipo de cálculo
        const tipoCalculo = formData.tipoCalculo;
        let isValid = true;
        let errorMessage = '';
        
        switch(tipoCalculo) {
          case 'valor_inicial':
            if (!formData.valor || parseFloat(formData.valor.replace(',', '.')) <= 0) {
              isValid = false;
              errorMessage = 'Preencha o valor inicial corretamente';
            } else if (!formData.porcentagem || parseFloat(formData.porcentagem) < 0) {
              isValid = false;
              errorMessage = 'Preencha a porcentagem de juros corretamente';
            }
            break;
            
          case 'valor_final':
            if (!formData.valorInicialFinal || parseFloat(formData.valorInicialFinal.replace(',', '.')) <= 0) {
              isValid = false;
              errorMessage = 'Preencha o valor inicial corretamente';
            } else if (!formData.valorFinal || parseFloat(formData.valorFinal.replace(',', '.')) <= 0) {
              isValid = false;
              errorMessage = 'Preencha o valor final corretamente';
            }
            break;
            
          case 'parcela_fixa':
            if (!formData.valorInicialParcela || parseFloat(formData.valorInicialParcela.replace(',', '.')) <= 0) {
              isValid = false;
              errorMessage = 'Preencha o valor inicial corretamente';
            } else if (!formData.valorParcela || parseFloat(formData.valorParcela.replace(',', '.')) <= 0) {
              isValid = false;
              errorMessage = 'Preencha o valor da parcela corretamente';
            }
            break;
        }
        
        if (!isValid) {
          ui.showNotification(errorMessage, 'error');
          return;
        }
        let cliente_id = formData.clienteId;
        // Se não selecionou cliente, criar cliente
        if (!cliente_id) {
          // Validação do nome do cliente
          if (!formData.nome || formData.nome.trim() === '' || formData.nome === 'undefined') {
            ui.showNotification('Preencha o nome do cliente corretamente!', 'error');
            return;
          }
          
          try {
            const clientePayload = {
              nome: formData.nome,
              cpf_cnpj: formData.cpf || '',
              telefone: formData.telefone || '',
              email: '',
              endereco: '',
              cidade: '',
              estado: '',
              cep: ''
            };
            const resp = await fetch('/api/cobrancas/clientes', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              credentials: 'include',
              body: JSON.stringify(clientePayload)
            });
            const data = await resp.json();
            if (!resp.ok || !data.id) throw new Error('Erro ao criar cliente');
            cliente_id = data.id;
            if (window.clientesApp && typeof window.clientesApp.loadClientes === 'function') {
              window.clientesApp.loadClientes();
            } else if (document.getElementById('clientes-lista')) {
              location.reload();
            }
          } catch (err) {
            ui.showNotification('Erro ao criar cliente', 'error');
            return;
          }
        }
        // Garantir que cliente_id seja inteiro
        cliente_id = parseInt(cliente_id, 10);
        // Calcular valores baseado no tipo de cálculo
        const tipoCalculoCalculo = formData.tipoCalculo;
        let valorInicial = 0;
        let valorFinal = 0;
        let valorParcela = 0;
        let jurosMensal = 0;
        
        switch(tipoCalculoCalculo) {
          case 'valor_inicial':
            valorInicial = parseFloat(formData.valor.replace(',', '.')) || 0;
            jurosMensal = parseFloat(formData.porcentagem) || 0;
            valorFinal = valorInicial * (1 + jurosMensal / 100);
            valorParcela = valorFinal / parseInt(formData.parcelas);
            break;
            
          case 'valor_final':
            valorInicial = parseFloat(formData.valorInicialFinal.replace(',', '.')) || 0;
            valorFinal = parseFloat(formData.valorFinal.replace(',', '.')) || 0;
            valorParcela = valorFinal / parseInt(formData.parcelas);
            jurosMensal = valorInicial > 0 ? ((valorFinal - valorInicial) / valorInicial) * 100 : 0;
            break;
            
          case 'parcela_fixa':
            valorInicial = parseFloat(formData.valorInicialParcela.replace(',', '.')) || 0;
            valorParcela = parseFloat(formData.valorParcela.replace(',', '.')) || 0;
            valorFinal = valorParcela * parseInt(formData.parcelas);
            jurosMensal = valorInicial > 0 ? ((valorFinal - valorInicial) / valorInicial) * 100 : 0;
            break;
        }
        
        // Montar payload do empréstimo
        const payload = {
          cliente_id,
          valor: valorInicial,
          valor_final: valorFinal,
          valor_parcela: valorParcela,
          data_emprestimo: formData.dataVencimento,
          data_vencimento: formData.dataVencimento,
          data_primeira_parcela: formData.dataVencimento,
          juros_mensal: jurosMensal,
          multa_atraso: formData.multa,
          observacoes: formData.observacoes || '',
          tipo_emprestimo: parseInt(formData.parcelas) > 1 ? 'in_installments' : 'fixed',
          numero_parcelas: parseInt(formData.parcelas) || 1,
          frequencia: formData.frequencia || 'monthly',
          tipo_calculo: tipoCalculoCalculo
        };
        
        console.log('Criando empréstimo:', payload);
        try {
          await apiService.createEmprestimo(payload);
          ui.showNotification('Empréstimo adicionado com sucesso!', 'success');
          modal.remove();
          // Atualizar lista de empréstimos de forma robusta
          setTimeout(() => {
            if (document.getElementById('emprestimos-lista')) {
              renderEmprestimosLista();
            } else {
              // Fallback: recarregar a página se a lista não estiver pronta
              location.reload();
            }
          }, 300);
        } catch (err) {
          console.error('=== ERRO AO CRIAR EMPRÉSTIMO ===');
          console.error('Erro completo:', err);
          console.error('Mensagem:', err.message);
          console.error('Stack:', err.stack);
          
          if (err.response) {
            console.error('Response status:', err.response.status);
            console.error('Response data:', err.response.data);
            ui.showNotification(`Erro ao adicionar empréstimo: ${err.response.data?.error || err.message}`, 'error');
          } else {
            ui.showNotification(`Erro ao adicionar empréstimo: ${err.message}`, 'error');
          }
        }
      });
    });
  }
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
    
    // Verificar status de cada empréstimo considerando parcelas
    const atrasados = [];
    for (const e of emprestimos || []) {
      let isAtrasado = false;
      let status = (e.status || '').toUpperCase();
      
      // Se for empréstimo parcelado, verificar parcelas
      if (e.tipo_emprestimo === 'in_installments' && e.numero_parcelas > 1) {
        try {
          const parcelas = await apiService.getParcelasEmprestimo(e.id);
          const parcelasAtrasadas = parcelas.filter(p => {
            const dataVencParcela = new Date(p.data_vencimento);
            return dataVencParcela < hoje && (p.status !== 'Paga');
          });
          
          if (parcelasAtrasadas.length > 0) {
            isAtrasado = true;
          }
        } catch (error) {
          console.error('Erro ao buscar parcelas para empréstimo', e.id, error);
        }
      } else {
        // Para empréstimos de parcela única
        const dataVenc = e.data_vencimento ? new Date(e.data_vencimento) : null;
        if (dataVenc && dataVenc < hoje && status !== 'QUITADO') {
          isAtrasado = true;
        }
      }
      
      if (isAtrasado) {
        atrasados.push(e);
      }
    }
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

// Disponibilizar funções globalmente
window.renderHistoricoEmprestimos = renderHistoricoEmprestimos;
window.viewEmprestimo = viewEmprestimo;
window.viewCliente = viewCliente;
window.deleteCliente = deleteCliente;
window.cobrar = cobrar;

// Funções para controle de status das parcelas
async function marcarParcelaPaga(emprestimoId, numeroParcela) {
  try {
    const hoje = new Date().toISOString().split('T')[0];
    
    const response = await fetch(`/api/cobrancas/emprestimos/${emprestimoId}/parcelas/${numeroParcela}/status`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json'
      },
      credentials: 'include',
      body: JSON.stringify({
        status: 'Paga',
        data_pagamento: hoje
      })
    });
    
    if (!response.ok) {
      throw new Error('Erro ao atualizar parcela');
    }
    
    ui.showNotification('Parcela marcada como paga!', 'success');
    
    // Recarregar os detalhes do empréstimo
    await emprestimoController.viewEmprestimo(emprestimoId);
    
  } catch (error) {
    console.error('Erro ao marcar parcela como paga:', error);
    ui.showNotification('Erro ao marcar parcela como paga', 'error');
  }
}

async function marcarParcelaAtrasada(emprestimoId, numeroParcela) {
  try {
    const response = await fetch(`/api/cobrancas/emprestimos/${emprestimoId}/parcelas/${numeroParcela}/status`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json'
      },
      credentials: 'include',
      body: JSON.stringify({
        status: 'Atrasada'
      })
    });
    
    if (!response.ok) {
      throw new Error('Erro ao atualizar parcela');
    }
    
    ui.showNotification('Parcela marcada como atrasada!', 'success');
    
    // Recarregar os detalhes do empréstimo
    await emprestimoController.viewEmprestimo(emprestimoId);
    
  } catch (error) {
    console.error('Erro ao marcar parcela como atrasada:', error);
    ui.showNotification('Erro ao marcar parcela como atrasada', 'error');
  }
}

async function marcarParcelaPendente(emprestimoId, numeroParcela) {
  try {
    const response = await fetch(`/api/cobrancas/emprestimos/${emprestimoId}/parcelas/${numeroParcela}/status`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json'
      },
      credentials: 'include',
      body: JSON.stringify({
        status: 'Pendente',
        data_pagamento: null
      })
    });
    
    if (!response.ok) {
      throw new Error('Erro ao atualizar parcela');
    }
    
    ui.showNotification('Parcela marcada como pendente!', 'success');
    
    // Recarregar os detalhes do empréstimo
    await emprestimoController.viewEmprestimo(emprestimoId);
    
  } catch (error) {
    console.error('Erro ao marcar parcela como pendente:', error);
    ui.showNotification('Erro ao marcar parcela como pendente', 'error');
  }
}

// Disponibilizar funções de parcelas globalmente
window.marcarParcelaPaga = marcarParcelaPaga;
window.marcarParcelaAtrasada = marcarParcelaAtrasada;
window.marcarParcelaPendente = marcarParcelaPendente;

 