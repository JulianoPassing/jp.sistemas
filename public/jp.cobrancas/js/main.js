// Configurações da API
const API_BASE_URL = '/api';

// Filtros salvos (localStorage)
const FILTERS_KEY = 'jp-cobrancas-filters';
function saveFilters(page, filters) {
  try {
    const all = JSON.parse(localStorage.getItem(FILTERS_KEY) || '{}');
    all[page] = filters;
    localStorage.setItem(FILTERS_KEY, JSON.stringify(all));
  } catch (e) { console.warn('Erro ao salvar filtros:', e); }
}
function loadFilters(page) {
  try {
    const all = JSON.parse(localStorage.getItem(FILTERS_KEY) || '{}');
    return all[page] || {};
  } catch (e) { return {}; }
}

// Skeleton loading para tabelas
function getSkeletonRows(colspan, rows = 4) {
  let html = '';
  for (let i = 0; i < rows; i++) {
    html += `<tr><td colspan="${colspan}"><div class="table-skeleton"><div class="skeleton-row"><div class="skeleton"></div><div class="skeleton"></div><div class="skeleton"></div></div><div class="skeleton-row"><div class="skeleton"></div><div class="skeleton"></div><div class="skeleton"></div></div></div></td></tr>`;
  }
  return html;
}

// Estado global da aplicação
const appState = {
  isLoading: false,
  data: {
    dashboard: null,
    emprestimos: [],
    cobrancas: []
  },
  configuracoes: {
    chave_pix: null,
    msg_parcela: null,
    msg_emprestimo_com_juros: null,
    msg_emprestimo_sem_juros: null,
    msg_parcelas_vencidas: null
  }
};

// Função para carregar configurações do usuário
async function carregarConfiguracoesUsuario() {
  try {
    const response = await fetch(`${API_BASE_URL}/cobrancas/configuracoes`, {
      credentials: 'include'
    });
    if (response.ok) {
      const config = await response.json();
      appState.configuracoes = {
        chave_pix: config.chave_pix || null,
        msg_parcela: config.msg_parcela || null,
        msg_emprestimo_com_juros: config.msg_emprestimo_com_juros || null,
        msg_emprestimo_sem_juros: config.msg_emprestimo_sem_juros || null,
        msg_parcelas_vencidas: config.msg_parcelas_vencidas || null
      };
      console.log('Configurações carregadas:', appState.configuracoes);
    }
  } catch (error) {
    console.log('Usando configurações padrão:', error.message);
  }
}

// Função helper para gerar mensagem de cobrança com base nas configurações
function gerarMensagemCobranca(tipo, dados) {
  const config = appState.configuracoes;
  const chavePix = config.chave_pix || '(Chave PIX não configurada)';
  
  // Função para substituir variáveis na mensagem
  const substituirVariaveis = (msg, vars) => {
    let resultado = msg;
    for (const [chave, valor] of Object.entries(vars)) {
      resultado = resultado.split(chave).join(valor);
    }
    return resultado;
  };
  
  switch (tipo) {
    case 'parcela': {
      const variaveis = {
        '{nome}': dados.nome,
        '{parcela_atual}': dados.parcelaAtual,
        '{total_parcelas}': dados.totalParcelas,
        '{data_vencimento}': dados.dataVencimento,
        '{valor}': dados.valor,
        '{chave_pix}': chavePix
      };
      
      if (config.msg_parcela) {
        return substituirVariaveis(config.msg_parcela, variaveis);
      }
      
      // Mensagem padrão
      const infoParcela = dados.isParcelado ? ` (parcela ${dados.parcelaAtual}/${dados.totalParcelas})` : '';
      return `Olá, ${dados.nome}, a sua parcela${infoParcela} vence ${dados.dataVencimento}. Você pode pagar o valor de ${dados.valor}.

Chave PIX: ${chavePix}

Solicitamos o pagamento até a data de vencimento.`;
    }
    
    case 'emprestimo_com_juros': {
      const variaveis = {
        '{nome}': dados.nome,
        '{data_vencimento}': dados.dataVencimento,
        '{valor_investido}': dados.valorInvestido,
        '{juros_percent}': dados.jurosPercent,
        '{juros_total}': dados.jurosTotal,
        '{juros_diario}': dados.jurosDiario,
        '{dias_atraso}': dados.diasAtraso,
        '{juros_atraso}': dados.jurosAtraso,
        '{valor_total}': dados.valorTotal,
        '{chave_pix}': chavePix
      };
      
      if (config.msg_emprestimo_com_juros) {
        return substituirVariaveis(config.msg_emprestimo_com_juros, variaveis);
      }
      
      // Mensagem padrão (será construída no código existente)
      return null;
    }
    
    case 'emprestimo_sem_juros': {
      const variaveis = {
        '{nome}': dados.nome,
        '{data_vencimento}': dados.dataVencimento,
        '{valor_investido}': dados.valorInvestido,
        '{juros_percent}': dados.jurosPercent,
        '{juros_total}': dados.jurosTotal,
        '{valor_total}': dados.valorTotal,
        '{chave_pix}': chavePix
      };
      
      if (config.msg_emprestimo_sem_juros) {
        return substituirVariaveis(config.msg_emprestimo_sem_juros, variaveis);
      }
      
      // Mensagem padrão (será construída no código existente)
      return null;
    }
    
    case 'parcelas_vencidas': {
      const variaveis = {
        '{nome}': dados.nome,
        '{qtd_parcelas}': dados.qtdParcelas,
        '{lista_parcelas}': dados.listaParcelas,
        '{valor_total}': dados.valorTotal,
        '{chave_pix}': chavePix
      };
      
      if (config.msg_parcelas_vencidas) {
        return substituirVariaveis(config.msg_parcelas_vencidas, variaveis);
      }
      
      // Mensagem padrão (será construída no código existente)
      return null;
    }
    
    default:
      return null;
  }
}

