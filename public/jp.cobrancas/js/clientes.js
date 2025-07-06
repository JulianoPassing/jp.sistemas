// Estado da aplicação
let clientes = [];
let currentPage = 1;
const itemsPerPage = 10;

// Elementos DOM
const clientesTable = document.getElementById('clientes-table');
const clientesTableBody = document.getElementById('clientes-table-body');
const searchInput = document.getElementById('search-cliente');
const addClienteBtn = document.getElementById('addClienteBtn');
const totalClientesSpan = document.getElementById('total-clientes');

// API Service específico para clientes
const clientesApiService = {
  async getClientes() {
    return apiService.request('/clientes');
  },

  async getCliente(id) {
    return apiService.request(`/clientes/${id}`);
  },

  async createCliente(clienteData) {
    return apiService.request('/clientes', {
      method: 'POST',
      body: JSON.stringify(clienteData)
    });
  },

  async updateCliente(id, clienteData) {
    return apiService.request(`/clientes/${id}`, {
      method: 'PUT',
      body: JSON.stringify(clienteData)
    });
  },

  async deleteCliente(id) {
    return apiService.request(`/clientes/${id}`, {
      method: 'DELETE'
    });
  },

  async searchClientes(term) {
    return apiService.request(`/clientes/search/${term}`);
  }
};

// UI Components
const clientesUI = {
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

    // Fechar modal
    const closeModal = () => modal.remove();
    modal.querySelector('.modal-close').addEventListener('click', closeModal);
    modal.querySelector('.modal-overlay').addEventListener('click', closeModal);

    return modal;
  },

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

  renderClienteRow(cliente) {
    return `
      <tr data-id="${cliente.id}">
        <td>${cliente.razao || cliente.nome || cliente.name || 'N/A'}</td>
        <td>${cliente.cnpj || cliente.cpf || 'N/A'}</td>
        <td>${cliente.telefone || cliente.phone || 'N/A'}</td>
        <td>${cliente.email || 'N/A'}</td>
        <td>${(cliente.cidade || '') + (cliente.estado ? '/' + cliente.estado : '') || 'N/A'}</td>
        <td>
          <span class="badge badge-success">Ativo</span>
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
      clientesTableBody.innerHTML = '';
    }
    const clientesValidos = (clientes || []).filter(
      c =>
        c &&
        typeof c === 'object' &&
        (c.razao || c.nome || c.name) &&
        typeof (c.razao || c.nome || c.name) === 'string' &&
        !['', 'undefined', 'n/a', 'na', 'N/A', 'NA', null].includes((c.razao || c.nome || c.name).trim().toLowerCase())
    );
    if (clientesTableBody) {
      if (clientesValidos.length === 0) {
        clientesTableBody.innerHTML = `
          <tr>
            <td colspan="6" class="text-center text-gray-500">
              Nenhum cliente encontrado
            </td>
          </tr>
        `;
        return;
      }

      clientesTableBody.innerHTML = clientesValidos.map(cliente => 
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
          <label for="razao" class="form-label">Nome/Razão Social *</label>
          <input type="text" id="razao" name="razao" class="form-input" 
                 value="${cliente?.razao || cliente?.name || ''}" required>
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

    const modal = clientesUI.showModal(formContent, title);
    
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
          <strong>Nome:</strong> ${cliente.razao || cliente.name || 'N/A'}
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
          <strong>Data de Cadastro:</strong> ${new Date(cliente.created_at).toLocaleDateString('pt-BR')}
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
                    <div>Valor: ${new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(emp.amount)}</div>
                    <div>Vencimento: ${new Date(emp.due_date).toLocaleDateString('pt-BR')}</div>
                    <div>Restante: ${new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(emp.valor_restante)}</div>
                  </div>
                </div>
              `).join('')}
            </div>
          </div>
        ` : ''}
      </div>
    `;

    clientesUI.showModal(detailsContent, `Detalhes do Cliente - ${cliente.razao || cliente.name || 'N/A'}`);
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
        clientesUI.renderClienteForm();
      });
    }

    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        this.searchClientes(e.target.value);
      });
    }
  },

  async loadClientes() {
    try {
      clientesUI.showLoading();
      clientes = await clientesApiService.getClientes();
      this.renderClientes();
      this.updateStats();
    } catch (error) {
      clientesUI.showNotification('Erro ao carregar clientes', 'error');
      console.error('Erro ao carregar clientes:', error);
    }
  },

  renderClientes() {
    clientesUI.renderClientesTable(clientes);
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
      clientesUI.showLoading();
      const searchResults = await clientesApiService.searchClientes(term);
      clientesUI.renderClientesTable(searchResults);
    } catch (error) {
      clientesUI.showNotification('Erro na busca', 'error');
      console.error('Erro na busca:', error);
    }
  },

  async createCliente(clienteData) {
    // Validação: nome obrigatório
    if (!clienteData.razao || clienteData.razao.trim() === '' || clienteData.razao === 'undefined') {
      clientesUI.showNotification('Preencha o nome/razão social do cliente corretamente!', 'error');
      return;
    }
    try {
      const newCliente = await clientesApiService.createCliente(clienteData);
      clientes.unshift(newCliente);
      this.renderClientes();
      this.updateStats();
      clientesUI.showNotification('Cliente cadastrado com sucesso!');
      
      // Fechar modal
      document.querySelector('.modal').remove();
    } catch (error) {
      clientesUI.showNotification(error.message || 'Erro ao cadastrar cliente', 'error');
    }
  },

  async updateCliente(id, clienteData) {
    try {
      const updatedCliente = await clientesApiService.updateCliente(id, clienteData);
      const index = clientes.findIndex(c => c.id === id);
      if (index !== -1) {
        clientes[index] = updatedCliente;
        this.renderClientes();
      }
      clientesUI.showNotification('Cliente atualizado com sucesso!');
      
      // Fechar modal
      document.querySelector('.modal').remove();
    } catch (error) {
      clientesUI.showNotification(error.message || 'Erro ao atualizar cliente', 'error');
    }
  },

  async deleteCliente(id) {
    if (!confirm('Tem certeza que deseja deletar este cliente?')) {
      return;
    }

    try {
      await clientesApiService.deleteCliente(id);
      clientes = clientes.filter(c => c.id !== id);
      this.renderClientes();
      this.updateStats();
      clientesUI.showNotification('Cliente deletado com sucesso!');
    } catch (error) {
      // Mensagem personalizada para erro 400 (cliente com empréstimos)
      if (error.message && error.message.includes('vinculados')) {
        clientesUI.showNotification('Não é possível remover clientes que possuem empréstimos vinculados. Quite ou remova os empréstimos antes.', 'error');
      } else {
        clientesUI.showNotification(error.message || 'Erro ao deletar cliente', 'error');
      }
    }
  },

  async viewCliente(id) {
    try {
      const cliente = await clientesApiService.getCliente(id);
      clientesUI.renderClienteDetails(cliente);
    } catch (error) {
      clientesUI.showNotification('Erro ao carregar detalhes do cliente', 'error');
    }
  },

  async editCliente(id) {
    try {
      const cliente = await clientesApiService.getCliente(id);
      clientesUI.renderClienteForm(cliente);
    } catch (error) {
      clientesUI.showNotification('Erro ao carregar dados do cliente', 'error');
    }
  }
};

