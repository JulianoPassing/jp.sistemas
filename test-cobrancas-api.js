const fetch = require('node-fetch');

async function testCobrancasAPI() {
  const baseURL = 'http://localhost:3000/api/cobrancas';
  
  console.log('🧪 Testando API de Cobranças...\n');
  
  try {
    // Teste 1: Verificar se a API está respondendo
    console.log('1. Testando conexão com a API...');
    const response = await fetch(`${baseURL}/session`);
    console.log('Status:', response.status);
    const sessionData = await response.json();
    console.log('Session data:', sessionData);
    
    // Teste 2: Tentar criar um cliente
    console.log('\n2. Testando criação de cliente...');
    const clienteData = {
      nome: 'João Silva Teste',
      cpf_cnpj: '123.456.789-00',
      telefone: '(11) 99999-9999'
    };
    
    const createResponse = await fetch(`${baseURL}/clientes`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(clienteData)
    });
    
    console.log('Status da criação:', createResponse.status);
    const createResult = await createResponse.json();
    console.log('Resultado da criação:', createResult);
    
    // Teste 3: Listar clientes
    console.log('\n3. Testando listagem de clientes...');
    const listResponse = await fetch(`${baseURL}/clientes`);
    console.log('Status da listagem:', listResponse.status);
    const clientes = await listResponse.json();
    console.log('Clientes encontrados:', clientes.length);
    console.log('Primeiro cliente:', clientes[0]);
    
  } catch (error) {
    console.error('❌ Erro no teste:', error.message);
  }
}

testCobrancasAPI(); 