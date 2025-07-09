// Configurações da API
const API_BASE_URL = '/api';

// Estado global da aplicação
const appState = {
  isLoading: false,
  notifications: [],
  unreadCount: 0,
  data: {
    dashboard: null,
    emprestimos: [],
    cobrancas: [],
    metrics: {}
  },
  filters: {
    dateFrom: null,
    dateTo: null,
    status: 'all',
    search: ''
  },
  pagination: {
    currentPage: 1,
    itemsPerPage: 10,
    totalItems: 0
  },
  selectedItems: new Set(),
  charts: {}
};

// Sistema de Notificações
const notificationSystem = {
  notifications: [],
  unreadCount: 0,
  
  init() {
    this.createNotificationElements();
    this.bindEvents();
    this.startRealTimeUpdates();
    this.loadNotifications();
  },

  createNotificationElements() {
    // Adicionar botão de notificação no header se não existir
    const header = document.querySelector('.header-content');
    if (header && !document.getElementById('notification-btn')) {
      const notificationBtn = document.createElement('button');
      notificationBtn.id = 'notification-btn';
      notificationBtn.className = 'notification-icon';
      notificationBtn.innerHTML = `
        <svg width="24" height="24" fill="none" viewBox="0 0 24 24">
          <path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 5.365V3m0 2.365a5.338 5.338 0 0 1 5.133 5.368v1.8c0 2.386 1.867 2.982 1.867 4.175 0 .593 0 1.292-.538 1.292H5.538C5 18 5 17.301 5 16.708c0-1.193 1.867-1.789 1.867-4.175v-1.8A5.338 5.338 0 0 1 12 5.365ZM8.733 18c.094.852.306 1.54.944 2.112a3.48 3.48 0 0 0 4.646 0c.638-.572 1.236-1.26 1.33-2.112h-6.92Z"/>
        </svg>
        <span id="notification-badge" class="notification-badge" style="display: none;">0</span>
      `;
      
      // Inserir antes do logo ou no final
      const nav = header.querySelector('nav');
      if (nav) {
        nav.insertBefore(notificationBtn, nav.firstChild);
      } else {
        header.appendChild(notificationBtn);
      }
    }

    // Criar painel lateral de notificações
    if (!document.getElementById('notification-sidebar')) {
      const sidebar = document.createElement('div');
      sidebar.id = 'notification-sidebar';
      sidebar.className = 'notification-sidebar';
      sidebar.innerHTML = `
        <div class="notification-sidebar-header">
          <h3 class="notification-sidebar-title">Notificações</h3>
          <button id="notification-close" class="notification-sidebar-close">×</button>
        </div>
        <div class="notification-sidebar-content">
          <div id="notification-list"></div>
          <div id="notification-loading" style="display: none; text-align: center; padding: 2rem;">
            <div class="loading-spinner">Carregando...</div>
          </div>
        </div>
      `;
      document.body.appendChild(sidebar);

      // Criar overlay
      const overlay = document.createElement('div');
      overlay.id = 'notification-overlay';
      overlay.className = 'sidebar-overlay';
      document.body.appendChild(overlay);
    }
  },

  bindEvents() {
    // Botão de notificação
    const notificationBtn = document.getElementById('notification-btn');
    if (notificationBtn) {
      notificationBtn.addEventListener('click', () => this.toggleSidebar());
    }

    // Botão de fechar
    const closeBtn = document.getElementById('notification-close');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => this.closeSidebar());
    }

    // Overlay
    const overlay = document.getElementById('notification-overlay');
    if (overlay) {
      overlay.addEventListener('click', () => this.closeSidebar());
    }

    // ESC key
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        this.closeSidebar();
      }
    });
  },

  toggleSidebar() {
    const sidebar = document.getElementById('notification-sidebar');
    const overlay = document.getElementById('notification-overlay');
    
    if (sidebar.classList.contains('active')) {
      this.closeSidebar();
    } else {
      this.openSidebar();
    }
  },

  openSidebar() {
    const sidebar = document.getElementById('notification-sidebar');
    const overlay = document.getElementById('notification-overlay');
    
    sidebar.classList.add('active');
    overlay.classList.add('active');
    document.body.style.overflow = 'hidden';
    
    // Marcar notificações como lidas
    setTimeout(() => {
      this.markAllAsRead();
    }, 1000);
  },

  closeSidebar() {
    const sidebar = document.getElementById('notification-sidebar');
    const overlay = document.getElementById('notification-overlay');
    
    sidebar.classList.remove('active');
    overlay.classList.remove('active');
    document.body.style.overflow = '';
  },

  async loadNotifications() {
    try {
      const response = await apiService.getNotifications();
      this.notifications = response.notifications || [];
      this.unreadCount = response.unreadCount || 0;
      this.updateBadge();
      this.renderNotifications();
    } catch (error) {
      console.error('Erro ao carregar notificações:', error);
      // Usar dados mock se a API falhar
      this.loadMockNotifications();
    }
  },

  loadMockNotifications() {
    const mockNotifications = [
      {
        id: 1,
        type: 'payment_due',
        title: 'Cobrança Vencendo',
        description: 'Cliente João Silva tem parcela vencendo em 2 dias',
        time: new Date(Date.now() - 1000 * 60 * 30),
        read: false,
        actions: [
          { text: 'Cobrar', action: 'cobrar', id: 123 },
          { text: 'Ver Detalhes', action: 'view', id: 123 }
        ]
      },
      {
        id: 2,
        type: 'payment_overdue',
        title: 'Pagamento em Atraso',
        description: 'Cliente Maria Santos está com 5 dias de atraso',
        time: new Date(Date.now() - 1000 * 60 * 60 * 2),
        read: false,
        actions: [
          { text: 'Cobrar', action: 'cobrar', id: 456 },
          { text: 'Lista Negra', action: 'blacklist', id: 456 }
        ]
      },
      {
        id: 3,
        type: 'payment_received',
        title: 'Pagamento Recebido',
        description: 'Cliente Pedro Oliveira quitou empréstimo',
        time: new Date(Date.now() - 1000 * 60 * 60 * 24),
        read: true,
        actions: []
      }
    ];

    this.notifications = mockNotifications;
    this.unreadCount = mockNotifications.filter(n => !n.read).length;
    this.updateBadge();
    this.renderNotifications();
  },

  updateBadge() {
    const badge = document.getElementById('notification-badge');
    if (badge) {
      if (this.unreadCount > 0) {
        badge.textContent = this.unreadCount > 99 ? '99+' : this.unreadCount;
        badge.style.display = 'flex';
        badge.className = 'notification-badge';
      } else {
        badge.style.display = 'none';
      }
    }
  },

  renderNotifications() {
    const container = document.getElementById('notification-list');
    if (!container) return;

    if (this.notifications.length === 0) {
      container.innerHTML = `
        <div style="text-align: center; padding: 2rem; color: var(--gray-500);">
          <p>Nenhuma notificação</p>
        </div>
      `;
      return;
    }

    container.innerHTML = this.notifications.map(notification => {
      const timeAgo = this.formatTimeAgo(notification.time);
      const typeClass = this.getTypeClass(notification.type);
      
      return `
        <div class="notification-item ${notification.read ? '' : 'unread'}" data-id="${notification.id}">
          <div class="notification-item-header">
            <div>
              <div class="notification-item-title">${notification.title}</div>
              <div class="notification-item-time">${timeAgo}</div>
            </div>
          </div>
          <div class="notification-item-description">${notification.description}</div>
          ${notification.actions.length > 0 ? `
            <div class="notification-item-actions">
              ${notification.actions.map(action => `
                <button class="notification-item-action ${action.action === 'cobrar' ? 'primary' : ''}" 
                        data-action="${action.action}" 
                        data-id="${action.id}">
                  ${action.text}
                </button>
              `).join('')}
            </div>
          ` : ''}
        </div>
      `;
    }).join('');

    // Bind action events
    container.querySelectorAll('.notification-item-action').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const action = e.target.dataset.action;
        const id = e.target.dataset.id;
        this.handleNotificationAction(action, id);
      });
    });

    // Bind item click events
    container.querySelectorAll('.notification-item').forEach(item => {
      item.addEventListener('click', (e) => {
        if (!e.target.classList.contains('notification-item-action')) {
          const id = parseInt(item.dataset.id);
          this.markAsRead(id);
        }
      });
    });
  },

  formatTimeAgo(date) {
    const now = new Date();
    const diffMs = now - new Date(date);
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return 'Agora';
    if (diffMins < 60) return `${diffMins}m atrás`;
    if (diffHours < 24) return `${diffHours}h atrás`;
    if (diffDays < 7) return `${diffDays}d atrás`;
    return utils.formatDate(date);
  },

  getTypeClass(type) {
    const types = {
      payment_due: 'warning',
      payment_overdue: 'danger',
      payment_received: 'success',
      new_client: 'info'
    };
    return types[type] || 'info';
  },

  async handleNotificationAction(action, id) {
    switch (action) {
      case 'cobrar':
        await this.cobrarCliente(id);
        break;
      case 'view':
        await this.viewEmprestimo(id);
        break;
      case 'blacklist':
        await this.adicionarListaNegra(id);
        break;
    }
  },

  async cobrarCliente(id) {
    try {
      await apiService.cobrarCliente(id);
      ui.showNotification('Cobrança enviada com sucesso!', 'success');
      this.removeNotification(id);
    } catch (error) {
      ui.showNotification('Erro ao enviar cobrança', 'error');
    }
  },

  async markAsRead(id) {
    const notification = this.notifications.find(n => n.id === id);
    if (notification && !notification.read) {
      notification.read = true;
      this.unreadCount--;
      this.updateBadge();
      
      // Atualizar visualmente
      const element = document.querySelector(`[data-id="${id}"]`);
      if (element) {
        element.classList.remove('unread');
      }
      
      // Notificar servidor
      try {
        await apiService.markNotificationAsRead(id);
      } catch (error) {
        console.error('Erro ao marcar notificação como lida:', error);
      }
    }
  },

  async markAllAsRead() {
    const unreadNotifications = this.notifications.filter(n => !n.read);
    unreadNotifications.forEach(n => n.read = true);
    this.unreadCount = 0;
    this.updateBadge();
    
    // Atualizar visualmente
    document.querySelectorAll('.notification-item.unread').forEach(item => {
      item.classList.remove('unread');
    });
    
    // Notificar servidor
    try {
      await apiService.markAllNotificationsAsRead();
    } catch (error) {
      console.error('Erro ao marcar todas as notificações como lidas:', error);
    }
  },

  addNotification(notification) {
    this.notifications.unshift(notification);
    if (!notification.read) {
      this.unreadCount++;
    }
    this.updateBadge();
    this.renderNotifications();
  },

  removeNotification(id) {
    const index = this.notifications.findIndex(n => n.id === id);
    if (index > -1) {
      const notification = this.notifications[index];
      if (!notification.read) {
        this.unreadCount--;
      }
      this.notifications.splice(index, 1);
      this.updateBadge();
      this.renderNotifications();
    }
  },

  startRealTimeUpdates() {
    // Atualizar notificações a cada 30 segundos
    setInterval(() => {
      this.loadNotifications();
    }, 30000);

    // Verificar alertas de vencimento a cada minuto
    setInterval(() => {
      this.checkPaymentAlerts();
    }, 60000);
  },

  async checkPaymentAlerts() {
    try {
      const alerts = await apiService.getPaymentAlerts();
      alerts.forEach(alert => {
        if (!this.notifications.find(n => n.clientId === alert.clientId)) {
          this.addNotification({
            id: Date.now() + Math.random(),
            type: alert.type,
            title: alert.title,
            description: alert.description,
            time: new Date(),
            read: false,
            clientId: alert.clientId,
            actions: alert.actions || []
          });
        }
      });
    } catch (error) {
      console.error('Erro ao verificar alertas:', error);
    }
  }
};

