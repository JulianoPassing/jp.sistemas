const mysql = require('mysql2/promise');
const axios = require('axios');
require('dotenv').config();

async function testarAPIUsuarioNovo() {
  const username = 'teste1234';
  const password = 'teste1234';
  const baseURL = 'http://localhost:3000'; // Altere se necessário
  
  console.log('🔍 Testando API para usuário recém-criado...');
  console.log(`👤 Usuário: ${username}`);
  console.log(`🌐 URL Base: ${baseURL}`);
  console.log('');

  try {
    // 1. Testar se o banco do usuário está acessível
    console.log('📦 Testando acesso ao banco do usuário...');
    const connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'jpsistemas',
      password: process.env.DB_PASSWORD || 'Juliano@95',
      database: 'jpcobrancas_teste1234',
      charset: 'utf8mb4'
    });

    // Testar consultas básicas
    const [tabelas] = await connection.execute('SHOW TABLES');
    console.log('✅ Tabelas encontradas:', tabelas.map(t => Object.values(t)[0]));

    const [counts] = await connection.execute(`
      SELECT 
        (SELECT COUNT(*) FROM clientes_cobrancas) as clientes,
        (SELECT COUNT(*) FROM emprestimos) as emprestimos,
        (SELECT COUNT(*) FROM cobrancas) as cobrancas,
        (SELECT COUNT(*) FROM pagamentos) as pagamentos,
        (SELECT COUNT(*) FROM parcelas) as parcelas
    `);
    console.log('✅ Contadores:', counts[0]);

    await connection.end();

    // 2. Testar login via API
    console.log('\n🔐 Testando login via API...');
    const cookieJar = [];
    
    const loginResponse = await axios.post(`${baseURL}/api/cobrancas/login`, {
      username: username,
      password: password
    }, {
      headers: { 'Content-Type': 'application/json' },
      withCredentials: true
    });

    console.log('✅ Login bem-sucedido:', loginResponse.data);
    
    // Extrair cookies
    if (loginResponse.headers['set-cookie']) {
      cookieJar.push(...loginResponse.headers['set-cookie']);
      console.log('🍪 Cookies recebidos:', cookieJar.length);
    }

    // 3. Testar APIs específicas
    const endpoints = [
      '/api/cobrancas/check-auth',
      '/api/cobrancas/usuario-info',
      '/api/cobrancas/clientes',
      '/api/cobrancas/emprestimos',
      '/api/cobrancas/cobrancas',
      '/api/cobrancas/dashboard'
    ];

    console.log('\n🧪 Testando endpoints específicos...');
    
    for (const endpoint of endpoints) {
      try {
        console.log(`\n📍 Testando: ${endpoint}`);
        
        const response = await axios.get(`${baseURL}${endpoint}`, {
          headers: {
            'Cookie': cookieJar.join('; ')
          },
          withCredentials: true,
          timeout: 10000
        });

        console.log(`✅ ${endpoint}: Status ${response.status}`);
        
        if (endpoint === '/api/cobrancas/emprestimos') {
          console.log('📊 Dados de empréstimos:', response.data);
        } else if (endpoint === '/api/cobrancas/dashboard') {
          console.log('📊 Dados do dashboard:', JSON.stringify(response.data, null, 2));
        } else {
          console.log(`📊 Resposta (primeiros 200 chars):`, 
            JSON.stringify(response.data).substring(0, 200) + '...');
        }
        
      } catch (apiError) {
        console.log(`❌ ${endpoint}: Erro ${apiError.response?.status || 'NETWORK'}`);
        
        if (apiError.response?.data) {
          console.log(`📋 Erro detalhado:`, apiError.response.data);
        }
        
        if (apiError.response?.status === 500) {
          console.log('🚨 ERRO 500 ENCONTRADO!');
          console.log('📄 Headers da resposta:', apiError.response.headers);
        }
      }
    }

  } catch (error) {
    console.error('❌ Erro geral:', error.message);
    
    if (error.code === 'ECONNREFUSED') {
      console.log('💡 Servidor não está rodando. Execute: npm start');
    }
  }
}

async function verificarLogsServidor() {
  console.log('\n📋 VERIFICAÇÕES ADICIONAIS:');
  console.log('');
  console.log('1. Verificar se o servidor está rodando:');
  console.log('   ps aux | grep node');
  console.log('');
  console.log('2. Verificar logs do servidor:');
  console.log('   tail -f /var/log/jpsistemas.log');
  console.log('   ou verificar onde estão os logs do seu servidor');
  console.log('');
  console.log('3. Verificar se algum processo está usando a porta:');
  console.log('   netstat -tlnp | grep 3000');
  console.log('');
  console.log('4. Testar diretamente no banco:');
  console.log('   mysql -u jpsistemas -p -e "USE jpcobrancas_teste1234; SELECT * FROM emprestimos;"');
  console.log('');
  console.log('5. Verificar estrutura da tabela emprestimos:');
  console.log('   mysql -u jpsistemas -p -e "USE jpcobrancas_teste1234; DESCRIBE emprestimos;"');
}

async function testarEmprestimosEspecifico() {
  console.log('\n🎯 TESTE ESPECÍFICO - TABELA EMPRESTIMOS');
  console.log('');
  
  try {
    const connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'jpsistemas',
      password: process.env.DB_PASSWORD || 'Juliano@95',
      database: 'jpcobrancas_teste1234',
      charset: 'utf8mb4'
    });

    // Verificar estrutura da tabela
    console.log('📋 Estrutura da tabela emprestimos:');
    const [estrutura] = await connection.execute('DESCRIBE emprestimos');
    console.table(estrutura);

    // Testar query básica
    console.log('\n📊 Testando SELECT básico:');
    const [emprestimos] = await connection.execute('SELECT * FROM emprestimos');
    console.log('Registros encontrados:', emprestimos.length);

    // Testar query com JOIN (como pode estar fazendo na API)
    console.log('\n🔗 Testando SELECT com JOIN:');
    const [emprestimosJoin] = await connection.execute(`
      SELECT 
        e.*,
        c.nome as cliente_nome
      FROM emprestimos e
      LEFT JOIN clientes_cobrancas c ON e.cliente_id = c.id
      ORDER BY e.created_at DESC
    `);
    console.log('Registros com JOIN:', emprestimosJoin.length);

    await connection.end();
    console.log('✅ Testes de banco concluídos com sucesso');

  } catch (dbError) {
    console.error('❌ Erro no teste de banco:', dbError.message);
  }
}

// Executar todos os testes
async function executarTodosTestes() {
  await testarAPIUsuarioNovo();
  await testarEmprestimosEspecifico();
  await verificarLogsServidor();
}

executarTodosTestes(); 