// Configurações da API
const API_BASE_URL = 'http://localhost:3001/api';

// Estado da aplicação
let clientes = [];
let currentPage = 1;
const itemsPerPage = 10;

// Elementos DOM
const clientesTable = document.getElementById('clientes-table');
const clientesTableBody = document.getElementById('clientes-table-body');
const searchInput = document.getElementById('search-cliente');
const addClienteBtn = document.getElementById('add-cliente-btn');
const totalClientesSpan = document.getElementById('total-clientes');

// Utilitários
const utils = {
  formatCurrency: (value) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  },

  formatDate: (date) => {
    return new Intl.DateTimeFormat('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    }).format(new Date(date));
  },

  showNotification: (message, type = 'success') => {
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.innerHTML = `
      <div class="notification-content">
        <span>${message}</span>
        <button class="notification-close">&times;</button>
      </div>
    `;

    document.body.appendChild(notification);

    setTimeout(() => notification.remove(), 5000);

    notification.querySelector('.notification-close').addEventListener('click', () => {
      notification.remove();
    });
  },

  showModal: (content, title = '') => {
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

    const closeModal = () => modal.remove();
    modal.querySelector('.modal-close').addEventListener('click', closeModal);
    modal.querySelector('.modal-overlay').addEventListener('click', closeModal);

    return { modal, closeModal };
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

  async getClientes() {
    return this.request('/clientes');
  },

  async getCliente(id) {
    return this.request(`/clientes/${id}`);
  },

  async createCliente(clienteData) {
    return this.request('/clientes', {
      method: 'POST',
      body: JSON.stringify(clienteData)
    });
  },

  async updateCliente(id, clienteData) {
    return this.request(`/clientes/${id}`, {
      method: 'PUT',
      body: JSON.stringify(clienteData)
    });
  },

  async deleteCliente(id) {
    return this.request(`/clientes/${id}`, {
      method: 'DELETE'
    });
  },

  async searchClientes(term) {
    return this.request(`/clientes/search/${term}`);
  }
};

// UI Components
const ui = {
  showLoading() {
    if (clientesTableBody) {
      clientesTableBody.innerHTML = `
        <tr>
          <td colspan="6" class="text-center">
            <div class="loading">Carregando...</div>
          </td>
        </tr>
      `;
    }
  },

  hideLoading() {
    // Loading será removido quando os dados forem carregados
  },

  renderClienteRow(cliente) {
    const emprestimosAtivos = cliente.emprestimos_ativos || 0;
    const emprestimosAtrasados = cliente.emprestimos_atrasados || 0;
    
    return `
      <tr data-id="${cliente.id}">
        <td>
          <div class="cliente-info">
            <div class="cliente-nome">${cliente.name}</div>
            <div class="cliente-email">${cliente.email || 'N/A'}</div>
          </div>
        </td>
        <td>${cliente.phone || 'N/A'}</td>
        <td>${cliente.cpf_cnpj || 'N/A'}</td>
        <td>
          <span class="badge badge-success">${emprestimosAtivos}</span>
        </td>
        <td>
          ${emprestimosAtrasados > 0 ? 
            `<span class="badge badge-danger">${emprestimosAtrasados}</span>` : 
            '<span class="badge badge-success">0</span>'
          }
        </td>
        <td>
          <div class="actions">
            <button class="btn btn-sm btn-primary" onclick="clientesApp.viewCliente(${cliente.id})">
              <svg width="16" height="16" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"/>
              </svg>
            </button>
            <button class="btn btn-sm btn-secondary" onclick="clientesApp.editCliente(${cliente.id})">
              <svg width="16" height="16" fill="currentColor" viewBox="0 0 24 24">
                <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/>
              </svg>
            </button>
            <button class="btn btn-sm btn-danger" onclick="clientesApp.deleteCliente(${cliente.id})">
              <svg width="16" height="16" fill="currentColor" viewBox="0 0 24 24">
                <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/>
              </svg>
            </button>
          </div>
        </td>
      </tr>
    `;
  },

  renderClientesTable(clientes) {
    if (clientesTableBody) {
      if (clientes.length === 0) {
        clientesTableBody.innerHTML = `
          <tr>
            <td colspan="6" class="text-center text-gray-500">
              Nenhum cliente encontrado
            </td>
          </tr>
        `;
        return;
      }

      clientesTableBody.innerHTML = clientes.map(cliente => 
        this.renderClienteRow(cliente)
      ).join('');
    }
  },

  renderClienteForm(cliente = null) {
    const isEdit = cliente !== null;
    const title = isEdit ? 'Editar Cliente' : 'Novo Cliente';
    
    const formContent = `
      <form id="cliente-form" class="form">
        <div class="form-group">
          <label for="name" class="form-label">Nome *</label>
          <input type="text" id="name" name="name" class="form-input" 
                 value="${cliente?.name || ''}" required>
        </div>
        
        <div class="form-group">
          <label for="email" class="form-label">Email</label>
          <input type="email" id="email" name="email" class="form-input" 
                 value="${cliente?.email || ''}">
        </div>
        
        <div class="form-group">
          <label for="phone" class="form-label">Telefone</label>
          <input type="text" id="phone" name="phone" class="form-input" 
                 value="${cliente?.phone || ''}">
        </div>
        
        <div class="form-group">
          <label for="cpf_cnpj" class="form-label">CPF/CNPJ</label>
          <input type="text" id="cpf_cnpj" name="cpf_cnpj" class="form-input" 
                 value="${cliente?.cpf_cnpj || ''}">
        </div>
        
        <div class="form-group">
          <label for="address" class="form-label">Endereço</label>
          <textarea id="address" name="address" class="form-input" rows="3">${cliente?.address || ''}</textarea>
        </div>
        
        <div class="form-actions">
          <button type="button" class="btn btn-secondary" onclick="this.closest('.modal').remove()">
            Cancelar
          </button>
          <button type="submit" class="btn btn-primary">
            ${isEdit ? 'Atualizar' : 'Cadastrar'}
          </button>
        </div>
      </form>
    `;

    const { modal } = utils.showModal(formContent, title);
    
    // Adicionar evento de submit
    const form = modal.querySelector('#cliente-form');
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const formData = new FormData(form);
      const clienteData = Object.fromEntries(formData.entries());
      
      if (isEdit) {
        clientesApp.updateCliente(cliente.id, clienteData);
      } else {
        clientesApp.createCliente(clienteData);
      }
    });
  },

  renderClienteDetails(cliente) {
    const detailsContent = `
      <div class="cliente-details">
        <div class="detail-row">
          <strong>Nome:</strong> ${cliente.name}
        </div>
        <div class="detail-row">
          <strong>Email:</strong> ${cliente.email || 'N/A'}
        </div>
        <div class="detail-row">
          <strong>Telefone:</strong> ${cliente.phone || 'N/A'}
        </div>
        <div class="detail-row">
          <strong>CPF/CNPJ:</strong> ${cliente.cpf_cnpj || 'N/A'}
        </div>
        <div class="detail-row">
          <strong>Endereço:</strong> ${cliente.address || 'N/A'}
        </div>
        <div class="detail-row">
          <strong>Data de Cadastro:</strong> ${utils.formatDate(cliente.created_at)}
        </div>
        
        ${cliente.emprestimos && cliente.emprestimos.length > 0 ? `
          <div class="emprestimos-section">
            <h4>Empréstimos</h4>
            <div class="emprestimos-list">
              ${cliente.emprestimos.map(emp => `
                <div class="emprestimo-item">
                  <div class="emprestimo-header">
                    <span class="emprestimo-id">#${emp.id}</span>
                    <span class="badge badge-${emp.status === 'active' ? 'success' : emp.status === 'overdue' ? 'danger' : 'secondary'}">
                      ${emp.status}
                    </span>
                  </div>
                  <div class="emprestimo-details">
                    <div>Valor: ${utils.formatCurrency(emp.amount)}</div>
                    <div>Vencimento: ${utils.formatDate(emp.due_date)}</div>
                    <div>Restante: ${utils.formatCurrency(emp.valor_restante)}</div>
                  </div>
                </div>
              `).join('')}
            </div>
          </div>
        ` : ''}
      </div>
    `;

    utils.showModal(detailsContent, `Detalhes do Cliente - ${cliente.name}`);
  }
};

