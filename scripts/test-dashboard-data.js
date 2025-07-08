const mysql = require('mysql2/promise');

async function testDashboardData() {
  console.log('🔍 Verificando dados do dashboard...\n');
  
  try {
    // Configuração do banco - tentativa de conexão
    const dbConfig = {
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: 'cobrancas_admin'
    };
    
    console.log('📊 Conectando ao banco:', dbConfig.database);
    const connection = await mysql.createConnection(dbConfig);
    
    // 1. Verificar se as tabelas existem
    console.log('\n1. Verificando estrutura das tabelas...');
    const [tables] = await connection.execute('SHOW TABLES');
    const tableNames = tables.map(t => Object.values(t)[0]);
    console.log('✅ Tabelas encontradas:', tableNames);
    
    // 2. Verificar dados nas tabelas principais
    console.log('\n2. Verificando dados nas tabelas...');
    
    // Empréstimos
    const [emprestimosCount] = await connection.execute('SELECT COUNT(*) as total FROM emprestimos');
    console.log(`📋 Empréstimos na tabela: ${emprestimosCount[0].total}`);
    
    if (emprestimosCount[0].total > 0) {
      const [emprestimosAmostra] = await connection.execute('SELECT * FROM emprestimos LIMIT 3');
      console.log('📝 Amostra de empréstimos:', emprestimosAmostra);
    }
    
    // Clientes
    const [clientesCount] = await connection.execute('SELECT COUNT(*) as total FROM clientes_cobrancas');
    console.log(`👥 Clientes na tabela: ${clientesCount[0].total}`);
    
    if (clientesCount[0].total > 0) {
      const [clientesAmostra] = await connection.execute('SELECT * FROM clientes_cobrancas LIMIT 3');
      console.log('📝 Amostra de clientes:', clientesAmostra);
    }
    
    // Cobranças
    const [cobrancasCount] = await connection.execute('SELECT COUNT(*) as total FROM cobrancas');
    console.log(`💰 Cobranças na tabela: ${cobrancasCount[0].total}`);
    
    if (cobrancasCount[0].total > 0) {
      const [cobrancasAmostra] = await connection.execute('SELECT * FROM cobrancas LIMIT 3');
      console.log('📝 Amostra de cobranças:', cobrancasAmostra);
    }
    
    // 3. Testar as queries do dashboard
    console.log('\n3. Testando queries do dashboard...');
    
    // Query de empréstimos
    console.log('📊 Testando query de empréstimos...');
    const [emprestimosStats] = await connection.execute(`
      SELECT 
        COUNT(CASE WHEN status IN ('Ativo', 'Pendente') AND cliente_id IS NOT NULL THEN 1 END) as total_emprestimos,
        COALESCE(SUM(CASE WHEN status IN ('Ativo', 'Pendente') AND cliente_id IS NOT NULL THEN COALESCE(valor_inicial, valor) ELSE 0 END), 0) as valor_total_emprestimos,
        COUNT(CASE WHEN status IN ('Ativo', 'Pendente') AND cliente_id IS NOT NULL THEN 1 END) as emprestimos_ativos,
        COUNT(CASE WHEN status = 'Quitado' AND cliente_id IS NOT NULL THEN 1 END) as emprestimos_quitados
      FROM emprestimos
    `);
    console.log('✅ Resultado empréstimos:', emprestimosStats[0]);
    
    // Query de cobranças
    console.log('📊 Testando query de cobranças...');
    const [cobrancasStats] = await connection.execute(`
      SELECT 
        COUNT(*) as total_cobrancas,
        COALESCE(SUM(valor_atualizado), 0) as valor_total_cobrancas,
        COUNT(CASE WHEN status = 'Pendente' THEN 1 END) as cobrancas_pendentes,
        COUNT(CASE WHEN status = 'Paga' THEN 1 END) as cobrancas_pagas,
        COALESCE(SUM(CASE WHEN dias_atraso > 0 THEN valor_atualizado ELSE 0 END), 0) as valor_atrasado
      FROM cobrancas
      WHERE cliente_id IS NOT NULL
    `);
    console.log('✅ Resultado cobranças:', cobrancasStats[0]);
    
    // Query de clientes
    console.log('📊 Testando query de clientes...');
    const [clientesStats] = await connection.execute(`
      SELECT COUNT(*) as total_clientes FROM clientes_cobrancas WHERE status IN ('Ativo', 'Pendente')
    `);
    console.log('✅ Resultado clientes:', clientesStats[0]);
    
    // 4. Verificar clientes em atraso
    console.log('\n4. Verificando clientes em atraso...');
    const [clientesAtraso] = await connection.execute(`
      SELECT COUNT(DISTINCT c.id) as total
      FROM clientes_cobrancas c
      JOIN emprestimos e ON e.cliente_id = c.id
      WHERE e.status IN ('Ativo', 'Pendente')
        AND e.status <> 'Quitado'
        AND e.data_vencimento < CURDATE()
    `);
    console.log('✅ Clientes em atraso:', clientesAtraso[0]);
    
    // 5. Verificar empréstimos recentes
    console.log('\n5. Verificando empréstimos recentes...');
    const [emprestimosRecentes] = await connection.execute(`
      SELECT e.*, c.nome as cliente_nome, c.telefone as telefone
      FROM emprestimos e
      LEFT JOIN clientes_cobrancas c ON e.cliente_id = c.id
      WHERE e.status IN ('Ativo', 'Pendente') AND e.cliente_id IS NOT NULL
      ORDER BY e.created_at DESC
      LIMIT 5
    `);
    console.log('✅ Empréstimos recentes encontrados:', emprestimosRecentes.length);
    
    // 6. Verificar cobranças pendentes
    console.log('\n6. Verificando cobranças pendentes...');
    const [cobrancasPendentes] = await connection.execute(`
      SELECT cb.*, c.nome as cliente_nome, c.telefone as telefone
      FROM cobrancas cb
      LEFT JOIN clientes_cobrancas c ON cb.cliente_id = c.id
      LEFT JOIN emprestimos e ON cb.emprestimo_id = e.id
      WHERE cb.status = 'Pendente' AND cb.cliente_id IS NOT NULL AND e.status IN ('Ativo', 'Pendente')
      ORDER BY cb.data_vencimento ASC
      LIMIT 10
    `);
    console.log('✅ Cobranças pendentes encontradas:', cobrancasPendentes.length);
    
    // 7. Resumo final
    console.log('\n📈 RESUMO FINAL:');
    console.log('================');
    console.log(`Total de empréstimos: ${emprestimosStats[0].total_emprestimos}`);
    console.log(`Valor total investido: R$ ${emprestimosStats[0].valor_total_emprestimos.toFixed(2)}`);
    console.log(`Total de cobranças: ${cobrancasStats[0].total_cobrancas}`);
    console.log(`Valor total a receber: R$ ${cobrancasStats[0].valor_total_cobrancas.toFixed(2)}`);
    console.log(`Total de clientes: ${clientesStats[0].total_clientes}`);
    console.log(`Clientes em atraso: ${clientesAtraso[0].total}`);
    console.log(`Empréstimos recentes: ${emprestimosRecentes.length}`);
    console.log(`Cobranças pendentes: ${cobrancasPendentes.length}`);
    
    // Verificar se há dados zerados
    if (emprestimosStats[0].total_emprestimos === 0 && 
        cobrancasStats[0].total_cobrancas === 0 && 
        clientesStats[0].total_clientes === 0) {
      console.log('\n⚠️  PROBLEMA IDENTIFICADO: Todos os valores estão zerados!');
      console.log('🔍 Possíveis causas:');
      console.log('   - Não há dados de teste no banco');
      console.log('   - Problema nas condições das queries (status, cliente_id)');
      console.log('   - Dados estão com status diferentes do esperado');
    }
    
    await connection.end();
    console.log('\n✅ Teste concluído!');
    
  } catch (error) {
    console.error('❌ Erro durante o teste:', error);
    console.log('Detalhes do erro:', error.message);
  }
}

// Executar o teste
testDashboardData().catch(console.error); 