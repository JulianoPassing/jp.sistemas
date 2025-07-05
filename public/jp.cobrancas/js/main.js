// Configurações da API
const API_BASE_URL = '/api/cobrancas';

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
      appState.data.dashboard = data;
      
      this.updateDashboardCards(data);
      this.updateRecentEmprestimos(data.emprestimosRecentes || []);
      this.updateCobrancasPendentes(data.cobrancasPendentes || []);
      
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
      'clientes-atraso': data.cobrancas?.cobrancas_pendentes || 0
    };

    Object.entries(cards).forEach(([id, value]) => {
      const element = document.getElementById(id);
      if (element) {
        if (id === 'valor-receber') {
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
      const valor = new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL'
      }).format(emprestimo.valor || 0);
      
      const data = new Date(emprestimo.data_emprestimo).toLocaleDateString('pt-BR');
      
      const row = document.createElement('tr');
      row.innerHTML = `
        <td>${emprestimo.cliente_nome || 'N/A'}</td>
        <td>${valor}</td>
        <td>${data}</td>
        <td><span class="badge badge-${emprestimo.status === 'Ativo' ? 'success' : 'warning'}">${emprestimo.status}</span></td>
        <td>
          <button class="btn btn-primary btn-sm" onclick="emprestimoController.viewEmprestimo(${emprestimo.id})">Ver</button>
        </td>
      `;
      
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
      const valor = new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL'
      }).format(cobranca.valor_atualizado || 0);
      
      const vencimento = new Date(cobranca.data_vencimento).toLocaleDateString('pt-BR');
      const diasAtraso = cobranca.dias_atraso || 0;
      const statusClass = diasAtraso > 30 ? 'danger' : diasAtraso > 7 ? 'warning' : 'info';
      
      const row = document.createElement('tr');
      row.innerHTML = `
        <td>${cobranca.cliente_nome || 'N/A'}</td>
        <td>${valor}</td>
        <td>${vencimento}</td>
        <td>${diasAtraso > 0 ? `${diasAtraso} dias` : 'No prazo'}</td>
        <td><span class="badge badge-${statusClass}">${cobranca.status}</span></td>
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
      
      // Após carregar os dados do dashboard, se estiver na página de cobranças, renderizar os cards estruturados
      const path = window.location.pathname;
      if (path.includes('cobrancas.html')) {
        document.addEventListener('DOMContentLoaded', () => {
          apiService.getCobrancas().then(lista => {
            renderCobrancasResumo(lista, 'cobrancas-pendentes');
            renderCobrancasResumo(lista, 'valor-receber'); // Se quiser separar, filtre as listas
          });
        });
      }
      
      // Carregar lista de empréstimos se existir na página
      if (document.getElementById('emprestimos-lista')) {
        renderEmprestimosLista();
      }
      
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

// Controllers para ações específicas
const emprestimoController = {
  async viewEmprestimo(id) {
    try {
      const emprestimos = await apiService.getEmprestimos();
      const emp = emprestimos.find(e => String(e.id) === String(id));
      if (!emp) {
        ui.showNotification('Empréstimo não encontrado', 'error');
        return;
      }
      // Dados principais
      const statusBadge = emp.status === 'Ativo' ? '<span class="badge badge-success">Pendente</span>' : `<span class="badge badge-warning">${emp.status}</span>`;
      const nome = emp.cliente_nome || 'N/A';
      const numero = `PCL-Nº #${emp.id}`;
      const parcelaAtual = emp.parcela_atual || 1;
      const totalParcelas = emp.total_parcelas || 1;
      const parcelaInfo = `PARCELA ${parcelaAtual} DE ${totalParcelas}`;
      const valorInvestido = utils.formatCurrency(emp.valor || 0);
      const jurosReceber = utils.formatCurrency(emp.juros_a_receber || emp.juros_mensal || 0);
      const totalReceber = utils.formatCurrency(emp.valor_total || emp.valor || 0);
      const telefone = emp.telefone || emp.celular || emp.whatsapp || '';
      const vencimento = emp.data_vencimento ? utils.formatDate(emp.data_vencimento) : '-';
      const afiliado = emp.afiliado_nome || 'Nenhum afiliado informado';
      const multa = emp.multa_atraso ? utils.formatCurrency(emp.multa_atraso) : '-';
      const pix = emp.chave_pix || 'CHAVE';
      // Mensagem WhatsApp
      const msgWhatsapp = encodeURIComponent(
        `Bom dia ${nome}, hoje é a data de pagamento da sua parcela ${parcelaAtual} de ${totalParcelas}. Valor total da dívida: ${totalReceber}\nConta para Depósito: Chave PIX: ${pix}\nObservação: O não pagamento resultará em uma multa de ${multa} por dia.`
      );
      const linkWhatsapp = telefone ? `https://wa.me/55${telefone.replace(/\D/g,'')}?text=${msgWhatsapp}` : '#';
      // Modal HTML
      const detalhes = `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
          ${statusBadge}
          <button class="btn btn-secondary" id="modal-editar-emprestimo">Editar</button>
        </div>
        <h2 style="margin: 1rem 0 0.2rem 0;">${nome}</h2>
        <div style="font-weight: bold; color: #444;">${numero} (${parcelaAtual}ª parcela)</div>
        <div class="modal-emprestimo-info">
          <div class="info-row"><span>Deve ser pago em</span><span>${vencimento}</span></div>
          <div class="info-row"><span>Valor Investido</span><span>${valorInvestido}</span></div>
          <div class="info-row"><span>Juros a Receber</span><span>${jurosReceber}</span></div>
        </div>
        <div style="margin: 0.5rem 0; text-align: right;"><a href="#" id="modal-ver-parcelas">Ver todas as parcelas &gt;</a></div>
        <h3>Detalhes</h3>
        <div class="info-row"><span>Celular/Whatsapp</span><span>${telefone ? `<a href=\"https://wa.me/55${telefone.replace(/\D/g,'')}\" target=\"_blank\">${telefone}</a>` : '-'}</span></div>
        <h3>Afiliado</h3>
        <div class="info-row">${afiliado}</div>
        <div style="margin: 1rem 0; text-align: center; font-weight: bold;">${parcelaInfo}<br>Total a Receber: <span style="font-size: 1.3em; color: #222;">${totalReceber}</span></div>
        <div style="display: flex; flex-direction: column; gap: 0.5rem;">
          <a class="btn" style="background: #25d366; color: #fff;" id="modal-notificar" href="${linkWhatsapp}" target="_blank" rel="noopener noreferrer">Notificar <b>WhatsApp</b></a>
          <div style="display: flex; gap: 0.5rem; flex-wrap: wrap;">
            <button class="btn" style="background: #6fffd6; color: #222; flex:1;" id="modal-btn-quitado" type="button">Quitado</button>
            <button class="btn" style="background: #5b4fff; color: #fff; flex:1;" id="modal-btn-sojuros" type="button">Só Juros</button>
          </div>
          <div style="display: flex; gap: 0.5rem; flex-wrap: wrap;">
            <button class="btn" style="background: #ff3b3b; color: #fff; flex:1;" id="modal-btn-naopagou" type="button">Não Pagou</button>
          </div>
          <button class="btn" style="background: #ff2222; color: #fff;" id="modal-btn-remover" type="button">REMOVER</button>
        </div>
      `;
      const modal = ui.showModal(detalhes, 'Detalhes do Empréstimo');
      // Corrigir comportamento do botão WhatsApp para nunca recarregar
      const btnWhats = modal.querySelector('#modal-notificar');
      btnWhats.addEventListener('click', (e) => {
        e.stopPropagation();
        // Não faz nada além de abrir o link
      });
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
      modal.querySelector('#modal-btn-sojuros').onclick = (e) => {
        e.preventDefault();
        // Apenas envia mensagem de cobrança dos juros
        if (!telefone) {
          ui.showNotification('Sem telefone para cobrança!', 'error');
          return;
        }
        const msg = encodeURIComponent(`Olá ${nome}, você pode pagar apenas os juros deste mês: ${jurosReceber}`);
        window.open(`https://wa.me/55${telefone.replace(/\D/g,'')}?text=${msg}`, '_blank');
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
      ui.showNotification('Erro ao buscar empréstimo', 'error');
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

