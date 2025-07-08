const { createCobrancasConnection } = require('../api/cobrancas');

async function investigarDadosDashboard() {
  console.log('🔍 Investigação Detalhada dos Dados do Dashboard...\n');
  
  try {
    const username = 'admin';
    const connection = await createCobrancasConnection(username);
    
    // 1. Verificar TODOS os empréstimos na tabela
    console.log('1. 📊 TODOS os empréstimos na tabela:');
    const [todosEmprestimos] = await connection.execute(`
      SELECT id, cliente_id, valor, valor_inicial, status, data_emprestimo, data_vencimento, created_at
      FROM emprestimos 
      ORDER BY id DESC
    `);
    
    console.log(`   Total de empréstimos encontrados: ${todosEmprestimos.length}`);
    todosEmprestimos.forEach((emp, i) => {
      console.log(`   ${i+1}. ID: ${emp.id} | Cliente: ${emp.cliente_id} | Status: "${emp.status}" | Valor: ${emp.valor || emp.valor_inicial} | Data: ${emp.data_emprestimo}`);
    });
    
    // 2. Verificar status únicos (com detalhes)
    console.log('\n2. 📊 Status únicos dos empréstimos:');
    const [statusEmprestimos] = await connection.execute(`
      SELECT 
        status, 
        COUNT(*) as total,
        CHAR_LENGTH(status) as tamanho_status,
        HEX(status) as hex_status
      FROM emprestimos 
      GROUP BY status
    `);
    
    statusEmprestimos.forEach(s => {
      console.log(`   Status: "${s.status}" | Total: ${s.total} | Tamanho: ${s.tamanho_status} | HEX: ${s.hex_status}`);
    });
    
    // 3. Verificar cliente_id (nulls e inválidos)
    console.log('\n3. 📊 Verificando cliente_id:');
    const [clienteIdNull] = await connection.execute(`
      SELECT COUNT(*) as total FROM emprestimos WHERE cliente_id IS NULL
    `);
    const [clienteIdZero] = await connection.execute(`
      SELECT COUNT(*) as total FROM emprestimos WHERE cliente_id = 0
    `);
    const [clienteIdValido] = await connection.execute(`
      SELECT COUNT(*) as total FROM emprestimos WHERE cliente_id IS NOT NULL AND cliente_id > 0
    `);
    
    console.log(`   Cliente ID NULL: ${clienteIdNull[0].total}`);
    console.log(`   Cliente ID = 0: ${clienteIdZero[0].total}`);
    console.log(`   Cliente ID válido: ${clienteIdValido[0].total}`);
    
    // 4. Testar diferentes variações da query
    console.log('\n4. 📊 Testando diferentes variações da query:');
    
    // Query original
    const [queryOriginal] = await connection.execute(`
      SELECT COUNT(*) as total FROM emprestimos WHERE status IN ('Ativo', 'Pendente')
    `);
    console.log(`   Query original (status IN 'Ativo','Pendente'): ${queryOriginal[0].total}`);
    
    // Query com TRIM
    const [queryTrim] = await connection.execute(`
      SELECT COUNT(*) as total FROM emprestimos WHERE TRIM(status) IN ('Ativo', 'Pendente')
    `);
    console.log(`   Query com TRIM: ${queryTrim[0].total}`);
    
    // Query com UPPER
    const [queryUpper] = await connection.execute(`
      SELECT COUNT(*) as total FROM emprestimos WHERE UPPER(status) IN ('ATIVO', 'PENDENTE')
    `);
    console.log(`   Query com UPPER: ${queryUpper[0].total}`);
    
    // Query com TRIM + UPPER
    const [queryTrimUpper] = await connection.execute(`
      SELECT COUNT(*) as total FROM emprestimos WHERE TRIM(UPPER(status)) IN ('ATIVO', 'PENDENTE')
    `);
    console.log(`   Query com TRIM + UPPER: ${queryTrimUpper[0].total}`);
    
    // Query com LIKE
    const [queryLike] = await connection.execute(`
      SELECT COUNT(*) as total FROM emprestimos WHERE status LIKE '%Ativo%' OR status LIKE '%Pendente%'
    `);
    console.log(`   Query com LIKE: ${queryLike[0].total}`);
    
    // 5. Verificar se há empréstimos com cliente_id válido
    console.log('\n5. 📊 Empréstimos com cliente_id válido:');
    const [emprestimosComCliente] = await connection.execute(`
      SELECT COUNT(*) as total 
      FROM emprestimos 
      WHERE cliente_id IS NOT NULL AND cliente_id > 0
    `);
    console.log(`   Empréstimos com cliente_id válido: ${emprestimosComCliente[0].total}`);
    
    // 6. Verificar se os clientes existem
    console.log('\n6. 📊 Verificando se os clientes existem:');
    const [clientesExistentes] = await connection.execute(`
      SELECT 
        e.id as emprestimo_id,
        e.cliente_id,
        c.nome as cliente_nome,
        e.status as emprestimo_status
      FROM emprestimos e
      LEFT JOIN clientes_cobrancas c ON e.cliente_id = c.id
      WHERE e.cliente_id IS NOT NULL
    `);
    
    console.log(`   Empréstimos com clientes válidos: ${clientesExistentes.length}`);
    clientesExistentes.forEach(ec => {
      console.log(`   Empréstimo ${ec.emprestimo_id}: Cliente ${ec.cliente_id} (${ec.cliente_nome || 'NÃO ENCONTRADO'}) - Status: ${ec.emprestimo_status}`);
    });
    
    // 7. Investigar problema de clientes em atraso
    console.log('\n7. 📊 Investigando clientes em atraso:');
    const [clientesComAtraso] = await connection.execute(`
      SELECT 
        c.id as cliente_id,
        c.nome as cliente_nome,
        e.id as emprestimo_id,
        e.status as emprestimo_status,
        e.data_vencimento,
        CURDATE() as data_atual,
        DATEDIFF(CURDATE(), e.data_vencimento) as dias_diferenca,
        (e.data_vencimento < CURDATE()) as esta_vencido
      FROM clientes_cobrancas c
      JOIN emprestimos e ON e.cliente_id = c.id
      WHERE e.data_vencimento < CURDATE()
    `);
    
    console.log(`   Empréstimos com data vencida: ${clientesComAtraso.length}`);
    clientesComAtraso.forEach(ca => {
      console.log(`   Cliente: ${ca.cliente_nome} | Empréstimo ${ca.emprestimo_id} | Status: ${ca.emprestimo_status}`);
      console.log(`     Data vencimento: ${ca.data_vencimento} | Dias: ${ca.dias_diferenca} | Vencido: ${ca.esta_vencido}`);
    });
    
    // 8. Verificar parcelas (se existirem)
    console.log('\n8. 📊 Verificando parcelas:');
    try {
      const [parcelas] = await connection.execute(`
        SELECT COUNT(*) as total FROM parcelas
      `);
      console.log(`   Total de parcelas: ${parcelas[0].total}`);
      
      if (parcelas[0].total > 0) {
        const [parcelasDetalhes] = await connection.execute(`
          SELECT 
            p.id, p.emprestimo_id, p.numero_parcela, p.status, p.data_vencimento,
            e.cliente_id, c.nome as cliente_nome
          FROM parcelas p
          JOIN emprestimos e ON p.emprestimo_id = e.id
          JOIN clientes_cobrancas c ON e.cliente_id = c.id
          ORDER BY p.emprestimo_id, p.numero_parcela
        `);
        
        console.log(`   Parcelas detalhadas: ${parcelasDetalhes.length}`);
        parcelasDetalhes.slice(0, 5).forEach(pd => {
          console.log(`     Parcela ${pd.numero_parcela} - Empréstimo ${pd.emprestimo_id} - Cliente: ${pd.cliente_nome} - Status: ${pd.status} - Vencimento: ${pd.data_vencimento}`);
        });
      }
    } catch (error) {
      console.log('   Tabela parcelas não existe');
    }
    
    // 9. Testar query completa do dashboard
    console.log('\n9. 📊 Testando query completa do dashboard:');
    const [queryCompleta] = await connection.execute(`
      SELECT 
        COUNT(CASE WHEN TRIM(UPPER(status)) IN ('ATIVO', 'PENDENTE') AND cliente_id IS NOT NULL THEN 1 END) as total_emprestimos,
        COALESCE(SUM(CASE WHEN TRIM(UPPER(status)) IN ('ATIVO', 'PENDENTE') AND cliente_id IS NOT NULL THEN COALESCE(valor_inicial, valor) ELSE 0 END), 0) as valor_total_emprestimos,
        COUNT(CASE WHEN TRIM(UPPER(status)) IN ('ATIVO', 'PENDENTE') AND cliente_id IS NOT NULL THEN 1 END) as emprestimos_ativos,
        COUNT(CASE WHEN TRIM(UPPER(status)) = 'QUITADO' AND cliente_id IS NOT NULL THEN 1 END) as emprestimos_quitados
      FROM emprestimos
    `);
    
    console.log('   Resultado da query completa:');
    console.log(`     Total empréstimos: ${queryCompleta[0].total_emprestimos}`);
    console.log(`     Valor total: ${queryCompleta[0].valor_total_emprestimos}`);
    console.log(`     Empréstimos ativos: ${queryCompleta[0].emprestimos_ativos}`);
    console.log(`     Empréstimos quitados: ${queryCompleta[0].emprestimos_quitados}`);
    
    await connection.end();
    
    console.log('\n🎯 CONCLUSÃO:');
    console.log('==============');
    if (queryCompleta[0].total_emprestimos === 0) {
      console.log('❌ PROBLEMA: Query ainda retorna 0 empréstimos');
      console.log('🔍 Possíveis causas:');
      console.log('   - Status não são "Ativo" ou "Pendente"');
      console.log('   - cliente_id são NULL ou inválidos');
      console.log('   - Problemas de encoding/charset');
      console.log('   - Valores são NULL em campos importantes');
    } else {
      console.log('✅ Query funcionando corretamente');
    }
    
  } catch (error) {
    console.error('❌ Erro durante a investigação:', error);
  }
}

investigarDadosDashboard().catch(console.error); 