const { createCobrancasConnection } = require('../api/cobrancas');

async function testDashboardAPI() {
  console.log('🔍 Testando API do Dashboard...\n');
  
  try {
    // Simular usuário de teste
    const username = 'admin'; // ou outro usuário padrão
    
    console.log('📊 Conectando como usuário:', username);
    const connection = await createCobrancasConnection(username);
    
    console.log('✅ Conexão estabelecida');
    
    // Replicar exatamente a lógica da API do dashboard
    let emprestimosStats = [{ 
      total_emprestimos: 0, 
      valor_total_emprestimos: 0, 
      emprestimos_ativos: 0, 
      emprestimos_quitados: 0 
    }];
    let cobrancasStats = [{ 
      total_cobrancas: 0, 
      valor_total_cobrancas: 0, 
      cobrancas_pendentes: 0, 
      cobrancas_pagas: 0, 
      valor_atrasado: 0 
    }];
    let clientesStats = [{ total_clientes: 0 }];
    let emprestimosRecentes = [];
    let cobrancasPendentes = [];
    let clientesEmAtraso = [{ total: 0 }];
    let emprestimosEmAtraso = [{ total: 0 }];
    let clientesAtivos = [{ total: 0 }];
    let emprestimosAtivos = [{ total: 0 }];
    
    // Atualizar dias de atraso
    console.log('\n1. Atualizando dias de atraso...');
    try {
      await connection.execute(`
        UPDATE cobrancas 
        SET dias_atraso = CASE 
          WHEN data_vencimento < CURDATE() THEN DATEDIFF(CURDATE(), data_vencimento)
          ELSE 0 
        END
        WHERE status = 'Pendente'
      `);
      console.log('✅ Dias de atraso atualizados');
    } catch (error) {
      console.log('❌ Erro ao atualizar dias de atraso:', error.message);
    }
    
    // Estatísticas de empréstimos
    console.log('\n2. Buscando estatísticas de empréstimos...');
    try {
      [emprestimosStats] = await connection.execute(`
        SELECT 
          COUNT(CASE WHEN status IN ('Ativo', 'Pendente') AND cliente_id IS NOT NULL THEN 1 END) as total_emprestimos,
          COALESCE(SUM(CASE WHEN status IN ('Ativo', 'Pendente') AND cliente_id IS NOT NULL THEN COALESCE(valor_inicial, valor) ELSE 0 END), 0) as valor_total_emprestimos,
          COUNT(CASE WHEN status IN ('Ativo', 'Pendente') AND cliente_id IS NOT NULL THEN 1 END) as emprestimos_ativos,
          COUNT(CASE WHEN status = 'Quitado' AND cliente_id IS NOT NULL THEN 1 END) as emprestimos_quitados
        FROM emprestimos
      `);
      console.log('✅ Estatísticas de empréstimos:', emprestimosStats[0]);
    } catch (error) {
      console.log('❌ Erro ao buscar estatísticas de empréstimos:', error.message);
    }
    
    // Estatísticas de cobranças
    console.log('\n3. Buscando estatísticas de cobranças...');
    try {
      [cobrancasStats] = await connection.execute(`
        SELECT 
          COUNT(*) as total_cobrancas,
          COALESCE(SUM(valor_atualizado), 0) as valor_total_cobrancas,
          COUNT(CASE WHEN status = 'Pendente' THEN 1 END) as cobrancas_pendentes,
          COUNT(CASE WHEN status = 'Paga' THEN 1 END) as cobrancas_pagas,
          COALESCE(SUM(CASE WHEN dias_atraso > 0 THEN valor_atualizado ELSE 0 END), 0) as valor_atrasado
        FROM cobrancas
        WHERE cliente_id IS NOT NULL
      `);
      console.log('✅ Estatísticas de cobranças:', cobrancasStats[0]);
    } catch (error) {
      console.log('❌ Erro ao buscar estatísticas de cobranças:', error.message);
    }
    
    // Verificar se a tabela clientes_cobrancas existe
    console.log('\n4. Verificando tabela clientes_cobrancas...');
    try {
      const [tables] = await connection.execute(`SHOW TABLES LIKE 'clientes_cobrancas'`);
      
      if (tables.length > 0) {
        console.log('✅ Tabela clientes_cobrancas existe');
        [clientesStats] = await connection.execute(`
          SELECT COUNT(*) as total_clientes FROM clientes_cobrancas WHERE status IN ('Ativo', 'Pendente')
        `);
        console.log('✅ Estatísticas de clientes:', clientesStats[0]);
      } else {
        console.log('❌ Tabela clientes_cobrancas não existe');
      }
    } catch (error) {
      console.log('❌ Erro ao buscar estatísticas de clientes:', error.message);
    }
    
    // Empréstimos recentes
    console.log('\n5. Buscando empréstimos recentes...');
    try {
      [emprestimosRecentes] = await connection.execute(`
        SELECT e.*, c.nome as cliente_nome, c.telefone as telefone
        FROM emprestimos e
        LEFT JOIN clientes_cobrancas c ON e.cliente_id = c.id
        WHERE e.status IN ('Ativo', 'Pendente') AND e.cliente_id IS NOT NULL
        ORDER BY e.created_at DESC
        LIMIT 5
      `);
      console.log('✅ Empréstimos recentes:', emprestimosRecentes.length);
    } catch (error) {
      console.log('❌ Erro ao buscar empréstimos recentes:', error.message);
    }
    
    // Cobranças pendentes
    console.log('\n6. Buscando cobranças pendentes...');
    try {
      [cobrancasPendentes] = await connection.execute(`
        SELECT cb.*, c.nome as cliente_nome, c.telefone as telefone
        FROM cobrancas cb
        LEFT JOIN clientes_cobrancas c ON cb.cliente_id = c.id
        LEFT JOIN emprestimos e ON cb.emprestimo_id = e.id
        WHERE cb.status = 'Pendente' AND cb.cliente_id IS NOT NULL AND e.status IN ('Ativo', 'Pendente')
        ORDER BY cb.data_vencimento ASC
        LIMIT 10
      `);
      console.log('✅ Cobranças pendentes:', cobrancasPendentes.length);
    } catch (error) {
      console.log('❌ Erro ao buscar cobranças pendentes:', error.message);
    }
    
    // Clientes em atraso
    console.log('\n7. Buscando clientes em atraso...');
    try {
      [clientesEmAtraso] = await connection.execute(`
        SELECT COUNT(DISTINCT c.id) as total
        FROM clientes_cobrancas c
        JOIN emprestimos e ON e.cliente_id = c.id
        WHERE e.status IN ('Ativo', 'Pendente')
          AND e.status <> 'Quitado'
          AND e.data_vencimento < CURDATE()
      `);
      console.log('✅ Clientes em atraso:', clientesEmAtraso[0]);
    } catch (error) {
      console.log('❌ Erro ao buscar clientes em atraso:', error.message);
    }
    
    // Empréstimos ativos
    console.log('\n8. Buscando empréstimos ativos...');
    try {
      [emprestimosAtivos] = await connection.execute(`
        SELECT COUNT(*) as total
        FROM emprestimos
        WHERE status IN ('Ativo', 'Pendente')
          AND status <> 'Quitado'
      `);
      console.log('✅ Empréstimos ativos:', emprestimosAtivos[0]);
    } catch (error) {
      console.log('❌ Erro ao buscar empréstimos ativos:', error.message);
    }
    
    await connection.end();
    
    // Montar resposta como a API faria
    const response = {
      emprestimos: emprestimosStats[0],
      cobrancas: cobrancasStats[0],
      clientes: clientesStats[0],
      emprestimosRecentes,
      cobrancasPendentes,
      clientesEmAtraso: clientesEmAtraso[0].total,
      emprestimosEmAtraso: emprestimosEmAtraso[0].total,
      clientesAtivos: clientesAtivos[0].total,
      emprestimosAtivos: emprestimosAtivos[0].total
    };
    
    console.log('\n📊 RESPOSTA FINAL DA API:');
    console.log('========================');
    console.log(JSON.stringify(response, null, 2));
    
    // Analisar se há problemas
    if (response.emprestimos.total_emprestimos === 0 && 
        response.cobrancas.total_cobrancas === 0 && 
        response.clientes.total_clientes === 0) {
      console.log('\n⚠️  PROBLEMA: Todos os valores estão zerados na API!');
    } else {
      console.log('\n🎉 API funcionando corretamente!');
    }
    
  } catch (error) {
    console.error('❌ Erro ao testar API do dashboard:', error);
  }
}

// Executar o teste
testDashboardAPI().catch(console.error); 