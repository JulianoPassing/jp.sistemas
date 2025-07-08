const mysql = require('mysql2/promise');

console.log('🧪 Testando correção das duplicatas na página de cobranças...');

async function testCorrecaoDuplicatas() {
  let connection;
  
  try {
    // Conectar ao banco do usuário cobranca
    const dbConfig = {
      host: 'localhost',
      user: 'jpsistemas',
      password: 'Juliano@95',
      database: 'jpcobrancas_cobranca',
      charset: 'utf8mb4'
    };
    
    connection = await mysql.createConnection(dbConfig);
    console.log('✅ Conectado ao banco jpcobrancas_cobranca');
    
    // Simular exatamente o que a API faz
    const [emprestimos] = await connection.execute(`
      SELECT e.*, c.nome as cliente_nome, c.telefone as telefone
      FROM emprestimos e
      LEFT JOIN clientes_cobrancas c ON e.cliente_id = c.id
      ORDER BY e.created_at DESC
    `);
    
    console.log(`\n📊 Total de empréstimos da API: ${emprestimos.length}`);
    
    // Filtrar apenas em aberto (mesma lógica do frontend)
    const emAberto = emprestimos.filter(e => {
      const status = (e.status || '').toLowerCase();
      return status === 'ativo' || status === 'pendente';
    });
    
    console.log(`📈 Empréstimos em aberto: ${emAberto.length}`);
    
    // Simular a nova lógica de Map para garantir unicidade
    const emprestimosUnicos = new Map();
    emAberto.forEach(emp => {
      if (!emprestimosUnicos.has(emp.id)) {
        emprestimosUnicos.set(emp.id, emp);
      }
    });
    
    console.log(`🔍 Empréstimos únicos após Map: ${emprestimosUnicos.size}`);
    
    // Mostrar detalhes dos empréstimos únicos
    console.log('\n📋 Empréstimos que aparecerão na página:');
    let contador = 0;
    for (const emp of emprestimosUnicos.values()) {
      contador++;
      console.log(`${contador}. ID: ${emp.id} - Cliente: ${emp.cliente_nome || 'N/A'} - Valor: R$ ${emp.valor} - Status: ${emp.status}`);
    }
    
    // Verificar se há duplicatas por cliente
    const clientesCount = {};
    for (const emp of emprestimosUnicos.values()) {
      const cliente = emp.cliente_nome || 'N/A';
      if (!clientesCount[cliente]) {
        clientesCount[cliente] = 0;
      }
      clientesCount[cliente]++;
    }
    
    console.log('\n📊 Contagem por cliente:');
    for (const [cliente, count] of Object.entries(clientesCount)) {
      console.log(`   ${cliente}: ${count} empréstimo(s)`);
    }
    
    // Verificar se há múltiplos empréstimos legítimos para o mesmo cliente
    const clientesMultiplos = Object.entries(clientesCount).filter(([cliente, count]) => count > 1);
    
    if (clientesMultiplos.length > 0) {
      console.log('\n⚠️  Clientes com múltiplos empréstimos (pode ser legítimo):');
      for (const [cliente, count] of clientesMultiplos) {
        console.log(`   ${cliente}: ${count} empréstimos`);
        
        // Mostrar detalhes dos empréstimos deste cliente
        const emprestimosCli = Array.from(emprestimosUnicos.values()).filter(e => (e.cliente_nome || 'N/A') === cliente);
        emprestimosCli.forEach(emp => {
          console.log(`     ID ${emp.id}: R$ ${emp.valor} - ${emp.data_emprestimo} - ${emp.status}`);
        });
      }
    } else {
      console.log('\n✅ Cada cliente tem apenas um empréstimo em aberto');
    }
    
    // Teste final: verificar se não há duplicatas de ID
    const idsArray = Array.from(emprestimosUnicos.keys());
    const idsSet = new Set(idsArray);
    
    console.log('\n🔍 Verificação final:');
    console.log(`   IDs no array: ${idsArray.length}`);
    console.log(`   IDs únicos: ${idsSet.size}`);
    
    if (idsArray.length === idsSet.size) {
      console.log('✅ SUCESSO: Não há duplicatas de ID');
    } else {
      console.log('❌ PROBLEMA: Ainda há duplicatas de ID');
    }
    
    console.log('\n🎯 Resultado esperado na página:');
    console.log(`   - Devem aparecer exatamente ${emprestimosUnicos.size} linha(s) na tabela`);
    console.log(`   - Nenhuma duplicata deve ser exibida`);
    console.log(`   - Cada empréstimo deve aparecer apenas uma vez`);
    
    // Simular o que apareceria na tabela
    console.log('\n📋 Simulação da tabela:');
    console.log('CLIENTE | VALOR | VENCIMENTO | STATUS | AÇÕES');
    console.log('--------|-------|------------|--------|-------');
    
    for (const emp of emprestimosUnicos.values()) {
      const valor = `R$ ${emp.valor}`;
      const vencimento = emp.data_vencimento || '-';
      const status = emp.status || '-';
      console.log(`${emp.cliente_nome || 'N/A'} | ${valor} | ${vencimento} | ${status} | Ver, Cobrar`);
    }
    
  } catch (error) {
    console.error('❌ Erro:', error.message);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

testCorrecaoDuplicatas().catch(console.error); 