// Sistema de Contadores em Tempo Real
const counterSystem = {
  counters: {},
  
  init() {
    this.updateMenuCounters();
    this.startRealTimeUpdates();
  },

  async updateMenuCounters() {
    try {
      const data = await apiService.getMenuCounters();
      this.counters = data;
      this.renderCounters();
    } catch (error) {
      console.error('Erro ao carregar contadores:', error);
      // Usar dados mock
      this.counters = {
        cobrancas: 8,
        atrasados: 23,
        emprestimos: 156,
        clientes: 89
      };
      this.renderCounters();
    }
  },

  renderCounters() {
    const menuItems = {
      'cobrancas.html': this.counters.cobrancas,
      'atrasados.html': this.counters.atrasados,
      'emprestimos.html': this.counters.emprestimos,
      'clientes.html': this.counters.clientes
    };

    Object.entries(menuItems).forEach(([page, count]) => {
      const link = document.querySelector(`a[href="${page}"]`);
      if (link && count > 0) {
        if (!link.querySelector('.menu-counter-badge')) {
          const counter = document.createElement('span');
          counter.className = 'menu-counter-badge';
          counter.textContent = count > 99 ? '99+' : count;
          
          // Adicionar classe especial baseada no tipo
          if (page.includes('atrasados')) {
            counter.classList.add('danger');
          } else if (page.includes('cobrancas')) {
            counter.classList.add('warning');
          }
          
          link.style.position = 'relative';
          link.appendChild(counter);
        } else {
          link.querySelector('.menu-counter-badge').textContent = count > 99 ? '99+' : count;
        }
      }
    });
  },

  startRealTimeUpdates() {
    setInterval(() => {
      this.updateMenuCounters();
    }, 30000);
  }
};

// Sistema de Filtros Avançados
const filterSystem = {
  init() {
    this.createFilterUI();
    this.bindFilterEvents();
  },

  createFilterUI() {
    const targetPages = ['cobrancas.html', 'atrasados.html', 'emprestimos.html', 'clientes.html'];
    const currentPage = window.location.pathname.split('/').pop();
    
    if (!targetPages.includes(currentPage)) return;

    const mainContainer = document.querySelector('.container');
    if (!mainContainer) return;

    const filtersContainer = document.createElement('div');
    filtersContainer.className = 'filters-container';
    filtersContainer.innerHTML = `
      <div class="filters-header">
        <h3 class="filters-title">Filtros</h3>
        <button class="filters-toggle" onclick="this.parentElement.parentElement.querySelector('.filters-content').style.display = this.parentElement.parentElement.querySelector('.filters-content').style.display === 'none' ? 'grid' : 'none'">
          <i class="fas fa-filter"></i> Filtros
        </button>
      </div>
      <div class="filters-content">
        <div class="filter-group">
          <label class="filter-label">Data Inicial</label>
          <input type="date" class="filter-input" id="filter-date-from">
        </div>
        <div class="filter-group">
          <label class="filter-label">Data Final</label>
          <input type="date" class="filter-input" id="filter-date-to">
        </div>
        <div class="filter-group">
          <label class="filter-label">Status</label>
          <select class="filter-input" id="filter-status">
            <option value="">Todos</option>
            <option value="ativo">Ativo</option>
            <option value="pendente">Pendente</option>
            <option value="atrasado">Atrasado</option>
            <option value="quitado">Quitado</option>
          </select>
        </div>
        <div class="filter-group">
          <label class="filter-label">Buscar</label>
          <input type="text" class="filter-input" id="filter-search" placeholder="Nome do cliente...">
        </div>
      </div>
      <div class="filter-actions">
        <button class="filter-btn secondary" onclick="filterSystem.clearFilters()">Limpar</button>
        <button class="filter-btn primary" onclick="filterSystem.applyFilters()">Aplicar Filtros</button>
      </div>
    `;

    // Inserir no início do container
    mainContainer.insertBefore(filtersContainer, mainContainer.firstChild);
  },

  bindFilterEvents() {
    // Aplicar filtros em tempo real na busca
    const searchInput = document.getElementById('filter-search');
    if (searchInput) {
      searchInput.addEventListener('input', utils.debounce(() => {
        this.applyFilters();
      }, 300));
    }
  },

  applyFilters() {
    const filters = {
      dateFrom: document.getElementById('filter-date-from')?.value || null,
      dateTo: document.getElementById('filter-date-to')?.value || null,
      status: document.getElementById('filter-status')?.value || null,
      search: document.getElementById('filter-search')?.value || null
    };

    appState.filters = filters;
    
    // Aplicar filtros baseado na página atual
    const currentPage = window.location.pathname.split('/').pop();
    
    switch (currentPage) {
      case 'cobrancas.html':
        this.filterCobrancas(filters);
        break;
      case 'atrasados.html':
        this.filterAtrasados(filters);
        break;
      case 'emprestimos.html':
        this.filterEmprestimos(filters);
        break;
      case 'clientes.html':
        this.filterClientes(filters);
        break;
    }
  },

  clearFilters() {
    document.getElementById('filter-date-from').value = '';
    document.getElementById('filter-date-to').value = '';
    document.getElementById('filter-status').value = '';
    document.getElementById('filter-search').value = '';
    
    appState.filters = {};
    this.applyFilters();
  },

  filterCobrancas(filters) {
    // Implementar filtro específico para cobranças
    if (typeof renderCobrancasEmAbertoLista === 'function') {
      renderCobrancasEmAbertoLista(filters);
    }
  },

  filterAtrasados(filters) {
    // Implementar filtro específico para atrasados
    if (typeof renderAtrasadosLista === 'function') {
      renderAtrasadosLista(filters);
    }
  },

  filterEmprestimos(filters) {
    // Implementar filtro específico para empréstimos
    if (typeof renderEmprestimosLista === 'function') {
      renderEmprestimosLista(filters);
    }
  },

  filterClientes(filters) {
    // Implementar filtro específico para clientes
    if (typeof renderClientesLista === 'function') {
      renderClientesLista(filters);
    }
  }
};

