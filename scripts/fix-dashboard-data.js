const mysql = require('mysql2/promise');

async function fixDashboardData() {
  console.log('🔧 Corrigindo dados do dashboard...\n');
  
  try {
    // Configuração do banco
    const dbConfig = {
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: 'cobrancas_admin'
    };
    
    console.log('📊 Conectando ao banco:', dbConfig.database);
    const connection = await mysql.createConnection(dbConfig);
    
    // 1. Verificar dados atuais
    console.log('\n1. Verificando dados atuais...');
    const [emprestimosCount] = await connection.execute('SELECT COUNT(*) as total FROM emprestimos');
    const [clientesCount] = await connection.execute('SELECT COUNT(*) as total FROM clientes_cobrancas');
    const [cobrancasCount] = await connection.execute('SELECT COUNT(*) as total FROM cobrancas');
    
    console.log(`📋 Empréstimos: ${emprestimosCount[0].total}`);
    console.log(`👥 Clientes: ${clientesCount[0].total}`);
    console.log(`💰 Cobranças: ${cobrancasCount[0].total}`);
    
    // 2. Verificar status dos dados existentes
    console.log('\n2. Verificando status dos dados existentes...');
    
    if (emprestimosCount[0].total > 0) {
      const [statusEmprestimos] = await connection.execute(`
        SELECT status, COUNT(*) as total 
        FROM emprestimos 
        GROUP BY status
      `);
      console.log('📊 Status dos empréstimos:', statusEmprestimos);
    }
    
    if (clientesCount[0].total > 0) {
      const [statusClientes] = await connection.execute(`
        SELECT status, COUNT(*) as total 
        FROM clientes_cobrancas 
        GROUP BY status
      `);
      console.log('📊 Status dos clientes:', statusClientes);
    }
    
    if (cobrancasCount[0].total > 0) {
      const [statusCobrancas] = await connection.execute(`
        SELECT status, COUNT(*) as total 
        FROM cobrancas 
        GROUP BY status
      `);
      console.log('📊 Status das cobranças:', statusCobrancas);
    }
    
    // 3. Criar dados de teste se não houver dados
    if (emprestimosCount[0].total === 0 || clientesCount[0].total === 0) {
      console.log('\n3. Criando dados de teste...');
      
      // Criar cliente de teste
      await connection.execute(`
        INSERT IGNORE INTO clientes_cobrancas (nome, email, telefone, cpf, endereco, status, created_at) 
        VALUES 
        ('João Silva', 'joao@email.com', '11999999999', '12345678901', 'Rua A, 123', 'Ativo', NOW()),
        ('Maria Santos', 'maria@email.com', '11888888888', '12345678902', 'Rua B, 456', 'Ativo', NOW()),
        ('Pedro Oliveira', 'pedro@email.com', '11777777777', '12345678903', 'Rua C, 789', 'Ativo', NOW())
      `);
      
      // Buscar IDs dos clientes criados
      const [clientes] = await connection.execute('SELECT id FROM clientes_cobrancas ORDER BY id DESC LIMIT 3');
      
      if (clientes.length > 0) {
        // Criar empréstimos de teste
        for (let i = 0; i < clientes.length; i++) {
          const clienteId = clientes[i].id;
          const valor = 1000 + (i * 500);
          const dataEmprestimo = new Date();
          const dataVencimento = new Date();
          dataVencimento.setMonth(dataVencimento.getMonth() + 1);
          
          await connection.execute(`
            INSERT INTO emprestimos (
              cliente_id, valor, valor_inicial, juros_mensal, data_emprestimo, 
              data_vencimento, status, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
          `, [clienteId, valor, valor, 10, dataEmprestimo, dataVencimento, 'Ativo']);
        }
        
        // Criar cobranças de teste
        const [emprestimos] = await connection.execute('SELECT id, cliente_id, valor, juros_mensal FROM emprestimos');
        
        for (const emprestimo of emprestimos) {
          const valorJuros = emprestimo.valor * (emprestimo.juros_mensal / 100);
          const valorAtualizado = emprestimo.valor + valorJuros;
          const dataVencimento = new Date();
          dataVencimento.setMonth(dataVencimento.getMonth() + 1);
          
          await connection.execute(`
            INSERT INTO cobrancas (
              emprestimo_id, cliente_id, valor_original, valor_atualizado, 
              data_vencimento, status, dias_atraso, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
          `, [emprestimo.id, emprestimo.cliente_id, emprestimo.valor, valorAtualizado, dataVencimento, 'Pendente', 0]);
        }
        
        console.log('✅ Dados de teste criados com sucesso!');
      }
    }
    
    // 4. Corrigir status se necessário
    console.log('\n4. Corrigindo status dos dados...');
    
    // Garantir que clientes tenham status válido
    await connection.execute(`
      UPDATE clientes_cobrancas 
      SET status = 'Ativo' 
      WHERE status IS NULL OR status = ''
    `);
    
    // Garantir que empréstimos tenham status válido
    await connection.execute(`
      UPDATE emprestimos 
      SET status = 'Ativo' 
      WHERE status IS NULL OR status = ''
    `);
    
    // Garantir que cobranças tenham status válido
    await connection.execute(`
      UPDATE cobrancas 
      SET status = 'Pendente' 
      WHERE status IS NULL OR status = ''
    `);
    
    // 5. Atualizar dias de atraso
    console.log('\n5. Atualizando dias de atraso...');
    await connection.execute(`
      UPDATE cobrancas 
      SET dias_atraso = CASE 
        WHEN data_vencimento < CURDATE() THEN DATEDIFF(CURDATE(), data_vencimento)
        ELSE 0 
      END
      WHERE status = 'Pendente'
    `);
    
    // 6. Testar queries do dashboard após correção
    console.log('\n6. Testando queries do dashboard após correção...');
    
    const [emprestimosStats] = await connection.execute(`
      SELECT 
        COUNT(CASE WHEN status IN ('Ativo', 'Pendente') AND cliente_id IS NOT NULL THEN 1 END) as total_emprestimos,
        COALESCE(SUM(CASE WHEN status IN ('Ativo', 'Pendente') AND cliente_id IS NOT NULL THEN COALESCE(valor_inicial, valor) ELSE 0 END), 0) as valor_total_emprestimos,
        COUNT(CASE WHEN status IN ('Ativo', 'Pendente') AND cliente_id IS NOT NULL THEN 1 END) as emprestimos_ativos,
        COUNT(CASE WHEN status = 'Quitado' AND cliente_id IS NOT NULL THEN 1 END) as emprestimos_quitados
      FROM emprestimos
    `);
    
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
    
    const [clientesStats] = await connection.execute(`
      SELECT COUNT(*) as total_clientes FROM clientes_cobrancas WHERE status IN ('Ativo', 'Pendente')
    `);
    
    const [clientesAtraso] = await connection.execute(`
      SELECT COUNT(DISTINCT c.id) as total
      FROM clientes_cobrancas c
      JOIN emprestimos e ON e.cliente_id = c.id
      WHERE e.status IN ('Ativo', 'Pendente')
        AND e.status <> 'Quitado'
        AND e.data_vencimento < CURDATE()
    `);
    
    console.log('\n📈 RESULTADOS APÓS CORREÇÃO:');
    console.log('============================');
    console.log(`✅ Total de empréstimos: ${emprestimosStats[0].total_emprestimos}`);
    console.log(`✅ Valor total investido: R$ ${emprestimosStats[0].valor_total_emprestimos.toFixed(2)}`);
    console.log(`✅ Total de cobranças: ${cobrancasStats[0].total_cobrancas}`);
    console.log(`✅ Valor total a receber: R$ ${cobrancasStats[0].valor_total_cobrancas.toFixed(2)}`);
    console.log(`✅ Total de clientes: ${clientesStats[0].total_clientes}`);
    console.log(`✅ Clientes em atraso: ${clientesAtraso[0].total}`);
    
    // 7. Verificar se ainda há problema
    if (emprestimosStats[0].total_emprestimos === 0 && 
        cobrancasStats[0].total_cobrancas === 0 && 
        clientesStats[0].total_clientes === 0) {
      console.log('\n⚠️  AINDA HÁ PROBLEMA: Valores continuam zerados!');
      
      // Verificar se há dados mas com condições diferentes
      const [todosEmprestimos] = await connection.execute('SELECT COUNT(*) as total FROM emprestimos');
      const [todosClientes] = await connection.execute('SELECT COUNT(*) as total FROM clientes_cobrancas');
      const [todasCobrancas] = await connection.execute('SELECT COUNT(*) as total FROM cobrancas');
      
      console.log(`📊 Total geral - Empréstimos: ${todosEmprestimos[0].total}`);
      console.log(`📊 Total geral - Clientes: ${todosClientes[0].total}`);
      console.log(`📊 Total geral - Cobranças: ${todasCobrancas[0].total}`);
      
      if (todosEmprestimos[0].total > 0) {
        // Verificar condições específicas
        const [emprestimosComCliente] = await connection.execute('SELECT COUNT(*) as total FROM emprestimos WHERE cliente_id IS NOT NULL');
        const [emprestimosAtivos] = await connection.execute('SELECT COUNT(*) as total FROM emprestimos WHERE status IN ("Ativo", "Pendente")');
        
        console.log(`📊 Empréstimos com cliente_id: ${emprestimosComCliente[0].total}`);
        console.log(`📊 Empréstimos com status Ativo/Pendente: ${emprestimosAtivos[0].total}`);
      }
    } else {
      console.log('\n🎉 PROBLEMA CORRIGIDO! Dashboard deve funcionar agora.');
    }
    
    await connection.end();
    console.log('\n✅ Correção concluída!');
    
  } catch (error) {
    console.error('❌ Erro durante a correção:', error);
    console.log('Detalhes do erro:', error.message);
  }
}

// Executar a correção
fixDashboardData().catch(console.error); 