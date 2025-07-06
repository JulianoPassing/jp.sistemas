// Funções utilitárias para o sistema de caixa

// Mostrar notificação
function mostrarNotificacao(mensagem, tipo = 'info') {
  // Remover notificações existentes
  const notificacoesExistentes = document.querySelectorAll('.notification');
  notificacoesExistentes.forEach(notif => notif.remove());

  // Criar nova notificação
  const notificacao = document.createElement('div');
  notificacao.className = `notification notification-${tipo}`;
  notificacao.style.transform = 'translateX(100%)';
  
  notificacao.innerHTML = `
    <div class="notification-content">
      <i class="fas ${getIconeNotificacao(tipo)}"></i>
      <span>${mensagem}</span>
    </div>
    <button class="notification-close" onclick="this.parentElement.remove()">&times;</button>
  `;

  document.body.appendChild(notificacao);

  // Animar entrada
  setTimeout(() => {
    notificacao.style.transform = 'translateX(0)';
  }, 100);

  // Auto-remover após 5 segundos
  setTimeout(() => {
    if (notificacao.parentElement) {
      notificacao.style.transform = 'translateX(100%)';
      setTimeout(() => {
        if (notificacao.parentElement) {
          notificacao.remove();
        }
      }, 300);
    }
  }, 5000);
}

// Obter ícone da notificação
function getIconeNotificacao(tipo) {
  const icones = {
    'success': 'fa-check-circle',
    'error': 'fa-exclamation-circle',
    'warning': 'fa-exclamation-triangle',
    'info': 'fa-info-circle'
  };
  return icones[tipo] || icones.info;
}

// Formatar moeda
function formatarMoeda(valor) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  }).format(valor);
}

// Formatar data
function formatarData(data) {
  return new Date(data).toLocaleDateString('pt-BR');
}

// Formatar data e hora
function formatarDataHora(data) {
  return new Date(data).toLocaleString('pt-BR');
}

// Validar CPF
function validarCPF(cpf) {
  cpf = cpf.replace(/[^\d]/g, '');
  
  if (cpf.length !== 11) return false;
  
  // Verificar se todos os dígitos são iguais
  if (/^(\d)\1{10}$/.test(cpf)) return false;
  
  // Validar primeiro dígito verificador
  let soma = 0;
  for (let i = 0; i < 9; i++) {
    soma += parseInt(cpf.charAt(i)) * (10 - i);
  }
  let resto = 11 - (soma % 11);
  let digito1 = resto < 2 ? 0 : resto;
  
  // Validar segundo dígito verificador
  soma = 0;
  for (let i = 0; i < 10; i++) {
    soma += parseInt(cpf.charAt(i)) * (11 - i);
  }
  resto = 11 - (soma % 11);
  let digito2 = resto < 2 ? 0 : resto;
  
  return cpf.charAt(9) === digito1.toString() && cpf.charAt(10) === digito2.toString();
}

// Validar email
function validarEmail(email) {
  const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return regex.test(email);
}