// Abre o modal de cobrança para escolher tipo de mensagem (reutilizado em viewEmprestimo e Cobranças do Dia)
function showModalNotificacaoCobranca(dadosNotificacao) {
  const chavePix = appState.configuracoes.chave_pix || '(Chave PIX não configurada)';
  const infoParcela = dadosNotificacao.isParcelado ? ` (parcela ${dadosNotificacao.numeroParcelaAtual}/${dadosNotificacao.totalParcelas})` : '';
  let msgParcelado;
  const msgParcelaPersonalizada = gerarMensagemCobranca('parcela', {
    nome: dadosNotificacao.primeiroNome,
    parcelaAtual: dadosNotificacao.numeroParcelaAtual,
    totalParcelas: dadosNotificacao.totalParcelas,
    dataVencimento: dadosNotificacao.dataParcela,
    valor: utils.formatCurrency(dadosNotificacao.valorParcela),
    isParcelado: dadosNotificacao.isParcelado
  });
  if (msgParcelaPersonalizada) {
    msgParcelado = msgParcelaPersonalizada;
  } else {
    msgParcelado = `Olá, ${dadosNotificacao.primeiroNome}, a sua parcela${infoParcela} vence ${dadosNotificacao.dataParcela}. Você pode pagar o valor de ${utils.formatCurrency(dadosNotificacao.valorParcela)}.

Chave PIX: ${chavePix}

Solicitamos o pagamento até a data de vencimento.`;
  }
  const jurosTotalMaisDiario = dadosNotificacao.jurosTotal + dadosNotificacao.jurosDiario;
  const jurosMensalMaisAtraso = dadosNotificacao.jurosTotal + dadosNotificacao.jurosAplicado;
  const infoJurosMsg = dadosNotificacao.diasAtraso > 0
    ? `\n📊 *Detalhes:*
• Valor investido: ${utils.formatCurrency(dadosNotificacao.valorInvestido)}
• Juros mensal (${dadosNotificacao.jurosPercent}%): ${utils.formatCurrency(dadosNotificacao.jurosTotal)}
• Juros diário: ${utils.formatCurrency(dadosNotificacao.jurosDiario)}/dia
• Dias em atraso: ${dadosNotificacao.diasAtraso} dia(s)
• Juros por atraso: ${utils.formatCurrency(dadosNotificacao.jurosAplicado)}
• Total de juros: ${utils.formatCurrency(jurosMensalMaisAtraso)}

💰 *Total a pagar: ${utils.formatCurrency(dadosNotificacao.valorTotal)}*`
    : `\n📊 *Detalhes:*
• Valor investido: ${utils.formatCurrency(dadosNotificacao.valorInvestido)}
• Juros mensal (${dadosNotificacao.jurosPercent}%): ${utils.formatCurrency(dadosNotificacao.jurosTotal)}
• Juros diário: ${utils.formatCurrency(dadosNotificacao.jurosDiario)}/dia
• Juros + diário: ${utils.formatCurrency(jurosTotalMaisDiario)}

💰 *Total a pagar: ${utils.formatCurrency(dadosNotificacao.valorTotal)}*
💵 *Apenas juros (com diário): ${utils.formatCurrency(jurosTotalMaisDiario)}*`;
  let msgEmprestimo;
  const msgEmprestimoPersonalizada = gerarMensagemCobranca('emprestimo_com_juros', {
    nome: dadosNotificacao.primeiroNome,
    dataVencimento: dadosNotificacao.dataVencimento,
    valorInvestido: utils.formatCurrency(dadosNotificacao.valorInvestido),
    jurosPercent: dadosNotificacao.jurosPercent,
    jurosTotal: utils.formatCurrency(dadosNotificacao.jurosTotal),
    jurosDiario: utils.formatCurrency(dadosNotificacao.jurosDiario),
    diasAtraso: dadosNotificacao.diasAtraso,
    jurosAtraso: utils.formatCurrency(dadosNotificacao.jurosAplicado),
    valorTotal: utils.formatCurrency(dadosNotificacao.valorTotal)
  });
  if (msgEmprestimoPersonalizada) {
    msgEmprestimo = msgEmprestimoPersonalizada;
  } else {
    msgEmprestimo = `Olá, ${dadosNotificacao.primeiroNome}, seu empréstimo vence ${dadosNotificacao.dataVencimento}.
${infoJurosMsg}

Chave PIX: ${chavePix}

Lembramos que, em caso de atraso, será cobrada uma multa diária de ${utils.formatCurrency(dadosNotificacao.jurosDiario)}.`;
  }
  const valorTotalSemDiario = dadosNotificacao.valorInvestido + dadosNotificacao.jurosTotal;
  const infoJurosSemDiario = dadosNotificacao.diasAtraso > 0
    ? `\n📊 *Detalhes:*
• Valor investido: ${utils.formatCurrency(dadosNotificacao.valorInvestido)}
• Juros mensal (${dadosNotificacao.jurosPercent}%): ${utils.formatCurrency(dadosNotificacao.jurosTotal)}

💰 *Total a pagar: ${utils.formatCurrency(valorTotalSemDiario)}*`
    : `\n📊 *Detalhes:*
• Valor investido: ${utils.formatCurrency(dadosNotificacao.valorInvestido)}
• Juros mensal (${dadosNotificacao.jurosPercent}%): ${utils.formatCurrency(dadosNotificacao.jurosTotal)}

💰 *Total a pagar: ${utils.formatCurrency(valorTotalSemDiario)}*
💵 *Apenas juros: ${utils.formatCurrency(dadosNotificacao.jurosTotal)}*`;
  let msgEmprestimoSemDiario;
  const msgEmprestimoSemJurosPersonalizada = gerarMensagemCobranca('emprestimo_sem_juros', {
    nome: dadosNotificacao.primeiroNome,
    dataVencimento: dadosNotificacao.dataVencimento,
    valorInvestido: utils.formatCurrency(dadosNotificacao.valorInvestido),
    jurosPercent: dadosNotificacao.jurosPercent,
    jurosTotal: utils.formatCurrency(dadosNotificacao.jurosTotal),
    valorTotal: utils.formatCurrency(valorTotalSemDiario)
  });
  if (msgEmprestimoSemJurosPersonalizada) {
    msgEmprestimoSemDiario = msgEmprestimoSemJurosPersonalizada;
  } else {
    msgEmprestimoSemDiario = `Olá, ${dadosNotificacao.primeiroNome}, seu empréstimo vence ${dadosNotificacao.dataVencimento}.
${infoJurosSemDiario}

Chave PIX: ${chavePix}

Solicitamos o pagamento até a data de vencimento.`;
  }
  const telefoneNumeros = (dadosNotificacao.telefone || '').replace(/\D/g, '');
  const telefoneFinal = telefoneNumeros.startsWith('55') ? telefoneNumeros : `55${telefoneNumeros}`;
  const semTelefone = !telefoneNumeros;
  const btnDisabledStyle = semTelefone ? 'opacity: 0.5; cursor: not-allowed;' : '';
  const btnOnClick = semTelefone ? `onclick="event.preventDefault(); ui.showNotification('⚠️ Cliente sem telefone cadastrado! Edite o empréstimo para adicionar o telefone.', 'error'); return false;"` : '';
  let msgTodasVencidas = '';
  let opcaoTodasVencidas = '';
  if (dadosNotificacao.parcelasVencidas && dadosNotificacao.parcelasVencidas.length >= 1) {
    const listaParcelasVencidas = dadosNotificacao.parcelasVencidas.map(p => {
      const numParcela = p.numero_parcela || '?';
      return `• Parcela ${numParcela}: ${utils.formatCurrency(Number(p.valor_parcela || 0))} (vencida em ${utils.formatDate(p.data_vencimento)})`;
    }).join('\n');
    const qtdParcelas = dadosNotificacao.parcelasVencidas.length;
    const textoQtd = qtdParcelas === 1 ? '1 parcela em atraso' : `${qtdParcelas} parcelas em atraso`;
    const msgVencidasPersonalizada = gerarMensagemCobranca('parcelas_vencidas', {
      nome: dadosNotificacao.primeiroNome,
      qtdParcelas: qtdParcelas.toString(),
      listaParcelas: listaParcelasVencidas,
      valorTotal: utils.formatCurrency(dadosNotificacao.valorTotalVencidas)
    });
    if (msgVencidasPersonalizada) {
      msgTodasVencidas = msgVencidasPersonalizada;
    } else {
      msgTodasVencidas = `Olá, ${dadosNotificacao.primeiroNome}, você possui ${textoQtd}:

${listaParcelasVencidas}

💰 *Total a pagar: ${utils.formatCurrency(dadosNotificacao.valorTotalVencidas)}*

Chave PIX: ${chavePix}

Solicitamos a regularização o mais breve possível.`;
    }
    const tituloVencidas = qtdParcelas === 1 ? '🚨 Parcela Vencida' : `🚨 Parcelas Vencidas (${qtdParcelas})`;
    const linkVencidas = telefoneNumeros ? `https://wa.me/${telefoneFinal}?text=${encodeURIComponent(msgTodasVencidas)}` : '';
    opcaoTodasVencidas = `
      <div style="border: 2px solid #ef4444; border-radius: 12px; padding: 1rem; background: #fef2f2;">
        <h4 style="color: #ef4444; margin-bottom: 0.5rem;">${tituloVencidas}</h4>
        <div style="font-size: 0.8rem; color: #666; margin-bottom: 0.5rem;">Total em atraso: <b style="color: #ef4444;">${utils.formatCurrency(dadosNotificacao.valorTotalVencidas)}</b></div>
        <div style="font-size: 0.75rem; color: #6b7280; margin-bottom: 0.5rem; font-weight: 600;">📱 Preview da mensagem (será enviada ao clicar no botão abaixo):</div>
        <p style="font-size: 0.9rem; color: #444; margin-bottom: 1rem; white-space: pre-line; background: #fff; padding: 0.75rem; border-radius: 8px; border: 1px solid #e5e7eb; max-height: 150px; overflow-y: auto;">${msgTodasVencidas}</p>
        <a href="${linkVencidas || 'javascript:void(0)'}" ${linkVencidas ? 'target="_blank" rel="noopener noreferrer"' : ''} ${btnOnClick} class="btn" style="display: block; background: #ef4444; color: #fff; text-align: center; padding: 0.75rem; border-radius: 8px; font-weight: 600; text-decoration: none; ${btnDisabledStyle}">
          Enviar via WhatsApp
        </a>
      </div>
    `;
  }
  const linkParcelado = telefoneNumeros ? `https://wa.me/${telefoneFinal}?text=${encodeURIComponent(msgParcelado)}` : '';
  const linkEmprestimo = telefoneNumeros ? `https://wa.me/${telefoneFinal}?text=${encodeURIComponent(msgEmprestimo)}` : '';
  const linkEmprestimoSemDiario = telefoneNumeros ? `https://wa.me/${telefoneFinal}?text=${encodeURIComponent(msgEmprestimoSemDiario)}` : '';
  const tituloParcela = dadosNotificacao.isParcelado
    ? `📋 Próxima Parcela (${dadosNotificacao.numeroParcelaAtual}/${dadosNotificacao.totalParcelas})`
    : '📋 Mensagem para Parcela';
  const avisoSemTelefone = semTelefone ? `
    <div style="background: #fef3c7; border: 1px solid #f59e0b; border-radius: 8px; padding: 0.75rem; margin-bottom: 1rem; display: flex; align-items: center; gap: 0.5rem;">
      <span style="font-size: 1.2rem;">⚠️</span>
      <span style="color: #92400e; font-size: 0.9rem;"><b>Atenção:</b> Cliente sem telefone cadastrado. Edite o empréstimo para adicionar.</span>
    </div>
  ` : '';
  // Blocos de opções separados para ordenar conforme o tipo de empréstimo
  const previewLabel = '<div style="font-size: 0.75rem; color: #6b7280; margin-bottom: 0.5rem; font-weight: 600;">📱 Preview da mensagem (será enviada ao clicar no botão abaixo):</div>';
  const opcaoParcela = `
    <div style="border: 2px solid #25d366; border-radius: 12px; padding: 1rem; background: #f0fff4;">
      <h4 style="color: #25d366; margin-bottom: 0.5rem;">📋 ${tituloParcela}</h4>
      <div style="font-size: 0.8rem; color: #666; margin-bottom: 0.5rem;">Vencimento: <b>${dadosNotificacao.dataParcela}</b> • Valor: <b>${utils.formatCurrency(dadosNotificacao.valorParcela)}</b></div>
      ${previewLabel}
      <p style="font-size: 0.9rem; color: #444; margin-bottom: 1rem; white-space: pre-line; background: #fff; padding: 0.75rem; border-radius: 8px; border: 1px solid #e5e7eb;">${msgParcelado}</p>
      <a href="${linkParcelado || 'javascript:void(0)'}" ${linkParcelado ? 'target="_blank" rel="noopener noreferrer"' : ''} ${btnOnClick} class="btn" style="display: block; background: #25d366; color: #fff; text-align: center; padding: 0.75rem; border-radius: 8px; font-weight: 600; text-decoration: none; ${btnDisabledStyle}">Enviar via WhatsApp</a>
    </div>
  `;
  const opcaoEmprestimoSemDiario = `
    <div style="border: 2px solid #8b5cf6; border-radius: 12px; padding: 1rem; background: #f5f3ff;">
      <h4 style="color: #8b5cf6; margin-bottom: 0.5rem;">💵 Empréstimo (sem juros diário)</h4>
      ${previewLabel}
      <p style="font-size: 0.9rem; color: #444; margin-bottom: 1rem; white-space: pre-line; background: #fff; padding: 0.75rem; border-radius: 8px; border: 1px solid #e5e7eb; max-height: 150px; overflow-y: auto;">${msgEmprestimoSemDiario}</p>
      <a href="${linkEmprestimoSemDiario || 'javascript:void(0)'}" ${linkEmprestimoSemDiario ? 'target="_blank" rel="noopener noreferrer"' : ''} ${btnOnClick} class="btn" style="display: block; background: #8b5cf6; color: #fff; text-align: center; padding: 0.75rem; border-radius: 8px; font-weight: 600; text-decoration: none; ${btnDisabledStyle}">Enviar via WhatsApp</a>
    </div>
  `;
  const opcaoEmprestimoComDiario = `
    <div style="border: 2px solid #3b82f6; border-radius: 12px; padding: 1rem; background: #eff6ff;">
      <h4 style="color: #3b82f6; margin-bottom: 0.5rem;">💰 Empréstimo (com juros/multa diária)</h4>
      ${previewLabel}
      <p style="font-size: 0.9rem; color: #444; margin-bottom: 1rem; white-space: pre-line; background: #fff; padding: 0.75rem; border-radius: 8px; border: 1px solid #e5e7eb; max-height: 150px; overflow-y: auto;">${msgEmprestimo}</p>
      <a href="${linkEmprestimo || 'javascript:void(0)'}" ${linkEmprestimo ? 'target="_blank" rel="noopener noreferrer"' : ''} ${btnOnClick} class="btn" style="display: block; background: #3b82f6; color: #fff; text-align: center; padding: 0.75rem; border-radius: 8px; font-weight: 600; text-decoration: none; ${btnDisabledStyle}">Enviar via WhatsApp</a>
    </div>
  `;
  // Ordenar opções: parcelado = msgs parceladas em cima; juros = msgs de juros em cima
  const opcoesOrdenadas = dadosNotificacao.isParcelado
    ? `${opcaoTodasVencidas}${opcaoParcela}${opcaoEmprestimoSemDiario}${opcaoEmprestimoComDiario}`
    : `${opcaoEmprestimoSemDiario}${opcaoEmprestimoComDiario}${opcaoTodasVencidas}${opcaoParcela}`;
  const modalNotificacao = `
    <div style="padding: 1.5rem; max-width: 500px; margin: 0 auto; max-height: 80vh; overflow-y: auto;">
      <h3 style="margin-bottom: 1.5rem; color: #002f4b; text-align: center;">Escolha o tipo de mensagem</h3>
      ${avisoSemTelefone}
      <div style="margin-bottom: 0.5rem; font-size: 0.85rem; color: #6b7280; text-align: center;">
        ${dadosNotificacao.isParcelado ? '📦 Empréstimo parcelado' : '💵 Empréstimo com juros'}
      </div>
      <div style="display: flex; flex-direction: column; gap: 1rem;">
        ${opcoesOrdenadas}
      </div>
      <button type="button" class="btn" style="width: 100%; margin-top: 1.5rem; background: #6b7280; color: #fff; padding: 0.75rem; border-radius: 8px;" onclick="this.closest('.modal').remove()">Cancelar</button>
    </div>
  `;
  ui.showModal(modalNotificacao, 'Notificar Cliente');
}

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

  // Configurar logout automático (desabilitado para melhor experiência)
  setupAutoLogout() {
    // NOTA: Logout automático por inatividade foi DESABILITADO
    // A sessão do servidor dura 24 horas, então o usuário permanece logado
    // O logout só acontece quando:
    // 1. O usuário clica em "Sair"
    // 2. A sessão do servidor expira (24 horas)
    // 3. O navegador é fechado e os cookies são limpos
    
    console.log('Sistema configurado para manter sessão ativa');
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

  // Calcular próxima data de vencimento pela frequência
  // Mensal: +1 mês mantendo o dia (fev 29/30/31->28, março volta 29/30/31; meses 30 dias idem)
  // Semanal: +7 dias | Quinzenal: +14 dias | Diário: +1 dia
  calcularProximaDataVencimento: (dataVencimentoAtual, frequencia) => {
    const data = utils.createValidDate(dataVencimentoAtual);
    if (!data) return null;
    const freq = frequencia || 'monthly';

    switch (freq) {
      case 'daily':
        data.setDate(data.getDate() + 1);
        break;
      case 'weekly':
        data.setDate(data.getDate() + 7);
        break;
      case 'biweekly':
        data.setDate(data.getDate() + 14);
        break;
      case 'monthly':
      default: {
        const diaAtual = data.getDate();
        const mesAtual = data.getMonth();
        const anoAtual = data.getFullYear();
        const diaAlvo = (mesAtual === 1 && diaAtual >= 28) ||
          (diaAtual === 30 && [3, 5, 8, 10].includes(mesAtual))
          ? 31
          : diaAtual;

        const proxMes = mesAtual === 11 ? 0 : mesAtual + 1;
        const proxAno = mesAtual === 11 ? anoAtual + 1 : anoAtual;
        const ultimoDiaMes = new Date(proxAno, proxMes + 1, 0).getDate();
        data.setFullYear(proxAno, proxMes, Math.min(diaAlvo, ultimoDiaMes));
        break;
      }
    }
    return data;
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

  // Histórico de pagamentos (parcelas + juros)
  async getHistoricoPagamentos(params = {}) {
    const qs = new URLSearchParams(params).toString();
    return this.request(`/cobrancas/historico-pagamentos${qs ? '?' + qs : ''}`);
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

  // Loading state em botões
  setButtonLoading(btn, loading, loadingText = 'Salvando...') {
    if (!btn) return;
    if (loading) {
      btn.dataset.originalHtml = btn.innerHTML;
      btn.disabled = true;
      btn.innerHTML = `<i class="fas fa-spinner fa-spin" style="margin-right: 0.5rem;"></i>${loadingText}`;
    } else {
      btn.disabled = false;
      btn.innerHTML = btn.dataset.originalHtml || btn.innerHTML;
      delete btn.dataset.originalHtml;
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
  
  // Fechar modal
  closeModal() {
    const modal = document.querySelector('.modal');
    if (modal) {
      modal.remove();
    }
  },

  // Modal de confirmação (substitui confirm nativo)
  showConfirm(message, options = {}) {
    const { title = 'Confirmar', confirmText = 'Confirmar', cancelText = 'Cancelar', danger = false } = options;
    return new Promise((resolve) => {
      const modal = document.createElement('div');
      modal.className = 'modal modal-confirm';
      modal.innerHTML = `
        <div class="modal-overlay"></div>
        <div class="modal-content modal-confirm-content">
          <div class="modal-header">
            <h3>${title}</h3>
            <button class="modal-close" type="button">&times;</button>
          </div>
          <div class="modal-body">
            <p class="modal-confirm-message">${message}</p>
            <div class="modal-confirm-actions">
              <button type="button" class="btn btn-secondary modal-confirm-cancel">${cancelText}</button>
              <button type="button" class="btn ${danger ? 'btn-danger' : 'btn-primary'} modal-confirm-ok">${confirmText}</button>
            </div>
          </div>
        </div>
      `;
      document.body.appendChild(modal);

      const close = (result) => {
        modal.remove();
        resolve(result);
      };

      modal.querySelector('.modal-confirm-ok').onclick = () => close(true);
      modal.querySelector('.modal-confirm-cancel').onclick = () => close(false);
      modal.querySelector('.modal-close').onclick = () => close(false);
      modal.querySelector('.modal-overlay').onclick = () => close(false);
    });
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
      await this.updateCobrancasDoDia();
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
      tbody.innerHTML = '<tr><td colspan="5"><div class="empty-state"><i class="fas fa-folder-open empty-state-icon"></i><div class="empty-state-title">Nenhum empréstimo recente</div><div class="empty-state-text">Clique em "Novo Empréstimo" acima para cadastrar.</div></div></td></tr>';
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

  // Variável para armazenar todos os empréstimos processados (para filtragem)
  todosEmprestimosProcessados: [],
  
  // Cobranças do dia - empréstimos/parcelas que vencem hoje
  async updateCobrancasDoDia() {
    const tbody = document.getElementById('cobrancas-do-dia');
    const subtitle = document.getElementById('cobrancas-dia-subtitle');
    if (!tbody) return;

    tbody.innerHTML = getSkeletonRows(5, 3);

    try {
      const emprestimos = await apiService.getEmprestimos();
      const hoje = new Date();
      hoje.setHours(0, 0, 0, 0);
      const hojeStr = hoje.toISOString().split('T')[0]; // YYYY-MM-DD

      const cobrancasDoDia = [];

      for (const emp of (emprestimos || [])) {
        const status = (emp.status || '').toUpperCase();
        if (status === 'QUITADO') continue;

        if (emp.tipo_emprestimo === 'in_installments' && emp.numero_parcelas > 1) {
          try {
            const parcelas = await apiService.getParcelasEmprestimo(emp.id);
            if (parcelas && parcelas.length > 0) {
              const parcelasVencemHoje = parcelas.filter(p => {
                if (p.status === 'Paga') return false;
                const dv = utils.createValidDate(p.data_vencimento);
                if (!dv) return false;
                const dvStr = dv.toISOString().split('T')[0];
                return dvStr === hojeStr;
              });
              parcelasVencemHoje.forEach(p => {
                cobrancasDoDia.push({
                  ...emp,
                  cliente_nome: emp.cliente_nome || 'N/A',
                  valor: Number(p.valor_parcela || 0),
                  vencimentoExibir: p.data_vencimento,
                  parcelaInfo: `Parcela ${p.numero_parcela}`,
                  numeroParcela: p.numero_parcela,
                  statusCalculado: 'Vence hoje'
                });
              });
            }
          } catch (e) { /* ignorar */ }
        } else {
          const dv = utils.createValidDate(emp.data_vencimento);
          if (dv) {
            const dvStr = dv.toISOString().split('T')[0];
            if (dvStr === hojeStr) {
              cobrancasDoDia.push({
                ...emp,
                cliente_nome: emp.cliente_nome || 'N/A',
                valor: Number(emp.valor_final || emp.valor || 0),
                vencimentoExibir: emp.data_vencimento,
                parcelaInfo: 'Empréstimo',
                statusCalculado: 'Vence hoje'
              });
            }
          }
        }
      }

      if (subtitle) {
        subtitle.textContent = cobrancasDoDia.length === 0
          ? 'Nenhuma cobrança vence hoje'
          : `${cobrancasDoDia.length} cobrança(s) vencem hoje`;
      }

      if (cobrancasDoDia.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5"><div class="empty-state"><i class="fas fa-calendar-check empty-state-icon"></i><div class="empty-state-title">Nenhuma cobrança vence hoje</div><div class="empty-state-text">Ótimo! Nenhum vencimento para a data de hoje.</div></div></td></tr>';
        return;
      }

      const isMobile = window.innerWidth <= 768;
      if (isMobile) {
        tbody.parentElement.style.display = 'none';
        const container = tbody.closest('.section');
        const oldCards = container.querySelector('.mobile-cobrancas-dia-cards');
        if (oldCards) oldCards.remove();
        const cardsContainer = document.createElement('div');
        cardsContainer.className = 'mobile-cobrancas-dia-cards';
        cardsContainer.style.cssText = 'display: flex; flex-direction: column; gap: 0.75rem; padding: 0.5rem;';
        cobrancasDoDia.forEach(item => {
          const valor = utils.formatCurrency(item.valor);
          const card = document.createElement('div');
          card.style.cssText = 'padding: 1rem; background: #fef3c7; border-radius: 10px; border-left: 4px solid #f59e0b; box-shadow: 0 2px 8px rgba(0,0,0,0.06);';
          const notificarArgs = item.numeroParcela ? `${item.id}, ${item.numeroParcela}` : item.id;
          card.innerHTML = `
            <div style="font-weight: 600; color: #1f2937;">${item.cliente_nome}</div>
            <div style="font-size: 0.8rem; color: #92400e; margin: 0.25rem 0;">${item.parcelaInfo}</div>
            <div style="font-size: 0.9rem; font-weight: 700; color: #059669;">${valor}</div>
            <div style="font-size: 0.75rem; color: #6b7280;">Venc: ${utils.formatDate(item.vencimentoExibir)}</div>
            <div style="display: flex; gap: 0.5rem; margin-top: 0.5rem;">
              <button onclick="viewEmprestimo(${item.id})" class="btn btn-primary btn-sm" style="flex: 1;">Ver</button>
              <button onclick="abrirModalCobranca(${notificarArgs})" class="btn btn-sm" style="flex: 1; background: #25d366; color: #fff; display: flex; align-items: center; justify-content: center; gap: 0.35rem;">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                Notificar
              </button>
            </div>
          `;
          cardsContainer.appendChild(card);
        });
        container.appendChild(cardsContainer);
      } else {
        const oldCards = tbody.closest('.section').querySelector('.mobile-cobrancas-dia-cards');
        if (oldCards) oldCards.remove();
        tbody.parentElement.style.display = '';
        tbody.innerHTML = '';
        cobrancasDoDia.forEach(item => {
          const valor = utils.formatCurrency(item.valor);
          const notificarArgs = item.numeroParcela ? `${item.id}, ${item.numeroParcela}` : item.id;
          const row = document.createElement('tr');
          row.innerHTML = `
            <td>
              <div class="font-semibold">${item.cliente_nome}</div>
              <div class="text-sm text-gray-500">${item.parcelaInfo}</div>
            </td>
            <td class="font-semibold text-green-600">${valor}</td>
            <td>${utils.formatDate(item.vencimentoExibir)}</td>
            <td><span class="badge badge-warning">Vence hoje</span></td>
            <td>
              <div style="display: flex; gap: 0.5rem; align-items: center;">
                <button class="btn btn-primary btn-sm" onclick="viewEmprestimo(${item.id})">Ver</button>
                <button class="btn btn-sm" onclick="abrirModalCobranca(${notificarArgs})" style="background: #25d366; color: #fff; display: inline-flex; align-items: center; gap: 0.35rem;">
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                  Notificar
                </button>
              </div>
            </td>
          `;
          tbody.appendChild(row);
        });
      }
    } catch (error) {
      console.error('Erro ao carregar cobranças do dia:', error);
      if (tbody) tbody.innerHTML = '<tr><td colspan="5" class="text-center text-red-500">Erro ao carregar</td></tr>';
    }
  },

  async updateCobrancasPendentes() {
    const tbody = document.getElementById('cobrancas-pendentes');
    if (!tbody) return;

    tbody.innerHTML = getSkeletonRows(7, 3);

    try {
      // Buscar todos os empréstimos
      const emprestimos = await apiService.getEmprestimos();
      
      if (!emprestimos || emprestimos.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7"><div class="empty-state"><i class="fas fa-search empty-state-icon"></i><div class="empty-state-title">Nenhum empréstimo encontrado</div><div class="empty-state-text">Tente ajustar os filtros de busca ou adicione um novo empréstimo.</div></div></td></tr>';
        this.todosEmprestimosProcessados = [];
        this.updateSearchResultsInfo(0, 0);
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

      // Armazenar para filtragem
      this.todosEmprestimosProcessados = emprestimosProcessados;
      
      // Renderizar com filtro atual (se houver)
      const searchInput = document.getElementById('search-todos-emprestimos');
      const termo = searchInput ? searchInput.value : '';
      this.renderEmprestimosFiltrados(termo);
      
    } catch (error) {
      console.error('Erro ao carregar cobranças pendentes:', error);
      const tbody = document.getElementById('cobrancas-pendentes');
      if (tbody) {
        tbody.innerHTML = '<tr><td colspan="7" class="text-center text-red-500">Erro ao carregar cobranças</td></tr>';
      }
    }
  },
  
  // Atualizar informação de resultados da busca
  updateSearchResultsInfo(filtrados, total) {
    const info = document.getElementById('search-results-info-dashboard');
    if (info) {
      if (filtrados === total) {
        info.textContent = `Mostrando todos os ${total} empréstimos`;
      } else {
        info.textContent = `Mostrando ${filtrados} de ${total} empréstimos`;
      }
    }
  },
  
  // Renderizar empréstimos com filtro
  renderEmprestimosFiltrados(termo = '') {
    const tbody = document.getElementById('cobrancas-pendentes');
    if (!tbody) return;
    
    const termoLower = termo.toLowerCase().trim();
    
    // Filtrar por nome do cliente
    const emprestimosFiltrados = this.todosEmprestimosProcessados.filter(emp => {
      if (!termoLower) return true;
      const nomeCliente = (emp.cliente_nome || '').toLowerCase();
      return nomeCliente.includes(termoLower);
    });
    
    // Atualizar info de resultados
    this.updateSearchResultsInfo(emprestimosFiltrados.length, this.todosEmprestimosProcessados.length);
    
    if (emprestimosFiltrados.length === 0) {
      // Esconder cards mobile se existirem
      const container = tbody.parentElement.parentElement;
      const oldCards = container.querySelector('.mobile-cards-container');
      if (oldCards) oldCards.remove();
      tbody.parentElement.style.display = '';
      
      tbody.innerHTML = '<tr><td colspan="7"><div class="empty-state"><i class="fas fa-search empty-state-icon"></i><div class="empty-state-title">Nenhum empréstimo encontrado</div><div class="empty-state-text">Tente ajustar os filtros de busca ou adicione um novo empréstimo.</div></div></td></tr>';
      return;
    }

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
        
        emprestimosFiltrados.forEach(emp => {
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
        
        emprestimosFiltrados.forEach(emp => {
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
                    <button class="btn" style="background: #8b5cf6; color: #fff; font-size: 0.875rem; padding: 0.375rem 0.75rem; border-radius: 6px; flex: 1; min-width: 70px;" onclick="editarValorParcela(${parcela.emprestimo_id}, ${parcela.numero_parcela}, '${valorParcela.toFixed(2).replace('.', ',')}')">
                      Alterar Valor
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
                  <option value="monthly" ${(emp.frequencia || emp.frequencia_pagamento) === 'monthly' ? 'selected' : ''}>Mensal</option>
                  <option value="weekly" ${(emp.frequencia || emp.frequencia_pagamento) === 'weekly' ? 'selected' : ''}>Semanal</option>
                  <option value="daily" ${(emp.frequencia || emp.frequencia_pagamento) === 'daily' ? 'selected' : ''}>Diário</option>
                  <option value="biweekly" ${(emp.frequencia || emp.frequencia_pagamento) === 'biweekly' ? 'selected' : ''}>Quinzenal</option>
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
        
        if (formData.juros_mensal === null || formData.juros_mensal === undefined || formData.juros_mensal < 0) {
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



  async viewEmprestimo(id, opts) {
    try {
      opts = opts || {};
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
        let numeroParcelaAtual = 1;
        let totalParcelas = 1;
        let parcelasVencidas = [];
        let valorTotalVencidas = 0;
        
        if (parcelas.length > 0) {
          totalParcelas = parcelas.length;
          const parcelasNaoPagas = parcelas.filter(p => p.status !== 'Paga');
          
          // Filtrar parcelas vencidas (atrasadas + vence hoje)
          parcelasVencidas = parcelasNaoPagas.filter(p => {
            const dataVencParcela = utils.createValidDate(p.data_vencimento);
            return dataVencParcela && dataVencParcela <= hoje; // <= inclui hoje
          }).sort((a, b) => utils.createValidDate(a.data_vencimento) - utils.createValidDate(b.data_vencimento));
          
          // Calcular valor total das parcelas vencidas
          valorTotalVencidas = parcelasVencidas.reduce((acc, p) => acc + Number(p.valor_parcela || 0), 0);
          
          if (parcelasNaoPagas.length > 0) {
            // Ordenar por data de vencimento
            parcelasNaoPagas.sort((a, b) => utils.createValidDate(a.data_vencimento) - utils.createValidDate(b.data_vencimento));
            
            // Prioridade: parcela que vence HOJE, senão a próxima a vencer (incluindo atrasadas)
            const parcelaHoje = parcelasNaoPagas.find(p => {
              const dataVenc = utils.createValidDate(p.data_vencimento);
              if (!dataVenc) return false;
              return dataVenc.getFullYear() === hoje.getFullYear() &&
                     dataVenc.getMonth() === hoje.getMonth() &&
                     dataVenc.getDate() === hoje.getDate();
            });
            
            const proximaParcela = parcelaHoje || parcelasNaoPagas[0];
            valorParcelaAtual = Number(proximaParcela.valor_parcela || 0);
            dataParcelaAtual = utils.formatDate(proximaParcela.data_vencimento);
            numeroParcelaAtual = proximaParcela.numero_parcela || (parcelas.indexOf(proximaParcela) + 1);
          }
        }
        
        // Guardar dados para o modal de notificação
        let dadosNotificacao = {
          telefone,
          primeiroNome,
          valorTotal: valorAtualizado,
          valorJuros: valorTotalJuros,
          valorParcela: valorParcelaAtual,
          dataParcela: dataParcelaAtual,
          dataVencimento: dataVencFormatada,
          isParcelado: parcelas.length > 1,
          numeroParcelaAtual,
          totalParcelas,
          parcelasVencidas,
          valorTotalVencidas,
          valorInvestido,
          jurosTotal,
          jurosDiario,
          diasAtraso,
          jurosAplicado,
          jurosPercent
        };
        // Se chamado de Cobranças do Dia com parcela específica, usar dados dessa parcela
        if (opts.numeroParcela && parcelas.length > 0) {
          const parcelaEspecifica = parcelas.find(p => String(p.numero_parcela) === String(opts.numeroParcela));
          if (parcelaEspecifica) {
            dadosNotificacao = { ...dadosNotificacao,
              valorParcela: Number(parcelaEspecifica.valor_parcela || 0),
              dataParcela: utils.formatDate(parcelaEspecifica.data_vencimento),
              numeroParcelaAtual: parcelaEspecifica.numero_parcela || opts.numeroParcela
            };
          }
        }
        if (opts.abreDiretoNotificar) {
          showModalNotificacaoCobranca(dadosNotificacao);
          return;
        }
        const detalhes = `
          <div class="emprestimo-modal-box" style="padding: 1.5rem; max-width: 420px; margin: 0 auto; background: #fff; border-radius: 16px; box-shadow: 0 2px 16px #002f4b22;">
            <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 1rem;">
              <span class="badge" style="background: ${status === 'Em Atraso' ? '#fbbf24' : status.toUpperCase() === 'QUITADO' ? '#10b981' : status === 'SÓ JUROS' ? '#6366f1' : '#002f4b'}; color: #fff; font-weight: 600; font-size: 1rem; padding: 0.4em 1em; border-radius: 8px; letter-spacing: 1px;">${status || '-'}</span>
              <button class="btn" style="background: #10b981; color: #fff; font-weight: 600; border-radius: 8px; padding: 0.4em 1.2em; font-size: 1rem;" id="modal-btn-editar">Editar</button>
            </div>
            <div style="margin-bottom: 1.2rem;">
              <h2 style="font-size: 1.4rem; font-weight: bold; margin-bottom: 0.2em; color: #002f4b;">${emp.cliente_nome || 'N/A'}</h2>
              ${telefone ? `<div style="font-size: 0.95rem; color: #666; margin-bottom: 0.4em; display: flex; align-items: center; gap: 0.4rem;">
                <span style="color: #25d366;">📱</span> 
                <a href="https://wa.me/55${telefone.replace(/\D/g, '')}" target="_blank" style="color: #25d366; text-decoration: none; font-weight: 500;">${telefone}</a>
              </div>` : ''}
              <div style="font-size: 1.1rem; font-weight: 600; color: #222; margin-bottom: 0.2em;">PCL-Nº #${emp.id} ${emp.parcelas ? `(${emp.parcelas}ª parcela)` : ''}</div>
              <div style="font-size: 1rem; color: #444; margin-bottom: 0.2em;">Deve ser pago em <b>${utils.formatDate(emp.data_vencimento)}</b></div>
              <div style="font-size: 1rem; color: #444;">Valor Investido <b>${utils.formatCurrency(valorInvestido)}</b></div>
              <div style="font-size: 1rem; color: #444;">Juros <b>${jurosPercent}%</b> (${utils.formatCurrency(jurosTotal)})</div>
              ${infoJuros}
              ${emp.observacoes ? `
              <div style="margin-top: 0.8rem; padding: 0.8rem; background: #f8f9fa; border-radius: 8px; border-left: 3px solid #6366f1;">
                <div style="font-size: 0.85rem; color: #666; margin-bottom: 0.3rem; font-weight: 600;">📝 Observações:</div>
                <div style="font-size: 0.95rem; color: #333; white-space: pre-line;">${emp.observacoes}</div>
              </div>` : ''}
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
          showModalNotificacaoCobranca(dadosNotificacao);
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
                  const prox = utils.calcularProximaDataVencimento(emp.data_vencimento, emp.frequencia || emp.frequencia_pagamento);
                  return prox ? utils.formatDate(prox) : '-';
                })()}</p>
                                  <p><strong>Novo Valor da Dívida:</strong> ${utils.formatCurrency(valorInicial)} <em>(volta ao valor inicial)</em></p>
                <div style="background: #e3f2fd; padding: 0.75rem; border-radius: 6px; margin-top: 0.75rem; border-left: 4px solid #2196f3;">
                  <p style="margin: 0; font-size: 0.9rem; color: #1565c0;">
                    <strong>Como funciona:</strong> Ao pagar apenas os juros, o valor da dívida volta ao valor inicial do empréstimo e o prazo é estendido conforme a frequência (mensal +1 mês, semanal +7 dias, quinzenal +14 dias).
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
                                ui.showNotification(`Valor insuficiente. O mínimo é ${utils.formatCurrency(jurosAcumulados)}`, 'error');
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
              ui.showNotification('Erro ao processar pagamento: ' + error.message, 'error');
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
          const ok = await ui.showConfirm('Tem certeza que deseja remover este empréstimo?', { title: 'Remover empréstimo', confirmText: 'Remover', danger: true });
          if (!ok) return;
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
    const ok = await ui.showConfirm('Tem certeza que deseja adicionar este cliente à lista negra?', { title: 'Lista Negra', confirmText: 'Adicionar', danger: true });
    if (!ok) return;
    
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
                      <p style="margin: 0.3rem 0;"><strong>Frequência:</strong> ${
                        emp.frequencia === 'monthly' ? 'Mensal' : 
                        emp.frequencia === 'weekly' ? 'Semanal' : 
                        emp.frequencia === 'biweekly' ? 'Quinzenal' : 
                        emp.frequencia === 'daily' ? 'Diário' : 'N/A'
                      }</p>
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
          
          <!-- Documentos do cliente -->
          <div style="margin-top: 1.5rem; padding-top: 1.5rem; border-top: 1px solid #e2e8f0;">
            <h4 style="margin-bottom: 0.5rem; color: #002f4b;">Documentos</h4>
            <p style="font-size: 0.875rem; color: #64748b; margin-bottom: 1rem;">PDF e imagens (JPEG, PNG, GIF, WebP). Máx. 15 MB por arquivo. Você pode selecionar vários de uma vez.</p>
            <form id="form-upload-doc-modal-ver" data-cliente-id="${id}" style="margin-bottom: 1rem;">
              <input type="file" id="input-doc-modal-ver" name="arquivo" accept=".pdf,image/jpeg,image/jpg,image/png,image/gif,image/webp" multiple style="margin-bottom: 0.5rem; display: block; width: 100%; padding: 8px; border: 1px solid #e2e8f0; border-radius: 8px;" />
              <button type="submit" class="btn btn-sm" id="btn-anexar-doc-modal-ver" style="background: #0d9488; color: #fff; border: none; border-radius: 8px; padding: 6px 12px; cursor: pointer;"><i class="fas fa-upload"></i> Anexar documento</button>
            </form>
            <ul id="modal-ver-cliente-docs-list" style="list-style: none; padding: 0; margin: 0; max-height: 200px; overflow-y: auto;"></ul>
          </div>
        </div>
      `;
      
      const modal = ui.showModal(modalContent, 'Detalhes do Cliente');
      initDocumentosModalVer(modal, id);
    } catch (error) {
      console.error('Erro ao buscar cliente:', error);
      ui.showNotification('Erro ao buscar dados do cliente', 'error');
    }
  },

  async editCliente(id) {
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
        <div class="cliente-modal-box" style="padding: 1.5rem; max-width: 600px; margin: 0 auto;">
          <h3 style="margin-bottom: 1.5rem; color: #002f4b;">Editar Cliente</h3>
          
          <form id="form-editar-cliente">
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
              <div class="form-group">
                <label class="form-label">Nome Completo *</label>
                <input type="text" class="form-input" name="nome" value="${cliente.nome || ''}" required>
              </div>
              
              <div class="form-group">
                <label class="form-label">CPF/CNPJ</label>
                <input type="text" class="form-input" name="cpf_cnpj" value="${cliente.cpf_cnpj || ''}">
              </div>
              
              <div class="form-group">
                <label class="form-label">Telefone</label>
                <input type="text" class="form-input" name="telefone" value="${cliente.telefone || ''}" placeholder="(XX) XXXXX-XXXX">
              </div>
              
              <div class="form-group">
                <label class="form-label">Email</label>
                <input type="email" class="form-input" name="email" value="${cliente.email || ''}">
              </div>
              
              <div class="form-group" style="grid-column: span 2;">
                <label class="form-label">Endereço</label>
                <input type="text" class="form-input" name="endereco" value="${cliente.endereco || ''}">
              </div>
              
              <div class="form-group">
                <label class="form-label">Cidade</label>
                <input type="text" class="form-input" name="cidade" value="${cliente.cidade || ''}">
              </div>
              
              <div class="form-group">
                <label class="form-label">Estado</label>
                <input type="text" class="form-input" name="estado" value="${cliente.estado || ''}" maxlength="2" placeholder="UF">
              </div>
              
              <div class="form-group">
                <label class="form-label">CEP</label>
                <input type="text" class="form-input" name="cep" value="${cliente.cep || ''}" placeholder="00000-000">
              </div>
            </div>
            
            <div style="display: flex; gap: 1rem; margin-top: 1.5rem; justify-content: flex-end;">
              <button type="button" class="btn btn-secondary" onclick="ui.closeModal()">Cancelar</button>
              <button type="submit" class="btn btn-primary">Salvar Alterações</button>
            </div>
          </form>
        </div>
      `;
      
      ui.showModal(modalContent, 'Editar Cliente');
      
      // Adicionar evento de submit
      const form = document.getElementById('form-editar-cliente');
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const formData = new FormData(form);
        const clienteData = {
          nome: formData.get('nome'),
          cpf_cnpj: formData.get('cpf_cnpj'),
          telefone: formData.get('telefone'),
          email: formData.get('email'),
          endereco: formData.get('endereco'),
          cidade: formData.get('cidade'),
          estado: formData.get('estado'),
          cep: formData.get('cep')
        };
        
        try {
          const updateResponse = await fetch(`/api/cobrancas/clientes/${id}`, {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json'
            },
            credentials: 'include',
            body: JSON.stringify(clienteData)
          });
          
          if (!updateResponse.ok) {
            const error = await updateResponse.json();
            ui.showNotification(error.error || 'Erro ao atualizar cliente', 'error');
            return;
          }
          
          ui.showNotification('Cliente atualizado com sucesso!', 'success');
          ui.closeModal();
          
          // Recarregar lista de clientes
          if (typeof renderClientesLista === 'function') {
            renderClientesLista();
          }
        } catch (error) {
          console.error('Erro ao atualizar cliente:', error);
          ui.showNotification('Erro ao atualizar cliente', 'error');
        }
      });
      
    } catch (error) {
      console.error('Erro ao buscar cliente:', error);
      ui.showNotification('Erro ao buscar dados do cliente', 'error');
    }
  },

  async deleteCliente(id) {
    const ok = await ui.showConfirm('Tem certeza que deseja remover este cliente?', { title: 'Remover cliente', confirmText: 'Remover', danger: true });
    if (!ok) return;

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
  tbody.innerHTML = getSkeletonRows(6, 3);
  try {
    const emprestimos = await apiService.getEmprestimos();
    if (!emprestimos || emprestimos.length === 0) {
      tbody.innerHTML = '<tr><td colspan="6"><div class="empty-state"><i class="fas fa-history empty-state-icon"></i><div class="empty-state-title">Nenhum empréstimo encontrado</div><div class="empty-state-text">Não há empréstimos cadastrados no sistema.</div></div></td></tr>';
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
  tbody.innerHTML = getSkeletonRows(7, 3);
  try {
    const emprestimos = await apiService.getEmprestimos();
    // Filtrar apenas empréstimos ativos
    const ativos = (emprestimos || []).filter(e => (e.status || '').toLowerCase() === 'ativo');
    if (!ativos || ativos.length === 0) {
      tbody.innerHTML = '<tr><td colspan="7"><div class="empty-state"><i class="fas fa-hand-holding-usd empty-state-icon"></i><div class="empty-state-title">Nenhum empréstimo ativo encontrado</div><div class="empty-state-text">Não há empréstimos ativos no momento.</div></div></td></tr>';
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
  tbody.innerHTML = getSkeletonRows(5, 3);
  try {
    const clientes = await apiService.getClientes();
    const emprestimos = await apiService.getEmprestimos();
    if (!clientes || clientes.length === 0) {
      tbody.innerHTML = '<tr><td colspan="5"><div class="empty-state"><i class="fas fa-users-slash empty-state-icon"></i><div class="empty-state-title">Nenhum cliente encontrado</div><div class="empty-state-text">Cadastre clientes em "Adicionar Cliente" ou ajuste a busca.</div></div></td></tr>';
      return;
    }
    
    // Ordenar clientes em ordem alfabética pelo nome
    clientes.sort((a, b) => {
      const nomeA = (a.nome || '').toLowerCase();
      const nomeB = (b.nome || '').toLowerCase();
      return nomeA.localeCompare(nomeB, 'pt-BR');
    });
    
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
          <button class="btn btn-sm btn-documentos-cobrancas" style="background:#0d9488;color:#fff;" data-cliente-id="${cliente.id}" data-cliente-nome="${(cliente.nome || '').replace(/"/g, '&quot;')}">Documentos</button>
          <button class="btn btn-info btn-sm" onclick="editCliente(${cliente.id})">Editar</button>
          ${cliente.status === 'Lista Negra' 
            ? '<button class="btn btn-success btn-sm" onclick="removerListaNegra(' + cliente.id + ')">Remover da Lista</button>'
            : '<button class="btn btn-warning btn-sm" onclick="adicionarListaNegra(' + cliente.id + ')">Lista Negra</button>'
          }
          <button class="btn btn-danger btn-sm" onclick="deleteCliente(${cliente.id})">Remover</button>
        </td>
      `;
      tbody.appendChild(row);
    }
    document.querySelectorAll('.btn-documentos-cobrancas').forEach(btn => {
      btn.onclick = () => abrirModalDocumentosCobrancas(btn.getAttribute('data-cliente-id'), btn.getAttribute('data-cliente-nome') || '');
    });
  } catch (err) {
    tbody.innerHTML = '<tr><td colspan="5" class="text-center text-red-500">Erro ao carregar clientes</td></tr>';
  }
}

function escapeHtmlCobrancas(s) {
  if (!s) return '';
  const div = document.createElement('div');
  div.textContent = s;
  return div.innerHTML;
}

async function carregarListaDocumentosCobrancas(clienteId) {
  const ul = document.getElementById('lista-documentos-cobrancas');
  if (!ul) return;
  ul.innerHTML = '<li style="padding:12px;color:#64748b;"><i class="fas fa-spinner fa-spin"></i> Carregando...</li>';
  try {
    const resp = await fetch(`/api/cobrancas/clientes/${clienteId}/documentos`, { credentials: 'include' });
    const docs = await resp.json();
    if (!resp.ok) {
      ul.innerHTML = '<li style="padding:12px;color:#dc2626;">Erro ao carregar documentos.</li>';
      return;
    }
    if (docs.length === 0) {
      ul.innerHTML = '<li style="padding:12px;color:#64748b;">Nenhum documento anexado.</li>';
      return;
    }
    ul.innerHTML = docs.map(d => {
      const data = d.created_at ? new Date(d.created_at).toLocaleDateString('pt-BR') : '';
      const tipo = (d.tipo_mime || '').includes('pdf') ? 'file-pdf' : 'file-image';
      return `<li style="display:flex;align-items:center;justify-content:space-between;padding:10px 0;border-bottom:1px solid #f1f5f9;">
        <span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${escapeHtmlCobrancas(d.nome_original)}"><i class="fas fa-${tipo}" style="margin-right:8px;color:#0d9488;"></i>${escapeHtmlCobrancas(d.nome_original)}</span>
        <span style="font-size:0.85rem;color:#64748b;margin-right:8px;">${data}</span>
        <button type="button" class="btn btn-sm btn-abrir-doc-cobrancas" data-cliente-id="${clienteId}" data-doc-id="${d.id}" style="margin-right:8px;background:#0d9488;color:#fff;border:none;border-radius:6px;cursor:pointer;padding:4px 10px;" title="Abrir"><i class="fas fa-external-link-alt"></i> Abrir</button>
        <button type="button" class="btn btn-danger btn-sm btn-excluir-doc-cobrancas" data-cliente-id="${clienteId}" data-doc-id="${d.id}" style="padding:4px 10px;"><i class="fas fa-trash"></i></button>
      </li>`;
    }).join('');
    document.querySelectorAll('.btn-abrir-doc-cobrancas').forEach(btn => {
      btn.onclick = async () => {
        const cid = btn.getAttribute('data-cliente-id');
        const did = btn.getAttribute('data-doc-id');
        try {
          const r = await fetch(`/api/cobrancas/clientes/${cid}/documentos/${did}/arquivo`, { credentials: 'include' });
          if (!r.ok) { ui.showNotification('Erro ao abrir documento.', 'error'); return; }
          const blob = await r.blob();
          const url = URL.createObjectURL(blob);
          window.open(url, '_blank');
        } catch (_) { ui.showNotification('Erro ao abrir documento.', 'error'); }
      };
    });
    document.querySelectorAll('.btn-excluir-doc-cobrancas').forEach(btn => {
      btn.onclick = async () => {
        const cid = btn.getAttribute('data-cliente-id');
        const did = btn.getAttribute('data-doc-id');
        const ok = await ui.showConfirm('Remover este documento?', { title: 'Remover documento', confirmText: 'Remover', danger: true });
        if (!ok) return;
        try {
          const r = await fetch(`/api/cobrancas/clientes/${cid}/documentos/${did}`, { method: 'DELETE', credentials: 'include' });
          if (r.ok) await carregarListaDocumentosCobrancas(cid);
          else ui.showNotification('Erro ao remover.', 'error');
        } catch (_) { ui.showNotification('Erro ao remover.', 'error'); }
      };
    });
  } catch (_) {
    ul.innerHTML = '<li style="padding:12px;color:#dc2626;">Erro ao carregar documentos.</li>';
  }
}

function abrirModalDocumentosCobrancas(clienteId, clienteNome) {
  let modal = document.getElementById('modal-documentos-cobrancas');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'modal-documentos-cobrancas';
    modal.style.cssText = 'display:none;position:fixed;top:0;left:0;width:100vw;height:100vh;background:rgba(0,0,0,0.5);z-index:2001;backdrop-filter:blur(5px);';
    modal.innerHTML = `
      <div style="background:#fff;max-width:560px;margin:40px auto;padding:28px;border-radius:20px;box-shadow:0 25px 50px rgba(0,0,0,0.25);position:relative;max-height:90vh;overflow:auto;">
        <button id="fechar-modal-documentos-cobrancas" style="position:absolute;top:15px;right:20px;font-size:1.5rem;background:none;border:none;cursor:pointer;color:#666;">&times;</button>
        <h2 id="modal-documentos-cobrancas-titulo" style="margin-bottom:16px;font-size:1.25rem;color:#1e293b;font-weight:600;">Documentos do Cliente</h2>
        <p style="color:#64748b;font-size:0.9rem;margin-bottom:16px;">Aceito: PDF e imagens (JPEG, PNG, GIF, WebP). Máx. 15 MB por arquivo. Você pode selecionar vários de uma vez.</p>
        <form id="form-upload-documento-cobrancas" style="margin-bottom:20px;">
          <input type="file" id="input-documento-cobrancas" name="arquivo" accept=".pdf,image/jpeg,image/jpg,image/png,image/gif,image/webp" multiple style="margin-bottom:10px;display:block;width:100%;padding:8px;border:1px solid #e2e8f0;border-radius:8px;" />
          <button type="submit" class="btn" id="btn-anexar-doc-cobrancas" style="background:#0d9488;color:#fff;border:none;border-radius:8px;padding:8px 16px;cursor:pointer;">
            <i class="fas fa-upload"></i> Anexar documento
          </button>
        </form>
        <hr style="border:none;border-top:1px solid #e2e8f0;margin:16px 0;" />
        <h3 style="font-size:1rem;color:#334155;margin-bottom:12px;">Documentos anexados</h3>
        <ul id="lista-documentos-cobrancas" style="list-style:none;padding:0;margin:0;"></ul>
      </div>
    `;
    document.body.appendChild(modal);
    document.getElementById('fechar-modal-documentos-cobrancas').onclick = () => { modal.style.display = 'none'; };
    modal.onclick = (e) => { if (e.target === modal) modal.style.display = 'none'; };
    document.getElementById('form-upload-documento-cobrancas').onsubmit = async function(e) {
      e.preventDefault();
      const input = document.getElementById('input-documento-cobrancas');
      const cid = modal.getAttribute('data-cliente-id');
      if (!cid || !input.files || input.files.length === 0) {
        ui.showNotification('Selecione um ou mais arquivos (PDF ou imagem).', 'error');
        return;
      }
      const btn = document.getElementById('btn-anexar-doc-cobrancas');
      btn.disabled = true;
      btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Enviando...';
      try {
        const formData = new FormData();
        for (let i = 0; i < input.files.length; i++) {
          formData.append('arquivo', input.files[i]);
        }
        const resp = await fetch(`/api/cobrancas/clientes/${cid}/documentos`, { method: 'POST', credentials: 'include', body: formData });
        const data = await resp.json().catch(() => ({}));
        if (!resp.ok) { ui.showNotification(data.error || 'Erro ao anexar documento.', 'error'); return; }
        input.value = '';
        await carregarListaDocumentosCobrancas(cid);
      } catch (err) { ui.showNotification('Erro ao enviar arquivo.', 'error'); }
      finally { btn.disabled = false; btn.innerHTML = '<i class="fas fa-upload"></i> Anexar documento'; }
    };
  }
  modal.setAttribute('data-cliente-id', clienteId);
  document.getElementById('modal-documentos-cobrancas-titulo').textContent = 'Documentos — ' + (clienteNome || 'Cliente #' + clienteId);
  document.getElementById('input-documento-cobrancas').value = '';
  modal.style.display = 'block';
  carregarListaDocumentosCobrancas(clienteId);
}

async function initDocumentosModalVer(modal, clienteId) {
  const ul = modal.querySelector('#modal-ver-cliente-docs-list');
  const form = modal.querySelector('#form-upload-doc-modal-ver');
  if (!ul || !form) return;

  async function renderDocs() {
    ul.innerHTML = '<li style="padding:12px;color:#64748b;"><i class="fas fa-spinner fa-spin"></i> Carregando...</li>';
    try {
      const resp = await fetch(`/api/cobrancas/clientes/${clienteId}/documentos`, { credentials: 'include' });
      const docs = await resp.json();
      if (!resp.ok) {
        ul.innerHTML = '<li style="padding:12px;color:#dc2626;">Erro ao carregar documentos.</li>';
        return;
      }
      if (docs.length === 0) {
        ul.innerHTML = '<li style="padding:12px;color:#64748b;">Nenhum documento anexado.</li>';
        return;
      }
      ul.innerHTML = docs.map(d => {
        const data = d.created_at ? new Date(d.created_at).toLocaleDateString('pt-BR') : '';
        const tipo = (d.tipo_mime || '').includes('pdf') ? 'file-pdf' : 'file-image';
        const nomeSafe = (d.nome_original || '').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
        return `<li style="display:flex;align-items:center;justify-content:space-between;padding:10px 0;border-bottom:1px solid #f1f5f9;">
          <span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${nomeSafe}"><i class="fas fa-${tipo}" style="margin-right:8px;color:#0d9488;"></i>${nomeSafe}</span>
          <span style="font-size:0.85rem;color:#64748b;margin-right:8px;">${data}</span>
          <button type="button" class="btn btn-sm btn-abrir-doc-modal-ver" data-doc-id="${d.id}" style="margin-right:8px;background:#0d9488;color:#fff;border:none;border-radius:6px;cursor:pointer;padding:4px 10px;"><i class="fas fa-external-link-alt"></i> Abrir</button>
          <button type="button" class="btn btn-danger btn-sm btn-excluir-doc-modal-ver" data-doc-id="${d.id}" style="padding:4px 10px;"><i class="fas fa-trash"></i></button>
        </li>`;
      }).join('');
      modal.querySelectorAll('.btn-abrir-doc-modal-ver').forEach(btn => {
        btn.onclick = async () => {
          try {
            const r = await fetch(`/api/cobrancas/clientes/${clienteId}/documentos/${btn.getAttribute('data-doc-id')}/arquivo`, { credentials: 'include' });
            if (!r.ok) { ui.showNotification('Erro ao abrir documento.', 'error'); return; }
            const blob = await r.blob();
            window.open(URL.createObjectURL(blob), '_blank');
          } catch (_) { ui.showNotification('Erro ao abrir documento.', 'error'); }
        };
      });
      modal.querySelectorAll('.btn-excluir-doc-modal-ver').forEach(btn => {
        btn.onclick = async () => {
          const ok = await ui.showConfirm('Remover este documento?', { title: 'Remover documento', confirmText: 'Remover', danger: true });
          if (!ok) return;
          try {
            const r = await fetch(`/api/cobrancas/clientes/${clienteId}/documentos/${btn.getAttribute('data-doc-id')}`, { method: 'DELETE', credentials: 'include' });
            if (r.ok) await renderDocs();
            else ui.showNotification('Erro ao remover.', 'error');
          } catch (_) { ui.showNotification('Erro ao remover.', 'error'); }
        };
      });
    } catch (_) {
      ul.innerHTML = '<li style="padding:12px;color:#dc2626;">Erro ao carregar documentos.</li>';
    }
  }

  form.onsubmit = async (e) => {
    e.preventDefault();
    const input = modal.querySelector('#input-doc-modal-ver');
    if (!input.files || input.files.length === 0) {
      ui.showNotification('Selecione um ou mais arquivos (PDF ou imagem).', 'error');
      return;
    }
    const btn = modal.querySelector('#btn-anexar-doc-modal-ver');
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Enviando...';
    try {
      const formData = new FormData();
      for (let i = 0; i < input.files.length; i++) {
        formData.append('arquivo', input.files[i]);
      }
      const resp = await fetch(`/api/cobrancas/clientes/${clienteId}/documentos`, { method: 'POST', credentials: 'include', body: formData });
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok) { ui.showNotification(data.error || 'Erro ao anexar documento.', 'error'); return; }
      input.value = '';
      await renderDocs();
    } catch (err) { ui.showNotification('Erro ao enviar arquivo.', 'error'); }
    finally { btn.disabled = false; btn.innerHTML = '<i class="fas fa-upload"></i> Anexar documento'; }
  };

  await renderDocs();
}

// Função para renderizar a lista negra
async function renderListaNegra() {
  const tbody = document.getElementById('lista-negra-clientes');
  if (!tbody) return;
  tbody.innerHTML = getSkeletonRows(6, 3);
  try {
    const clientes = await apiService.getClientes();
    if (!clientes || clientes.length === 0) {
      tbody.innerHTML = '<tr><td colspan="6"><div class="empty-state"><i class="fas fa-users-slash empty-state-icon"></i><div class="empty-state-title">Nenhum cliente encontrado</div><div class="empty-state-text">Cadastre clientes em "Adicionar Cliente" para começar.</div></div></td></tr>';
      return;
    }
    
    // Filtrar apenas clientes na lista negra
    const listaNegra = clientes.filter(cliente => cliente.status === 'Lista Negra');
    
    if (listaNegra.length === 0) {
      tbody.innerHTML = '<tr><td colspan="6"><div class="empty-state"><i class="fas fa-shield-alt empty-state-icon"></i><div class="empty-state-title">Nenhum cliente na lista negra</div><div class="empty-state-text">Nenhum cliente bloqueado no momento.</div></div></td></tr>';
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
    const ok = await ui.showConfirm('Tem certeza que deseja remover este cliente da lista negra?', { title: 'Remover da Lista Negra', confirmText: 'Remover' });
    if (!ok) return;
    
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
  tbody.innerHTML = getSkeletonRows(5, 3);
  try {
    const emprestimos = await apiService.getEmprestimos();
    // Filtrar apenas em aberto (status Ativo ou Pendente)
    const emAberto = (emprestimos || []).filter(e => {
      const status = (e.status || '').toLowerCase();
      return status === 'ativo' || status === 'pendente';
    });
    if (emAberto.length === 0) {
      tbody.innerHTML = '<tr><td colspan="5"><div class="empty-state"><i class="fas fa-receipt empty-state-icon"></i><div class="empty-state-title">Nenhuma cobrança em aberto</div><div class="empty-state-text">Todas as cobranças foram quitadas ou não há empréstimos ativos.</div></div></td></tr>';
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
    
    // Recarregar dashboard completo (empréstimos recentes + todos os empréstimos) se estiver na página do dashboard
    if (document.getElementById('emprestimos-recentes') || document.getElementById('cobrancas-pendentes')) {
      await dashboardController.loadDashboardData();
    }
    
    // Recarregar histórico de empréstimos se estiver na página de emprestimos
    if (document.getElementById('historico-emprestimos')) {
      await renderHistoricoEmprestimos();
    }
    
    // Recarregar lista de clientes se estiver na página de clientes
    if (document.getElementById('lista-clientes')) {
      await renderClientesLista();
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
async function sair() {
  const ok = await ui.showConfirm('Tem certeza que deseja sair?', { title: 'Sair', confirmText: 'Sair' });
  if (ok) {
    sessionStorage.removeItem('loggedIn');
    sessionStorage.removeItem('username');
    sessionStorage.removeItem('loginTime');
    window.location.href = 'login.html';
  }
}

// Inicializar quando o DOM estiver pronto
// Registrar Service Worker para PWA
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('./sw.js').catch(() => {});
}

// Dark mode - aplicar preferência salva
function applyDarkMode() {
  const dark = localStorage.getItem('jp-dark-mode') === 'true';
  document.body.classList.toggle('dark-mode', dark);
}
applyDarkMode();

document.addEventListener('DOMContentLoaded', async () => {
  app.init();
  
  // Carregar configurações do usuário
  await carregarConfiguracoesUsuario();

  // Event listener para busca na seção "Todos os Empréstimos" do Dashboard
  const searchTodosEmprestimos = document.getElementById('search-todos-emprestimos');
  if (searchTodosEmprestimos) {
    searchTodosEmprestimos.addEventListener('input', (e) => {
      dashboardController.renderEmprestimosFiltrados(e.target.value);
    });
  }

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
              <option value="fixo">Mensal</option>
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
      const tipoEmprestimoSelect = modal.querySelector('#modal-tipo');
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
      // Atualizar opções de Tipo de Cálculo conforme Tipo de Empréstimo (parcelado = só Valor Final/Parcela Fixo; mensal = só Valor Inicial + Juros)
      function atualizarTipoCalculoPorTipo() {
        const tipo = tipoEmprestimoSelect.value;
        if (tipo === 'parcelado') {
          tipoCalculoSelect.innerHTML = `
            <option value="valor_final">Valor Final Fixo</option>
            <option value="parcela_fixa">Valor da Parcela Fixo</option>
          `;
        } else {
          tipoCalculoSelect.innerHTML = `
            <option value="valor_inicial">Valor Inicial + Juros</option>
          `;
        }
        tipoCalculoSelect.dispatchEvent(new Event('change'));
      }
      tipoEmprestimoSelect.addEventListener('change', atualizarTipoCalculoPorTipo);
      atualizarTipoCalculoPorTipo();
      
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
            } else if (formData.porcentagem === '' || formData.porcentagem === undefined || parseFloat(formData.porcentagem) < 0) {
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
        // Verificar frequência selecionada
        const frequenciaSelecionada = formData.frequencia || 'monthly';
        console.log('📆 Frequência selecionada:', frequenciaSelecionada);
        console.log('📆 FormData frequencia:', formData.frequencia);
        
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
          frequencia: frequenciaSelecionada,
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
  tbody.innerHTML = getSkeletonRows(7, 3);
  
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
      tbody.innerHTML = '<tr><td colspan="7"><div class="empty-state"><i class="fas fa-check-circle empty-state-icon" style="color: #10b981;"></i><div class="empty-state-title">Nenhum empréstimo atrasado</div><div class="empty-state-text">Ótimo! Todos os pagamentos estão em dia.</div></div></td></tr>';
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

async function editCliente(id) {
  if (typeof clienteController !== 'undefined' && clienteController.editCliente) {
    return clienteController.editCliente(id);
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

// Abre diretamente o modal de cobrança para escolher mensagem (usado em Cobranças do Dia)
function abrirModalCobranca(id, numeroParcela) {
  if (typeof emprestimoController !== 'undefined' && emprestimoController.viewEmprestimo) {
    return emprestimoController.viewEmprestimo(id, {
      abreDiretoNotificar: true,
      numeroParcela: numeroParcela || undefined
    });
  }
  console.error('emprestimoController não está disponível');
}

// Disponibilizar funções globalmente
window.renderHistoricoEmprestimos = renderHistoricoEmprestimos;
window.viewEmprestimo = viewEmprestimo;
window.viewCliente = viewCliente;
window.deleteCliente = deleteCliente;
window.editCliente = editCliente;
window.cobrar = cobrar;
window.abrirModalCobranca = abrirModalCobranca;

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
    
    // Atualizar dashboard (empréstimos recentes + todos os empréstimos) se estiver na página
    await recarregarDadosPagina();
    
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
    
    // Atualizar dashboard se estiver na página
    await recarregarDadosPagina();
    
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

// Função para editar valor da parcela
async function editarValorParcela(emprestimoId, numeroParcela, valorAtual) {
  const valorFormatado = (valorAtual || '0').replace(',', '.');
  const modalContent = `
    <div style="padding: 1.5rem; max-width: 400px; margin: 0 auto;">
      <h3 style="margin-bottom: 1.5rem; color: #002f4b; text-align: center;">Alterar Valor da Parcela ${numeroParcela}</h3>
      <form id="form-alterar-valor-parcela">
        <div class="form-group" style="margin-bottom: 1rem;">
          <label style="display: block; margin-bottom: 0.5rem; font-weight: 600;">Novo Valor da Parcela (R$)</label>
          <input type="text" id="novo-valor-parcela" class="form-input" value="${valorFormatado.replace('.', ',')}" required placeholder="ex.: 1000,00" style="width: 100%; padding: 0.75rem; border: 1px solid #ddd; border-radius: 8px; font-size: 1rem;">
        </div>
        <div style="display: flex; gap: 1rem; margin-top: 1.5rem;">
          <button type="button" class="btn" style="flex: 1; background: #6b7280; color: #fff; padding: 0.75rem; border-radius: 8px; font-size: 1rem;" onclick="ui.closeModal()">Cancelar</button>
          <button type="submit" class="btn" style="flex: 1; background: #8b5cf6; color: #fff; padding: 0.75rem; border-radius: 8px; font-size: 1rem;">Salvar</button>
        </div>
      </form>
    </div>
  `;
  
  ui.showModal(modalContent, 'Alterar Valor da Parcela');
  
  const form = document.getElementById('form-alterar-valor-parcela');
  const inputValor = document.getElementById('novo-valor-parcela');
  if (inputValor) {
    inputValor.addEventListener('input', (e) => {
      let v = e.target.value.replace(/\D/g, '');
      v = (parseInt(v, 10) / 100).toFixed(2);
      e.target.value = v.replace('.', ',');
    });
  }
  
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const valorStr = document.getElementById('novo-valor-parcela').value.replace(',', '.');
    const valorNum = parseFloat(valorStr);
    
    if (isNaN(valorNum) || valorNum <= 0) {
      ui.showNotification('Informe um valor válido para a parcela', 'error');
      return;
    }
    
    try {
      const response = await fetch(`/api/cobrancas/emprestimos/${emprestimoId}/parcelas/${numeroParcela}/valor`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ valor_parcela: valorNum })
      });
      
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Erro ao atualizar valor');
      }
      
      ui.closeModal();
      ui.showNotification('Valor da parcela atualizado com sucesso!', 'success');
      
      await emprestimoController.viewEmprestimo(emprestimoId);
      
    } catch (error) {
      console.error('Erro ao atualizar valor da parcela:', error);
      ui.showNotification(error.message || 'Erro ao atualizar valor da parcela', 'error');
    }
  });
}

// Disponibilizar funções de parcelas globalmente
window.marcarParcelaPaga = marcarParcelaPaga;
window.marcarParcelaAtrasada = marcarParcelaAtrasada;
window.marcarParcelaPendente = marcarParcelaPendente;
window.editarDataParcela = editarDataParcela;
window.editarValorParcela = editarValorParcela;

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
