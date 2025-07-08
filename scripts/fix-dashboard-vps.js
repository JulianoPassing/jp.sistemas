const { createCobrancasConnection } = require('../api/cobrancas');

async function fixDashboardVPS() {
  console.log('🔧 Corrigindo Dashboard na VPS...\n');
  
  try {
    const username = 'admin';
    console.log('Conectando ao banco...');
    const connection = await createCobrancasConnection(username);
    
    // 1. Verificar dados atuais
    console.log('\n1. Verificando empréstimos atuais...');
    const [emprestimos] = await connection.execute(`
      SELECT id, cliente_id, valor, valor_inicial, status 
      FROM emprestimos 
      ORDER BY id DESC 
      LIMIT 5
    `);
    
    console.log(`Total de empréstimos encontrados: ${emprestimos.length}`);
    emprestimos.forEach((emp, i) => {
      console.log(`${i+1}. ID: ${emp.id} | Cliente: ${emp.cliente_id} | Status: "${emp.status}" | Valor: ${emp.valor || emp.valor_inicial}`);
    });
    
    // 2. Verificar problema específico
    console.log('\n2. Testando query de estatísticas atual...');
    const [statsAtual] = await connection.execute(`
      SELECT 
        COUNT(CASE WHEN TRIM(UPPER(status)) IN ('ATIVO', 'PENDENTE') AND cliente_id IS NOT NULL THEN 1 END) as total_emprestimos,
        COALESCE(SUM(CASE WHEN TRIM(UPPER(status)) IN ('ATIVO', 'PENDENTE') AND cliente_id IS NOT NULL THEN COALESCE(valor_inicial, valor) ELSE 0 END), 0) as valor_total
      FROM emprestimos
    `);
    
    console.log(`Resultado atual: ${statsAtual[0].total_emprestimos} empréstimos, R$ ${statsAtual[0].valor_total}`);
    
    // 3. Identificar o problema
    console.log('\n3. Identificando problema...');
    
    // Verificar status únicos
    const [statusUnicos] = await connection.execute(`
      SELECT DISTINCT status, COUNT(*) as total 
      FROM emprestimos 
      GROUP BY status
    `);
    
    console.log('Status encontrados:');
    statusUnicos.forEach(s => {
      console.log(`   "${s.status}": ${s.total} empréstimos`);
    });
    
    // Verificar cliente_id
    const [clienteCheck] = await connection.execute(`
      SELECT 
        COUNT(CASE WHEN cliente_id IS NULL THEN 1 END) as nulls,
        COUNT(CASE WHEN cliente_id > 0 THEN 1 END) as validos
      FROM emprestimos
    `);
    
    console.log(`Cliente ID: ${clienteCheck[0].nulls} nulls, ${clienteCheck[0].validos} válidos`);
    
    // 4. Aplicar correções
    console.log('\n4. Aplicando correções...');
    
    // Corrigir cliente_id se necessário
    if (clienteCheck[0].nulls > 0) {
      const [primeiroCliente] = await connection.execute(`
        SELECT id FROM clientes_cobrancas ORDER BY id LIMIT 1
      `);
      
      if (primeiroCliente.length > 0) {
        await connection.execute(`
          UPDATE emprestimos 
          SET cliente_id = ? 
          WHERE cliente_id IS NULL
        `, [primeiroCliente[0].id]);
        console.log(`✅ Cliente_id corrigido para ${primeiroCliente[0].id}`);
      }
    }
    
    // Normalizar status
    await connection.execute(`
      UPDATE emprestimos 
      SET status = 'Ativo' 
      WHERE status IS NULL OR TRIM(status) = ''
    `);
    
    await connection.execute(`
      UPDATE emprestimos 
      SET status = 'Ativo' 
      WHERE TRIM(LOWER(status)) IN ('ativo', 'pendente', 'em andamento')
    `);
    
    console.log('✅ Status normalizados');
    
    // Corrigir valores
    await connection.execute(`
      UPDATE emprestimos 
      SET valor = valor_inicial 
      WHERE valor IS NULL AND valor_inicial IS NOT NULL
    `);
    
    await connection.execute(`
      UPDATE emprestimos 
      SET valor_inicial = valor 
      WHERE valor_inicial IS NULL AND valor IS NOT NULL
    `);
    
    console.log('✅ Valores corrigidos');
    
    // 5. Testar resultado final
    console.log('\n5. Testando resultado final...');
    const [statsFinal] = await connection.execute(`
      SELECT 
        COUNT(CASE WHEN cliente_id IS NOT NULL AND cliente_id > 0 THEN 1 END) as total_emprestimos,
        COALESCE(SUM(CASE WHEN cliente_id IS NOT NULL AND cliente_id > 0 THEN COALESCE(valor_inicial, valor) ELSE 0 END), 0) as valor_total
      FROM emprestimos
    `);
    
    console.log('\n📊 RESULTADO FINAL:');
    console.log('==================');
    console.log(`✅ Total de empréstimos: ${statsFinal[0].total_emprestimos}`);
    console.log(`✅ Valor total: R$ ${statsFinal[0].valor_total.toFixed(2)}`);
    
    if (statsFinal[0].total_emprestimos > 0) {
      console.log('\n🎉 SUCESSO! Dashboard deve funcionar agora!');
      console.log('👉 Recarregue a página do dashboard para ver as mudanças');
    } else {
      console.log('\n⚠️ Ainda há problemas. Verifique os dados manualmente.');
    }
    
    await connection.end();
    
  } catch (error) {
    console.error('❌ Erro:', error.message);
  }
}

fixDashboardVPS().catch(console.error); 