// Inicializar quando o DOM estiver pronto
document.addEventListener('DOMContentLoaded', () => {
  clientesApp.init();
});

// Expor para uso global
window.clientesApp = clientesApp;

// Função para exportar clientes para Excel
function exportarClientesParaExcel(clientes) {
  if (!window.XLSX) {
    clientesUI.showNotification('Biblioteca XLSX não carregada!', 'error');
    return;
  }
  const data = clientes.map(c => ({
    'Nome': c.razao || c.name || c.nome || '',
    'CPF': c.cpf_cnpj || c.cpf || '',
    'Telefone': c.phone || c.telefone || '',
    'E-mail': c.email || '',
    'Cidade': c.cidade || '',
    'Estado': c.estado || '',
    'Status': c.status || '',
    'Empréstimos Ativos': c.emprestimos_ativos || 0,
    'Empréstimos Atrasados': c.emprestimos_atrasados || 0
  }));
  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Clientes');
  XLSX.writeFile(wb, 'clientes.xlsx');
}

// Adicionar evento ao botão Exportar
window.addEventListener('DOMContentLoaded', () => {
  const btnExportar = document.querySelector('.btn-success, .btn-exportar, #btn-exportar');
  if (btnExportar) {
    btnExportar.addEventListener('click', async () => {
      let lista = clientes;
      if (!lista || lista.length === 0) {
        // Carregar clientes se não estiverem carregados
        lista = await clientesApiService.getClientes();
      }
      exportarClientesParaExcel(lista);
    });
  }
}); 