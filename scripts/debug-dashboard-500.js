const mysql = require('mysql2/promise');
const { createCobrancasConnection } = require('../api/cobrancas');

async function debugDashboard500() {
  console.log('🔍 Diagnosticando erro 500 no dashboard...');
  
  try {
    // Simular usuário de teste
    const username = 'test_user';
    
    console.log('\n1. Testando conexão básica...');
    const connection = await createCobrancasConnection(username);
    console.log('✅ Conexão estabelecida');
    
    console.log('\n2. Testando query de empréstimos...');
    try {
      const [emprestimosStats] = await connection.execute(`
        SELECT 
          COUNT(CASE WHEN status IN ('Ativo', 'Pendente') AND cliente_id IS NOT NULL THEN 1 END) as total_emprestimos,
          SUM(CASE WHEN status IN ('Ativo', 'Pendente') AND cliente_id IS NOT NULL THEN COALESCE(valor_inicial, valor) ELSE 0 END) as valor_total_emprestimos,
          COUNT(CASE WHEN status IN ('Ativo', 'Pendente') AND cliente_id IS NOT NULL THEN 1 END) as emprestimos_ativos,
          COUNT(CASE WHEN status = 'Quitado' AND cliente_id IS NOT NULL THEN 1 END) as emprestimos_quitados
        FROM emprestimos
      `);
      console.log('✅ Query de empréstimos executada:', emprestimosStats[0]);
    } catch (error) {
      console.error('❌ Erro na query de empréstimos:', error.message);
      console.log('Detalhes:', error);
    }
    
    console.log('\n3. Testando query de cobranças...');
    try {
      const [cobrancasStats] = await connection.execute(`
        SELECT 
          COUNT(*) as total_cobrancas,
          SUM(valor_atualizado) as valor_total_cobrancas,
          COUNT(CASE WHEN status = 'Pendente' THEN 1 END) as cobrancas_pendentes,
          COUNT(CASE WHEN status = 'Paga' THEN 1 END) as cobrancas_pagas,
          SUM(CASE WHEN dias_atraso > 0 THEN valor_atualizado ELSE 0 END) as valor_atrasado
        FROM cobrancas
        WHERE cliente_id IS NOT NULL
      `);
      console.log('✅ Query de cobranças executada:', cobrancasStats[0]);
    } catch (error) {
      console.error('❌ Erro na query de cobranças:', error.message);
      console.log('Detalhes:', error);
    }
    
    console.log('\n4. Testando query de clientes...');
    try {
      const [clientesStats] = await connection.execute(`
        SELECT COUNT(*) as total_clientes FROM clientes_cobrancas WHERE status IN ('Ativo', 'Pendente')
      `);
      console.log('✅ Query de clientes executada:', clientesStats[0]);
    } catch (error) {
      console.error('❌ Erro na query de clientes:', error.message);
      console.log('Detalhes:', error);
    }
    
    console.log('\n5. Testando query de clientes em atraso (nova)...');
    try {
      const [clientesEmAtraso] = await connection.execute(`
        SELECT COUNT(DISTINCT c.id) as total
        FROM clientes_cobrancas c
        JOIN emprestimos e ON e.cliente_id = c.id
        WHERE e.status IN ('Ativo', 'Pendente')
          AND e.status <> 'Quitado'
          AND (
            -- Para empréstimos de parcela única
            (e.tipo_emprestimo != 'in_installments' AND e.data_vencimento < CURDATE())
            OR
            -- Para empréstimos parcelados, verificar se há parcelas atrasadas
            (e.tipo_emprestimo = 'in_installments' AND EXISTS (
              SELECT 1 FROM parcelas p 
              WHERE p.emprestimo_id = e.id 
                AND p.data_vencimento < CURDATE() 
                AND p.status != 'Paga'
            ))
          )
      `);
      console.log('✅ Query de clientes em atraso executada:', clientesEmAtraso[0]);
    } catch (error) {
      console.error('❌ Erro na query de clientes em atraso:', error.message);
      console.log('Detalhes:', error);
      
      // Testar se a tabela parcelas existe
      console.log('\n🔍 Verificando se a tabela parcelas existe...');
      try {
        const [tables] = await connection.execute(`
          SHOW TABLES LIKE 'parcelas'
        `);
        if (tables.length === 0) {
          console.error('❌ Tabela "parcelas" não existe!');
          console.log('💡 Solução: A tabela parcelas precisa ser criada.');
          
          // Verificar estrutura da tabela emprestimos
          console.log('\n🔍 Verificando estrutura da tabela emprestimos...');
          const [columns] = await connection.execute(`
            SHOW COLUMNS FROM emprestimos
          `);
          console.log('Colunas da tabela emprestimos:');
          columns.forEach(col => {
            console.log(`  - ${col.Field}: ${col.Type}`);
          });
          
          // Verificar se há campo tipo_emprestimo
          const tipoEmprestimoExists = columns.some(col => col.Field === 'tipo_emprestimo');
          if (!tipoEmprestimoExists) {
            console.error('❌ Campo "tipo_emprestimo" não existe na tabela emprestimos!');
            console.log('💡 Solução: Adicionar campo tipo_emprestimo à tabela emprestimos.');
          }
        } else {
          console.log('✅ Tabela parcelas existe');
        }
      } catch (tableError) {
        console.error('❌ Erro ao verificar tabelas:', tableError.message);
      }
    }
    
    console.log('\n6. Testando query de empréstimos em atraso (nova)...');
    try {
      const [emprestimosEmAtraso] = await connection.execute(`
        SELECT COUNT(*) as total
        FROM emprestimos e
        WHERE e.status IN ('Ativo', 'Pendente')
          AND e.status <> 'Quitado'
          AND (
            -- Para empréstimos de parcela única
            (e.tipo_emprestimo != 'in_installments' AND e.data_vencimento < CURDATE())
            OR
            -- Para empréstimos parcelados, verificar se há parcelas atrasadas
            (e.tipo_emprestimo = 'in_installments' AND EXISTS (
              SELECT 1 FROM parcelas p 
              WHERE p.emprestimo_id = e.id 
                AND p.data_vencimento < CURDATE() 
                AND p.status != 'Paga'
            ))
          )
      `);
      console.log('✅ Query de empréstimos em atraso executada:', emprestimosEmAtraso[0]);
    } catch (error) {
      console.error('❌ Erro na query de empréstimos em atraso:', error.message);
      console.log('Detalhes:', error);
    }
    
    console.log('\n7. Testando queries restantes...');
    try {
      // Clientes ativos
      const [clientesAtivos] = await connection.execute(`
        SELECT COUNT(DISTINCT c.id) as total
        FROM clientes_cobrancas c
        JOIN emprestimos e ON e.cliente_id = c.id
        WHERE e.status IN ('Ativo', 'Pendente')
          AND e.status <> 'Quitado'
      `);
      console.log('✅ Clientes ativos:', clientesAtivos[0]);
      
      // Empréstimos ativos
      const [emprestimosAtivos] = await connection.execute(`
        SELECT COUNT(*) as total
        FROM emprestimos
        WHERE status IN ('Ativo', 'Pendente')
          AND status <> 'Quitado'
      `);
      console.log('✅ Empréstimos ativos:', emprestimosAtivos[0]);
      
      // Empréstimos recentes
      const [emprestimosRecentes] = await connection.execute(`
        SELECT e.*, c.nome as cliente_nome, c.telefone as telefone
        FROM emprestimos e
        LEFT JOIN clientes_cobrancas c ON e.cliente_id = c.id
        WHERE e.status IN ('Ativo', 'Pendente') AND e.cliente_id IS NOT NULL
        ORDER BY e.created_at DESC
        LIMIT 5
      `);
      console.log('✅ Empréstimos recentes:', emprestimosRecentes.length);
      
      // Cobranças pendentes
      const [cobrancasPendentes] = await connection.execute(`
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
      console.error('❌ Erro nas queries restantes:', error.message);
      console.log('Detalhes:', error);
    }
    
    await connection.end();
    
    console.log('\n🎯 Diagnóstico concluído!');
    
  } catch (error) {
    console.error('❌ Erro geral no diagnóstico:', error.message);
    console.log('Stack trace:', error.stack);
    
    if (error.code === 'ER_NO_SUCH_TABLE') {
      console.log('\n💡 Solução: Tabela não existe. Execute:');
      console.log('   node scripts/init-cobrancas-db.js');
    } else if (error.code === 'ER_BAD_FIELD_ERROR') {
      console.log('\n💡 Solução: Campo não existe. Verifique a estrutura das tabelas.');
    } else if (error.code === 'ER_ACCESS_DENIED_ERROR') {
      console.log('\n💡 Solução: Erro de permissão. Verifique as credenciais.');
    }
  }
}

// Executar o diagnóstico
debugDashboard500(); 