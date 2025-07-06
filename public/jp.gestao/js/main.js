// Funções utilitárias para o sistema JP Gestão

// Verificar autenticação
function checkAuth() {
    if (sessionStorage.getItem('loggedIn') !== 'true') {
        window.location.href = 'login.html';
        return false;
    }
    return true;
}

// Função de logout
function sair() {
    sessionStorage.clear();
    window.location.href = 'login.html';
}

// Formatar moeda
function formatCurrency(value) {
    return new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL'
    }).format(value || 0);
}

// Formatar data
function formatDate(date) {
    if (!date) return '';
    return new Date(date).toLocaleDateString('pt-BR');
}

// Formatar data e hora
function formatDateTime(date) {
    if (!date) return '';
    return new Date(date).toLocaleString('pt-BR');
}

// Mostrar notificação
function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.innerHTML = `
        <div class="notification-content">
            <span>${message}</span>
            <button class="notification-close" onclick="this.parentElement.parentElement.remove()">
                <i class="fas fa-times"></i>
            </button>
        </div>
    `;
    
    document.body.appendChild(notification);
    
    // Remover automaticamente após 5 segundos
    setTimeout(() => {
        if (notification.parentElement) {
            notification.remove();
        }
    }, 5000);
}

// Mostrar modal
function showModal(title, content) {
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.style.display = 'block';
    modal.innerHTML = `
        <div class="modal-overlay"></div>
        <div class="modal-content">
            <div class="modal-header">
                <h3>${title}</h3>
                <button class="modal-close" onclick="closeModal(this)">
                    <i class="fas fa-times"></i>
                </button>
            </div>
            <div class="modal-body">
                ${content}
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    // Fechar ao clicar fora
    modal.addEventListener('click', function(e) {
        if (e.target === modal) {
            closeModal(modal.querySelector('.modal-close'));
        }
    });
}

// Fechar modal
function closeModal(button) {
    const modal = button.closest('.modal');
    if (modal) {
        modal.remove();
    }
}

// Confirmar ação
function confirmAction(message, callback) {
    const content = `
        <p>${message}</p>
        <div style="display: flex; gap: 1rem; justify-content: flex-end; margin-top: 1rem;">
            <button class="btn btn-secondary" onclick="closeModal(this)">Cancelar</button>
            <button class="btn btn-danger" onclick="executeConfirmAction(this, ${callback})">Confirmar</button>
        </div>
    `;
    showModal('Confirmar Ação', content);
}

// Executar ação confirmada
function executeConfirmAction(button, callback) {
    closeModal(button);
    if (typeof callback === 'function') {
        callback();
    }
}

// Fazer requisição HTTP
async function apiRequest(url, options = {}) {
    try {
        const response = await fetch(url, {
            headers: {
                'Content-Type': 'application/json',
                ...options.headers
            },
            ...options
        });
        
        const data = await response.json();
        
        if (!response.ok) {
            throw new Error(data.message || 'Erro na requisição');
        }
        
        return data;
    } catch (error) {
        console.error('Erro na requisição:', error);
        showNotification(error.message, 'error');
        throw error;
    }
}

// Carregar dados de uma tabela
async function loadTableData(url, tableId, columns, actions = null) {
    try {
        const data = await apiRequest(url);
        const tbody = document.getElementById(tableId);
        
        if (data.length === 0) {
            tbody.innerHTML = `<tr><td colspan="${columns.length + (actions ? 1 : 0)}" class="text-center text-gray-500">Nenhum registro encontrado</td></tr>`;
            return;
        }
        
        tbody.innerHTML = data.map(item => {
            let row = '';
            columns.forEach(col => {
                if (col.type === 'currency') {
                    row += `<td>${formatCurrency(item[col.key])}</td>`;
                } else if (col.type === 'date') {
                    row += `<td>${formatDate(item[col.key])}</td>`;
                } else if (col.type === 'datetime') {
                    row += `<td>${formatDateTime(item[col.key])}</td>`;
                } else if (col.type === 'badge') {
                    const badgeClass = col.badgeClass ? col.badgeClass(item) : 'info';
                    row += `<td><span class="badge badge-${badgeClass}">${item[col.key]}</span></td>`;
                } else {
                    row += `<td>${item[col.key] || ''}</td>`;
                }
            });
            
            if (actions) {
                row += `<td>${actions(item)}</td>`;
            }
            
            return `<tr>${row}</tr>`;
        }).join('');
    } catch (error) {
        console.error('Erro ao carregar dados da tabela:', error);
        const tbody = document.getElementById(tableId);
        tbody.innerHTML = `<tr><td colspan="${columns.length + (actions ? 1 : 0)}" class="text-center text-gray-500">Erro ao carregar dados</td></tr>`;
    }
}

// Buscar dados
function searchData(searchTerm, data, fields) {
    if (!searchTerm) return data;
    
    const term = searchTerm.toLowerCase();
    return data.filter(item => {
        return fields.some(field => {
            const value = item[field];
            return value && value.toString().toLowerCase().includes(term);
        });
    });
}

// Filtrar dados
function filterData(data, filters) {
    return data.filter(item => {
        return Object.keys(filters).every(key => {
            const filterValue = filters[key];
            const itemValue = item[key];
            
            if (!filterValue) return true;
            
            if (typeof filterValue === 'string') {
                return itemValue && itemValue.toString().toLowerCase().includes(filterValue.toLowerCase());
            }
            
            return itemValue === filterValue;
        });
    });
}

// Ordenar dados
function sortData(data, field, direction = 'asc') {
    return data.sort((a, b) => {
        let aVal = a[field];
        let bVal = b[field];
        
        // Converter para número se possível
        if (!isNaN(aVal) && !isNaN(bVal)) {
            aVal = parseFloat(aVal);
            bVal = parseFloat(bVal);
        } else {
            aVal = aVal ? aVal.toString().toLowerCase() : '';
            bVal = bVal ? bVal.toString().toLowerCase() : '';
        }
        
        if (direction === 'asc') {
            return aVal > bVal ? 1 : aVal < bVal ? -1 : 0;
        } else {
            return aVal < bVal ? 1 : aVal > bVal ? -1 : 0;
        }
    });
}

// Paginar dados
function paginateData(data, page, perPage) {
    const start = (page - 1) * perPage;
    const end = start + perPage;
    return {
        data: data.slice(start, end),
        total: data.length,
        pages: Math.ceil(data.length / perPage),
        currentPage: page
    };
}

// Exportar dados para CSV
function exportToCSV(data, filename) {
    if (data.length === 0) {
        showNotification('Nenhum dado para exportar', 'warning');
        return;
    }
    
    const headers = Object.keys(data[0]);
    const csvContent = [
        headers.join(','),
        ...data.map(row => headers.map(header => `"${row[header] || ''}"`).join(','))
    ].join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    
    if (link.download !== undefined) {
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', `${filename}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }
}

