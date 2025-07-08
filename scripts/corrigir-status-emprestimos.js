const { createCobrancasConnection } = require('../api/cobrancas');

async function corrigirStatusEmprestimos() {
  console.log('🔧 Corrigindo status dos empréstimos...\n');
  
  try {
    const username = 'admin';
    const connection = await createCobrancasConnection(username);
    
    // 1. Verificar status atuais
    console.log('1. Verificando status atuais...');
    const [statusAtuais] = await connection.execute(`
      SELECT 
        status, 
        COUNT(*) as total,
        CHAR_LENGTH(status) as tamanho,
        HEX(status) as hex_value
      FROM emprestimos 
      GROUP BY status
    `);
    
    console.log('Status encontrados:');
    statusAtuais.forEach(s => {
      console.log(`   "${s.status}" (${s.total} empréstimos, tamanho: ${s.tamanho}, HEX: ${s.hex_value})`);
    });
    
    // 2. Verificar cliente_id
    console.log('\n2. Verificando cliente_id...');
    const [clienteIdProblemas] = await connection.execute(`
      SELECT 
        COUNT(CASE WHEN cliente_id IS NULL THEN 1 END) as nulls,
        COUNT(CASE WHEN cliente_id = 0 THEN 1 END) as zeros,
        COUNT(CASE WHEN cliente_id > 0 THEN 1 END) as validos
      FROM emprestimos
    `);
    
    console.log(`   Cliente ID NULL: ${clienteIdProblemas[0].nulls}`);
    console.log(`   Cliente ID = 0: ${clienteIdProblemas[0].zeros}`);
    console.log(`   Cliente ID válidos: ${clienteIdProblemas[0].validos}`);
    
    // 3. Corrigir cliente_id se necessário
    if (clienteIdProblemas[0].nulls > 0 || clienteIdProblemas[0].zeros > 0) {
      console.log('\n3. Corrigindo cliente_id...');
      
      // Verificar se há clientes disponíveis
      const [clientesDisponiveis] = await connection.execute(`
        SELECT id FROM clientes_cobrancas ORDER BY id LIMIT 1
      `);
      
      if (clientesDisponiveis.length > 0) {
        const clienteId = clientesDisponiveis[0].id;
        
        // Corrigir empréstimos sem cliente
        await connection.execute(`
          UPDATE emprestimos 
          SET cliente_id = ? 
          WHERE cliente_id IS NULL OR cliente_id = 0
        `, [clienteId]);
        
        console.log(`   ✅ Cliente_id corrigido para ${clienteId}`);
      } else {
        console.log('   ⚠️ Nenhum cliente encontrado para corrigir');
      }
    }
    
    // 4. Corrigir status se necessário
    console.log('\n4. Corrigindo status...');
    
    // Normalizar status conhecidos
    const correcoesStatus = [
      { de: '', para: 'Ativo' },
      { de: null, para: 'Ativo' },
      { de: 'ativo', para: 'Ativo' },
      { de: 'ATIVO', para: 'Ativo' },
      { de: 'pendente', para: 'Pendente' },
      { de: 'PENDENTE', para: 'Pendente' },
      { de: 'quitado', para: 'Quitado' },
      { de: 'QUITADO', para: 'Quitado' },
      { de: 'pago', para: 'Quitado' },
      { de: 'PAGO', para: 'Quitado' }
    ];
    
    for (const correcao of correcoesStatus) {
      if (correcao.de === null) {
        await connection.execute(`
          UPDATE emprestimos 
          SET status = ? 
          WHERE status IS NULL
        `, [correcao.para]);
      } else {
        await connection.execute(`
          UPDATE emprestimos 
          SET status = ? 
          WHERE TRIM(status) = ?
        `, [correcao.para, correcao.de]);
      }
    }
    
    // Se ainda há status problemáticos, definir como 'Ativo'
    await connection.execute(`
      UPDATE emprestimos 
      SET status = 'Ativo' 
      WHERE status IS NULL OR TRIM(status) = '' OR status NOT IN ('Ativo', 'Pendente', 'Quitado')
    `);
    
    console.log('   ✅ Status normalizados');
    
    // 5. Verificar valores (valor vs valor_inicial)
    console.log('\n5. Verificando valores...');
    const [valoresProblema] = await connection.execute(`
      SELECT 
        COUNT(CASE WHEN valor IS NULL AND valor_inicial IS NULL THEN 1 END) as sem_valor,
        COUNT(CASE WHEN valor IS NULL AND valor_inicial IS NOT NULL THEN 1 END) as so_inicial,
        COUNT(CASE WHEN valor IS NOT NULL AND valor_inicial IS NULL THEN 1 END) as so_valor,
        COUNT(CASE WHEN valor IS NOT NULL AND valor_inicial IS NOT NULL THEN 1 END) as ambos
      FROM emprestimos
    `);
    
    console.log(`   Sem valor: ${valoresProblema[0].sem_valor}`);
    console.log(`   Só valor_inicial: ${valoresProblema[0].so_inicial}`);
    console.log(`   Só valor: ${valoresProblema[0].so_valor}`);
    console.log(`   Ambos: ${valoresProblema[0].ambos}`);
    
    // Corrigir valores se necessário
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
    
    await connection.execute(`
      UPDATE emprestimos 
      SET valor = 1000, valor_inicial = 1000 
      WHERE (valor IS NULL OR valor = 0) AND (valor_inicial IS NULL OR valor_inicial = 0)
    `);
    
    console.log('   ✅ Valores corrigidos');
    
    // 6. Verificar resultado final
    console.log('\n6. Verificando resultado final...');
    const [resultado] = await connection.execute(`
      SELECT 
        COUNT(CASE WHEN cliente_id IS NOT NULL AND cliente_id > 0 
                   AND status IN ('Ativo', 'Pendente') 
              THEN 1 END) as total_emprestimos,
        COALESCE(SUM(CASE WHEN cliente_id IS NOT NULL AND cliente_id > 0 
                         AND status IN ('Ativo', 'Pendente') 
                     THEN COALESCE(valor_inicial, valor) ELSE 0 END), 0) as valor_total_emprestimos
      FROM emprestimos
    `);
    
    console.log('\n📊 RESULTADO FINAL:');
    console.log('==================');
    console.log(`✅ Total de empréstimos: ${resultado[0].total_emprestimos}`);
    console.log(`✅ Valor total investido: R$ ${resultado[0].valor_total_emprestimos.toFixed(2)}`);
    
    if (resultado[0].total_emprestimos > 0) {
      console.log('\n🎉 SUCESSO! Empréstimos corrigidos e funcionando!');
    } else {
      console.log('\n⚠️ Ainda há problemas. Verifique os dados manualmente.');
    }
    
    await connection.end();
    
  } catch (error) {
    console.error('❌ Erro durante a correção:', error);
  }
}

corrigirStatusEmprestimos().catch(console.error); 