// Validar telefone
function validarTelefone(telefone) {
  const regex = /^\(?[1-9]{2}\)? ?(?:[2-8]|9[1-9])[0-9]{3}\-?[0-9]{4}$/;
  return regex.test(telefone);
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

// Gerar ID único
function gerarId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

// Copiar para clipboard
async function copiarParaClipboard(texto) {
  try {
    await navigator.clipboard.writeText(texto);
    mostrarNotificacao('Copiado para a área de transferência', 'success');
  } catch (err) {
    // Fallback para navegadores mais antigos
    const textArea = document.createElement('textarea');
    textArea.value = texto;
    document.body.appendChild(textArea);
    textArea.select();
    document.execCommand('copy');
    document.body.removeChild(textArea);
    mostrarNotificacao('Copiado para a área de transferência', 'success');
  }
}

// Download de arquivo
function downloadArquivo(conteudo, nomeArquivo, tipo = 'text/plain') {
  const blob = new Blob([conteudo], { type: tipo });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = nomeArquivo;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

// Calcular idade
function calcularIdade(dataNascimento) {
  const hoje = new Date();
  const nascimento = new Date(dataNascimento);
  let idade = hoje.getFullYear() - nascimento.getFullYear();
  const mes = hoje.getMonth() - nascimento.getMonth();
  
  if (mes < 0 || (mes === 0 && hoje.getDate() < nascimento.getDate())) {
    idade--;
  }
  
  return idade;
}

// Formatar CPF
function formatarCPF(cpf) {
  cpf = cpf.replace(/\D/g, '');
  return cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
}

// Formatar telefone
function formatarTelefone(telefone) {
  telefone = telefone.replace(/\D/g, '');
  if (telefone.length === 11) {
    return telefone.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3');
  } else if (telefone.length === 10) {
    return telefone.replace(/(\d{2})(\d{4})(\d{4})/, '($1) $2-$3');
  }
  return telefone;
}

// Formatar CEP
function formatarCEP(cep) {
  cep = cep.replace(/\D/g, '');
  return cep.replace(/(\d{5})(\d{3})/, '$1-$2');
}

// Máscara de input
function aplicarMascara(input, mascara) {
  let valor = input.value.replace(/\D/g, '');
  let resultado = '';
  let posicao = 0;
  
  for (let i = 0; i < mascara.length && posicao < valor.length; i++) {
    if (mascara[i] === '#') {
      resultado += valor[posicao];
      posicao++;
    } else {
      resultado += mascara[i];
    }
  }
  
  input.value = resultado;
}

// Verificar se é mobile
function isMobile() {
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
}

// Verificar se está online
function isOnline() {
  return navigator.onLine;
}

// Salvar no localStorage
function salvarLocalStorage(chave, valor) {
  try {
    localStorage.setItem(chave, JSON.stringify(valor));
  } catch (error) {
    console.error('Erro ao salvar no localStorage:', error);
  }
}

// Carregar do localStorage
function carregarLocalStorage(chave) {
  try {
    const item = localStorage.getItem(chave);
    return item ? JSON.parse(item) : null;
  } catch (error) {
    console.error('Erro ao carregar do localStorage:', error);
    return null;
  }
}

// Remover do localStorage
function removerLocalStorage(chave) {
  try {
    localStorage.removeItem(chave);
  } catch (error) {
    console.error('Erro ao remover do localStorage:', error);
  }
}

// Limpar localStorage
function limparLocalStorage() {
  try {
    localStorage.clear();
  } catch (error) {
    console.error('Erro ao limpar localStorage:', error);
  }
}

// Fazer requisição HTTP
async function fazerRequisicao(url, opcoes = {}) {
  const config = {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include',
    ...opcoes
  };

  try {
    const response = await fetch(url, config);
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      return await response.json();
    } else {
      return await response.text();
    }
  } catch (error) {
    console.error('Erro na requisição:', error);
    throw error;
  }
}

// Verificar permissões
function verificarPermissoes() {
  if (sessionStorage.getItem('loggedIn') !== 'true') {
    window.location.href = 'login.html';
    return false;
  }
  return true;
}

// Logout
function logout() {
  sessionStorage.removeItem('loggedIn');
  sessionStorage.removeItem('username');
  sessionStorage.removeItem('loginTime');
  window.location.href = 'login.html';
}

// Atualizar data/hora
function atualizarDataHora() {
  const agora = new Date();
  const opcoes = {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  };
  
  return agora.toLocaleDateString('pt-BR', opcoes);
}

// Calcular diferença entre datas
function calcularDiferencaDatas(data1, data2) {
  const diffTime = Math.abs(data2 - data1);
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays;
}

// Formatar duração
function formatarDuracao(minutos) {
  const horas = Math.floor(minutos / 60);
  const mins = minutos % 60;
  
  if (horas > 0) {
    return `${horas}h ${mins}min`;
  } else {
    return `${mins}min`;
  }
}

// Verificar se string é numérica
function isNumeric(str) {
  return !isNaN(str) && !isNaN(parseFloat(str));
}

// Capitalizar primeira letra
function capitalizar(str) {
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}

// Capitalizar todas as palavras
function capitalizarPalavras(str) {
  return str.replace(/\w\S*/g, function(txt) {
    return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase();
  });
}

// Remover acentos
function removerAcentos(str) {
  return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

// Gerar senha aleatória
function gerarSenhaAleatoria(tamanho = 8) {
  const caracteres = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
  let senha = '';
  
  for (let i = 0; i < tamanho; i++) {
    senha += caracteres.charAt(Math.floor(Math.random() * caracteres.length));
  }
  
  return senha;
}

// Verificar força da senha
function verificarForcaSenha(senha) {
  let forca = 0;
  
  if (senha.length >= 8) forca++;
  if (/[a-z]/.test(senha)) forca++;
  if (/[A-Z]/.test(senha)) forca++;
  if (/[0-9]/.test(senha)) forca++;
  if (/[^A-Za-z0-9]/.test(senha)) forca++;
  
  if (forca <= 2) return 'fraca';
  if (forca <= 3) return 'média';
  if (forca <= 4) return 'forte';
  return 'muito forte';
}

// Exportar funções para uso global
window.mostrarNotificacao = mostrarNotificacao;
window.formatarMoeda = formatarMoeda;
window.formatarData = formatarData;
window.formatarDataHora = formatarDataHora;
window.validarCPF = validarCPF;
window.validarEmail = validarEmail;
window.validarTelefone = validarTelefone;
window.debounce = debounce;
window.throttle = throttle;
window.gerarId = gerarId;
window.copiarParaClipboard = copiarParaClipboard;
window.downloadArquivo = downloadArquivo;
window.calcularIdade = calcularIdade;
window.formatarCPF = formatarCPF;
window.formatarTelefone = formatarTelefone;
window.formatarCEP = formatarCEP;
window.aplicarMascara = aplicarMascara;
window.isMobile = isMobile;
window.isOnline = isOnline;
window.salvarLocalStorage = salvarLocalStorage;
window.carregarLocalStorage = carregarLocalStorage;
window.removerLocalStorage = removerLocalStorage;
window.limparLocalStorage = limparLocalStorage;
window.fazerRequisicao = fazerRequisicao;
window.verificarPermissoes = verificarPermissoes;
window.logout = logout;
window.atualizarDataHora = atualizarDataHora;
window.calcularDiferencaDatas = calcularDiferencaDatas;
window.formatarDuracao = formatarDuracao;
window.isNumeric = isNumeric;
window.capitalizar = capitalizar;
window.capitalizarPalavras = capitalizarPalavras;
window.removerAcentos = removerAcentos;
window.gerarSenhaAleatoria = gerarSenhaAleatoria;
window.verificarForcaSenha = verificarForcaSenha; 