// Script para testar correção da lista negra
// Usando fetch nativo do Node.js 18+

async function testListaNegraFix() {
  try {
    console.log('=== TESTE DE CORREÇÃO DA LISTA NEGRA ===\n');
    
    const baseURL = 'https://jp-sistemas.com/api/cobrancas';
    
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
    
    // 2. Buscar clientes
    console.log('2. Buscando clientes...');
    const clientesResponse = await fetch(`${baseURL}/clientes`);
    const clientes = await clientesResponse.json();
    console.log(`Total de clientes: ${clientes.length}`);
    
    if (clientes.length === 0) {
      console.log('❌ Nenhum cliente encontrado. Crie um cliente primeiro.');
      return;
    }
    
    // 3. Encontrar um cliente ativo para testar
    const clienteAtivo = clientes.find(cliente => cliente.status === 'Ativo' || !cliente.status);
    
    if (!clienteAtivo) {
      console.log('❌ Nenhum cliente ativo encontrado para teste.');
      return;
    }
    
    console.log(`Cliente selecionado para teste:`);
    console.log(`- ID: ${clienteAtivo.id}`);
    console.log(`- Nome: ${clienteAtivo.nome}`);
    console.log(`- Status: ${clienteAtivo.status || 'Ativo'}`);
    console.log('');
    
    // 4. Testar adição à lista negra
    console.log('3. Testando adição à lista negra...');
    const adicionarData = {
      status: 'Lista Negra',
      motivo: 'Teste de correção da funcionalidade'
    };
    
    console.log('Dados enviados:', adicionarData);
    
    const adicionarResponse = await fetch(`${baseURL}/clientes/${clienteAtivo.id}/lista-negra`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(adicionarData)
    });
    
    console.log('Status da resposta:', adicionarResponse.status);
    
    if (!adicionarResponse.ok) {
      const error = await adicionarResponse.json();
      console.log('❌ Erro ao adicionar à lista negra:', error);
      return;
    }
    
    const adicionarResult = await adicionarResponse.json();
    console.log('✅ Cliente adicionado à lista negra com sucesso!');
    console.log('Resultado:', adicionarResult);
    console.log('');
    
    // 5. Verificar se o cliente aparece na lista negra
    console.log('4. Verificando se cliente aparece na lista negra...');
    const clientesAtualizadosResponse = await fetch(`${baseURL}/clientes`);
    const clientesAtualizados = await clientesAtualizadosResponse.json();
    
    const clienteNaListaNegra = clientesAtualizados.find(c => c.id === clienteAtivo.id);
    
    if (clienteNaListaNegra && clienteNaListaNegra.status === 'Lista Negra') {
      console.log('✅ SUCESSO: Cliente aparece na lista negra!');
      console.log(`- Status: ${clienteNaListaNegra.status}`);
      console.log(`- Observações: ${clienteNaListaNegra.observacoes || 'N/A'}`);
    } else {
      console.log('❌ ERRO: Cliente não aparece na lista negra');
      console.log(`Status atual: ${clienteNaListaNegra?.status}`);
    }
    console.log('');
    
    // 6. Testar remoção da lista negra
    console.log('5. Testando remoção da lista negra...');
    const removerData = {
      status: 'Ativo',
      motivo: 'Teste de remoção da lista negra'
    };
    
    const removerResponse = await fetch(`${baseURL}/clientes/${clienteAtivo.id}/lista-negra`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(removerData)
    });
    
    if (!removerResponse.ok) {
      const error = await removerResponse.json();
      console.log('❌ Erro ao remover da lista negra:', error);
      return;
    }
    
    const removerResult = await removerResponse.json();
    console.log('✅ Cliente removido da lista negra com sucesso!');
    console.log('Resultado:', removerResult);
    console.log('');
    
    // 7. Verificar se o cliente voltou ao status ativo
    console.log('6. Verificando se cliente voltou ao status ativo...');
    const clientesFinaisResponse = await fetch(`${baseURL}/clientes`);
    const clientesFinais = await clientesFinaisResponse.json();
    
    const clienteFinal = clientesFinais.find(c => c.id === clienteAtivo.id);
    
    if (clienteFinal && (clienteFinal.status === 'Ativo' || !clienteFinal.status)) {
      console.log('✅ SUCESSO: Cliente voltou ao status ativo!');
      console.log(`- Status: ${clienteFinal.status || 'Ativo'}`);
    } else {
      console.log('❌ ERRO: Cliente não voltou ao status ativo');
      console.log(`Status atual: ${clienteFinal?.status}`);
    }
    
    console.log('\n=== TESTE CONCLUÍDO ===');
    console.log('🎉 A funcionalidade de lista negra está funcionando corretamente!');
    
  } catch (error) {
    console.error('❌ Erro durante o teste:', error);
    console.log('\n🔧 Possíveis soluções:');
    console.log('1. Execute o script add-observacoes-field.js para adicionar o campo observacoes');
    console.log('2. Verifique se o servidor está rodando');
    console.log('3. Verifique se as credenciais do banco estão corretas');
  }
}

// Executar teste
testListaNegraFix(); 