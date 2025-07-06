/**
 * Script para testar navegação entre páginas sem logout
 */

const fetch = require('node-fetch');

async function testNavigation() {
  const baseURL = 'http://localhost:3000/api/cobrancas';
  
  console.log('🧪 Testando Navegação entre Páginas...\n');
  
  try {
    // Teste 1: Fazer login
    console.log('1. Fazendo login...');
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
    
    // Teste 3: Simular navegação rápida (múltiplas verificações)
    console.log('3. Simulando navegação rápida (múltiplas verificações)...');
    
    for (let i = 1; i <= 5; i++) {
      console.log(`   Verificação ${i}/5...`);
      const checkResponse = await fetch(`${baseURL}/check-auth`, {
        credentials: 'include'
      });
      const checkData = await checkResponse.json();
      
      if (checkData.authenticated) {
        console.log(`   ✅ Verificação ${i}: Autenticado`);
      } else {
        console.log(`   ❌ Verificação ${i}: Não autenticado`);
        break;
      }
      
      // Pequena pausa para simular navegação
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    console.log('');
    
    // Teste 4: Testar diferentes endpoints
    console.log('4. Testando diferentes endpoints...');
    
    const endpoints = [
      '/session',
      '/check-auth',
      '/dashboard'
    ];
    
    for (const endpoint of endpoints) {
      console.log(`   Testando ${endpoint}...`);
      try {
        const response = await fetch(`${baseURL}${endpoint}`, {
          credentials: 'include'
        });
        console.log(`   Status: ${response.status}`);
        
        if (response.ok) {
          const data = await response.json();
          console.log(`   ✅ ${endpoint}: OK`);
        } else {
          console.log(`   ❌ ${endpoint}: Erro ${response.status}`);
        }
      } catch (error) {
        console.log(`   ❌ ${endpoint}: Erro - ${error.message}`);
      }
    }
    console.log('');
    
    // Teste 5: Verificar se ainda está autenticado
    console.log('5. Verificação final de autenticação...');
    const finalCheckResponse = await fetch(`${baseURL}/check-auth`, {
      credentials: 'include'
    });
    console.log('Status:', finalCheckResponse.status);
    const finalCheckData = await finalCheckResponse.json();
    console.log('Resposta:', finalCheckData);
    console.log('');
    
    if (finalCheckData.authenticated) {
      console.log('✅ Navegação funcionando corretamente!');
      console.log('✅ Usuário permanece autenticado durante navegação');
    } else {
      console.log('❌ Problema na navegação - usuário foi deslogado');
    }
    
    // Teste 6: Fazer logout
    console.log('6. Fazendo logout...');
    const logoutResponse = await fetch(`${baseURL}/logout`, {
      method: 'POST',
      credentials: 'include'
    });
    console.log('Status do logout:', logoutResponse.status);
    const logoutResult = await logoutResponse.json();
    console.log('Resultado do logout:', logoutResult);
    console.log('');
    
  } catch (error) {
    console.error('❌ Erro nos testes:', error.message);
  }
}

// Executar testes
testNavigation(); 