const mysql = require('mysql2/promise');

// Configuração do banco de dados
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'jp_cobrancas',
  charset: 'utf8mb4'
};

async function fixEmprestimosQuitadosInconsistentes() {
  let connection;
  
  try {
    connection = await mysql.createConnection(dbConfig);
    console.log('🔗 Conectado ao banco de dados');
    
    // 1. Buscar empréstimos marcados como quitados mas com parcelas não pagas
    console.log('\n🔍 Buscando empréstimos inconsistentes...');
    const [emprestimosInconsistentes] = await connection.execute(`
      SELECT e.id, e.cliente_id, e.status, e.valor, 
             c.nome as cliente_nome,
             COUNT(p.id) as total_parcelas,
             SUM(CASE WHEN p.status = 'Paga' THEN 1 ELSE 0 END) as parcelas_pagas,
             SUM(CASE WHEN p.status != 'Paga' THEN 1 ELSE 0 END) as parcelas_pendentes
      FROM emprestimos e
      LEFT JOIN clientes_cobrancas c ON e.cliente_id = c.id
      LEFT JOIN parcelas p ON p.emprestimo_id = e.id
      WHERE e.status = 'Quitado'
      GROUP BY e.id
      HAVING COUNT(p.id) > 0 AND SUM(CASE WHEN p.status != 'Paga' THEN 1 ELSE 0 END) > 0
      ORDER BY e.id
    `);
    
    console.log(`📊 Encontrados ${emprestimosInconsistentes.length} empréstimos inconsistentes`);
    
    if (emprestimosInconsistentes.length === 0) {
      console.log('✅ Nenhum empréstimo inconsistente encontrado!');
      return;
    }
    
    // 2. Listar empréstimos inconsistentes
    console.log('\n📋 Empréstimos inconsistentes encontrados:');
    for (const emp of emprestimosInconsistentes) {
      console.log(`\n📝 Empréstimo ID: ${emp.id}`);
      console.log(`   Cliente: ${emp.cliente_nome}`);
      console.log(`   Status: ${emp.status} (marcado como quitado)`);
      console.log(`   Valor: R$ ${emp.valor}`);
      console.log(`   Total parcelas: ${emp.total_parcelas}`);
      console.log(`   Parcelas pagas: ${emp.parcelas_pagas}`);
      console.log(`   Parcelas pendentes: ${emp.parcelas_pendentes}`);
      
      // Mostrar detalhes das parcelas pendentes
      const [parcelasPendentes] = await connection.execute(`
        SELECT numero_parcela, valor_parcela, data_vencimento, status
        FROM parcelas
        WHERE emprestimo_id = ? AND status != 'Paga'
        ORDER BY numero_parcela
      `, [emp.id]);
      
      if (parcelasPendentes.length > 0) {
        console.log(`   📅 Parcelas pendentes:`);
        for (const parcela of parcelasPendentes) {
          console.log(`      ${parcela.numero_parcela}: R$ ${parcela.valor_parcela} - ${parcela.data_vencimento} - ${parcela.status}`);
        }
      }
    }
    
    // 3. Confirmar correção
    console.log('\n❓ Deseja corrigir estes empréstimos? (y/n)');
    
    // Para automação, vamos assumir que sim
    const corrigir = true; // process.argv.includes('--auto') ? true : false;
    
    if (corrigir) {
      console.log('\n🔧 Iniciando correção...');
      
      const hoje = new Date().toISOString().split('T')[0];
      let emprestimosCorrigidos = 0;
      let parcelasCorrigidas = 0;
      
      for (const emp of emprestimosInconsistentes) {
        console.log(`\n🔄 Corrigindo empréstimo ID: ${emp.id}`);
        
        // Marcar todas as parcelas como pagas
        const [parcelasUpdate] = await connection.execute(`
          UPDATE parcelas 
          SET status = 'Paga', 
              data_pagamento = ?, 
              valor_pago = COALESCE(valor_pago, valor_parcela),
              updated_at = CURRENT_TIMESTAMP
          WHERE emprestimo_id = ? AND status != 'Paga'
        `, [hoje, emp.id]);
        
        console.log(`   ✅ ${parcelasUpdate.affectedRows} parcelas marcadas como pagas`);
        parcelasCorrigidas += parcelasUpdate.affectedRows;
        
        // Marcar cobranças como pagas também
        await connection.execute('UPDATE cobrancas SET status = ? WHERE emprestimo_id = ?', ['Paga', emp.id]);
        
        emprestimosCorrigidos++;
        console.log(`   ✅ Empréstimo ${emp.id} corrigido`);
      }
      
      console.log(`\n🎉 Correção concluída!`);
      console.log(`📊 Empréstimos corrigidos: ${emprestimosCorrigidos}`);
      console.log(`📊 Parcelas corrigidas: ${parcelasCorrigidas}`);
      
      // 4. Verificar se a correção funcionou
      console.log('\n🔍 Verificando se a correção funcionou...');
      const [emprestimosAindaInconsistentes] = await connection.execute(`
        SELECT e.id, e.status, 
               COUNT(p.id) as total_parcelas,
               SUM(CASE WHEN p.status = 'Paga' THEN 1 ELSE 0 END) as parcelas_pagas
        FROM emprestimos e
        LEFT JOIN parcelas p ON p.emprestimo_id = e.id
        WHERE e.status = 'Quitado'
        GROUP BY e.id
        HAVING COUNT(p.id) > 0 AND SUM(CASE WHEN p.status != 'Paga' THEN 1 ELSE 0 END) > 0
      `);
      
      if (emprestimosAindaInconsistentes.length === 0) {
        console.log('✅ Todas as inconsistências foram corrigidas!');
      } else {
        console.log(`❌ Ainda existem ${emprestimosAindaInconsistentes.length} empréstimos inconsistentes`);
      }
      
    } else {
      console.log('❌ Correção cancelada pelo usuário');
    }
    
    // 5. Buscar empréstimos que deveriam estar quitados mas não estão
    console.log('\n🔍 Buscando empréstimos que deveriam estar quitados...');
    const [emprestimosDeveriamQuitados] = await connection.execute(`
      SELECT e.id, e.status, e.valor, c.nome as cliente_nome,
             COUNT(p.id) as total_parcelas,
             SUM(CASE WHEN p.status = 'Paga' THEN 1 ELSE 0 END) as parcelas_pagas
      FROM emprestimos e
      LEFT JOIN clientes_cobrancas c ON e.cliente_id = c.id
      LEFT JOIN parcelas p ON p.emprestimo_id = e.id
      WHERE e.status IN ('Ativo', 'Pendente')
      GROUP BY e.id
      HAVING COUNT(p.id) > 0 AND COUNT(p.id) = SUM(CASE WHEN p.status = 'Paga' THEN 1 ELSE 0 END)
      ORDER BY e.id
    `);
    
    console.log(`📊 Encontrados ${emprestimosDeveriamQuitados.length} empréstimos que deveriam estar quitados`);
    
    if (emprestimosDeveriamQuitados.length > 0) {
      console.log('\n📋 Empréstimos que deveriam estar quitados:');
      for (const emp of emprestimosDeveriamQuitados) {
        console.log(`   📝 ID: ${emp.id} - ${emp.cliente_nome} - ${emp.status} (${emp.parcelas_pagas}/${emp.total_parcelas} pagas)`);
      }
      
      if (corrigir) {
        console.log('\n🔧 Corrigindo status destes empréstimos...');
        for (const emp of emprestimosDeveriamQuitados) {
          await connection.execute(
            'UPDATE emprestimos SET status = ? WHERE id = ?',
            ['Quitado', emp.id]
          );
          console.log(`   ✅ Empréstimo ${emp.id} marcado como quitado`);
        }
      }
    }
    
    console.log('\n🎉 Processo concluído!');
    
  } catch (error) {
    console.error('❌ Erro durante a correção:', error);
    console.error('Detalhes:', error.message);
  } finally {
    if (connection) {
      await connection.end();
      console.log('🔌 Conexão com banco encerrada');
    }
  }
}

// Executar a correção
fixEmprestimosQuitadosInconsistentes().catch(console.error); 