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
      welcomeElement.textContent = 'Bem-vindo ao sistema JP-Cobranças!';
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

  // Função auxiliar para criar data válida a partir de diversos formatos
  createValidDate: (dateInput) => {
    if (!dateInput) return null;
    
    // Se já é um objeto Date válido
    if (dateInput instanceof Date && !isNaN(dateInput.getTime())) {
      // Verificar se o ano faz sentido (corrigir anos < 100)
      const year = dateInput.getFullYear();
      if (year < 100) {
        dateInput.setFullYear(year + 2000);
      } else if (year < 1950) {
        // Provavelmente ano foi interpretado errado (ex: 1925 deveria ser 2025)
        dateInput.setFullYear(year + 100);
      }
      return dateInput;
    }
    
    const dateStr = String(dateInput).trim();
    
    // Formato ISO: 2026-01-09 ou 2026-01-09T00:00:00
    if (/^\d{4}-\d{2}-\d{2}/.test(dateStr)) {
      const parts = dateStr.split('T')[0].split('-');
      let year = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10) - 1;
      const day = parseInt(parts[2], 10);
      
      // Corrigir anos que parecem errados
      if (year < 100) {
        year = year + 2000;
      } else if (year < 1950) {
        year = year + 100;
      }
      
      // Usar setFullYear para evitar problemas com anos pequenos
      const date = new Date(2000, month, day);
      date.setFullYear(year);
      return date;
    }
    
    // Formato brasileiro: 09/01/2026 ou 09/01/26
    if (/^\d{2}\/\d{2}\/\d{2,4}$/.test(dateStr)) {
      const parts = dateStr.split('/');
      const day = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10) - 1;
      let year = parseInt(parts[2], 10);
      
      // Corrigir ano
      if (year < 100) {
        year = year + 2000;
      } else if (year < 1950) {
        year = year + 100;
      }
      
      // Usar setFullYear para evitar problemas com anos pequenos
      const date = new Date(2000, month, day);
      date.setFullYear(year);
      return date;
    }
    
    // Tentar criar data diretamente
    const date = new Date(dateStr);
    
    // Verificar se a data é válida e se o ano faz sentido
    if (!isNaN(date.getTime())) {
      const year = date.getFullYear();
      if (year < 100) {
        date.setFullYear(year + 2000);
      } else if (year < 1950) {
        // Corrigir anos como 1925 que deveriam ser 2025
        date.setFullYear(year + 100);
      }
      return date;
    }
    
    console.warn('Data inválida:', dateInput);
    return null;
  },

  // Formatação de data
  formatDate: (date) => {
    const validDate = utils.createValidDate(date);
    if (!validDate) return '-';
    return new Intl.DateTimeFormat('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    }).format(validDate);
  },

  // Formatação de data e hora
  formatDateTime: (date) => {
    const validDate = utils.createValidDate(date);
    if (!validDate) return '-';
    return new Intl.DateTimeFormat('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(validDate);
  },

  // Cálculo de dias de atraso
  calculateDaysLate: (dueDate) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const due = utils.createValidDate(dueDate);
    if (!due) return 0;
    due.setHours(0, 0, 0, 0);
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
      const date = utils.createValidDate(dateString);
      // Verificar se a data é válida
      if (!date) return '';
      
      // ✅ CORREÇÃO: Evitar problema de fuso horário
      // Usar componentes locais em vez de toISOString()
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
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
      // ✅ CORREÇÃO: Usar valores já padronizados pela API em vez de calcular localmente
      // A API já calcula os valores consistentemente usando as funções padronizadas
      // Não sobrescrever os valores da API com cálculos locais
      
      // Se precisar de valores específicos, usar os já calculados pela API
      const emprestimos = await apiService.getEmprestimos();
      let valorTotalReceber = 0;
      
      for (const emprestimo of emprestimos) {
        const status = (emprestimo.status || '').toUpperCase();
        
        // Ignorar empréstimos quitados
        if (status === 'QUITADO') continue;
        
        const valorInvestido = Number(emprestimo.valor_inicial || emprestimo.valor || 0);
        
        // Verificar se é parcelado
        if (emprestimo.tipo_emprestimo === 'in_installments' && emprestimo.numero_parcelas > 1) {
          try {
            const parcelas = await apiService.getParcelasEmprestimo(emprestimo.id);
            if (parcelas && parcelas.length > 0) {
              // Verificar se todas as parcelas estão pagas
              const todasPagas = parcelas.every(p => p.status === 'Paga');
              if (!todasPagas) {
                // Somar valor investido + parcelas de juros em aberto
                valorTotalReceber += valorInvestido;
                const parcelasEmAberto = parcelas.filter(p => p.status !== 'Paga');
                parcelasEmAberto.forEach(parcela => {
                  valorTotalReceber += Number(parcela.valor || 0);
                });
              }
            }
          } catch (error) {
            console.error('Erro ao buscar parcelas:', error);
          }
        } else {
          // Empréstimo normal - somar valor investido + juros (valor_final)
          const valorFinal = Number(emprestimo.valor_final || emprestimo.valor || 0);
          valorTotalReceber += valorInvestido + valorFinal;
        }
      }
      
      // Usar o valor calculado baseado nos valores padronizados da API
      data.cobrancas = data.cobrancas || {};
      data.cobrancas.valor_total_cobrancas = valorTotalReceber;
      appState.data.dashboard = data;
      this.updateDashboardCards(data);
      await this.updateRecentEmprestimos(data.emprestimosRecentes || []);
      await this.updateCobrancasPendentes();
      
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
          
          // Manter o estado de blur se valores estiverem ocultos
          const valoresOcultos = localStorage.getItem('valoresOcultos') !== 'false';
          if (valoresOcultos) {
            element.style.filter = 'blur(8px)';
            element.style.userSelect = 'none';
          }
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

  // Atualizar tabela de empréstimos recentes (corrigido para 5 colunas)
  async updateRecentEmprestimos(emprestimos) {
    const tbody = document.getElementById('emprestimos-recentes');
    if (!tbody) return;

    tbody.innerHTML = '';

    if (emprestimos.length === 0) {
      tbody.innerHTML = '<tr><td colspan="5" class="text-center text-gray-500">Nenhum empréstimo recente</td></tr>';
      return;
    }

    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);

    // Processar empréstimos com verificação de parcelas
    const emprestimosProcessados = [];
    
    for (const emprestimo of emprestimos) {
      const valorFinal = Number(emprestimo.valor_final || emprestimo.valor || 0);
      let status = (emprestimo.status || '').toUpperCase();
      let vencimentoExibir = emprestimo.data_vencimento;
      
      // Verificar se é empréstimo parcelado
      if (emprestimo.tipo_emprestimo === 'in_installments' && emprestimo.numero_parcelas > 1) {
        try {
          const parcelas = await apiService.getParcelasEmprestimo(emprestimo.id);
          
          if (parcelas && parcelas.length > 0) {
            const todasPagas = parcelas.every(p => p.status === 'Paga');
            const parcelasNaoPagas = parcelas.filter(p => p.status !== 'Paga');
            
            if (todasPagas) {
              status = 'QUITADO';
            } else {
              const parcelasAtrasadas = parcelasNaoPagas.filter(p => {
                const dataVencParcela = utils.createValidDate(p.data_vencimento);
                return dataVencParcela && dataVencParcela < hoje;
              });
              
              if (parcelasAtrasadas.length > 0) {
                status = 'ATRASADO';
                parcelasAtrasadas.sort((a, b) => utils.createValidDate(a.data_vencimento) - utils.createValidDate(b.data_vencimento));
                vencimentoExibir = parcelasAtrasadas[0].data_vencimento;
              } else {
                status = 'ATIVO';
                parcelasNaoPagas.sort((a, b) => utils.createValidDate(a.data_vencimento) - utils.createValidDate(b.data_vencimento));
                if (parcelasNaoPagas.length > 0) {
                  vencimentoExibir = parcelasNaoPagas[0].data_vencimento;
                }
              }
            }
          }
        } catch (error) {
          console.error('Erro ao buscar parcelas:', error);
        }
      } else {
        // Empréstimo de valor fixo
        if (status !== 'QUITADO' && emprestimo.data_vencimento) {
          const venc = utils.createValidDate(emprestimo.data_vencimento);
          if (venc && venc < hoje) {
            status = 'ATRASADO';
          }
        }
      }
      
      emprestimosProcessados.push({ 
        ...emprestimo, 
        status, 
        valorAtualizado: valorFinal,
        vencimentoExibir,
        infoJuros: ''
      });
    }

    // Verificar se é mobile
    const isMobile = window.innerWidth <= 768;
    
    if (isMobile) {
      // Layout de cards para mobile
      const container = tbody.parentElement.parentElement;
      
      // Esconder tabela e criar container de cards
      tbody.parentElement.style.display = 'none';
      
      // Remover cards antigos se existirem
      const oldCards = container.querySelector('.mobile-recentes-cards');
      if (oldCards) oldCards.remove();
      
      const cardsContainer = document.createElement('div');
      cardsContainer.className = 'mobile-recentes-cards';
      cardsContainer.style.cssText = 'display: flex; flex-direction: column; gap: 0.75rem; padding: 0.5rem;';
      
      emprestimosProcessados.forEach(emprestimo => {
        const valor = new Intl.NumberFormat('pt-BR', {
          style: 'currency',
          currency: 'BRL'
        }).format(emprestimo.valorAtualizado);
        
        const dataExibida = utils.formatDate(emprestimo.vencimentoExibir);
        const statusRaw = (emprestimo.status || '');
        
        let statusColor = '#6b7280';
        let statusTexto = 'Pendente';
        if (statusRaw.toUpperCase() === 'ATRASADO' || statusRaw.toUpperCase() === 'EM ATRASO') {
          statusColor = '#ef4444';
          statusTexto = 'Atrasado';
        } else if (statusRaw.toUpperCase() === 'QUITADO') {
          statusColor = '#10b981';
          statusTexto = 'Quitado';
        } else if (statusRaw.toUpperCase() === 'ATIVO') {
          statusColor = '#f59e0b';
          statusTexto = 'Em dia';
        }
        
        const card = document.createElement('div');
        card.style.cssText = `
          display: flex; 
          align-items: center; 
          justify-content: space-between; 
          padding: 0.75rem 1rem; 
          background: #fff; 
          border-radius: 10px; 
          box-shadow: 0 2px 8px rgba(0,0,0,0.08);
          border-left: 4px solid ${statusColor};
        `;
        card.innerHTML = `
          <div style="flex: 1; min-width: 0;">
            <div style="font-weight: 600; color: #1f2937; font-size: 0.9rem; margin-bottom: 2px;">${emprestimo.cliente_nome || 'N/A'}</div>
            <div style="font-size: 0.85rem; font-weight: 700; color: #059669;">${valor}</div>
            <div style="font-size: 0.75rem; color: #6b7280; margin-top: 2px;">Venc: ${dataExibida} • <span style="color: ${statusColor}; font-weight: 600;">${statusTexto}</span></div>
          </div>
          <button onclick="viewEmprestimo(${emprestimo.id})" style="background: #3b82f6; color: #fff; border: none; border-radius: 6px; padding: 0.35rem 0.75rem; font-size: 0.75rem; font-weight: 600; cursor: pointer;">Ver</button>
        `;
        cardsContainer.appendChild(card);
      });
      
      container.appendChild(cardsContainer);
    } else {
      // Layout de tabela para desktop
      tbody.parentElement.style.display = '';
      const oldCards = tbody.parentElement.parentElement.querySelector('.mobile-recentes-cards');
      if (oldCards) oldCards.remove();
      
      emprestimosProcessados.forEach(emprestimo => {
        const valor = new Intl.NumberFormat('pt-BR', {
          style: 'currency',
          currency: 'BRL'
        }).format(emprestimo.valorAtualizado);
        
        // Usar data da próxima parcela a vencer
        const dataExibida = utils.formatDate(emprestimo.vencimentoExibir);
        
        // Exibir status exatamente como vem da API, formatando igual ao emprestimos.html
        const statusRaw = (emprestimo.status || '');
        const status = statusRaw.charAt(0).toUpperCase() + statusRaw.slice(1).toLowerCase();
        let statusClass = 'secondary';
        if (statusRaw.toUpperCase() === 'ATRASADO' || statusRaw.toUpperCase() === 'EM ATRASO') statusClass = 'danger';
        else if (statusRaw.toUpperCase() === 'PENDENTE' || statusRaw.toUpperCase() === 'ATIVO') statusClass = 'warning';
        else if (statusRaw.toUpperCase() === 'QUITADO') statusClass = 'info';
        const row = document.createElement('tr');
        row.innerHTML = `
          <td>${emprestimo.cliente_nome || 'N/A'}</td>
          <td>${valor}${emprestimo.infoJuros}</td>
          <td>${dataExibida}</td>
          <td><span class="badge badge-${statusClass}">${status}</span></td>
          <td>
            <button class="btn btn-primary btn-sm" onclick="viewEmprestimo(${emprestimo.id})">Ver</button>
          </td>
        `;
        tbody.appendChild(row);
      });
    }
  },

  async updateCobrancasPendentes() {
    const tbody = document.getElementById('cobrancas-pendentes');
    if (!tbody) return;

    tbody.innerHTML = '<tr><td colspan="7">Carregando...</td></tr>';

    try {
      // Buscar todos os empréstimos
      const emprestimos = await apiService.getEmprestimos();
      
      if (!emprestimos || emprestimos.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" class="text-center text-gray-500">Nenhum empréstimo encontrado</td></tr>';
        return;
      }

      const hoje = new Date();
      hoje.setHours(0, 0, 0, 0);
      
      // Processar cada empréstimo para determinar status real
      const emprestimosProcessados = [];
      
      for (const emprestimo of emprestimos) {
        const valorFinal = Number(emprestimo.valor_final || emprestimo.valor || 0);
        const dataEmprestimo = utils.formatDate(emprestimo.data_emprestimo);
        let vencimentoExibir = utils.formatDate(emprestimo.data_vencimento);
        let dataVencimentoOrdenacao = emprestimo.data_vencimento; // Data bruta para ordenação
        let diasAtraso = 0;
        let status = (emprestimo.status || '').toUpperCase();
        
        // Verificar se é empréstimo parcelado
        if (emprestimo.tipo_emprestimo === 'in_installments' && emprestimo.numero_parcelas > 1) {
          try {
            const parcelas = await apiService.getParcelasEmprestimo(emprestimo.id);
            
            if (parcelas && parcelas.length > 0) {
              // Verificar status baseado nas parcelas
              const todasPagas = parcelas.every(p => p.status === 'Paga');
              const parcelasNaoPagas = parcelas.filter(p => p.status !== 'Paga');
              
              if (todasPagas) {
                status = 'QUITADO';
                diasAtraso = 0;
              } else {
                // Encontrar parcelas atrasadas
                const parcelasAtrasadas = parcelasNaoPagas.filter(p => {
                  const dataVencParcela = utils.createValidDate(p.data_vencimento);
                  return dataVencParcela && dataVencParcela < hoje;
                });
                
                if (parcelasAtrasadas.length > 0) {
                  status = 'ATRASADO';
                  // Pegar a parcela mais antiga atrasada
                  parcelasAtrasadas.sort((a, b) => utils.createValidDate(a.data_vencimento) - utils.createValidDate(b.data_vencimento));
                  const parcelaMaisAtrasada = parcelasAtrasadas[0];
                  const dataVencAtrasada = utils.createValidDate(parcelaMaisAtrasada.data_vencimento);
                  vencimentoExibir = utils.formatDate(parcelaMaisAtrasada.data_vencimento);
                  dataVencimentoOrdenacao = parcelaMaisAtrasada.data_vencimento;
                  if (dataVencAtrasada) {
                    diasAtraso = Math.ceil((hoje - dataVencAtrasada) / (1000 * 60 * 60 * 24));
                  }
                } else {
                  // Tem parcelas pendentes mas nenhuma atrasada = em dia
                  status = 'ATIVO';
                  // Mostrar próxima parcela a vencer
                  parcelasNaoPagas.sort((a, b) => utils.createValidDate(a.data_vencimento) - utils.createValidDate(b.data_vencimento));
                  if (parcelasNaoPagas.length > 0) {
                    vencimentoExibir = utils.formatDate(parcelasNaoPagas[0].data_vencimento);
                    dataVencimentoOrdenacao = parcelasNaoPagas[0].data_vencimento;
                  }
                  diasAtraso = 0;
                }
              }
            }
          } catch (error) {
            console.error('Erro ao buscar parcelas do empréstimo', emprestimo.id, error);
          }
        } else {
          // Empréstimo de valor fixo - usar data de vencimento do empréstimo
          if (status !== 'QUITADO' && emprestimo.data_vencimento) {
            const venc = utils.createValidDate(emprestimo.data_vencimento);
            if (venc && venc < hoje) {
              status = 'ATRASADO';
              diasAtraso = Math.ceil((hoje - venc) / (1000 * 60 * 60 * 24));
            }
          }
        }
        
        emprestimosProcessados.push({
          ...emprestimo,
          valorFinal,
          dataEmprestimo,
          vencimentoExibir,
          dataVencimentoOrdenacao,
          diasAtraso,
          statusCalculado: status
        });
      }
      
      // Ordenar: quitados separados no final, por data de vencimento (mais antigo primeiro)
      emprestimosProcessados.sort((a, b) => {
        const isQuitadoA = a.statusCalculado === 'QUITADO';
        const isQuitadoB = b.statusCalculado === 'QUITADO';
        // Separar quitados no final
        if (isQuitadoA && !isQuitadoB) return 1;
        if (!isQuitadoA && isQuitadoB) return -1;
        // Ordenar por data de vencimento da próxima parcela/empréstimo (mais antigo primeiro)
        const dataA = utils.createValidDate(a.dataVencimentoOrdenacao);
        const dataB = utils.createValidDate(b.dataVencimentoOrdenacao);
        if (!dataA && !dataB) return 0;
        if (!dataA) return 1;
        if (!dataB) return -1;
        return dataA - dataB;
      });

      // Verificar se é mobile
      const isMobile = window.innerWidth <= 768;
      
      if (isMobile) {
        // Layout de cards para mobile
        const container = tbody.parentElement.parentElement;
        
        // Esconder tabela e criar container de cards
        tbody.parentElement.style.display = 'none';
        
        // Remover cards antigos se existirem
        const oldCards = container.querySelector('.mobile-cards-container');
        if (oldCards) oldCards.remove();
        
        const cardsContainer = document.createElement('div');
        cardsContainer.className = 'mobile-cards-container';
        cardsContainer.style.cssText = 'display: flex; flex-direction: column; gap: 0.75rem; padding: 0.5rem;';
        
        emprestimosProcessados.forEach(emp => {
          let statusColor = '#6b7280';
          if (emp.statusCalculado === 'ATRASADO') statusColor = '#ef4444';
          else if (emp.statusCalculado === 'PENDENTE' || emp.statusCalculado === 'ATIVO') statusColor = '#f59e0b';
          else if (emp.statusCalculado === 'QUITADO') statusColor = '#10b981';
          
          const card = document.createElement('div');
          card.style.cssText = `
            display: flex; 
            align-items: center; 
            justify-content: space-between; 
            padding: 0.75rem 1rem; 
            background: #fff; 
            border-radius: 10px; 
            box-shadow: 0 2px 8px rgba(0,0,0,0.08);
            border-left: 4px solid ${statusColor};
          `;
          const statusTexto = emp.statusCalculado === 'ATRASADO' ? 'Atrasado' : emp.statusCalculado === 'QUITADO' ? 'Quitado' : 'Em dia';
          card.innerHTML = `
            <div style="flex: 1; min-width: 0;">
              <div style="font-weight: 600; color: #1f2937; font-size: 0.9rem; margin-bottom: 2px;">${emp.cliente_nome || 'N/A'}</div>
              <div style="font-size: 0.85rem; font-weight: 700; color: ${statusColor};">${emp.valorFinal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</div>
              <div style="font-size: 0.75rem; color: #6b7280; margin-top: 2px;">Venc: ${emp.vencimentoExibir} • <span style="color: ${statusColor}; font-weight: 600;">${statusTexto}</span></div>
            </div>
            <button onclick="viewEmprestimo(${emp.id})" style="background: #3b82f6; color: #fff; border: none; border-radius: 6px; padding: 0.35rem 0.75rem; font-size: 0.75rem; font-weight: 600; cursor: pointer;">Ver</button>
          `;
          cardsContainer.appendChild(card);
        });
        
        container.appendChild(cardsContainer);
      } else {
        // Layout de tabela para desktop
        tbody.parentElement.style.display = '';
        const oldCards = tbody.parentElement.parentElement.querySelector('.mobile-cards-container');
        if (oldCards) oldCards.remove();
        
        tbody.innerHTML = '';
        
        emprestimosProcessados.forEach(emp => {
          let statusClass = 'secondary';
          if (emp.statusCalculado === 'ATRASADO') statusClass = 'danger';
          else if (emp.statusCalculado === 'PENDENTE' || emp.statusCalculado === 'ATIVO') statusClass = 'warning';
          else if (emp.statusCalculado === 'QUITADO') statusClass = 'info';
          
          const row = document.createElement('tr');
          row.innerHTML = `
            <td>${emp.cliente_nome || 'N/A'}</td>
            <td>${emp.valorFinal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
            <td>${emp.dataEmprestimo}</td>
            <td>${emp.vencimentoExibir}</td>
            <td>${emp.diasAtraso > 0 ? emp.diasAtraso : '-'}</td>
            <td><span class="badge badge-${statusClass}">${emp.statusCalculado.charAt(0) + emp.statusCalculado.slice(1).toLowerCase()}</span></td>
            <td>
              <button class="btn btn-primary btn-sm" onclick="viewEmprestimo(${emp.id})">Ver</button>
            </td>
          `;
          tbody.appendChild(row);
        });
      }
      
    } catch (error) {
      console.error('Erro ao carregar cobranças pendentes:', error);
      tbody.innerHTML = '<tr><td colspan="6" class="text-center text-red-500">Erro ao carregar cobranças</td></tr>';
    }
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
        await dashboardController.updateCobrancasPendentes();
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
        const emprestimos = await apiService.getEmprestimos();
        const hoje = new Date();
        hoje.setHours(0, 0, 0, 0);
        
        let emAtraso = 0;
        
        for (const emp of (emprestimos || [])) {
          const statusEmp = (emp.status || '').toUpperCase();
          
          // Ignorar quitados
          if (statusEmp === 'QUITADO') continue;
          
          // Verificar se é empréstimo parcelado
          if (emp.tipo_emprestimo === 'in_installments' && emp.numero_parcelas > 1) {
            try {
              const parcelas = await apiService.getParcelasEmprestimo(emp.id);
              if (parcelas && parcelas.length > 0) {
                // Verificar se todas as parcelas estão pagas
                const todasPagas = parcelas.every(p => p.status === 'Paga');
                if (todasPagas) continue;
                
                // Verificar se há parcelas atrasadas
                const temAtrasada = parcelas.some(p => {
                  if (p.status === 'Paga') return false;
                  const dataVenc = utils.createValidDate(p.data_vencimento);
                  return dataVenc && dataVenc < hoje;
                });
                
                if (temAtrasada) emAtraso++;
              }
            } catch (error) {
              console.error('Erro ao verificar parcelas:', error);
            }
          } else {
            // Empréstimo de valor fixo - verificar data de vencimento
            const dataVenc = utils.createValidDate(emp.data_vencimento);
            if (dataVenc && dataVenc < hoje) {
              emAtraso++;
            }
          }
        }
        
        document.getElementById('emprestimos-atraso').textContent = emAtraso;
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
            const dataVencimento = utils.createValidDate(parcela.data_vencimento);
            const statusDB = parcela.status || parcela.cobranca_status || 'Pendente';
            const valorParcela = Number(parcela.valor_parcela || 0);
            
            // Calcular dinamicamente se está atrasado (ignorar status do banco, exceto "Paga")
            const isPaga = statusDB === 'Paga';
            const isAtrasado = !isPaga && dataVencimento && dataVencimento < hoje;
            
            // Calcular dias de atraso corretamente
            let diasAtraso = 0;
            if (dataVencimento && isAtrasado) {
              const diffTime = hoje.getTime() - dataVencimento.getTime();
              diasAtraso = Math.floor(diffTime / (1000 * 60 * 60 * 24));
            }
            
            let statusColor = '#6b7280'; // cinza para pendente
            let statusText = 'Pendente';
            
            if (isPaga) {
              statusColor = '#10b981'; // verde
              statusText = 'Paga';
            } else if (isAtrasado) {
              statusColor = '#ef4444'; // vermelho
              statusText = 'Atrasada';
            }
            
            return `
              <div style="border: 1px solid #e5e7eb; border-radius: 8px; padding: 1rem; margin-bottom: 0.5rem; background: ${isPaga ? '#f0fdf4' : isAtrasado ? '#fef2f2' : '#fff'};" data-emprestimo-id="${parcela.emprestimo_id}" data-numero-parcela="${parcela.numero_parcela}">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
                  <span style="font-weight: 600; color: #374151;">Parcela ${parcela.numero_parcela}</span>
                  <span style="background: ${statusColor}; color: white; padding: 0.25rem 0.75rem; border-radius: 12px; font-size: 0.875rem; font-weight: 500;">
                    ${statusText}
                  </span>
                </div>
                <div style="display: flex; justify-content: space-between; margin-bottom: 0.25rem;">
                  <span style="color: #6b7280;">Valor:</span>
                  <span style="font-weight: 600;">${utils.formatCurrency(valorParcela)}</span>
                </div>
                <div style="display: flex; justify-content: space-between; margin-bottom: 0.5rem;">
                  <span style="color: #6b7280;">Vencimento:</span>
                  <span style="font-weight: 500; color: ${isAtrasado ? '#ef4444' : '#374151'};">
                    ${utils.formatDate(parcela.data_vencimento)}
                    ${isAtrasado && diasAtraso > 0 ? ` (${diasAtraso} dias)` : ''}
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
                  ${!isPaga ? `
                    <button class="btn" style="background: #10b981; color: #fff; font-size: 0.875rem; padding: 0.375rem 0.75rem; border-radius: 6px; flex: 1; min-width: 70px;" onclick="marcarParcelaPaga(${parcela.emprestimo_id}, ${parcela.numero_parcela})">
                      Pagar
                    </button>
                    <button class="btn" style="background: #ef4444; color: #fff; font-size: 0.875rem; padding: 0.375rem 0.75rem; border-radius: 6px; flex: 1; min-width: 70px;" onclick="marcarParcelaAtrasada(${parcela.emprestimo_id}, ${parcela.numero_parcela})">
                      Atraso
                    </button>
                    <button class="btn" style="background: #3b82f6; color: #fff; font-size: 0.875rem; padding: 0.375rem 0.75rem; border-radius: 6px; flex: 1; min-width: 70px;" onclick="editarDataParcela(${parcela.emprestimo_id}, ${parcela.numero_parcela}, '${parcela.data_vencimento ? parcela.data_vencimento.split('T')[0] : ''}')">
                      Alterar Data
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
                            Total do Empréstimo: <span style="color: #10b981;">${utils.formatCurrency(parcelas.reduce((total, p) => total + Number(p.valor_parcela || 0), 0))}</span>
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
      
      // Buscar parcelas se for empréstimo parcelado
      let parcelas = [];
      if (emp.tipo_emprestimo === 'in_installments' && emp.numero_parcelas > 1) {
        try {
          parcelas = await apiService.getParcelasEmprestimo(id);
        } catch (error) {
          console.error('Erro ao buscar parcelas:', error);
        }
      }
      
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
                 <input type="text" id="edit-valor" class="form-input" value="${utils.formatCurrency(emp.valor || 0)}" required>
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
            
            ${parcelas.length > 0 ? `
            <div style="margin-top: 1.5rem; border-top: 2px solid #e5e7eb; padding-top: 1.5rem;">
              <h4 style="color: #002f4b; margin-bottom: 1rem; display: flex; align-items: center; gap: 0.5rem;">
                <span>📅 Editar Datas das Parcelas</span>
                <span style="font-size: 0.8rem; color: #666; font-weight: normal;">(${parcelas.length} parcelas)</span>
              </h4>
              <div style="max-height: 300px; overflow-y: auto; border: 1px solid #e5e7eb; border-radius: 8px; padding: 0.5rem;">
                ${parcelas.map(parcela => {
                  const statusParcela = parcela.status || 'Pendente';
                  const isPaga = statusParcela === 'Paga';
                  const dataVenc = utils.createValidDate(parcela.data_vencimento);
                  const hoje = new Date();
                  hoje.setHours(0,0,0,0);
                  const isAtrasada = !isPaga && dataVenc && dataVenc < hoje;
                  
                  let corFundo = '#fff';
                  let corBorda = '#e5e7eb';
                  if (isPaga) {
                    corFundo = '#f0fdf4';
                    corBorda = '#86efac';
                  } else if (isAtrasada) {
                    corFundo = '#fef2f2';
                    corBorda = '#fca5a5';
                  }
                  
                  return `
                  <div style="display: flex; align-items: center; gap: 1rem; padding: 0.75rem; margin-bottom: 0.5rem; background: ${corFundo}; border: 1px solid ${corBorda}; border-radius: 6px;">
                    <div style="flex: 0 0 80px; font-weight: 600; color: #374151;">
                      Parcela ${parcela.numero_parcela}
                    </div>
                    <div style="flex: 0 0 100px; font-size: 0.9rem; color: #666;">
                      ${utils.formatCurrency(parcela.valor_parcela || 0)}
                    </div>
                    <div style="flex: 1;">
                      <input type="date" 
                        class="form-input parcela-data-input" 
                        data-parcela-numero="${parcela.numero_parcela}"
                        data-emprestimo-id="${parcela.emprestimo_id}"
                        value="${utils.formatDateForInput(parcela.data_vencimento)}"
                        ${isPaga ? 'disabled' : ''}
                        style="padding: 0.4rem; font-size: 0.9rem; ${isPaga ? 'background: #e5e7eb; cursor: not-allowed;' : ''}">
                    </div>
                    <div style="flex: 0 0 80px; text-align: center;">
                      <span style="padding: 0.25rem 0.5rem; border-radius: 4px; font-size: 0.75rem; font-weight: 500; color: white; background: ${isPaga ? '#10b981' : isAtrasada ? '#ef4444' : '#6b7280'};">
                        ${isPaga ? 'Paga' : isAtrasada ? 'Atrasada' : 'Pendente'}
                      </span>
                    </div>
                  </div>
                  `;
                }).join('')}
              </div>
              <p style="font-size: 0.8rem; color: #666; margin-top: 0.5rem; font-style: italic;">
                * Parcelas pagas não podem ter a data alterada
              </p>
            </div>
            ` : ''}
            
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
        
        // ✅ CORREÇÃO URGENTE: Capturar e corrigir data antes de enviar
        const dataInputValue = document.getElementById('edit-data-vencimento').value;
        console.log('🔍 Data capturada do input:', dataInputValue);
        
        // NOVA CORREÇÃO: Garantir que a data enviada para o backend seja sempre a string exata do input, sem criar objeto Date
        let dataVencimentoCorrigida = dataInputValue;
        if (dataInputValue) {
          // Se a data tem formato YYYY-MM-DD, manter exatamente assim
          const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
          if (dateRegex.test(dataInputValue)) {
            dataVencimentoCorrigida = dataInputValue;
            console.log('✅ Data mantida como digitada (sem ajuste de timezone):', dataVencimentoCorrigida);
          } else {
            // Se vier em outro formato, tentar extrair a data local corretamente
            const parts = dataInputValue.split(/[-T:Z ]/);
            if (parts.length >= 3) {
              const year = parts[0];
              const month = parts[1].padStart(2, '0');
              const day = parts[2].padStart(2, '0');
              dataVencimentoCorrigida = `${year}-${month}-${day}`;
              console.log('⚠️ Corrigido formato de data para:', dataVencimentoCorrigida);
            }
          }
        }

        const formData = {
          cliente_id: document.getElementById('edit-cliente').value,
          valor: this.parseMoeda(document.getElementById('edit-valor').value),
          juros_mensal: parseFloat(document.getElementById('edit-juros').value),
          data_vencimento: dataVencimentoCorrigida,
          frequencia_pagamento: document.getElementById('edit-frequencia').value,
          numero_parcelas: parseInt(document.getElementById('edit-parcelas').value),
          status: document.getElementById('edit-status').value,
          observacoes: document.getElementById('edit-observacoes').value
        };
        
        console.log('📤 Enviando dados para API:', formData);
        
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
        
        const submitBtn = form.querySelector('button[type="submit"]');
        const originalText = submitBtn ? submitBtn.textContent : 'Salvar Alterações';
        
        try {
          if (submitBtn) {
            submitBtn.textContent = 'Salvando...';
            submitBtn.disabled = true;
          }
          
          // Primeiro, atualizar as datas das parcelas se houver alterações
          const parcelaInputs = modal.querySelectorAll('.parcela-data-input:not([disabled])');
          for (const input of parcelaInputs) {
            const numeroParcela = input.dataset.parcelaNumero;
            const emprestimoId = input.dataset.emprestimoId;
            const novaData = input.value;
            
            // Verificar se a data foi alterada (comparar com a data original)
            const parcelaOriginal = parcelas.find(p => String(p.numero_parcela) === String(numeroParcela));
            const dataOriginal = parcelaOriginal ? utils.formatDateForInput(parcelaOriginal.data_vencimento) : '';
            
            if (novaData && novaData !== dataOriginal) {
              console.log(`📅 Atualizando data da parcela ${numeroParcela}: ${dataOriginal} -> ${novaData}`);
              try {
                const parcelaResponse = await fetch(`/api/cobrancas/emprestimos/${emprestimoId}/parcelas/${numeroParcela}/data`, {
                  method: 'PUT',
                  headers: {
                    'Content-Type': 'application/json'
                  },
                  credentials: 'include',
                  body: JSON.stringify({ data_vencimento: novaData })
                });
                
                if (!parcelaResponse.ok) {
                  console.warn(`Erro ao atualizar parcela ${numeroParcela}`);
                }
              } catch (parcelaError) {
                console.error(`Erro ao atualizar parcela ${numeroParcela}:`, parcelaError);
              }
            }
          }
          
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
          
          // ✅ CORREÇÃO: Recarregar página completamente para garantir atualização
          console.log('🔄 Recarregando página para garantir atualização dos dados...');
          console.log('💡 Se o problema persistir, pressione Ctrl+F5 para limpar o cache');
          setTimeout(() => {
            // Forçar limpeza de cache do navegador
            window.location.href = window.location.href + '?v=' + new Date().getTime();
          }, 1500);
          
        } catch (error) {
          console.error('Erro ao atualizar empréstimo:', error);
          ui.showNotification('Erro ao atualizar empréstimo: ' + error.message, 'error');
        } finally {
          if (submitBtn) {
            submitBtn.textContent = originalText;
            submitBtn.disabled = false;
          }
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
        let dataVencimento = utils.createValidDate(emp.data_vencimento);
        
        // Para empréstimos parcelados, verificar status baseado nas parcelas
        if (parcelas.length > 0) {
          const parcelasAtrasadas = parcelas.filter(p => {
            const dataVencParcela = utils.createValidDate(p.data_vencimento);
            return dataVencParcela && dataVencParcela < hoje && (p.status !== 'Paga');
          });
          
          const parcelasPagas = parcelas.filter(p => p.status === 'Paga');
          
          if (parcelasPagas.length === parcelas.length) {
            status = 'QUITADO';
          } else if (parcelasAtrasadas.length > 0) {
            status = 'Em Atraso';
            // Usar a data de vencimento da parcela mais atrasada
            const parcelaMaisAtrasada = parcelasAtrasadas.sort((a, b) => 
              utils.createValidDate(a.data_vencimento) - utils.createValidDate(b.data_vencimento)
            )[0];
            dataVencimento = utils.createValidDate(parcelaMaisAtrasada.data_vencimento);
          } else {
            status = 'ATIVO';
          }
        } else {
          // Para empréstimos de parcela única, usar lógica original
          if (dataVencimento && dataVencimento < hoje && status.toUpperCase() !== 'QUITADO') {
            status = 'Em Atraso';
          }
        }
        let valorAtualizado = valorInvestido + jurosTotal;
        let infoJuros = '';
        let diasAtraso = 0;
        let jurosDiario = 0;
        let jurosAplicado = 0;
        if (status === 'Em Atraso' && dataVencimento) {
          // Calcular dias de atraso
          const diffTime = hoje.getTime() - dataVencimento.getTime();
          diasAtraso = Math.floor(diffTime / (1000 * 60 * 60 * 24));
          // Garantir que dias de atraso seja positivo
          if (diasAtraso < 0) diasAtraso = 0;
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
        const nomeCompleto = emp.cliente_nome || '';
        const primeiroNome = nomeCompleto.split(' ')[0];
        // Calcular valor total dos juros (juros total + juros aplicado por atraso)
        const valorTotalJuros = jurosTotal + jurosAplicado;
        const dataVencFormatada = utils.formatDate(emp.data_vencimento);
        
        // Buscar dados da próxima parcela se for parcelado
        let valorParcelaAtual = valorAtualizado;
        let dataParcelaAtual = dataVencFormatada;
        if (parcelas.length > 0) {
          const parcelasNaoPagas = parcelas.filter(p => p.status !== 'Paga');
          if (parcelasNaoPagas.length > 0) {
            parcelasNaoPagas.sort((a, b) => utils.createValidDate(a.data_vencimento) - utils.createValidDate(b.data_vencimento));
            valorParcelaAtual = Number(parcelasNaoPagas[0].valor_parcela || 0);
            dataParcelaAtual = utils.formatDate(parcelasNaoPagas[0].data_vencimento);
          }
        }
        
        // Guardar dados para o modal de notificação
        const dadosNotificacao = {
          telefone,
          primeiroNome,
          valorTotal: valorAtualizado,
          valorJuros: valorTotalJuros,
          valorParcela: valorParcelaAtual,
          dataParcela: dataParcelaAtual,
          dataVencimento: dataVencFormatada,
          isParcelado: parcelas.length > 1
        };
        const detalhes = `
          <div class="emprestimo-modal-box" style="padding: 1.5rem; max-width: 420px; margin: 0 auto; background: #fff; border-radius: 16px; box-shadow: 0 2px 16px #002f4b22;">
            <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 1rem;">
              <span class="badge" style="background: ${status === 'Em Atraso' ? '#fbbf24' : status.toUpperCase() === 'QUITADO' ? '#10b981' : status === 'SÓ JUROS' ? '#6366f1' : '#002f4b'}; color: #fff; font-weight: 600; font-size: 1rem; padding: 0.4em 1em; border-radius: 8px; letter-spacing: 1px;">${status || '-'}</span>
              <button class="btn" style="background: #10b981; color: #fff; font-weight: 600; border-radius: 8px; padding: 0.4em 1.2em; font-size: 1rem;" id="modal-btn-editar">Editar</button>
            </div>
            <div style="margin-bottom: 1.2rem;">
              <h2 style="font-size: 1.4rem; font-weight: bold; margin-bottom: 0.2em; color: #002f4b;">${emp.cliente_nome || 'N/A'}</h2>
              <div style="font-size: 1.1rem; font-weight: 600; color: #222; margin-bottom: 0.2em;">PCL-Nº #${emp.id} ${emp.parcelas ? `(${emp.parcelas}ª parcela)` : ''}</div>
              <div style="font-size: 1rem; color: #444; margin-bottom: 0.2em;">Deve ser pago em <b>${utils.formatDate(emp.data_vencimento)}</b></div>
              <div style="font-size: 1rem; color: #444;">Valor Investido <b>${utils.formatCurrency(valorInvestido)}</b></div>
              <div style="font-size: 1rem; color: #444;">Juros <b>${jurosPercent}%</b> (${utils.formatCurrency(jurosTotal)})</div>
              ${infoJuros}
            </div>
            <hr style="margin: 1.2rem 0; border: none; border-top: 1px solid #eee;">
            ${parcelas.length > 1 ? this.renderParcelasDetalhadas(parcelas) : `
              <div style="margin-bottom: 1.2rem; text-align: center;">
                <div style="font-size: 1.1rem; font-weight: 700; color: #222; margin-bottom: 0.2em;">PARCELA ÚNICA</div>
                <div style="font-size: 1.3rem; font-weight: bold; color: #002f4b;">Total a Receber: <span style="color: #10b981;">${utils.formatCurrency(valorAtualizado)}</span></div>
              </div>
            `}
            <div style="display: flex; flex-direction: column; gap: 0.7rem; margin-top: 1.5rem;">
              <button class="btn" style="background: #25d366; color: #fff; font-weight: 600; font-size: 1.1rem; border-radius: 8px;" id="modal-notificar" type="button">Notificar <b>WhatsApp</b></button>
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
        
        // Botão Notificar WhatsApp - abre modal com opções
        const btnWhats = modal.querySelector('#modal-notificar');
        btnWhats.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          
          // Mensagem para empréstimo parcelado
          const msgParcelado = `Olá, ${dadosNotificacao.primeiroNome}, a sua parcela vence ${dadosNotificacao.dataParcela}. Você pode pagar o valor de ${utils.formatCurrency(dadosNotificacao.valorParcela)}.

Chave PIX: 04854589930

Lembramos que, em caso de atraso, será cobrada uma multa diária.`;

          // Mensagem para empréstimo normal
          const msgEmprestimo = `Olá, ${dadosNotificacao.primeiroNome}, seu empréstimo vence ${dadosNotificacao.dataVencimento}. Você pode pagar o valor total de ${utils.formatCurrency(dadosNotificacao.valorTotal)} ou apenas os juros de ${utils.formatCurrency(dadosNotificacao.valorJuros)}.

Chave PIX: 04854589930

Lembramos que, em caso de atraso, será cobrada uma multa diária.`;

          const linkParcelado = dadosNotificacao.telefone ? `https://wa.me/55${dadosNotificacao.telefone.replace(/\\D/g,'')}?text=${encodeURIComponent(msgParcelado)}` : '#';
          const linkEmprestimo = dadosNotificacao.telefone ? `https://wa.me/55${dadosNotificacao.telefone.replace(/\\D/g,'')}?text=${encodeURIComponent(msgEmprestimo)}` : '#';
          
          const modalNotificacao = `
            <div style="padding: 1.5rem; max-width: 500px; margin: 0 auto;">
              <h3 style="margin-bottom: 1.5rem; color: #002f4b; text-align: center;">Escolha o tipo de mensagem</h3>
              
              <div style="display: flex; flex-direction: column; gap: 1rem;">
                <!-- Opção Parcelado -->
                <div style="border: 2px solid #25d366; border-radius: 12px; padding: 1rem; background: #f0fff4;">
                  <h4 style="color: #25d366; margin-bottom: 0.5rem; display: flex; align-items: center; gap: 0.5rem;">
                    📋 Mensagem para Parcela
                  </h4>
                  <p style="font-size: 0.9rem; color: #444; margin-bottom: 1rem; white-space: pre-line; background: #fff; padding: 0.75rem; border-radius: 8px; border: 1px solid #e5e7eb;">${msgParcelado}</p>
                  <a href="${linkParcelado}" target="_blank" rel="noopener noreferrer" class="btn" style="display: block; background: #25d366; color: #fff; text-align: center; padding: 0.75rem; border-radius: 8px; font-weight: 600; text-decoration: none;">
                    Enviar via WhatsApp
                  </a>
                </div>
                
                <!-- Opção Empréstimo -->
                <div style="border: 2px solid #3b82f6; border-radius: 12px; padding: 1rem; background: #eff6ff;">
                  <h4 style="color: #3b82f6; margin-bottom: 0.5rem; display: flex; align-items: center; gap: 0.5rem;">
                    💰 Mensagem para Empréstimo
                  </h4>
                  <p style="font-size: 0.9rem; color: #444; margin-bottom: 1rem; white-space: pre-line; background: #fff; padding: 0.75rem; border-radius: 8px; border: 1px solid #e5e7eb;">${msgEmprestimo}</p>
                  <a href="${linkEmprestimo}" target="_blank" rel="noopener noreferrer" class="btn" style="display: block; background: #3b82f6; color: #fff; text-align: center; padding: 0.75rem; border-radius: 8px; font-weight: 600; text-decoration: none;">
                    Enviar via WhatsApp
                  </a>
                </div>
              </div>
              
              <button type="button" class="btn" style="width: 100%; margin-top: 1.5rem; background: #6b7280; color: #fff; padding: 0.75rem; border-radius: 8px;" onclick="this.closest('.modal').remove()">Cancelar</button>
            </div>
          `;
          
          ui.showModal(modalNotificacao, 'Notificar Cliente');
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
                <p><strong>Valor Inicial do Empréstimo:</strong> ${utils.formatCurrency(valorInicial)}</p>
                <p><strong>Juros Mensal:</strong> ${jurosPercent}%</p>
                                  <p><strong>Juros Acumulados a Pagar:</strong> ${utils.formatCurrency(jurosAcumulados)}</p>
                <p><strong>Vencimento Atual:</strong> ${emp.data_vencimento ? utils.formatDate(emp.data_vencimento) : '-'}</p>
                <p><strong>Novo Vencimento:</strong> ${(() => {
                  const dataVenc = utils.createValidDate(emp.data_vencimento);
                  if (!dataVenc) return '-';
                  dataVenc.setDate(dataVenc.getDate() + 30);
                  return utils.formatDate(dataVenc);
                })()}</p>
                                  <p><strong>Novo Valor da Dívida:</strong> ${utils.formatCurrency(valorInicial)} <em>(volta ao valor inicial)</em></p>
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
                  <small class="text-gray-500">Mínimo: ${utils.formatCurrency(jurosAcumulados)}</small>
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
                                alert(`Valor insuficiente. O mínimo é ${utils.formatCurrency(jurosAcumulados)}`);
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
              const dataVencParcela = utils.createValidDate(p.data_vencimento);
              return dataVencParcela && dataVencParcela < hoje && (p.status !== 'Paga');
            });
            
            const parcelasPagas = parcelas.filter(p => p.status === 'Paga');
            
            if (parcelasPagas.length === parcelas.length) {
              statusAtual = 'QUITADO';
            } else if (parcelasAtrasadas.length > 0) {
              statusAtual = 'Em Atraso';
            } else {
              statusAtual = 'ATIVO';
            }
          } else {
            // Para empréstimos de parcela única
            const dataVenc = utils.createValidDate(emp.data_vencimento);
            if (dataVenc && dataVenc < hoje && statusAtual.toUpperCase() !== 'QUITADO') {
              statusAtual = 'Em Atraso';
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
                    <span class="badge badge-${emp.statusAtual === 'ATIVO' ? 'success' : (emp.statusAtual === 'Em Atraso' ? 'danger' : 'info')}" style="font-size: 0.9rem;">${emp.statusAtual}</span>
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
                          const dataVenc = utils.createValidDate(parcela.data_vencimento);
                          const hoje = new Date();
                          hoje.setHours(0,0,0,0);
                          let statusParcela = parcela.status;
                          let corStatus = '#6366f1'; // Pendente
                          
                          if (statusParcela === 'Paga') {
                            corStatus = '#10b981'; // Verde
                          } else if (dataVenc && dataVenc < hoje) {
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
    
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    
    // Processar empréstimos e remover duplicatas
    const emprestimosProcessados = [];
    const idsProcessados = new Set();
    
    for (const emprestimo of emprestimos) {
      if (idsProcessados.has(emprestimo.id)) continue;
      idsProcessados.add(emprestimo.id);
      
      const valorFinal = Number(emprestimo.valor_final || emprestimo.valor || 0);
      const valorInicial = Number(emprestimo.valor_inicial || emprestimo.valor || 0);
      let status = (emprestimo.status || '').toUpperCase();
      let vencimentoExibir = emprestimo.data_vencimento;
      let dataVencimentoOrdenacao = emprestimo.data_vencimento;
      
      // Verificar se é empréstimo parcelado
      if (emprestimo.tipo_emprestimo === 'in_installments' && emprestimo.numero_parcelas > 1) {
        try {
          const parcelas = await apiService.getParcelasEmprestimo(emprestimo.id);
          
          if (parcelas && parcelas.length > 0) {
            const todasPagas = parcelas.every(p => p.status === 'Paga');
            const parcelasNaoPagas = parcelas.filter(p => p.status !== 'Paga');
            
            if (todasPagas) {
              status = 'QUITADO';
            } else {
              const parcelasAtrasadas = parcelasNaoPagas.filter(p => {
                const dataVencParcela = utils.createValidDate(p.data_vencimento);
                return dataVencParcela && dataVencParcela < hoje;
              });
              
              if (parcelasAtrasadas.length > 0) {
                status = 'ATRASADO';
                parcelasAtrasadas.sort((a, b) => utils.createValidDate(a.data_vencimento) - utils.createValidDate(b.data_vencimento));
                vencimentoExibir = parcelasAtrasadas[0].data_vencimento;
                dataVencimentoOrdenacao = parcelasAtrasadas[0].data_vencimento;
              } else {
                status = 'ATIVO';
                parcelasNaoPagas.sort((a, b) => utils.createValidDate(a.data_vencimento) - utils.createValidDate(b.data_vencimento));
                if (parcelasNaoPagas.length > 0) {
                  vencimentoExibir = parcelasNaoPagas[0].data_vencimento;
                  dataVencimentoOrdenacao = parcelasNaoPagas[0].data_vencimento;
                }
              }
            }
          }
        } catch (error) {
          console.error('Erro ao buscar parcelas:', error);
        }
      } else {
        // Empréstimo de valor fixo
        if (emprestimo.data_vencimento && status !== 'QUITADO') {
          const vencDate = utils.createValidDate(emprestimo.data_vencimento);
          if (vencDate) {
            vencDate.setHours(0, 0, 0, 0);
            if (vencDate < hoje) {
              status = 'ATRASADO';
            }
          }
        }
      }
      
      emprestimosProcessados.push({
        ...emprestimo,
        valorFinal,
        valorInicial,
        status,
        vencimentoExibir,
        dataVencimentoOrdenacao
      });
    }
    
    // Ordenar: quitados separados no final, por data de vencimento (mais antigo primeiro)
    emprestimosProcessados.sort((a, b) => {
      const isQuitadoA = a.status === 'QUITADO';
      const isQuitadoB = b.status === 'QUITADO';
      // Separar quitados no final
      if (isQuitadoA && !isQuitadoB) return 1;
      if (!isQuitadoA && isQuitadoB) return -1;
      // Ordenar por data de vencimento da próxima parcela (mais antigo primeiro)
      const dataA = utils.createValidDate(a.dataVencimentoOrdenacao);
      const dataB = utils.createValidDate(b.dataVencimentoOrdenacao);
      if (!dataA && !dataB) return 0;
      if (!dataA) return 1;
      if (!dataB) return -1;
      return dataA - dataB;
    });
    
    // Renderizar empréstimos ordenados
    for (const emprestimo of emprestimosProcessados) {
      const valorFinalFormatado = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(emprestimo.valorFinal);
      const valorInicialFormatado = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(emprestimo.valorInicial);
      const data = utils.formatDate(emprestimo.data_emprestimo);
      const vencimento = utils.formatDate(emprestimo.vencimentoExibir);
      let statusClass = 'secondary';
      if (emprestimo.status === 'ATRASADO') statusClass = 'danger';
      else if (emprestimo.status === 'PENDENTE' || emprestimo.status === 'ATIVO') statusClass = 'warning';
      else if (emprestimo.status === 'QUITADO') statusClass = 'info';
      
      const row = document.createElement('tr');
      row.innerHTML = `
        <td>${emprestimo.cliente_nome || 'N/A'}</td>
        <td>${valorInicialFormatado}</td>
        <td>${valorFinalFormatado}</td>
        <td>${data}</td>
        <td>${vencimento}</td>
        <td><span class="badge badge-${statusClass}">${emprestimo.status.charAt(0) + emprestimo.status.slice(1).toLowerCase()}</span></td>
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
    
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    
    // Processar e eliminar duplicatas
    const emprestimosProcessados = [];
    const idsProcessados = new Set();
    
    for (const emprestimo of ativos) {
      if (idsProcessados.has(emprestimo.id)) continue;
      idsProcessados.add(emprestimo.id);
      
      const valorFinal = Number(emprestimo.valor_final || emprestimo.valor || 0);
      let status = (emprestimo.status || '').toUpperCase();
      let vencimentoExibir = emprestimo.data_vencimento;
      let dataVencimentoOrdenacao = emprestimo.data_vencimento;
      
      // Verificar se é empréstimo parcelado
      if (emprestimo.tipo_emprestimo === 'in_installments' && emprestimo.numero_parcelas > 1) {
        try {
          const parcelas = await apiService.getParcelasEmprestimo(emprestimo.id);
          
          if (parcelas && parcelas.length > 0) {
            const todasPagas = parcelas.every(p => p.status === 'Paga');
            const parcelasNaoPagas = parcelas.filter(p => p.status !== 'Paga');
            
            if (todasPagas) {
              status = 'QUITADO';
            } else {
              const parcelasAtrasadas = parcelasNaoPagas.filter(p => {
                const dataVencParcela = utils.createValidDate(p.data_vencimento);
                return dataVencParcela && dataVencParcela < hoje;
              });
              
              if (parcelasAtrasadas.length > 0) {
                status = 'ATRASADO';
                parcelasAtrasadas.sort((a, b) => utils.createValidDate(a.data_vencimento) - utils.createValidDate(b.data_vencimento));
                vencimentoExibir = parcelasAtrasadas[0].data_vencimento;
                dataVencimentoOrdenacao = parcelasAtrasadas[0].data_vencimento;
              } else {
                status = 'ATIVO';
                parcelasNaoPagas.sort((a, b) => utils.createValidDate(a.data_vencimento) - utils.createValidDate(b.data_vencimento));
                if (parcelasNaoPagas.length > 0) {
                  vencimentoExibir = parcelasNaoPagas[0].data_vencimento;
                  dataVencimentoOrdenacao = parcelasNaoPagas[0].data_vencimento;
                }
              }
            }
          }
        } catch (error) {
          console.error('Erro ao buscar parcelas:', error);
        }
      } else {
        // Empréstimo de valor fixo
        if (emprestimo.data_vencimento && status !== 'QUITADO') {
          const vencDate = utils.createValidDate(emprestimo.data_vencimento);
          if (vencDate) {
            vencDate.setHours(0, 0, 0, 0);
            if (vencDate < hoje) {
              status = 'ATRASADO';
            }
          }
        }
      }
      
      const valor = new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL'
      }).format(valorFinal);
      const data = utils.formatDate(emprestimo.data_emprestimo);
      const vencimento = utils.formatDate(vencimentoExibir);
      const statusClass = status === 'ATRASADO' ? 'danger' : (status === 'PENDENTE' ? 'warning' : (status === 'ATIVO' ? 'success' : 'info'));
      
      emprestimosProcessados.push({
        ...emprestimo,
        valor,
        data,
        vencimento,
        status,
        statusClass,
        dataVencimentoOrdenacao
      });
    }
    
    // Ordenar: quitados separados no final, por data de vencimento (mais antigo primeiro)
    emprestimosProcessados.sort((a, b) => {
      const isQuitadoA = a.status === 'QUITADO';
      const isQuitadoB = b.status === 'QUITADO';
      // Separar quitados no final
      if (isQuitadoA && !isQuitadoB) return 1;
      if (!isQuitadoA && isQuitadoB) return -1;
      // Ordenar por data de vencimento da próxima parcela (mais antigo primeiro)
      const dataA = utils.createValidDate(a.dataVencimentoOrdenacao);
      const dataB = utils.createValidDate(b.dataVencimentoOrdenacao);
      if (!dataA && !dataB) return 0;
      if (!dataA) return 1;
      if (!dataB) return -1;
      return dataA - dataB;
    });
    
    // Verificar se é mobile
    const isMobile = window.innerWidth <= 768;
    
    if (isMobile) {
      // Layout de cards para mobile
      const container = tbody.parentElement.parentElement;
      
      // Esconder tabela
      tbody.parentElement.style.display = 'none';
      
      // Remover cards antigos
      const oldCards = container.querySelector('.mobile-emprestimos-cards');
      if (oldCards) oldCards.remove();
      
      const cardsContainer = document.createElement('div');
      cardsContainer.className = 'mobile-emprestimos-cards';
      cardsContainer.style.cssText = 'display: flex; flex-direction: column; gap: 0.75rem; padding: 0.5rem;';
      
      emprestimosProcessados.forEach((emp) => {
        let statusColor = '#6b7280';
        if (emp.status === 'ATRASADO') statusColor = '#ef4444';
        else if (emp.status === 'ATIVO') statusColor = '#10b981';
        else if (emp.status === 'QUITADO') statusColor = '#3b82f6';
        
        const card = document.createElement('div');
        card.style.cssText = `
          display: flex; 
          align-items: center; 
          justify-content: space-between; 
          padding: 0.75rem 1rem; 
          background: #fff; 
          border-radius: 10px; 
          box-shadow: 0 2px 8px rgba(0,0,0,0.08);
          border-left: 4px solid ${statusColor};
        `;
        const statusTexto = emp.status === 'ATRASADO' ? 'Atrasado' : emp.status === 'QUITADO' ? 'Quitado' : 'Em dia';
        card.innerHTML = `
          <div style="flex: 1; min-width: 0;">
            <div style="font-weight: 600; color: #1f2937; font-size: 0.9rem; margin-bottom: 2px;">${emp.cliente_nome || 'N/A'}</div>
            <div style="font-size: 0.85rem; font-weight: 700; color: ${statusColor};">${emp.valor}</div>
            <div style="font-size: 0.75rem; color: #6b7280; margin-top: 2px;">Venc: ${emp.vencimento} • <span style="color: ${statusColor}; font-weight: 600;">${statusTexto}</span></div>
          </div>
          <button onclick="viewEmprestimo(${emp.id})" style="background: #3b82f6; color: #fff; border: none; border-radius: 6px; padding: 0.35rem 0.75rem; font-size: 0.75rem; font-weight: 600; cursor: pointer;">Ver</button>
        `;
        cardsContainer.appendChild(card);
      });
      
      container.appendChild(cardsContainer);
    } else {
      // Layout de tabela para desktop
      tbody.parentElement.style.display = '';
      const oldCards = tbody.parentElement.parentElement.querySelector('.mobile-emprestimos-cards');
      if (oldCards) oldCards.remove();
      
      emprestimosProcessados.forEach((emp) => {
        const row = document.createElement('tr');
        row.innerHTML = `
          <td>${emp.cliente_nome || 'N/A'}</td>
          <td>${emp.valor}</td>
          <td>${emp.parcelas || '-'}</td>
          <td>${emp.data}</td>
          <td>${emp.vencimento}</td>
          <td><span class="badge badge-${emp.statusClass}">${emp.status.charAt(0) + emp.status.slice(1).toLowerCase()}</span></td>
          <td>
            <button class="btn btn-primary btn-sm" onclick="viewEmprestimo(${emp.id})">Ver</button>
          </td>
        `;
        tbody.appendChild(row);
      });
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
                const dataVencParcela = utils.createValidDate(p.data_vencimento);
                return dataVencParcela && dataVencParcela < hoje && (p.status !== 'Paga');
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
            const dataVenc = utils.createValidDate(emprestimo.data_vencimento);
            if (dataVenc && dataVenc < hoje) {
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
    
    // Criar um Map para garantir que cada empréstimo apareça apenas uma vez
    const emprestimosUnicos = new Map();
    emAberto.forEach(emp => {
      if (!emprestimosUnicos.has(emp.id)) {
        emprestimosUnicos.set(emp.id, emp);
      }
    });
    
    console.log(`📊 Empréstimos únicos encontrados: ${emprestimosUnicos.size}`);
    
    // Array para armazenar os empréstimos processados
    const emprestimosProcessados = [];
    
    // Verificar status de cada empréstimo com base nas parcelas
    for (const emp of emprestimosUnicos.values()) {
      // Variáveis para vencimento e valor corretos
      let valorACobrar = emp.valor || 0;
      let vencimentoACobrar = emp.data_vencimento;
      let badge = '';
      let status = (emp.status || '').toLowerCase();
      
      // Verificar se tem parcelas e determinar status real
      let statusReal = status;
      let proximaParcela = null;
      
      try {
        const parcelas = await apiService.getParcelasEmprestimo(emp.id);
        if (parcelas && parcelas.length > 0) {
          // Tem parcelas - verificar status das parcelas
          const hoje = new Date();
          hoje.setHours(0,0,0,0);
          
          let parcelasAtrasadas = 0;
          let parcelasPagas = 0;
          
          // Encontrar próxima parcela não paga
          const parcelasNaoPagas = parcelas.filter(p => p.status !== 'Paga');
          if (parcelasNaoPagas.length > 0) {
            // Ordenar por data de vencimento e pegar a mais próxima
            parcelasNaoPagas.sort((a, b) => utils.createValidDate(a.data_vencimento) - utils.createValidDate(b.data_vencimento));
            proximaParcela = parcelasNaoPagas[0];
            
            // Para empréstimos parcelados, usar dados da próxima parcela
            valorACobrar = proximaParcela.valor_parcela || valorACobrar;
            vencimentoACobrar = proximaParcela.data_vencimento || vencimentoACobrar;
          }
          
          parcelas.forEach(parcela => {
            const dataVencParcela = utils.createValidDate(parcela.data_vencimento);
            const atrasadaParcela = dataVencParcela && dataVencParcela < hoje && parcela.status !== 'Paga';
            
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
          const dataVenc = utils.createValidDate(emp.data_vencimento);
          if (dataVenc && dataVenc < hoje) {
            statusReal = 'atrasado';
          }
        }
      } catch (error) {
        console.error('Erro ao verificar parcelas do empréstimo', emp.id, error);
        // Fallback para verificação pela data de vencimento
        const hoje = new Date();
        hoje.setHours(0,0,0,0);
        const dataVenc = utils.createValidDate(emp.data_vencimento);
        if (dataVenc && dataVenc < hoje) {
          statusReal = 'atrasado';
        }
      }
      
      // Formatar valores para exibição
      const valor = utils.formatCurrency(valorACobrar);
      const vencimento = vencimentoACobrar ? utils.formatDate(vencimentoACobrar) : '-';
      
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
      
      // Adicionar empréstimo processado ao array
      emprestimosProcessados.push({
        ...emp,
        valorFormatado: valor,
        vencimentoFormatado: vencimento,
        vencimentoData: vencimentoACobrar,
        badge,
        statusReal
      });
    }
    
    // Ordenar: quitados separados no final, por data de vencimento (mais antigo primeiro)
    emprestimosProcessados.sort((a, b) => {
      const isQuitadoA = a.statusReal === 'quitado';
      const isQuitadoB = b.statusReal === 'quitado';
      // Separar quitados no final
      if (isQuitadoA && !isQuitadoB) return 1;
      if (!isQuitadoA && isQuitadoB) return -1;
      // Ordenar por data de vencimento (mais antigo primeiro)
      const dataA = utils.createValidDate(a.vencimentoData);
      const dataB = utils.createValidDate(b.vencimentoData);
      if (!dataA && !dataB) return 0;
      if (!dataA) return 1;
      if (!dataB) return -1;
      return dataA - dataB;
    });
    
    // Criar linhas da tabela
    const linhasTabela = emprestimosProcessados.map(emp => `
      <tr>
        <td>${emp.cliente_nome || 'N/A'}</td>
        <td>${emp.valorFormatado}</td>
        <td>${emp.vencimentoFormatado}</td>
        <td>${emp.badge}</td>
        <td>
          <button class="btn btn-primary btn-sm" onclick="viewEmprestimo(${emp.id})">Ver</button>
          <button class="btn btn-warning btn-sm" onclick="cobrar(${emp.id})">Cobrar</button>
        </td>
      </tr>
    `);
    
    // Inserir todas as linhas de uma vez
    tbody.innerHTML = linhasTabela.join('');
    console.log(`✅ Renderizadas ${linhasTabela.length} linhas na tabela de cobranças`);
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
    if (document.getElementById('cobrancas-pendentes')) {
      await dashboardController.updateCobrancasPendentes();
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
      const dataVenc = utils.createValidDate(cobranca.data_vencimento);
      const status = (cobranca.status || '').toUpperCase();
      return dataVenc && dataVenc <= hoje && (status === 'PENDENTE' || status === 'EM ABERTO');
    }).length;
    target.innerHTML = String(totalPendentes);
    return;
  }
  
  if (targetId === 'valor-receber') {
    const valorTotal = lista.reduce((acc, cobranca) => {
      // ✅ CORREÇÃO: Usar valores padronizados da API
      const valorAtualizado = Number(cobranca.valor_atualizado || cobranca.valor_original || cobranca.valor || 0);
      return acc + valorAtualizado;
    }, 0);
    
    target.innerHTML = utils.formatCurrency(valorTotal);
    return;
  }
  
  // Para outros casos, mostrar lista detalhada
  target.innerHTML = lista.map(cobranca => {
    // ✅ CORREÇÃO: Usar valores padronizados da API
    const valorAtualizado = Number(cobranca.valor_atualizado || cobranca.valor_original || cobranca.valor || 0);
    const dataVencimento = utils.createValidDate(cobranca.data_vencimento);
    let diasAtraso = 0;
    
    // Calcular dias de atraso apenas para exibição
    if (dataVencimento && dataVencimento < hoje) {
      const diffTime = hoje.getTime() - dataVencimento.getTime();
      diasAtraso = Math.floor(diffTime / (1000 * 60 * 60 * 24));
      if (diasAtraso < 0) diasAtraso = 0;
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
  tbody.innerHTML = '<tr><td colspan="7">Carregando...</td></tr>';
  
  try {
    const emprestimos = await apiService.getEmprestimos();
    const hoje = new Date();
    hoje.setHours(0,0,0,0);
    
    // Array para armazenar empréstimos atrasados com dados processados
    const atrasadosProcessados = [];
    
    for (const emp of emprestimos) {
      // Ignorar empréstimos quitados
      const statusEmp = (emp.status || '').toLowerCase();
      if (statusEmp === 'quitado') continue;
      
      let estaAtrasado = false;
      let dataVencimentoAtrasada = null;
      let diasAtraso = 0;
      
      // Verificar se é empréstimo parcelado
      if (emp.tipo_emprestimo === 'in_installments' && emp.numero_parcelas > 1) {
        try {
          const parcelas = await apiService.getParcelasEmprestimo(emp.id);
          
          // Verificar se todas as parcelas estão pagas
          const todasPagas = parcelas.every(p => p.status === 'Paga');
          if (todasPagas) continue; // Ignorar se todas as parcelas estão pagas
          
          // Encontrar parcelas atrasadas (não pagas e vencidas)
          const parcelasAtrasadas = parcelas.filter(p => {
            if (p.status === 'Paga') return false;
            const dataVencParcela = utils.createValidDate(p.data_vencimento);
            if (!dataVencParcela) return false;
            dataVencParcela.setHours(0,0,0,0);
            return dataVencParcela < hoje;
          });
          
          if (parcelasAtrasadas.length > 0) {
            estaAtrasado = true;
            // Pegar a parcela mais antiga atrasada
            parcelasAtrasadas.sort((a, b) => utils.createValidDate(a.data_vencimento) - utils.createValidDate(b.data_vencimento));
            dataVencimentoAtrasada = utils.createValidDate(parcelasAtrasadas[0].data_vencimento);
            if (dataVencimentoAtrasada) {
              dataVencimentoAtrasada.setHours(0,0,0,0);
              const diffTime = hoje.getTime() - dataVencimentoAtrasada.getTime();
              diasAtraso = Math.floor(diffTime / (1000 * 60 * 60 * 24));
              if (diasAtraso < 0) diasAtraso = 0;
            }
          }
        } catch (error) {
          console.error('Erro ao buscar parcelas para empréstimo', emp.id, error);
        }
      } else {
        // Empréstimo de parcela única - verificar data de vencimento
        if (!emp.data_vencimento) continue;
        
        dataVencimentoAtrasada = utils.createValidDate(emp.data_vencimento);
        if (!dataVencimentoAtrasada) continue;
        dataVencimentoAtrasada.setHours(0,0,0,0);
        
        if (dataVencimentoAtrasada < hoje) {
          estaAtrasado = true;
          const diffTime = hoje.getTime() - dataVencimentoAtrasada.getTime();
          diasAtraso = Math.floor(diffTime / (1000 * 60 * 60 * 24));
          if (diasAtraso < 0) diasAtraso = 0;
        }
      }
      
      if (estaAtrasado) {
        atrasadosProcessados.push({
          ...emp,
          dataVencimentoAtrasada,
          diasAtraso
        });
      }
    }
    
    if (atrasadosProcessados.length === 0) {
      tbody.innerHTML = '<tr><td colspan="7" class="text-center text-gray-500">Nenhum empréstimo atrasado</td></tr>';
      return;
    }
    
    // Ordenar por dias de atraso (mais atrasado primeiro)
    atrasadosProcessados.sort((a, b) => b.diasAtraso - a.diasAtraso);
    
    // Verificar se é mobile
    const isMobile = window.innerWidth <= 768;
    
    if (isMobile) {
      // Layout de cards para mobile
      const container = tbody.parentElement.parentElement;
      
      // Esconder tabela
      tbody.parentElement.style.display = 'none';
      
      // Remover cards antigos
      const oldCards = container.querySelector('.mobile-atrasados-cards');
      if (oldCards) oldCards.remove();
      
      const cardsContainer = document.createElement('div');
      cardsContainer.className = 'mobile-atrasados-cards';
      cardsContainer.style.cssText = 'display: flex; flex-direction: column; gap: 0.75rem; padding: 0.5rem;';
      
      atrasadosProcessados.forEach(emp => {
        const valorFinal = Number(emp.valor_final || emp.valor || 0);
        const vencimentoFormatado = utils.formatDate(emp.dataVencimentoAtrasada);
        
        const card = document.createElement('div');
        card.style.cssText = `
          display: flex; 
          align-items: center; 
          justify-content: space-between; 
          padding: 0.75rem 1rem; 
          background: #fff; 
          border-radius: 10px; 
          box-shadow: 0 2px 8px rgba(0,0,0,0.08);
          border-left: 4px solid #ef4444;
        `;
        card.innerHTML = `
          <div style="flex: 1; min-width: 0;">
            <div style="font-weight: 600; color: #1f2937; font-size: 0.9rem; margin-bottom: 2px;">${emp.cliente_nome || 'N/A'}</div>
            <div style="font-size: 0.85rem; font-weight: 700; color: #ef4444;">${valorFinal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</div>
            <div style="font-size: 0.75rem; color: #6b7280; margin-top: 2px;">Venc: ${vencimentoFormatado} • <span style="color: #ef4444; font-weight: 600;">${emp.diasAtraso} dias</span></div>
          </div>
          <button onclick="viewEmprestimo(${emp.id})" style="background: #3b82f6; color: #fff; border: none; border-radius: 6px; padding: 0.35rem 0.75rem; font-size: 0.75rem; font-weight: 600; cursor: pointer;">Ver</button>
        `;
        cardsContainer.appendChild(card);
      });
      
      container.appendChild(cardsContainer);
    } else {
      // Layout de tabela para desktop
      tbody.parentElement.style.display = '';
      const oldCards = tbody.parentElement.parentElement.querySelector('.mobile-atrasados-cards');
      if (oldCards) oldCards.remove();
      
      tbody.innerHTML = '';
      
      atrasadosProcessados.forEach(emp => {
        const valorFinal = Number(emp.valor_final || emp.valor || 0);
        const dataEmprestimo = utils.formatDate(emp.data_emprestimo);
        const vencimento = emp.dataVencimentoAtrasada ? emp.dataVencimentoAtrasada.toLocaleDateString('pt-BR') : '-';
        
        const row = document.createElement('tr');
        row.innerHTML = `
          <td>${emp.cliente_nome || 'N/A'}</td>
          <td>${valorFinal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
          <td>${dataEmprestimo}</td>
          <td>${vencimento}</td>
          <td>${emp.diasAtraso > 0 ? emp.diasAtraso : '-'}</td>
          <td><span class="badge badge-danger">Atrasado</span></td>
          <td>
            <button class="btn btn-primary btn-sm" onclick="viewEmprestimo(${emp.id})">Ver</button>
          </td>
        `;
        tbody.appendChild(row);
      });
    }
    
    console.log(`✅ Renderizados ${atrasadosProcessados.length} empréstimos atrasados`);
    
  } catch (error) {
    console.error('Erro ao carregar atrasados:', error);
    tbody.innerHTML = '<tr><td colspan="7" class="text-center text-red-500">Erro ao carregar atrasados</td></tr>';
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

// Função para editar data de vencimento da parcela
async function editarDataParcela(emprestimoId, numeroParcela, dataAtual) {
  // Criar modal com input de data
  const modalContent = `
    <div style="padding: 1.5rem; max-width: 400px; margin: 0 auto;">
      <h3 style="margin-bottom: 1.5rem; color: #002f4b; text-align: center;">Alterar Data da Parcela ${numeroParcela}</h3>
      <form id="form-alterar-data-parcela">
        <div class="form-group" style="margin-bottom: 1rem;">
          <label style="display: block; margin-bottom: 0.5rem; font-weight: 600;">Nova Data de Vencimento</label>
          <input type="date" id="nova-data-parcela" class="form-input" value="${dataAtual}" required style="width: 100%; padding: 0.75rem; border: 1px solid #ddd; border-radius: 8px; font-size: 1rem;">
        </div>
        <div style="display: flex; gap: 1rem; margin-top: 1.5rem;">
          <button type="button" class="btn" style="flex: 1; background: #6b7280; color: #fff; padding: 0.75rem; border-radius: 8px; font-size: 1rem;" onclick="ui.closeModal()">Cancelar</button>
          <button type="submit" class="btn" style="flex: 1; background: #3b82f6; color: #fff; padding: 0.75rem; border-radius: 8px; font-size: 1rem;">Salvar</button>
        </div>
      </form>
    </div>
  `;
  
  ui.showModal(modalContent, 'Alterar Data da Parcela');
  
  // Adicionar evento de submit ao formulário
  const form = document.getElementById('form-alterar-data-parcela');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const novaData = document.getElementById('nova-data-parcela').value;
    
    if (!novaData) {
      ui.showNotification('Informe a nova data de vencimento', 'error');
      return;
    }
    
    try {
      const response = await fetch(`/api/cobrancas/emprestimos/${emprestimoId}/parcelas/${numeroParcela}/data`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify({
          data_vencimento: novaData
        })
      });
      
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Erro ao atualizar data');
      }
      
      ui.closeModal();
      ui.showNotification('Data da parcela atualizada com sucesso!', 'success');
      
      // Recarregar os detalhes do empréstimo
      await emprestimoController.viewEmprestimo(emprestimoId);
      
    } catch (error) {
      console.error('Erro ao atualizar data da parcela:', error);
      ui.showNotification(error.message || 'Erro ao atualizar data da parcela', 'error');
    }
  });
}

// Disponibilizar funções de parcelas globalmente
window.marcarParcelaPaga = marcarParcelaPaga;
window.marcarParcelaAtrasada = marcarParcelaAtrasada;
window.marcarParcelaPendente = marcarParcelaPendente;
window.editarDataParcela = editarDataParcela;

// ========== FUNÇÃO PARA OCULTAR/MOSTRAR VALORES ==========
function toggleValoresOcultos() {
  const valoresOcultos = localStorage.getItem('valoresOcultos') !== 'false';
  const novoEstado = !valoresOcultos;
  
  localStorage.setItem('valoresOcultos', novoEstado.toString());
  aplicarEstadoValores(novoEstado);
}

function aplicarEstadoValores(oculto) {
  const elementos = document.querySelectorAll('.valor-sensivel');
  const eyeIcon = document.getElementById('eye-icon');
  const toggleText = document.getElementById('toggle-values-text');
  
  elementos.forEach(el => {
    if (oculto) {
      el.style.filter = 'blur(8px)';
      el.style.userSelect = 'none';
    } else {
      el.style.filter = 'none';
      el.style.userSelect = 'auto';
    }
  });
  
  if (eyeIcon && toggleText) {
    if (oculto) {
      // Ícone de olho fechado
      eyeIcon.innerHTML = `
        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
        <line x1="1" y1="1" x2="23" y2="23"></line>
      `;
      toggleText.textContent = 'Mostrar valores';
    } else {
      // Ícone de olho aberto
      eyeIcon.innerHTML = `
        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
        <circle cx="12" cy="12" r="3"></circle>
      `;
      toggleText.textContent = 'Ocultar valores';
    }
  }
}

// Aplicar estado inicial ao carregar a página (oculto por padrão)
document.addEventListener('DOMContentLoaded', function() {
  // Se não existe no localStorage, definir como oculto (true)
  if (localStorage.getItem('valoresOcultos') === null) {
    localStorage.setItem('valoresOcultos', 'true');
  }
  
  const valoresOcultos = localStorage.getItem('valoresOcultos') !== 'false';
  
  // Aguardar um pouco para garantir que os elementos foram renderizados
  setTimeout(() => {
    aplicarEstadoValores(valoresOcultos);
  }, 100);
});

window.toggleValoresOcultos = toggleValoresOcultos;
