/**
 * Script para diagnosticar problemas de sessão
 */

const fetch = require('node-fetch');

async function diagnoseSessionIssue() {
  const baseURL = 'http://localhost:3000/api/cobrancas';
  
  console.log('🔍 Diagnosticando Problema de Sessão...\n');
  
  try {
    // Teste 1: Verificar se o servidor está rodando
    console.log('1. Verificando se o servidor está rodando...');
    try {
      const response = await fetch(`${baseURL}/check-auth`);
      console.log('✅ Servidor está rodando');
    } catch (error) {
      console.log('❌ Servidor não está rodando ou não acessível');
      console.log('Execute: npm start ou node server.js');
      return;
    }
    
    // Teste 2: Verificar se o banco de sessões está funcionando
    console.log('\n2. Verificando banco de sessões...');
    try {
      const mysql = require('mysql2/promise');
      require('dotenv').config();
      
      const connection = await mysql.createConnection({
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: 'jpsistemas_sessions'
      });
      
      const [sessions] = await connection.execute('SELECT COUNT(*) as count FROM sessions');
      console.log(`✅ Banco de sessões funcionando (${sessions[0].count} sessões)`);
      await connection.end();
    } catch (error) {
      console.log('❌ Problema com banco de sessões:', error.message);
      console.log('Execute: node scripts/test-session-db.js');
    }
    
    // Teste 3: Fazer login e verificar sessão
    console.log('\n3. Testando login e sessão...');
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
    
    if (!loginResult.success) {
      console.log('❌ Login falhou, verifique as credenciais');
      return;
    }
    
    // Pegar cookies da resposta
    const cookies = loginResponse.headers.get('set-cookie');
    console.log('Cookies recebidos:', cookies ? 'Sim' : 'Não');
    
    // Teste 4: Verificar autenticação imediatamente após login
    console.log('\n4. Verificando autenticação após login...');
    const checkAuthResponse1 = await fetch(`${baseURL}/check-auth`, {
      credentials: 'include'
    });
    
    console.log('Status da verificação:', checkAuthResponse1.status);
    const checkAuthData1 = await checkAuthResponse1.json();
    console.log('Resposta da verificação:', checkAuthData1);
    
    if (!checkAuthData1.authenticated) {
      console.log('❌ Sessão não foi criada após login');
    } else {
      console.log('✅ Sessão criada com sucesso');
    }
    
    // Teste 5: Verificar sessão no servidor
    console.log('\n5. Verificando sessão no servidor...');
    const sessionResponse = await fetch(`${baseURL}/session`, {
      credentials: 'include'
    });
    
    console.log('Status da sessão:', sessionResponse.status);
    const sessionData = await sessionResponse.json();
    console.log('Dados da sessão:', sessionData);
    
    // Teste 6: Simular "refresh" (nova requisição)
    console.log('\n6. Simulando refresh...');
    const checkAuthResponse2 = await fetch(`${baseURL}/check-auth`, {
      credentials: 'include'
    });
    
    console.log('Status após "refresh":', checkAuthResponse2.status);
    const checkAuthData2 = await checkAuthResponse2.json();
    console.log('Resposta após "refresh":', checkAuthData2);
    
    // Teste 7: Verificar cookies no banco
    console.log('\n7. Verificando cookies no banco de dados...');
    try {
      const mysql = require('mysql2/promise');
      const connection = await mysql.createConnection({
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: 'jpsistemas_sessions'
      });
      
      const [activeSessions] = await connection.execute(
        'SELECT session_id, expires, LENGTH(data) as data_size FROM sessions WHERE expires > UNIX_TIMESTAMP()'
      );
      
      console.log(`Sessões ativas no banco: ${activeSessions.length}`);
      if (activeSessions.length > 0) {
        activeSessions.forEach((session, index) => {
          const expiresDate = new Date(session.expires * 1000);
          console.log(`  Sessão ${index + 1}:`);
          console.log(`    ID: ${session.session_id.substring(0, 20)}...`);
          console.log(`    Expira: ${expiresDate.toLocaleString('pt-BR')}`);
          console.log(`    Tamanho: ${session.data_size} bytes`);
        });
      }
      
      await connection.end();
    } catch (error) {
      console.log('❌ Erro ao verificar sessões no banco:', error.message);
    }
    
    // Análise dos resultados
    console.log('\n📊 ANÁLISE DOS RESULTADOS:');
    console.log('');
    
    if (checkAuthData1.authenticated && checkAuthData2.authenticated) {
      console.log('✅ Sessão funcionando corretamente');
      console.log('   - Login criou sessão');
      console.log('   - Sessão persiste após "refresh"');
    } else if (checkAuthData1.authenticated && !checkAuthData2.authenticated) {
      console.log('❌ Sessão perdida após "refresh"');
      console.log('   - Login criou sessão');
      console.log('   - Sessão não persiste (PROBLEMA)');
    } else if (!checkAuthData1.authenticated) {
      console.log('❌ Sessão não foi criada');
      console.log('   - Login não criou sessão (PROBLEMA)');
    }
    
    // Sugestões de correção
    console.log('\n🔧 SUGESTÕES DE CORREÇÃO:');
    
    if (!checkAuthData1.authenticated) {
      console.log('1. Verificar configuração de sessão no server.js');
      console.log('2. Verificar se o banco jpsistemas_sessions existe');
      console.log('3. Verificar se a tabela sessions existe');
      console.log('4. Verificar variáveis de ambiente (.env)');
    } else if (!checkAuthData2.authenticated) {
      console.log('1. Verificar configuração de cookies no server.js');
      console.log('2. Verificar se secure: false está configurado');
      console.log('3. Verificar se sameSite: "lax" está configurado');
      console.log('4. Verificar se httpOnly: true está configurado');
    }
    
    console.log('\n🧪 Para testar o banco de sessões:');
    console.log('   node scripts/test-session-db.js');
    
    console.log('\n🧪 Para testar o comportamento de refresh:');
    console.log('   node scripts/test-refresh-behavior.js');
    
  } catch (error) {
    console.error('❌ Erro no diagnóstico:', error.message);
  }
}

// Executar diagnóstico
diagnoseSessionIssue(); 