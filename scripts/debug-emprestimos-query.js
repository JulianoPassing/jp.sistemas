const { createCobrancasConnection } = require('../api/cobrancas');

async function debugEmprestimosQuery() {
  console.log('🔍 Investigando discrepância nas queries de empréstimos...\n');
  
  try {
    const username = 'admin';
    const connection = await createCobrancasConnection(username);
    
    // 1. Verificar dados básicos na tabela empréstimos
    console.log('1. Verificando dados básicos na tabela empréstimos...');
    const [todosEmprestimos] = await connection.execute('SELECT * FROM emprestimos');
    console.log(`📊 Total de empréstimos na tabela: ${todosEmprestimos.length}`);
    
    if (todosEmprestimos.length > 0) {
      console.log('📝 Amostra dos empréstimos:');
      todosEmprestimos.slice(0, 3).forEach((emp, i) => {
        console.log(`   ${i+1}. ID: ${emp.id}, Cliente ID: ${emp.cliente_id}, Status: "${emp.status}", Valor: ${emp.valor || emp.valor_inicial}`);
      });
    }
    
    // 2. Testar query de estatísticas (que está falhando)
    console.log('\n2. Testando query de estatísticas (que está retornando 0)...');
    const [estatisticas] = await connection.execute(`
      SELECT 
        COUNT(CASE WHEN status IN ('Ativo', 'Pendente') AND cliente_id IS NOT NULL THEN 1 END) as total_emprestimos,
        COALESCE(SUM(CASE WHEN status IN ('Ativo', 'Pendente') AND cliente_id IS NOT NULL THEN COALESCE(valor_inicial, valor) ELSE 0 END), 0) as valor_total_emprestimos,
        COUNT(CASE WHEN status IN ('Ativo', 'Pendente') AND cliente_id IS NOT NULL THEN 1 END) as emprestimos_ativos,
        COUNT(CASE WHEN status = 'Quitado' AND cliente_id IS NOT NULL THEN 1 END) as emprestimos_quitados
      FROM emprestimos
    `);
    console.log('📊 Resultado da query de estatísticas:', estatisticas[0]);
    
    // 3. Testar query de empréstimos recentes (que está funcionando)
    console.log('\n3. Testando query de empréstimos recentes (que está funcionando)...');
    const [emprestimosRecentes] = await connection.execute(`
      SELECT e.*, c.nome as cliente_nome, c.telefone as telefone
      FROM emprestimos e
      LEFT JOIN clientes_cobrancas c ON e.cliente_id = c.id
      WHERE e.status IN ('Ativo', 'Pendente') AND e.cliente_id IS NOT NULL
      ORDER BY e.created_at DESC
      LIMIT 5
    `);
    console.log(`📊 Empréstimos recentes encontrados: ${emprestimosRecentes.length}`);
    
    // 4. Investigar condições específicas
    console.log('\n4. Investigando condições específicas...');
    
    // Empréstimos com cliente_id NOT NULL
    const [comClienteId] = await connection.execute('SELECT COUNT(*) as total FROM emprestimos WHERE cliente_id IS NOT NULL');
    console.log(`📊 Empréstimos com cliente_id NOT NULL: ${comClienteId[0].total}`);
    
    // Empréstimos com status específicos
    const [comStatusAtivo] = await connection.execute(`SELECT COUNT(*) as total FROM emprestimos WHERE status IN ('Ativo', 'Pendente')`);
    console.log(`📊 Empréstimos com status 'Ativo' ou 'Pendente': ${comStatusAtivo[0].total}`);
    
    // Empréstimos com ambas condições
    const [comAmbas] = await connection.execute(`SELECT COUNT(*) as total FROM emprestimos WHERE status IN ('Ativo', 'Pendente') AND cliente_id IS NOT NULL`);
    console.log(`📊 Empréstimos com ambas condições: ${comAmbas[0].total}`);
    
    // 5. Verificar status únicos
    console.log('\n5. Verificando status únicos na tabela...');
    const [statusUnicos] = await connection.execute(`SELECT DISTINCT status, COUNT(*) as total FROM emprestimos GROUP BY status`);
    console.log('📊 Status únicos encontrados:');
    statusUnicos.forEach(s => {
      console.log(`   - "${s.status}": ${s.total} empréstimos`);
    });
    
    // 6. Verificar se há espaços em branco ou caracteres especiais nos status
    console.log('\n6. Verificando se há problemas nos status...');
    const [statusComProblemas] = await connection.execute(`
      SELECT id, status, CHAR_LENGTH(status) as tamanho, ASCII(status) as ascii_primeiro
      FROM emprestimos 
      WHERE status IS NOT NULL
      LIMIT 5
    `);
    console.log('📊 Análise dos status:');
    statusComProblemas.forEach(s => {
      console.log(`   ID ${s.id}: "${s.status}" (tamanho: ${s.tamanho}, ASCII: ${s.ascii_primeiro})`);
    });
    
    // 7. Testar query corrigida
    console.log('\n7. Testando query corrigida...');
    const [estatisticasCorrigidas] = await connection.execute(`
      SELECT 
        COUNT(CASE WHEN TRIM(status) IN ('Ativo', 'Pendente') AND cliente_id IS NOT NULL THEN 1 END) as total_emprestimos,
        COALESCE(SUM(CASE WHEN TRIM(status) IN ('Ativo', 'Pendente') AND cliente_id IS NOT NULL THEN COALESCE(valor_inicial, valor) ELSE 0 END), 0) as valor_total_emprestimos,
        COUNT(CASE WHEN TRIM(status) IN ('Ativo', 'Pendente') AND cliente_id IS NOT NULL THEN 1 END) as emprestimos_ativos,
        COUNT(CASE WHEN TRIM(status) = 'Quitado' AND cliente_id IS NOT NULL THEN 1 END) as emprestimos_quitados
      FROM emprestimos
    `);
    console.log('📊 Resultado da query corrigida com TRIM:', estatisticasCorrigidas[0]);
    
    // 8. Verificar problema de clientes em atraso
    console.log('\n8. Investigando clientes em atraso...');
    const [clientesAtraso] = await connection.execute(`
      SELECT 
        c.id, c.nome, 
        e.id as emprestimo_id, e.status, e.data_vencimento,
        DATEDIFF(CURDATE(), e.data_vencimento) as dias_atraso
      FROM clientes_cobrancas c
      JOIN emprestimos e ON e.cliente_id = c.id
      WHERE e.status IN ('Ativo', 'Pendente')
        AND e.status <> 'Quitado'
        AND e.data_vencimento < CURDATE()
    `);
    console.log(`📊 Clientes em atraso encontrados: ${clientesAtraso.length}`);
    clientesAtraso.forEach(ca => {
      console.log(`   - ${ca.nome}: Empréstimo ${ca.emprestimo_id}, Status: ${ca.status}, Vencimento: ${ca.data_vencimento}, Dias atraso: ${ca.dias_atraso}`);
    });
    
    // 9. Verificar parcelas em atraso
    console.log('\n9. Verificando parcelas em atraso...');
    try {
      const [parcelasAtraso] = await connection.execute(`
        SELECT 
          p.*, e.cliente_id, c.nome as cliente_nome
        FROM parcelas p
        JOIN emprestimos e ON p.emprestimo_id = e.id
        JOIN clientes_cobrancas c ON e.cliente_id = c.id
        WHERE p.status = 'Pendente' AND p.data_vencimento < CURDATE()
      `);
      console.log(`📊 Parcelas em atraso: ${parcelasAtraso.length}`);
    } catch (error) {
      console.log('ℹ️ Tabela parcelas não existe ou não há parcelas em atraso');
    }
    
    await connection.end();
    
    console.log('\n📈 CONCLUSÃO:');
    console.log('=============');
    if (estatisticas[0].total_emprestimos === 0 && emprestimosRecentes.length > 0) {
      console.log('❌ PROBLEMA CONFIRMADO: Query de estatísticas retorna 0 mas há empréstimos na tabela');
      console.log('🔧 Possíveis soluções:');
      console.log('   1. Status com espaços em branco ou caracteres especiais');
      console.log('   2. Problemas de case sensitivity (maiúsculas/minúsculas)');
      console.log('   3. Valores NULL em campos importantes');
    } else {
      console.log('✅ Queries estão funcionando corretamente');
    }
    
  } catch (error) {
    console.error('❌ Erro durante a investigação:', error);
  }
}

debugEmprestimosQuery().catch(console.error); 