/**
 * Script para testar o sistema de autenticação e logout automático
 */

const fetch = require('node-fetch');

async function testAuthSystem() {
  const baseURL = 'http://localhost:3000/api/cobrancas';
  
  console.log('🧪 Testando Sistema de Autenticação...\n');
  
  try {
    // Teste 1: Verificar se não está autenticado inicialmente
    console.log('1. Testando verificação de autenticação (sem login)...');
    const checkAuthResponse = await fetch(`${baseURL}/check-auth`, {
      credentials: 'include'
    });
    console.log('Status:', checkAuthResponse.status);
    const checkAuthData = await checkAuthResponse.json();
    console.log('Resposta:', checkAuthData);
    console.log('');
    
    // Teste 2: Tentar fazer login
    console.log('2. Testando login...');
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
    
    if (loginResult.success) {
      // Teste 3: Verificar se está autenticado após login
      console.log('3. Testando verificação de autenticação (após login)...');
      const checkAuthResponse2 = await fetch(`${baseURL}/check-auth`, {
        credentials: 'include'
      });
      console.log('Status:', checkAuthResponse2.status);
      const checkAuthData2 = await checkAuthResponse2.json();
      console.log('Resposta:', checkAuthData2);
      console.log('');
      
      // Teste 4: Verificar sessão
      console.log('4. Testando rota de sessão...');
      const sessionResponse = await fetch(`${baseURL}/session`, {
        credentials: 'include'
      });
      console.log('Status da sessão:', sessionResponse.status);
      const sessionData = await sessionResponse.json();
      console.log('Dados da sessão:', sessionData);
      console.log('');
      
      // Teste 5: Fazer logout
      console.log('5. Testando logout...');
      const logoutResponse = await fetch(`${baseURL}/logout`, {
        method: 'POST',
        credentials: 'include'
      });
      console.log('Status do logout:', logoutResponse.status);
      const logoutResult = await logoutResponse.json();
      console.log('Resultado do logout:', logoutResult);
      console.log('');
      
      // Teste 6: Verificar se não está mais autenticado após logout
      console.log('6. Testando verificação de autenticação (após logout)...');
      const checkAuthResponse3 = await fetch(`${baseURL}/check-auth`, {
        credentials: 'include'
      });
      console.log('Status:', checkAuthResponse3.status);
      const checkAuthData3 = await checkAuthResponse3.json();
      console.log('Resposta:', checkAuthData3);
      console.log('');
      
    } else {
      console.log('❌ Login falhou, não foi possível continuar os testes');
    }
    
    console.log('✅ Testes de autenticação concluídos!');
    
  } catch (error) {
    console.error('❌ Erro nos testes:', error.message);
  }
}

// Executar testes
testAuthSystem(); 