// Validar formulário
function validateForm(formData, rules) {
    const errors = {};
    
    Object.keys(rules).forEach(field => {
        const value = formData[field];
        const fieldRules = rules[field];
        
        if (fieldRules.required && (!value || value.trim() === '')) {
            errors[field] = 'Este campo é obrigatório';
        } else if (value && fieldRules.minLength && value.length < fieldRules.minLength) {
            errors[field] = `Mínimo de ${fieldRules.minLength} caracteres`;
        } else if (value && fieldRules.maxLength && value.length > fieldRules.maxLength) {
            errors[field] = `Máximo de ${fieldRules.maxLength} caracteres`;
        } else if (value && fieldRules.pattern && !fieldRules.pattern.test(value)) {
            errors[field] = fieldRules.message || 'Formato inválido';
        }
    });
    
    return errors;
}

// Mostrar erros de validação
function showValidationErrors(errors) {
    Object.keys(errors).forEach(field => {
        const input = document.getElementById(field);
        if (input) {
            input.classList.add('error');
            const errorDiv = document.createElement('div');
            errorDiv.className = 'error-message';
            errorDiv.textContent = errors[field];
            input.parentNode.appendChild(errorDiv);
        }
    });
}

// Limpar erros de validação
function clearValidationErrors() {
    document.querySelectorAll('.error').forEach(input => {
        input.classList.remove('error');
    });
    document.querySelectorAll('.error-message').forEach(error => {
        error.remove();
    });
}

// Debounce function
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// Throttle function
function throttle(func, limit) {
    let inThrottle;
    return function() {
        const args = arguments;
        const context = this;
        if (!inThrottle) {
            func.apply(context, args);
            inThrottle = true;
            setTimeout(() => inThrottle = false, limit);
        }
    };
}

// Inicializar componentes comuns
function initCommonComponents() {
    // Menu mobile
    const menuBtn = document.getElementById('mobile-menu-toggle');
    const navWrapper = document.querySelector('.nav-wrapper');
    
    if (menuBtn && navWrapper) {
        menuBtn.addEventListener('click', function() {
            navWrapper.classList.toggle('open');
        });
    }
    
    // Fechar menu ao clicar em um link
    document.querySelectorAll('.nav-link').forEach(link => {
        link.addEventListener('click', function() {
            if (navWrapper) {
                navWrapper.classList.remove('open');
            }
        });
    });
    
    // Auto-hide notifications
    document.querySelectorAll('.notification').forEach(notification => {
        setTimeout(() => {
            if (notification.parentElement) {
                notification.remove();
            }
        }, 5000);
    });
}

// Executar quando o DOM estiver carregado
document.addEventListener('DOMContentLoaded', function() {
    initCommonComponents();
    
    // Verificar autenticação em todas as páginas exceto login
    if (!window.location.pathname.includes('login.html') && !window.location.pathname.includes('index.html')) {
        checkAuth();
    }
}); 