// Sistema de Paginação Melhorada
const paginationSystem = {
  init() {
    this.createPaginationUI();
  },

  createPaginationUI() {
    const targetPages = ['cobrancas.html', 'atrasados.html', 'emprestimos.html', 'clientes.html'];
    const currentPage = window.location.pathname.split('/').pop();
    
    if (!targetPages.includes(currentPage)) return;

    const mainContainer = document.querySelector('.container');
    if (!mainContainer) return;

    const paginationContainer = document.createElement('div');
    paginationContainer.className = 'pagination-container';
    paginationContainer.id = 'pagination-container';
    
    mainContainer.appendChild(paginationContainer);
    this.updatePagination();
  },

  updatePagination() {
    const container = document.getElementById('pagination-container');
    if (!container) return;

    const { currentPage, itemsPerPage, totalItems } = appState.pagination;
    const totalPages = Math.ceil(totalItems / itemsPerPage);
    const startItem = (currentPage - 1) * itemsPerPage + 1;
    const endItem = Math.min(currentPage * itemsPerPage, totalItems);

    container.innerHTML = `
      <div class="pagination-info">
        Exibindo ${startItem} a ${endItem} de ${totalItems} itens
      </div>
      <div class="pagination-controls">
        <button class="pagination-btn" ${currentPage === 1 ? 'disabled' : ''} onclick="paginationSystem.goToPage(1)">
          <i class="fas fa-angle-double-left"></i>
        </button>
        <button class="pagination-btn" ${currentPage === 1 ? 'disabled' : ''} onclick="paginationSystem.goToPage(${currentPage - 1})">
          <i class="fas fa-angle-left"></i>
        </button>
        
        ${this.generatePageButtons(currentPage, totalPages)}
        
        <button class="pagination-btn" ${currentPage === totalPages ? 'disabled' : ''} onclick="paginationSystem.goToPage(${currentPage + 1})">
          <i class="fas fa-angle-right"></i>
        </button>
        <button class="pagination-btn" ${currentPage === totalPages ? 'disabled' : ''} onclick="paginationSystem.goToPage(${totalPages})">
          <i class="fas fa-angle-double-right"></i>
        </button>
      </div>
      <div class="pagination-size-selector">
        <label for="page-size">Itens por página:</label>
        <select id="page-size" onchange="paginationSystem.changePageSize(this.value)">
          <option value="10" ${itemsPerPage === 10 ? 'selected' : ''}>10</option>
          <option value="25" ${itemsPerPage === 25 ? 'selected' : ''}>25</option>
          <option value="50" ${itemsPerPage === 50 ? 'selected' : ''}>50</option>
          <option value="100" ${itemsPerPage === 100 ? 'selected' : ''}>100</option>
        </select>
      </div>
    `;
  },

  generatePageButtons(currentPage, totalPages) {
    let buttons = '';
    let startPage = Math.max(1, currentPage - 2);
    let endPage = Math.min(totalPages, currentPage + 2);

    if (startPage > 1) {
      buttons += `<button class="pagination-btn" onclick="paginationSystem.goToPage(1)">1</button>`;
      if (startPage > 2) {
        buttons += `<span class="pagination-ellipsis">...</span>`;
      }
    }

    for (let i = startPage; i <= endPage; i++) {
      buttons += `<button class="pagination-btn ${i === currentPage ? 'active' : ''}" onclick="paginationSystem.goToPage(${i})">${i}</button>`;
    }

    if (endPage < totalPages) {
      if (endPage < totalPages - 1) {
        buttons += `<span class="pagination-ellipsis">...</span>`;
      }
      buttons += `<button class="pagination-btn" onclick="paginationSystem.goToPage(${totalPages})">${totalPages}</button>`;
    }

    return buttons;
  },

  goToPage(page) {
    appState.pagination.currentPage = page;
    this.updatePagination();
    this.reloadCurrentPageData();
  },

  changePageSize(size) {
    appState.pagination.itemsPerPage = parseInt(size);
    appState.pagination.currentPage = 1;
    this.updatePagination();
    this.reloadCurrentPageData();
  },

  reloadCurrentPageData() {
    const currentPage = window.location.pathname.split('/').pop();
    
    switch (currentPage) {
      case 'cobrancas.html':
        if (typeof renderCobrancasEmAbertoLista === 'function') {
          renderCobrancasEmAbertoLista(appState.filters);
        }
        break;
      case 'atrasados.html':
        if (typeof renderAtrasadosLista === 'function') {
          renderAtrasadosLista(appState.filters);
        }
        break;
      case 'emprestimos.html':
        if (typeof renderEmprestimosLista === 'function') {
          renderEmprestimosLista(appState.filters);
        }
        break;
      case 'clientes.html':
        if (typeof renderClientesLista === 'function') {
          renderClientesLista(appState.filters);
        }
        break;
    }
  }
};

