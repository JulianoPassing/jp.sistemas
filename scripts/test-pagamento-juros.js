// Script para testar pagamento de juros
// Usando fetch nativo do Node.js 18+

async function testPagamentoJuros() {
  try {
    console.log('=== TESTE DE PAGAMENTO DE JUROS ===\n');
    
    const baseURL = 'http://localhost:3000/api/cobrancas';
    
    // 1. Verificar sessão
    console.log('1. Verificando sessão...');
    const sessionResponse = await fetch(`${baseURL}/session`);
    const sessionData = await sessionResponse.json();
    console.log('Sessão:', sessionData.authenticated ? 'Ativa' : 'Inativa');
    console.log('');
    
    if (!sessionData.authenticated) {
      console.log('❌ Sessão não autenticada. Faça login primeiro.');
      return;
    }
    
    // 2. Buscar empréstimos
    console.log('2. Buscando empréstimos...');
    const emprestimosResponse = await fetch(`${baseURL}/emprestimos`);
    const emprestimos = await emprestimosResponse.json();
    console.log(`Total de empréstimos: ${emprestimos.length}`);
    
    if (emprestimos.length === 0) {
      console.log('❌ Nenhum empréstimo encontrado. Crie um empréstimo primeiro.');
      return;
    }
    
    // 3. Encontrar um empréstimo ativo para testar
    const emprestimoAtivo = emprestimos.find(emp => emp.status === 'Ativo' || emp.status === 'Em Atraso');
    
    if (!emprestimoAtivo) {
      console.log('❌ Nenhum empréstimo ativo encontrado para teste.');
      return;
    }
    
    console.log(`Empréstimo selecionado para teste:`);
    console.log(`- ID: ${emprestimoAtivo.id}`);
    console.log(`- Cliente: ${emprestimoAtivo.cliente_nome}`);
    console.log(`- Valor: R$ ${emprestimoAtivo.valor}`);
    console.log(`- Juros: ${emprestimoAtivo.juros_mensal}%`);
    console.log(`- Vencimento: ${emprestimoAtivo.data_vencimento}`);
    console.log(`- Status: ${emprestimoAtivo.status}`);
    console.log('');
    
    // 4. Calcular juros acumulados
    const valorInicial = parseFloat(emprestimoAtivo.valor);
    const jurosMensal = parseFloat(emprestimoAtivo.juros_mensal);
    const jurosAcumulados = valorInicial * (jurosMensal / 100);
    
    console.log('3. Calculando juros acumulados...');
    console.log(`- Valor inicial: R$ ${valorInicial.toFixed(2)}`);
    console.log(`- Juros mensal: ${jurosMensal}%`);
    console.log(`- Juros acumulados: R$ ${jurosAcumulados.toFixed(2)}`);
    console.log('');
    
    // 5. Simular pagamento de juros
    console.log('4. Simulando pagamento de juros...');
    const pagamentoData = {
      valor_juros_pago: jurosAcumulados,
      data_pagamento: new Date().toISOString().split('T')[0],
      forma_pagamento: 'PIX',
      observacoes: 'Teste de pagamento de juros'
    };
    
    console.log('Dados do pagamento:', pagamentoData);
    console.log('');
    
    const pagamentoResponse = await fetch(`${baseURL}/emprestimos/${emprestimoAtivo.id}/pagamento-juros`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(pagamentoData)
    });
    
    if (!pagamentoResponse.ok) {
      const error = await pagamentoResponse.json();
      console.log('❌ Erro no pagamento:', error);
      return;
    }
    
    const resultado = await pagamentoResponse.json();
    console.log('✅ Pagamento processado com sucesso!');
    console.log('Resultado:', resultado);
    console.log('');
    
    // 6. Verificar empréstimo atualizado
    console.log('5. Verificando empréstimo atualizado...');
    const emprestimoAtualizadoResponse = await fetch(`${baseURL}/emprestimos/${emprestimoAtivo.id}`);
    const emprestimoAtualizado = await emprestimoAtualizadoResponse.json();
    
    console.log('Dados atualizados:');
    console.log(`- Valor: R$ ${emprestimoAtualizado.valor}`);
    console.log(`- Vencimento: ${emprestimoAtualizado.data_vencimento}`);
    console.log(`- Status: ${emprestimoAtualizado.status}`);
    console.log('');
    
    // 7. Verificar se o valor voltou ao inicial
    const valorAtual = parseFloat(emprestimoAtualizado.valor);
    if (Math.abs(valorAtual - valorInicial) < 0.01) {
      console.log('✅ SUCESSO: Valor da dívida voltou ao valor inicial!');
    } else {
      console.log('❌ ERRO: Valor da dívida não voltou ao valor inicial');
      console.log(`Esperado: R$ ${valorInicial.toFixed(2)}`);
      console.log(`Atual: R$ ${valorAtual.toFixed(2)}`);
    }
    
    // 8. Verificar se o prazo foi estendido
    const vencimentoOriginal = new Date(emprestimoAtivo.data_vencimento);
    const vencimentoNovo = new Date(emprestimoAtualizado.data_vencimento);
    const diasAdicionados = Math.round((vencimentoNovo - vencimentoOriginal) / (1000 * 60 * 60 * 24));
    
    if (diasAdicionados >= 30) {
      console.log('✅ SUCESSO: Prazo estendido em 30 dias!');
    } else {
      console.log('❌ ERRO: Prazo não foi estendido corretamente');
      console.log(`Dias adicionados: ${diasAdicionados}`);
    }
    
    // 9. Verificar se o status voltou para Ativo
    if (emprestimoAtualizado.status === 'Ativo') {
      console.log('✅ SUCESSO: Status voltou para Ativo!');
    } else {
      console.log('❌ ERRO: Status não voltou para Ativo');
      console.log(`Status atual: ${emprestimoAtualizado.status}`);
    }
    
    console.log('\n=== TESTE CONCLUÍDO ===');
    
  } catch (error) {
    console.error('❌ Erro durante o teste:', error);
  }
}

// Executar teste
testPagamentoJuros(); 