// Aplicação principal
const clientesApp = {
  async init() {
    this.bindEvents();
    await this.loadClientes();
  },

  bindEvents() {
    if (addClienteBtn) {
      addClienteBtn.addEventListener('click', () => {
        ui.renderClienteForm();
      });
    }

    if (searchInput) {
      searchInput.addEventListener('input', utils.debounce((e) => {
        this.searchClientes(e.target.value);
      }, 300));
    }
  },

  async loadClientes() {
    try {
      ui.showLoading();
      clientes = await apiService.getClientes();
      this.renderClientes();
      this.updateStats();
    } catch (error) {
      utils.showNotification('Erro ao carregar clientes', 'error');
      console.error('Erro ao carregar clientes:', error);
    }
  },

  renderClientes() {
    ui.renderClientesTable(clientes);
  },

  updateStats() {
    if (totalClientesSpan) {
      totalClientesSpan.textContent = clientes.length;
    }
  },

  async searchClientes(term) {
    if (!term.trim()) {
      await this.loadClientes();
      return;
    }

    try {
      ui.showLoading();
      const searchResults = await apiService.searchClientes(term);
      ui.renderClientesTable(searchResults);
    } catch (error) {
      utils.showNotification('Erro na busca', 'error');
      console.error('Erro na busca:', error);
    }
  },

  async createCliente(clienteData) {
    try {
      const newCliente = await apiService.createCliente(clienteData);
      clientes.unshift(newCliente);
      this.renderClientes();
      this.updateStats();
      utils.showNotification('Cliente cadastrado com sucesso!');
      
      // Fechar modal
      document.querySelector('.modal').remove();
    } catch (error) {
      utils.showNotification(error.message || 'Erro ao cadastrar cliente', 'error');
    }
  },

  async updateCliente(id, clienteData) {
    try {
      const updatedCliente = await apiService.updateCliente(id, clienteData);
      const index = clientes.findIndex(c => c.id === id);
      if (index !== -1) {
        clientes[index] = updatedCliente;
        this.renderClientes();
      }
      utils.showNotification('Cliente atualizado com sucesso!');
      
      // Fechar modal
      document.querySelector('.modal').remove();
    } catch (error) {
      utils.showNotification(error.message || 'Erro ao atualizar cliente', 'error');
    }
  },

  async deleteCliente(id) {
    if (!confirm('Tem certeza que deseja deletar este cliente?')) {
      return;
    }

    try {
      await apiService.deleteCliente(id);
      clientes = clientes.filter(c => c.id !== id);
      this.renderClientes();
      this.updateStats();
      utils.showNotification('Cliente deletado com sucesso!');
    } catch (error) {
      utils.showNotification(error.message || 'Erro ao deletar cliente', 'error');
    }
  },

  async viewCliente(id) {
    try {
      const cliente = await apiService.getCliente(id);
      ui.renderClienteDetails(cliente);
    } catch (error) {
      utils.showNotification('Erro ao carregar detalhes do cliente', 'error');
    }
  },

  async editCliente(id) {
    try {
      const cliente = await apiService.getCliente(id);
      ui.renderClienteForm(cliente);
    } catch (error) {
      utils.showNotification('Erro ao carregar dados do cliente', 'error');
    }
  }
};

// Inicializar quando o DOM estiver pronto
document.addEventListener('DOMContentLoaded', () => {
  clientesApp.init();
});

// Expor para uso global
window.clientesApp = clientesApp; 