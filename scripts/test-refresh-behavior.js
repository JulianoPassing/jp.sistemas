/**
 * Script para testar comportamento de refresh e guia anônima
 */

const fetch = require('node-fetch');

async function testRefreshBehavior() {
  const baseURL = 'http://localhost:3000/api/cobrancas';
  
  console.log('🧪 Testando Comportamento de Refresh e Guia Anônima...\n');
  
  try {
    // Teste 1: Login normal
    console.log('1. Fazendo login normal...');
    const loginData = {
      username: 'cobranca',
      password: 'cobranca123'
    };
    
    const loginResponse = await fetch(`${baseURL}/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      credentials: 'include',
      body: JSON.stringify(loginData)
    });
    
    console.log('Status do login:', loginResponse.status);
    const loginResult = await loginResponse.json();
    console.log('Resultado do login:', loginResult);
    console.log('');
    
    if (!loginResult.success) {
      console.log('❌ Login falhou, não foi possível continuar os testes');
      return;
    }
    
    // Teste 2: Verificar autenticação após login
    console.log('2. Verificando autenticação após login...');
    const checkAuthResponse1 = await fetch(`${baseURL}/check-auth`, {
      credentials: 'include'
    });
    console.log('Status:', checkAuthResponse1.status);
    const checkAuthData1 = await checkAuthResponse1.json();
    console.log('Resposta:', checkAuthData1);
    console.log('');
    
    // Teste 3: Simular "refresh" (nova requisição com mesmos cookies)
    console.log('3. Simulando refresh (nova requisição)...');
    const checkAuthResponse2 = await fetch(`${baseURL}/check-auth`, {
      credentials: 'include'
    });
    console.log('Status após "refresh":', checkAuthResponse2.status);
    const checkAuthData2 = await checkAuthResponse2.json();
    console.log('Resposta após "refresh":', checkAuthData2);
    console.log('');
    
    // Teste 4: Simular "guia anônima" (sem cookies)
    console.log('4. Simulando guia anônima (sem cookies)...');
    const checkAuthResponse3 = await fetch(`${baseURL}/check-auth`, {
      credentials: 'omit' // Sem cookies
    });
    console.log('Status sem cookies:', checkAuthResponse3.status);
    const checkAuthData3 = await checkAuthResponse3.json();
    console.log('Resposta sem cookies:', checkAuthData3);
    console.log('');
    
    // Teste 5: Verificar sessão
    console.log('5. Verificando sessão...');
    const sessionResponse = await fetch(`${baseURL}/session`, {
      credentials: 'include'
    });
    console.log('Status da sessão:', sessionResponse.status);
    const sessionData = await sessionResponse.json();
    console.log('Dados da sessão:', sessionData);
    console.log('');
    
    // Teste 6: Simular logout e verificar
    console.log('6. Fazendo logout...');
    const logoutResponse = await fetch(`${baseURL}/logout`, {
      method: 'POST',
      credentials: 'include'
    });
    console.log('Status do logout:', logoutResponse.status);
    const logoutResult = await logoutResponse.json();
    console.log('Resultado do logout:', logoutResult);
    console.log('');
    
    // Teste 7: Verificar após logout
    console.log('7. Verificando após logout...');
    const checkAuthResponse4 = await fetch(`${baseURL}/check-auth`, {
      credentials: 'include'
    });
    console.log('Status após logout:', checkAuthResponse4.status);
    const checkAuthData4 = await checkAuthResponse4.json();
    console.log('Resposta após logout:', checkAuthData4);
    console.log('');
    
    // Análise dos resultados
    console.log('📊 ANÁLISE DOS RESULTADOS:');
    console.log('');
    
    if (checkAuthData1.authenticated && checkAuthData2.authenticated) {
      console.log('✅ Comportamento NORMAL: Login mantido após "refresh"');
    } else {
      console.log('❌ Problema: Login perdido após "refresh"');
    }
    
    if (!checkAuthData3.authenticated) {
      console.log('✅ Comportamento CORRETO: Sem autenticação em "guia anônima"');
    } else {
      console.log('❌ Problema: Autenticação mantida sem cookies');
    }
    
    if (!checkAuthData4.authenticated) {
      console.log('✅ Comportamento CORRETO: Logout funcionando');
    } else {
      console.log('❌ Problema: Logout não funcionou');
    }
    
    console.log('');
    console.log('💡 EXPLICAÇÃO:');
    console.log('- F5 em guia anônima SEMPRE pede login (comportamento esperado)');
    console.log('- Guia anônima não salva cookies/sessões entre refresh');
    console.log('- Sessão é perdida em modo anônimo');
    console.log('- Isso é uma medida de segurança do navegador');
    
  } catch (error) {
    console.error('❌ Erro nos testes:', error.message);
  }
}

// Executar testes
testRefreshBehavior(); 