// Função para renderizar a lista de empréstimos
async function renderEmprestimosLista() {
  const tbody = document.getElementById('emprestimos-lista');
  if (!tbody) return;
  tbody.innerHTML = '<tr><td colspan="7">Carregando...</td></tr>';
  try {
    const emprestimos = await apiService.getEmprestimos();
    if (!emprestimos || emprestimos.length === 0) {
      tbody.innerHTML = '<tr><td colspan="7" class="text-center text-gray-500">Nenhum empréstimo encontrado</td></tr>';
      return;
    }
    tbody.innerHTML = '';
    emprestimos.forEach(emprestimo => {
      const valor = utils.formatCurrency(emprestimo.valor || 0);
      const parcelas = emprestimo.parcelas || '-';
      const data = emprestimo.data_emprestimo ? utils.formatDate(emprestimo.data_emprestimo) : '-';
      const vencimento = emprestimo.data_vencimento ? utils.formatDate(emprestimo.data_vencimento) : '-';
      // Badge de status
      let badge = '';
      const status = (emprestimo.status || '').toLowerCase();
      if (status === 'quitado') {
        badge = '<span class="badge" style="background:#10b981;color:#fff;">Quitado</span>';
      } else if (status === 'em atraso' || status === 'atrasado') {
        badge = '<span class="badge" style="background:#ef4444;color:#fff;">Em Atraso</span>';
      } else if (status === 'ativo' || status === 'pendente') {
        badge = '<span class="badge" style="background:#6366f1;color:#fff;">Pendente</span>';
      } else {
        badge = `<span class="badge" style="background:#888;color:#fff;">${emprestimo.status || '-'}</span>`;
      }
      tbody.innerHTML += `
        <tr>
          <td>${emprestimo.cliente_nome || 'N/A'}</td>
          <td>${valor}</td>
          <td>${parcelas}</td>
          <td>${data}</td>
          <td>${vencimento}</td>
          <td>${badge}</td>
          <td><button class="btn btn-primary btn-sm" onclick="emprestimoController.viewEmprestimo(${emprestimo.id})">Ver</button></td>
        </tr>
      `;
    });
  } catch (err) {
    tbody.innerHTML = '<tr><td colspan="7" class="text-center text-red-500">Erro ao carregar empréstimos</td></tr>';
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
      const clienteOptions = clientes.map(c => `<option value=\"${c.id}\">${c.nome || c.name}</option>`).join('');
      const modalContent = `
        <form id=\"modal-emprestimo-form\">
          <div class=\"form-group\">
            <label>Cliente (selecione ou preencha manualmente)</label>
            <select name=\"clienteId\" id=\"modal-cliente-select\" class=\"form-input\">
              <option value=\"\">Novo cliente (preencher abaixo)</option>
              ${clienteOptions}
            </select>
          </div>
          <div class=\"form-group\">
            <label>Nome *</label>
            <input type=\"text\" name=\"nome\" id=\"modal-nome\" class=\"form-input\" required placeholder=\"Nome do cliente\">
          </div>
          <div class=\"form-group\">
            <label>CPF (Opcional)</label>
            <input type=\"text\" name=\"cpf\" id=\"modal-cpf\" class=\"form-input\" placeholder=\"CPF do cliente\">
          </div>
          <div class=\"form-group\">
            <label>Telefone</label>
            <input type=\"text\" name=\"telefone\" id=\"modal-telefone\" class=\"form-input\" placeholder=\"Telefone do cliente\">
          </div>
          <div class=\"form-group\">
            <label>Tipo de Empréstimo</label>
            <select name=\"tipo\" class=\"form-input\">
              <option value=\"fixo\">Fixo</option>
              <option value=\"parcelado\">Parcelado</option>
            </select>
          </div>
          <div class=\"form-group\">
            <label>Valor (R$)</label>
            <input type=\"number\" name=\"valor\" class=\"form-input\" step=\"0.01\" min=\"0\" required placeholder=\"ex.: 1000\">
          </div>
          <div class=\"form-group\">
            <label>Porcentagem de Juros (%)</label>
            <input type=\"number\" name=\"porcentagem\" class=\"form-input\" step=\"0.01\" min=\"0\" required placeholder=\"ex.: 20\">
          </div>
          <div class=\"form-group\">
            <label>Multa por Atraso (%)</label>
            <input type=\"number\" name=\"multa\" class=\"form-input\" step=\"0.01\" min=\"0\" required placeholder=\"ex.: 2\">
          </div>
          <div class=\"form-group\">
            <label>Data de Pagamento</label>
            <input type=\"date\" name=\"dataPagamento\" class=\"form-input\" required>
          </div>
          <div class=\"form-group\">
            <label>Data de Vencimento</label>
            <input type=\"date\" name=\"dataVencimento\" class=\"form-input\" required>
          </div>
          <div class=\"form-group\">
            <label>Frequência</label>
            <select name=\"frequencia\" class=\"form-input\">
              <option value=\"mensal\">Mensal</option>
              <option value=\"diario\">Diário</option>
              <option value=\"semanal\">Semanal</option>
              <option value=\"quinzenal\">Quinzenal</option>
            </select>
          </div>
          <div class=\"form-group\">
            <label>Observações (opcional)</label>
            <textarea name=\"observacoes\" class=\"form-input\" rows=\"2\"></textarea>
          </div>
          <div class=\"form-group\">
            <button type=\"submit\" class=\"btn btn-primary\">Adicionar Empréstimo</button>
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
          nomeInput.value = cliente?.nome || cliente?.name || '';
          cpfInput.value = cliente?.cpf || cliente?.cpf_cnpj || '';
          telefoneInput.value = cliente?.telefone || cliente?.phone || '';
        }
      });
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const formData = Object.fromEntries(new FormData(form).entries());
        let cliente_id = formData.clienteId;
        // Se não selecionou cliente, criar cliente
        if (!cliente_id) {
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
          } catch (err) {
            ui.showNotification('Erro ao criar cliente', 'error');
            return;
          }
        }
        // Montar payload do empréstimo
        const payload = {
          cliente_id,
          valor: formData.valor,
          data_emprestimo: formData.dataPagamento,
          data_vencimento: formData.dataPagamento, // agora igual a data de pagamento
          juros_mensal: formData.porcentagem,
          multa_atraso: formData.multa,
          observacoes: formData.observacoes || ''
        };
        try {
          await apiService.createEmprestimo(payload);
          ui.showNotification('Empréstimo adicionado com sucesso!', 'success');
          modal.remove();
          // Atualizar lista sem reload
          if (document.getElementById('emprestimos-lista')) {
            renderEmprestimosLista();
          }
        } catch (err) {
          ui.showNotification('Erro ao adicionar empréstimo', 'error');
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
window.ui = ui;
window.utils = utils;

// Adicionar função para renderizar cobranças pendentes e valor a receber de forma estruturada
function renderCobrancasResumo(lista, targetId) {
  const target = document.getElementById(targetId);
  if (!target) return;
  if (!lista || lista.length === 0) {
    target.innerHTML = '<span class="text-gray-500">Nenhuma cobrança</span>';
    return;
  }
  target.innerHTML = lista.map(cobranca => `
    <div class="cobranca-item">
      <span class="cobranca-nome">${cobranca.cliente_nome || 'N/A'}</span>
      <span class="cobranca-valor">${utils.formatCurrency(cobranca.valor_atualizado || cobranca.valor || 0)}</span>
      <span class="cobranca-data">${cobranca.data_vencimento ? utils.formatDate(cobranca.data_vencimento) : ''}</span>
      <span class="cobranca-status">${cobranca.dias_atraso > 0 ? cobranca.dias_atraso + ' dias de atraso' : 'No prazo'}</span>
    </div>
  `).join('');
} 