// Sistema de Ações em Lote
const bulkActionSystem = {
  init() {
    this.createBulkActionUI();
    this.bindEvents();
  },

  createBulkActionUI() {
    const targetPages = ['cobrancas.html', 'atrasados.html', 'emprestimos.html', 'clientes.html'];
    const currentPage = window.location.pathname.split('/').pop();
    
    if (!targetPages.includes(currentPage)) return;

    const mainContainer = document.querySelector('.container');
    if (!mainContainer) return;

    const bulkContainer = document.createElement('div');
    bulkContainer.className = 'bulk-actions-container';
    bulkContainer.id = 'bulk-actions-container';
    bulkContainer.innerHTML = `
      <div class="bulk-actions-header">
        <div class="bulk-actions-title">Ações em Lote</div>
        <div class="bulk-actions-count">
          <span id="selected-count">0</span> item(s) selecionado(s)
        </div>
      </div>
      <div class="bulk-actions-buttons" id="bulk-actions-buttons">
        ${this.getBulkActionsForPage(currentPage)}
      </div>
    `;

    // Inserir após os filtros
    const filtersContainer = document.querySelector('.filters-container');
    if (filtersContainer) {
      filtersContainer.insertAdjacentElement('afterend', bulkContainer);
    } else {
      mainContainer.insertBefore(bulkContainer, mainContainer.firstChild);
    }
  },

  getBulkActionsForPage(page) {
    const actions = {
      'cobrancas.html': `
        <button class="bulk-action-btn success" onclick="bulkActionSystem.bulkCobrar()">
          <i class="fas fa-paper-plane"></i> Cobrar Selecionados
        </button>
        <button class="bulk-action-btn" onclick="bulkActionSystem.bulkMarkAsPaid()">
          <i class="fas fa-check"></i> Marcar como Pago
        </button>
        <button class="bulk-action-btn danger" onclick="bulkActionSystem.bulkAddToBlacklist()">
          <i class="fas fa-ban"></i> Adicionar à Lista Negra
        </button>
      `,
      'atrasados.html': `
        <button class="bulk-action-btn success" onclick="bulkActionSystem.bulkCobrar()">
          <i class="fas fa-paper-plane"></i> Cobrar Selecionados
        </button>
        <button class="bulk-action-btn" onclick="bulkActionSystem.bulkMarkAsPaid()">
          <i class="fas fa-check"></i> Marcar como Pago
        </button>
        <button class="bulk-action-btn danger" onclick="bulkActionSystem.bulkAddToBlacklist()">
          <i class="fas fa-ban"></i> Adicionar à Lista Negra
        </button>
      `,
      'emprestimos.html': `
        <button class="bulk-action-btn" onclick="bulkActionSystem.bulkExport()">
          <i class="fas fa-download"></i> Exportar Selecionados
        </button>
        <button class="bulk-action-btn danger" onclick="bulkActionSystem.bulkDelete()">
          <i class="fas fa-trash"></i> Excluir Selecionados
        </button>
      `,
      'clientes.html': `
        <button class="bulk-action-btn" onclick="bulkActionSystem.bulkExport()">
          <i class="fas fa-download"></i> Exportar Selecionados
        </button>
        <button class="bulk-action-btn danger" onclick="bulkActionSystem.bulkDelete()">
          <i class="fas fa-trash"></i> Excluir Selecionados
        </button>
      `
    };

    return actions[page] || '';
  },

  bindEvents() {
    document.addEventListener('change', (e) => {
      if (e.target.classList.contains('select-checkbox')) {
        this.handleItemSelection(e.target);
      } else if (e.target.classList.contains('select-all-checkbox')) {
        this.handleSelectAll(e.target);
      }
    });
  },

  handleItemSelection(checkbox) {
    const itemId = checkbox.dataset.id;
    
    if (checkbox.checked) {
      appState.selectedItems.add(itemId);
    } else {
      appState.selectedItems.delete(itemId);
    }
    
    this.updateBulkActions();
  },

  handleSelectAll(checkbox) {
    const itemCheckboxes = document.querySelectorAll('.select-checkbox');
    
    itemCheckboxes.forEach(cb => {
      cb.checked = checkbox.checked;
      const itemId = cb.dataset.id;
      
      if (checkbox.checked) {
        appState.selectedItems.add(itemId);
      } else {
        appState.selectedItems.delete(itemId);
      }
    });
    
    this.updateBulkActions();
  },

  updateBulkActions() {
    const container = document.getElementById('bulk-actions-container');
    const countElement = document.getElementById('selected-count');
    
    if (appState.selectedItems.size > 0) {
      container.classList.add('active');
      countElement.textContent = appState.selectedItems.size;
    } else {
      container.classList.remove('active');
      countElement.textContent = '0';
    }
  },

  async bulkCobrar() {
    if (appState.selectedItems.size === 0) return;
    
    const confirmed = confirm(`Deseja cobrar ${appState.selectedItems.size} item(s) selecionado(s)?`);
    if (!confirmed) return;

    try {
      const ids = Array.from(appState.selectedItems);
      await apiService.bulkCobrar(ids);
      ui.showNotification('Cobranças enviadas com sucesso!', 'success');
      this.clearSelection();
      this.reloadData();
    } catch (error) {
      ui.showNotification('Erro ao enviar cobranças', 'error');
    }
  },

  async bulkMarkAsPaid() {
    if (appState.selectedItems.size === 0) return;
    
    const confirmed = confirm(`Deseja marcar ${appState.selectedItems.size} item(s) como pago?`);
    if (!confirmed) return;

    try {
      const ids = Array.from(appState.selectedItems);
      await apiService.bulkMarkAsPaid(ids);
      ui.showNotification('Itens marcados como pagos!', 'success');
      this.clearSelection();
      this.reloadData();
    } catch (error) {
      ui.showNotification('Erro ao marcar como pagos', 'error');
    }
  },

  async bulkAddToBlacklist() {
    if (appState.selectedItems.size === 0) return;
    
    const confirmed = confirm(`Deseja adicionar ${appState.selectedItems.size} item(s) à lista negra?`);
    if (!confirmed) return;

    try {
      const ids = Array.from(appState.selectedItems);
      await apiService.bulkAddToBlacklist(ids);
      ui.showNotification('Itens adicionados à lista negra!', 'success');
      this.clearSelection();
      this.reloadData();
    } catch (error) {
      ui.showNotification('Erro ao adicionar à lista negra', 'error');
    }
  },

  async bulkExport() {
    if (appState.selectedItems.size === 0) return;
    
    try {
      const ids = Array.from(appState.selectedItems);
      const data = await apiService.bulkExport(ids);
      this.downloadFile(data, 'export.csv');
      ui.showNotification('Dados exportados com sucesso!', 'success');
    } catch (error) {
      ui.showNotification('Erro ao exportar dados', 'error');
    }
  },

  async bulkDelete() {
    if (appState.selectedItems.size === 0) return;
    
    const confirmed = confirm(`Deseja excluir ${appState.selectedItems.size} item(s) selecionado(s)? Esta ação não pode ser desfeita.`);
    if (!confirmed) return;

    try {
      const ids = Array.from(appState.selectedItems);
      await apiService.bulkDelete(ids);
      ui.showNotification('Itens excluídos com sucesso!', 'success');
      this.clearSelection();
      this.reloadData();
    } catch (error) {
      ui.showNotification('Erro ao excluir itens', 'error');
    }
  },

  clearSelection() {
    appState.selectedItems.clear();
    document.querySelectorAll('.select-checkbox, .select-all-checkbox').forEach(cb => {
      cb.checked = false;
    });
    this.updateBulkActions();
  },

  downloadFile(data, filename) {
    const blob = new Blob([data], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.style.display = 'none';
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  },

  reloadData() {
    const currentPage = window.location.pathname.split('/').pop();
    paginationSystem.reloadCurrentPageData();
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
  },

  // Gerar cores para gráficos
  generateColors: (count) => {
    const colors = [
      '#43A047', '#2196F3', '#FF9800', '#E91E63', '#9C27B0',
      '#607D8B', '#FF5722', '#795548', '#009688', '#FFC107'
    ];
    return colors.slice(0, count);
  },

  // Exportar dados para CSV
  exportToCSV: (data, filename) => {
    const headers = Object.keys(data[0]);
    const csvContent = [
      headers.join(','),
      ...data.map(row => headers.map(header => `"${row[header] || ''}"`).join(','))
    ].join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    link.click();
    URL.revokeObjectURL(link.href);
  },

  // Exportar dados para Excel
  exportToExcel: (data, filename) => {
    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Dados');
    XLSX.writeFile(workbook, filename);
  },

  // Exportar dados para PDF
  exportToPDF: (data, filename) => {
    const doc = new jsPDF();
    
    // Título
    doc.setFontSize(16);
    doc.text('Relatório de Dados', 20, 20);
    
    // Dados em formato de tabela
    const headers = Object.keys(data[0]);
    const rows = data.map(row => headers.map(header => row[header] || ''));
    
    doc.autoTable({
      head: [headers],
      body: rows,
      startY: 30,
      theme: 'striped',
      headStyles: { fillColor: [67, 160, 71] }
    });
    
    doc.save(filename);
  }
};

// Sistema de Analytics e Gráficos
const analyticsSystem = {
  charts: {},
  
  init() {
    this.createAnalyticsUI();
    this.loadAnalyticsData();
    this.createCharts();
  },

  createAnalyticsUI() {
    const currentPage = window.location.pathname.split('/').pop();
    
    if (currentPage !== 'dashboard.html') return;

    const mainContainer = document.querySelector('.container');
    if (!mainContainer) return;

    // Criar container de analytics
    const analyticsContainer = document.createElement('div');
    analyticsContainer.className = 'analytics-container';
    analyticsContainer.id = 'analytics-container';
    analyticsContainer.innerHTML = `
      <div class="chart-container">
        <div class="chart-header">
          <h3 class="chart-title">Faturamento Mensal</h3>
          <div class="chart-period-selector">
            <button class="chart-period-btn active" data-period="month">Mês</button>
            <button class="chart-period-btn" data-period="year">Ano</button>
          </div>
        </div>
        <canvas id="revenue-chart" class="chart-canvas"></canvas>
      </div>
      
      <div class="chart-container">
        <div class="chart-header">
          <h3 class="chart-title">Status dos Empréstimos</h3>
        </div>
        <canvas id="loans-status-chart" class="chart-canvas"></canvas>
      </div>
      
      <div class="chart-container">
        <div class="chart-header">
          <h3 class="chart-title">Evolução de Clientes</h3>
          <div class="chart-period-selector">
            <button class="chart-period-btn active" data-period="6months">6 Meses</button>
            <button class="chart-period-btn" data-period="year">1 Ano</button>
          </div>
        </div>
        <canvas id="clients-evolution-chart" class="chart-canvas"></canvas>
      </div>
      
      <div class="chart-container">
        <div class="chart-header">
          <h3 class="chart-title">Performance de Cobrança</h3>
        </div>
        <canvas id="collection-performance-chart" class="chart-canvas"></canvas>
      </div>
    `;

    // Inserir após os cards do dashboard
    const cardsSection = document.querySelector('.cards');
    if (cardsSection) {
      cardsSection.insertAdjacentElement('afterend', analyticsContainer);
    } else {
      mainContainer.appendChild(analyticsContainer);
    }

    // Criar seção de métricas de performance
    this.createPerformanceMetrics();
    
    // Criar seção de exportação
    this.createExportSection();
  },

  createPerformanceMetrics() {
    const mainContainer = document.querySelector('.container');
    if (!mainContainer) return;

    const metricsContainer = document.createElement('div');
    metricsContainer.className = 'performance-metrics';
    metricsContainer.id = 'performance-metrics';
    metricsContainer.innerHTML = `
      <div class="metric-card">
        <div class="metric-icon">
          <i class="fas fa-percentage"></i>
        </div>
        <div class="metric-value" id="recovery-rate">85%</div>
        <div class="metric-label">Taxa de Recuperação</div>
        <div class="metric-change positive">
          <i class="fas fa-arrow-up"></i> +5% este mês
        </div>
      </div>
      
      <div class="metric-card">
        <div class="metric-icon">
          <i class="fas fa-clock"></i>
        </div>
        <div class="metric-value" id="avg-collection-time">12</div>
        <div class="metric-label">Tempo Médio de Cobrança (dias)</div>
        <div class="metric-change negative">
          <i class="fas fa-arrow-down"></i> -2 dias este mês
        </div>
      </div>
      
      <div class="metric-card">
        <div class="metric-icon">
          <i class="fas fa-users"></i>
        </div>
        <div class="metric-value" id="active-clients">156</div>
        <div class="metric-label">Clientes Ativos</div>
        <div class="metric-change positive">
          <i class="fas fa-arrow-up"></i> +12 este mês
        </div>
      </div>
      
      <div class="metric-card">
        <div class="metric-icon">
          <i class="fas fa-chart-line"></i>
        </div>
        <div class="metric-value" id="growth-rate">8.5%</div>
        <div class="metric-label">Taxa de Crescimento</div>
        <div class="metric-change positive">
          <i class="fas fa-arrow-up"></i> +1.2% este mês
        </div>
      </div>
    `;

    const analyticsContainer = document.getElementById('analytics-container');
    if (analyticsContainer) {
      analyticsContainer.insertAdjacentElement('afterend', metricsContainer);
    }
  },

  createExportSection() {
    const mainContainer = document.querySelector('.container');
    if (!mainContainer) return;

    const exportContainer = document.createElement('div');
    exportContainer.className = 'export-container';
    exportContainer.id = 'export-container';
    exportContainer.innerHTML = `
      <div class="export-header">
        <h3 class="export-title">Exportar Dados</h3>
      </div>
      
      <div class="export-buttons">
        <button class="export-btn" onclick="analyticsSystem.exportData('csv')">
          <i class="fas fa-file-csv"></i> Exportar CSV
        </button>
        <button class="export-btn" onclick="analyticsSystem.exportData('excel')">
          <i class="fas fa-file-excel"></i> Exportar Excel
        </button>
        <button class="export-btn" onclick="analyticsSystem.exportData('pdf')">
          <i class="fas fa-file-pdf"></i> Exportar PDF
        </button>
        <button class="export-btn primary" onclick="analyticsSystem.generateReport()">
          <i class="fas fa-chart-bar"></i> Gerar Relatório Completo
        </button>
      </div>
      
      <div class="export-options" style="margin-top: 1rem;">
        <h4 style="margin-bottom: 0.5rem;">Período:</h4>
        <div style="display: flex; gap: 1rem; align-items: center;">
          <input type="date" id="export-date-from" class="filter-input" style="width: auto;">
          <span>até</span>
          <input type="date" id="export-date-to" class="filter-input" style="width: auto;">
        </div>
      </div>
    `;

    const metricsContainer = document.getElementById('performance-metrics');
    if (metricsContainer) {
      metricsContainer.insertAdjacentElement('afterend', exportContainer);
    }
  },

  async loadAnalyticsData() {
    try {
      const data = await apiService.getAnalyticsData();
      this.updateCharts(data);
      this.updateMetrics(data.metrics);
    } catch (error) {
      console.error('Erro ao carregar dados de analytics:', error);
      this.loadMockAnalyticsData();
    }
  },

  loadMockAnalyticsData() {
    const mockData = {
      revenue: {
        labels: ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun'],
        data: [15000, 18000, 22000, 19000, 25000, 28000]
      },
      loansStatus: {
        labels: ['Ativos', 'Atrasados', 'Quitados', 'Cancelados'],
        data: [45, 12, 78, 5]
      },
      clientsEvolution: {
        labels: ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun'],
        data: [120, 135, 142, 148, 153, 156]
      },
      collectionPerformance: {
        labels: ['Primeira Tentativa', 'Segunda Tentativa', 'Terceira Tentativa', 'Mais Tentativas'],
        data: [65, 25, 8, 2]
      },
      metrics: {
        recoveryRate: 85,
        avgCollectionTime: 12,
        activeClients: 156,
        growthRate: 8.5
      }
    };

    this.updateCharts(mockData);
    this.updateMetrics(mockData.metrics);
  },

  createCharts() {
    // Verificar se Chart.js está disponível
    if (typeof Chart === 'undefined') {
      this.loadChartJS(() => {
        this.initializeCharts();
      });
      return;
    }

    this.initializeCharts();
  },

  loadChartJS(callback) {
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/chart.js';
    script.onload = callback;
    document.head.appendChild(script);
  },

  initializeCharts() {
    // Gráfico de Faturamento
    const revenueCtx = document.getElementById('revenue-chart');
    if (revenueCtx) {
      this.charts.revenue = new Chart(revenueCtx, {
        type: 'line',
        data: {
          labels: [],
          datasets: [{
            label: 'Faturamento',
            data: [],
            borderColor: '#43A047',
            backgroundColor: 'rgba(67, 160, 71, 0.1)',
            tension: 0.4
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          scales: {
            y: {
              beginAtZero: true,
              ticks: {
                callback: function(value) {
                  return utils.formatCurrency(value);
                }
              }
            }
          },
          plugins: {
            legend: {
              display: false
            }
          }
        }
      });
    }

    // Gráfico de Status dos Empréstimos
    const loansStatusCtx = document.getElementById('loans-status-chart');
    if (loansStatusCtx) {
      this.charts.loansStatus = new Chart(loansStatusCtx, {
        type: 'doughnut',
        data: {
          labels: [],
          datasets: [{
            data: [],
            backgroundColor: ['#43A047', '#FF9800', '#2196F3', '#E91E63']
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: {
              position: 'bottom'
            }
          }
        }
      });
    }

    // Gráfico de Evolução de Clientes
    const clientsEvolutionCtx = document.getElementById('clients-evolution-chart');
    if (clientsEvolutionCtx) {
      this.charts.clientsEvolution = new Chart(clientsEvolutionCtx, {
        type: 'bar',
        data: {
          labels: [],
          datasets: [{
            label: 'Clientes',
            data: [],
            backgroundColor: 'rgba(67, 160, 71, 0.8)'
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          scales: {
            y: {
              beginAtZero: true
            }
          },
          plugins: {
            legend: {
              display: false
            }
          }
        }
      });
    }

    // Gráfico de Performance de Cobrança
    const collectionPerformanceCtx = document.getElementById('collection-performance-chart');
    if (collectionPerformanceCtx) {
      this.charts.collectionPerformance = new Chart(collectionPerformanceCtx, {
        type: 'pie',
        data: {
          labels: [],
          datasets: [{
            data: [],
            backgroundColor: ['#43A047', '#2196F3', '#FF9800', '#E91E63']
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: {
              position: 'bottom'
            }
          }
        }
      });
    }
  },

  updateCharts(data) {
    if (this.charts.revenue) {
      this.charts.revenue.data.labels = data.revenue.labels;
      this.charts.revenue.data.datasets[0].data = data.revenue.data;
      this.charts.revenue.update();
    }

    if (this.charts.loansStatus) {
      this.charts.loansStatus.data.labels = data.loansStatus.labels;
      this.charts.loansStatus.data.datasets[0].data = data.loansStatus.data;
      this.charts.loansStatus.update();
    }

    if (this.charts.clientsEvolution) {
      this.charts.clientsEvolution.data.labels = data.clientsEvolution.labels;
      this.charts.clientsEvolution.data.datasets[0].data = data.clientsEvolution.data;
      this.charts.clientsEvolution.update();
    }

    if (this.charts.collectionPerformance) {
      this.charts.collectionPerformance.data.labels = data.collectionPerformance.labels;
      this.charts.collectionPerformance.data.datasets[0].data = data.collectionPerformance.data;
      this.charts.collectionPerformance.update();
    }
  },

  updateMetrics(metrics) {
    // Atualizar métricas de performance
    const recoveryRate = document.getElementById('recovery-rate');
    if (recoveryRate) {
      recoveryRate.textContent = `${metrics.recoveryRate}%`;
    }

    const avgCollectionTime = document.getElementById('avg-collection-time');
    if (avgCollectionTime) {
      avgCollectionTime.textContent = metrics.avgCollectionTime;
    }

    const activeClients = document.getElementById('active-clients');
    if (activeClients) {
      activeClients.textContent = metrics.activeClients;
    }

    const growthRate = document.getElementById('growth-rate');
    if (growthRate) {
      growthRate.textContent = `${metrics.growthRate}%`;
    }
  },

  async exportData(format) {
    try {
      const dateFrom = document.getElementById('export-date-from')?.value || null;
      const dateTo = document.getElementById('export-date-to')?.value || null;
      
      const data = await apiService.getExportData({ dateFrom, dateTo });
      const filename = `relatorio_${new Date().toISOString().split('T')[0]}.${format}`;
      
      switch (format) {
        case 'csv':
          utils.exportToCSV(data, filename);
          break;
        case 'excel':
          utils.exportToExcel(data, filename);
          break;
        case 'pdf':
          utils.exportToPDF(data, filename);
          break;
      }
      
      ui.showNotification('Dados exportados com sucesso!', 'success');
    } catch (error) {
      console.error('Erro ao exportar dados:', error);
      ui.showNotification('Erro ao exportar dados', 'error');
    }
  },

  async generateReport() {
    try {
      const dateFrom = document.getElementById('export-date-from')?.value || null;
      const dateTo = document.getElementById('export-date-to')?.value || null;
      
      const reportData = await apiService.generateFullReport({ dateFrom, dateTo });
      
      // Criar PDF completo com gráficos
      const doc = new jsPDF();
      
      // Título
      doc.setFontSize(20);
      doc.text('Relatório Completo - JP Cobranças', 20, 20);
      
      // Data do relatório
      doc.setFontSize(12);
      doc.text(`Gerado em: ${new Date().toLocaleDateString('pt-BR')}`, 20, 30);
      
      if (dateFrom && dateTo) {
        doc.text(`Período: ${dateFrom} até ${dateTo}`, 20, 40);
      }
      
      // Métricas principais
      doc.setFontSize(16);
      doc.text('Métricas Principais', 20, 60);
      
      doc.setFontSize(12);
      doc.text(`Taxa de Recuperação: ${reportData.metrics.recoveryRate}%`, 20, 75);
      doc.text(`Tempo Médio de Cobrança: ${reportData.metrics.avgCollectionTime} dias`, 20, 85);
      doc.text(`Clientes Ativos: ${reportData.metrics.activeClients}`, 20, 95);
      doc.text(`Taxa de Crescimento: ${reportData.metrics.growthRate}%`, 20, 105);
      
      // Adicionar mais páginas com tabelas de dados
      doc.addPage();
      
      // Dados de empréstimos
      doc.setFontSize(16);
      doc.text('Empréstimos', 20, 20);
      
      if (reportData.loans && reportData.loans.length > 0) {
        doc.autoTable({
          head: [['Cliente', 'Valor', 'Status', 'Vencimento']],
          body: reportData.loans.map(loan => [
            loan.cliente,
            utils.formatCurrency(loan.valor),
            loan.status,
            utils.formatDate(loan.vencimento)
          ]),
          startY: 30,
          theme: 'striped',
          headStyles: { fillColor: [67, 160, 71] }
        });
      }
      
      doc.save(`relatorio_completo_${new Date().toISOString().split('T')[0]}.pdf`);
      
      ui.showNotification('Relatório gerado com sucesso!', 'success');
    } catch (error) {
      console.error('Erro ao gerar relatório:', error);
      ui.showNotification('Erro ao gerar relatório', 'error');
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
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error('API request failed:', error);
      throw error;
    }
  },

  // Métodos existentes
  async getDashboardData() {
    return await this.request('/cobrancas/dashboard');
  },

  async getClientes() {
    return await this.request('/clientes');
  },

  async createCliente(clienteData) {
    return await this.request('/clientes', {
      method: 'POST',
      body: JSON.stringify(clienteData)
    });
  },

  async getEmprestimos() {
    return await this.request('/emprestimos');
  },

  async createEmprestimo(emprestimoData) {
    return await this.request('/emprestimos', {
      method: 'POST',
      body: JSON.stringify(emprestimoData)
    });
  },

  async getParcelasEmprestimo(emprestimoId) {
    return await this.request(`/emprestimos/${emprestimoId}/parcelas`);
  },

  async getCobrancas() {
    return await this.request('/cobrancas');
  },

  // Novos métodos para notificações
  async getNotifications() {
    return await this.request('/notifications');
  },

  async markNotificationAsRead(id) {
    return await this.request(`/notifications/${id}/read`, {
      method: 'PUT'
    });
  },

  async markAllNotificationsAsRead() {
    return await this.request('/notifications/read-all', {
      method: 'PUT'
    });
  },

  async getPaymentAlerts() {
    return await this.request('/alerts/payments');
  },

  async cobrarCliente(id) {
    return await this.request(`/cobrancas/${id}/cobrar`, {
      method: 'POST'
    });
  },

  // Métodos para contadores
  async getMenuCounters() {
    return await this.request('/counters/menu');
  },

  // Métodos para ações em lote
  async bulkCobrar(ids) {
    return await this.request('/cobrancas/bulk-cobrar', {
      method: 'POST',
      body: JSON.stringify({ ids })
    });
  },

  async bulkMarkAsPaid(ids) {
    return await this.request('/cobrancas/bulk-mark-paid', {
      method: 'POST',
      body: JSON.stringify({ ids })
    });
  },

  async bulkAddToBlacklist(ids) {
    return await this.request('/cobrancas/bulk-blacklist', {
      method: 'POST',
      body: JSON.stringify({ ids })
    });
  },

  async bulkExport(ids) {
    return await this.request('/export/bulk', {
      method: 'POST',
      body: JSON.stringify({ ids })
    });
  },

  async bulkDelete(ids) {
    return await this.request('/bulk-delete', {
      method: 'POST',
      body: JSON.stringify({ ids })
    });
  },

  // Métodos para analytics
  async getAnalyticsData() {
    return await this.request('/analytics/data');
  },

  async getExportData(filters = {}) {
    const params = new URLSearchParams(filters);
    return await this.request(`/export/data?${params}`);
  },

  async generateFullReport(filters = {}) {
    const params = new URLSearchParams(filters);
    return await this.request(`/reports/full?${params}`);
  }
};

// UI utilities
const ui = {
  showLoading(element) {
    if (element) {
      element.innerHTML = '<div class="loading">Carregando...</div>';
    }
  },

  hideLoading(element) {
    if (element) {
      element.innerHTML = '';
    }
  },

  showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.innerHTML = `
      <div class="notification-content">
        <span>${message}</span>
        <button class="notification-close" onclick="this.parentElement.parentElement.remove()">×</button>
      </div>
    `;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
      notification.remove();
    }, 5000);
  },

  showModal(content, title = '') {
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.innerHTML = `
      <div class="modal-overlay" onclick="this.parentElement.remove()"></div>
      <div class="modal-content">
        <div class="modal-header">
          <h3>${title}</h3>
          <button class="modal-close" onclick="this.closest('.modal').remove()">×</button>
        </div>
        <div class="modal-body">
          ${content}
        </div>
      </div>
    `;
    
    document.body.appendChild(modal);
    
    const closeModal = () => modal.remove();
    
    modal.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        closeModal();
      }
    });
    
    return modal;
  },

  createTableRow(data, actions = []) {
    const row = document.createElement('tr');
    
    // Adicionar checkbox de seleção
    const checkboxCell = document.createElement('td');
    checkboxCell.innerHTML = `<input type="checkbox" class="select-checkbox" data-id="${data.id}">`;
    row.appendChild(checkboxCell);
    
    // Adicionar dados
    Object.values(data).forEach(value => {
      const cell = document.createElement('td');
      cell.textContent = value;
      row.appendChild(cell);
    });
    
    // Adicionar ações
    if (actions.length > 0) {
      const actionsCell = document.createElement('td');
      actionsCell.innerHTML = actions.map(action => 
        `<button class="btn btn-sm ${action.class}" onclick="${action.onclick}">${action.text}</button>`
      ).join(' ');
      row.appendChild(actionsCell);
    }
    
    return row;
  }
};

// Sistema principal
const dashboard = {
  async loadDashboardData() {
    if (window.location.pathname.includes('dashboard.html')) {
      try {
        const data = await apiService.getDashboardData();
        appState.data.dashboard = data;
        this.updateDashboardCards(data);
        this.updateRecentEmprestimos(data.emprestimos || []);
        this.updateCobrancasPendentes(data.cobrancas || []);
        
        // Atualizar paginação
        appState.pagination.totalItems = data.totalItems || 0;
        paginationSystem.updatePagination();
        
      } catch (error) {
        console.error('Erro ao carregar dados do dashboard:', error);
        this.loadMockDashboardData();
      }
    }
  },

  loadMockDashboardData() {
    const mockData = {
      totalInvestido: 125000,
      totalEmprestimos: 45,
      valorReceber: 189000,
      clientesAtraso: 8,
      emprestimos: [
        {
          id: 1,
          cliente: 'João Silva',
          valor: 5000,
          vencimento: '2024-01-15',
          status: 'Ativo'
        },
        {
          id: 2,
          cliente: 'Maria Santos',
          valor: 3000,
          vencimento: '2024-01-20',
          status: 'Pendente'
        }
      ],
      cobrancas: [
        {
          id: 1,
          cliente: 'Pedro Oliveira',
          valor: 2500,
          vencimento: '2024-01-10',
          diasAtraso: 5,
          status: 'Atrasado'
        }
      ]
    };
    
    this.updateDashboardCards(mockData);
    this.updateRecentEmprestimos(mockData.emprestimos);
    this.updateCobrancasPendentes(mockData.cobrancas);
  },

  updateDashboardCards(data) {
    const cards = [
      { id: 'total-investido', value: data.totalInvestido || 0, format: 'currency' },
      { id: 'total-emprestimos', value: data.totalEmprestimos || 0, format: 'number' },
      { id: 'valor-receber', value: data.valorReceber || 0, format: 'currency' },
      { id: 'clientes-atraso', value: data.clientesAtraso || 0, format: 'number' }
    ];

    cards.forEach(card => {
      const element = document.getElementById(card.id);
      if (element) {
        const currentValue = parseFloat(element.textContent.replace(/[^\d,]/g, '').replace(',', '.')) || 0;
        const targetValue = card.value;
        
        if (card.format === 'currency') {
          if (currentValue !== targetValue) {
            const startTime = performance.now();
            const duration = 1000; // 1 segundo
            
            function animateNumber(currentTime) {
              const elapsed = currentTime - startTime;
              const progress = Math.min(elapsed / duration, 1);
              
              const currentAnimatedValue = currentValue + (targetValue - currentValue) * progress;
              element.textContent = utils.formatCurrency(currentAnimatedValue);
              
              if (progress < 1) {
                requestAnimationFrame(animateNumber);
              }
            }
            
            requestAnimationFrame(animateNumber);
          }
        } else {
          element.textContent = targetValue;
        }
      }
    });
  },

  async updateRecentEmprestimos(emprestimos) {
    const tbody = document.getElementById('emprestimos-recentes');
    if (!tbody) return;

    if (!emprestimos || emprestimos.length === 0) {
      tbody.innerHTML = '<tr><td colspan="5" class="text-center text-gray-500">Nenhum empréstimo encontrado</td></tr>';
      return;
    }

    tbody.innerHTML = emprestimos.slice(0, 5).map(emprestimo => `
      <tr>
        <td>${emprestimo.cliente}</td>
        <td>${utils.formatCurrency(emprestimo.valor)}</td>
        <td>${utils.formatDate(emprestimo.vencimento)}</td>
        <td>
          <span class="badge ${this.getStatusClass(emprestimo.status)}">${emprestimo.status}</span>
        </td>
        <td>
          <button class="btn btn-sm btn-primary" onclick="viewEmprestimo(${emprestimo.id})">
            <i class="fas fa-eye"></i> Ver
          </button>
          <button class="btn btn-sm btn-secondary" onclick="editarEmprestimo(${emprestimo.id})">
            <i class="fas fa-edit"></i> Editar
          </button>
        </td>
      </tr>
    `).join('');
  },

  async updateCobrancasPendentes(cobrancas) {
    const tbody = document.getElementById('cobrancas-pendentes');
    if (!tbody) return;

    if (!cobrancas || cobrancas.length === 0) {
      tbody.innerHTML = '<tr><td colspan="6" class="text-center text-gray-500">Nenhuma cobrança pendente</td></tr>';
      return;
    }

    tbody.innerHTML = cobrancas.slice(0, 5).map(cobranca => `
      <tr>
        <td>${cobranca.cliente}</td>
        <td>${utils.formatCurrency(cobranca.valor)}</td>
        <td>${utils.formatDate(cobranca.vencimento)}</td>
        <td>
          <span class="badge ${cobranca.diasAtraso > 0 ? 'badge-danger' : 'badge-warning'}">
            ${cobranca.diasAtraso || 0} dias
          </span>
        </td>
        <td>
          <span class="badge ${this.getStatusClass(cobranca.status)}">${cobranca.status}</span>
        </td>
        <td>
          <button class="btn btn-sm btn-warning" onclick="cobrar(${cobranca.id})">
            <i class="fas fa-paper-plane"></i> Cobrar
          </button>
          <button class="btn btn-sm btn-info" onclick="viewCliente(${cobranca.clienteId})">
            <i class="fas fa-user"></i> Ver Cliente
          </button>
        </td>
      </tr>
    `).join('');
  },

  getStatusClass(status) {
    const statusClasses = {
      'Ativo': 'badge-success',
      'Pendente': 'badge-warning',
      'Atrasado': 'badge-danger',
      'Quitado': 'badge-info',
      'Cancelado': 'badge-secondary'
    };
    return statusClasses[status] || 'badge-secondary';
  },

  init() {
    this.loadDashboardData();
    this.updateStatisticsCards();
    this.setCurrentDate();
  }
};

// Inicialização dos sistemas
const app = {
  async init() {
    // Verificar autenticação
    if (!authSystem.checkAuth()) {
      window.location.href = 'login.html';
      return;
    }

    // Inicializar sistemas
    authSystem.setupAutoLogout();
    authSystem.showWelcomeMessage();
    
    // Inicializar novos sistemas
    notificationSystem.init();
    counterSystem.init();
    filterSystem.init();
    paginationSystem.init();
    bulkActionSystem.init();
    
    // Inicializar analytics apenas no dashboard
    if (window.location.pathname.includes('dashboard.html')) {
      analyticsSystem.init();
    }
    
    // Carregar dados específicos da página
    await this.loadPageSpecificData();
    
    // Inicializar dashboard se estivermos na página do dashboard
    if (window.location.pathname.includes('dashboard.html')) {
      dashboard.init();
    }
  },

  async loadPageSpecificData() {
    const currentPage = window.location.pathname.split('/').pop();
    
    switch (currentPage) {
      case 'dashboard.html':
        await dashboard.loadDashboardData();
        break;
      case 'cobrancas.html':
        if (typeof renderCobrancasEmAbertoLista === 'function') {
          await renderCobrancasEmAbertoLista();
        }
        break;
      case 'atrasados.html':
        if (typeof renderAtrasadosLista === 'function') {
          await renderAtrasadosLista();
        }
        break;
      case 'emprestimos.html':
        if (typeof renderEmprestimosLista === 'function') {
          await renderEmprestimosLista();
        }
        break;
      case 'clientes.html':
        if (typeof renderClientesLista === 'function') {
          await renderClientesLista();
        }
        break;
      case 'historico.html':
        if (typeof renderHistoricoEmprestimos === 'function') {
          await renderHistoricoEmprestimos();
        }
        break;
      case 'lista-negra.html':
        if (typeof renderListaNegra === 'function') {
          await renderListaNegra();
        }
        break;
    }
  }
};

// ... existing code ...

async function renderCobrancasEmAbertoLista(filters = {}) {
  try {
    const tbody = document.getElementById('lista-cobrancas');
    if (!tbody) return;

    // Mostrar loading
    tbody.innerHTML = '<tr><td colspan="7" class="text-center">Carregando dados...</td></tr>';

    // Preparar parâmetros de filtro e paginação
    const params = new URLSearchParams({
      page: appState.pagination.currentPage,
      limit: appState.pagination.itemsPerPage,
      ...filters
    });

    const response = await fetch(`/api/cobrancas?${params}`, {
      method: 'GET',
      credentials: 'include'
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    let lista = data.cobrancas || data || [];
    
    // Atualizar estado da paginação
    appState.pagination.totalItems = data.total || lista.length;
    if (typeof paginationSystem !== 'undefined') {
      paginationSystem.updatePagination();
    }

    if (!Array.isArray(lista) || lista.length === 0) {
      tbody.innerHTML = '<tr><td colspan="7" class="text-center text-gray-500">Nenhuma cobrança encontrada</td></tr>';
      return;
    }

    // Aplicar filtros locais se necessário
    if (filters.search) {
      const searchTerm = filters.search.toLowerCase();
      lista = lista.filter(item => 
        (item.nome && item.nome.toLowerCase().includes(searchTerm)) ||
        (item.cliente && item.cliente.toLowerCase().includes(searchTerm))
      );
    }

    if (filters.status && filters.status !== '') {
      lista = lista.filter(item => 
        (item.status && item.status.toLowerCase() === filters.status.toLowerCase())
      );
    }

    if (filters.dateFrom) {
      lista = lista.filter(item => 
        new Date(item.data_vencimento || item.vencimento) >= new Date(filters.dateFrom)
      );
    }

    if (filters.dateTo) {
      lista = lista.filter(item => 
        new Date(item.data_vencimento || item.vencimento) <= new Date(filters.dateTo)
      );
    }

    tbody.innerHTML = lista.map(item => {
      const clienteNome = item.nome || item.cliente || 'Cliente não identificado';
      const valor = parseFloat(item.valor) || 0;
      const valorFormatado = utils.formatCurrency(valor);
      const dataVencimento = item.data_vencimento || item.vencimento;
      const dataFormatada = dataVencimento ? utils.formatDate(dataVencimento) : 'N/A';
      
      // Calcular dias de atraso
      const diasAtraso = dataVencimento ? utils.calculateDaysLate(dataVencimento) : 0;
      const statusAtraso = diasAtraso > 0 ? 'Atrasado' : 'Em Dia';
      
      const statusClass = diasAtraso > 0 ? 'badge-danger' : 'badge-success';
      const statusText = item.status || statusAtraso;

      return `
        <tr>
          <td>
            <input type="checkbox" class="select-checkbox" data-id="${item.id || item.emprestimo_id}">
          </td>
          <td>
            <div class="cobranca-nome">${clienteNome}</div>
          </td>
          <td>
            <div class="cobranca-valor">${valorFormatado}</div>
          </td>
          <td>
            <div class="cobranca-data">${dataFormatada}</div>
          </td>
          <td>
            <span class="badge ${diasAtraso > 0 ? 'badge-danger' : 'badge-success'}">
              ${diasAtraso} dias
            </span>
          </td>
          <td>
            <span class="badge ${statusClass}">${statusText}</span>
          </td>
          <td>
            <div style="display: flex; gap: 0.5rem; flex-wrap: wrap;">
              <button class="btn btn-sm btn-warning" onclick="cobrar(${item.id || item.emprestimo_id})" title="Enviar Cobrança">
                <i class="fas fa-paper-plane"></i>
              </button>
              <button class="btn btn-sm btn-info" onclick="viewEmprestimo(${item.id || item.emprestimo_id})" title="Ver Detalhes">
                <i class="fas fa-eye"></i>
              </button>
              <button class="btn btn-sm btn-success" onclick="marcarParcelaPaga(${item.id || item.emprestimo_id}, 1)" title="Marcar como Pago">
                <i class="fas fa-check"></i>
              </button>
              ${diasAtraso > 5 ? `
                <button class="btn btn-sm btn-danger" onclick="adicionarListaNegra(${item.cliente_id || item.id})" title="Adicionar à Lista Negra">
                  <i class="fas fa-ban"></i>
                </button>
              ` : ''}
            </div>
          </td>
        </tr>
      `;
    }).join('');

    // Atualizar data atual
    const currentDateElement = document.getElementById('currentDate');
    if (currentDateElement) {
      currentDateElement.textContent = new Date().toLocaleDateString('pt-BR');
    }

    // Limpar seleções
    if (typeof bulkActionSystem !== 'undefined') {
      bulkActionSystem.clearSelection();
    }

  } catch (error) {
    console.error('Erro ao carregar cobranças:', error);
    const tbody = document.getElementById('lista-cobrancas');
    if (tbody) {
      tbody.innerHTML = '<tr><td colspan="7" class="text-center text-red-600">Erro ao carregar dados. Tente novamente.</td></tr>';
    }
  }
}

async function renderClientesLista(filters = {}) {
  try {
    const tbody = document.getElementById('clientes-lista');
    if (!tbody) return;

    // Mostrar loading
    tbody.innerHTML = '<tr><td colspan="6" class="text-center">Carregando dados...</td></tr>';

    // Preparar parâmetros de filtro e paginação
    const params = new URLSearchParams({
      page: appState.pagination.currentPage,
      limit: appState.pagination.itemsPerPage,
      ...filters
    });

    const response = await fetch(`/api/cobrancas/clientes?${params}`, {
      method: 'GET',
      credentials: 'include'
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    let lista = data.clientes || data || [];
    
    // Atualizar estado da paginação
    appState.pagination.totalItems = data.total || lista.length;
    if (typeof paginationSystem !== 'undefined') {
      paginationSystem.updatePagination();
    }

    if (!Array.isArray(lista) || lista.length === 0) {
      tbody.innerHTML = '<tr><td colspan="6" class="text-center text-gray-500">Nenhum cliente encontrado</td></tr>';
      return;
    }

    // Aplicar filtros locais se necessário
    if (filters.search) {
      const searchTerm = filters.search.toLowerCase();
      lista = lista.filter(item => 
        (item.nome && item.nome.toLowerCase().includes(searchTerm)) ||
        (item.cpf_cnpj && item.cpf_cnpj.toLowerCase().includes(searchTerm)) ||
        (item.telefone && item.telefone.toLowerCase().includes(searchTerm))
      );
    }

    if (filters.status && filters.status !== '') {
      lista = lista.filter(item => 
        (item.status && item.status.toLowerCase() === filters.status.toLowerCase())
      );
    }

    tbody.innerHTML = lista.map(cliente => {
      const nome = cliente.nome || cliente.razao || 'Nome não informado';
      const cpfCnpj = cliente.cpf_cnpj || 'N/A';
      const telefone = cliente.telefone || 'N/A';
      const email = cliente.email || 'N/A';
      const status = cliente.status || 'Ativo';
      const statusClass = status.toLowerCase() === 'ativo' ? 'badge-success' : 'badge-danger';

      return `
        <tr>
          <td>
            <input type="checkbox" class="select-checkbox" data-id="${cliente.id}">
          </td>
          <td>
            <div style="font-weight: 500;">${nome}</div>
            <small class="text-gray-500">${cpfCnpj}</small>
          </td>
          <td>${telefone}</td>
          <td>${email}</td>
          <td>
            <span class="badge ${statusClass}">${status}</span>
          </td>
          <td>
            <div style="display: flex; gap: 0.5rem; flex-wrap: wrap;">
              <button class="btn btn-sm btn-info" onclick="viewCliente(${cliente.id})" title="Ver Detalhes">
                <i class="fas fa-eye"></i>
              </button>
              <button class="btn btn-sm btn-secondary" onclick="editarCliente(${cliente.id})" title="Editar">
                <i class="fas fa-edit"></i>
              </button>
              <button class="btn btn-sm btn-warning" onclick="cobrarCliente(${cliente.id})" title="Criar Cobrança">
                <i class="fas fa-paper-plane"></i>
              </button>
              <button class="btn btn-sm btn-danger" onclick="deleteCliente(${cliente.id})" title="Excluir">
                <i class="fas fa-trash"></i>
              </button>
            </div>
          </td>
        </tr>
      `;
    }).join('');

    // Atualizar data atual
    const currentDateElement = document.getElementById('currentDate');
    if (currentDateElement) {
      currentDateElement.textContent = new Date().toLocaleDateString('pt-BR');
    }

    // Limpar seleções
    if (typeof bulkActionSystem !== 'undefined') {
      bulkActionSystem.clearSelection();
    }

  } catch (error) {
    console.error('Erro ao carregar clientes:', error);
    const tbody = document.getElementById('clientes-lista');
    if (tbody) {
      tbody.innerHTML = '<tr><td colspan="6" class="text-center text-red-600">Erro ao carregar dados. Tente novamente.</td></tr>';
    }
  }
}

 