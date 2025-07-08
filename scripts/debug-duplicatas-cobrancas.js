const mysql = require('mysql2/promise');

console.log('🔍 Debugando empréstimos duplicados na página de cobranças...');

async function debugDuplicatasCobrancas() {
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
    
    // 1. Verificar todos os empréstimos (mesma query da API)
    const [emprestimos] = await connection.execute(`
      SELECT e.*, c.nome as cliente_nome, c.telefone as telefone
      FROM emprestimos e
      LEFT JOIN clientes_cobrancas c ON e.cliente_id = c.id
      ORDER BY e.created_at DESC
    `);
    
    console.log(`\n📊 Total de empréstimos encontrados: ${emprestimos.length}`);
    
    // 2. Verificar duplicatas por cliente
    const contadorPorCliente = {};
    emprestimos.forEach(emp => {
      const cliente = emp.cliente_nome || 'Sem nome';
      if (!contadorPorCliente[cliente]) {
        contadorPorCliente[cliente] = [];
      }
      contadorPorCliente[cliente].push({
        id: emp.id,
        valor: emp.valor,
        status: emp.status,
        data_emprestimo: emp.data_emprestimo,
        data_vencimento: emp.data_vencimento
      });
    });
    
    console.log('\n📋 Empréstimos por cliente:');
    for (const [cliente, emps] of Object.entries(contadorPorCliente)) {
      console.log(`\n👤 ${cliente}: ${emps.length} empréstimo(s)`);
      emps.forEach(emp => {
        console.log(`   ID ${emp.id}: R$ ${emp.valor} - ${emp.status} - Empréstimo: ${emp.data_emprestimo} - Vencimento: ${emp.data_vencimento}`);
      });
      
      if (emps.length > 1) {
        console.log(`   ⚠️  POSSÍVEL DUPLICATA: ${emps.length} empréstimos para o mesmo cliente`);
      }
    }
    
    // 3. Verificar duplicatas por valor e cliente
    const possiveisDuplicatas = [];
    for (const [cliente, emps] of Object.entries(contadorPorCliente)) {
      if (emps.length > 1) {
        // Verificar se há valores iguais
        const porValor = {};
        emps.forEach(emp => {
          const valor = emp.valor;
          if (!porValor[valor]) {
            porValor[valor] = [];
          }
          porValor[valor].push(emp);
        });
        
        for (const [valor, empsValor] of Object.entries(porValor)) {
          if (empsValor.length > 1) {
            possiveisDuplicatas.push({
              cliente,
              valor,
              emprestimos: empsValor
            });
          }
        }
      }
    }
    
    if (possiveisDuplicatas.length > 0) {
      console.log('\n🚨 DUPLICATAS ENCONTRADAS:');
      possiveisDuplicatas.forEach(dup => {
        console.log(`\n🔴 Cliente: ${dup.cliente} - Valor: R$ ${dup.valor}`);
        console.log(`   Empréstimos duplicados:`);
        dup.emprestimos.forEach(emp => {
          console.log(`     ID ${emp.id}: ${emp.data_emprestimo} - Status: ${emp.status}`);
        });
      });
    } else {
      console.log('\n✅ Nenhuma duplicata real encontrada no banco');
    }
    
    // 4. Verificar empréstimos "em aberto" (mesma lógica do frontend)
    const emAberto = emprestimos.filter(e => {
      const status = (e.status || '').toLowerCase();
      return status === 'ativo' || status === 'pendente';
    });
    
    console.log(`\n📈 Empréstimos em aberto: ${emAberto.length}`);
    
    // 5. Verificar IDs únicos
    const idsUnicos = new Set(emprestimos.map(e => e.id));
    console.log(`\n🔢 IDs únicos: ${idsUnicos.size}`);
    console.log(`📊 Total registros: ${emprestimos.length}`);
    
    if (idsUnicos.size !== emprestimos.length) {
      console.log('🚨 PROBLEMA: Há IDs duplicados nos resultados!');
      const idCount = {};
      emprestimos.forEach(emp => {
        if (!idCount[emp.id]) {
          idCount[emp.id] = 0;
        }
        idCount[emp.id]++;
      });
      
      for (const [id, count] of Object.entries(idCount)) {
        if (count > 1) {
          console.log(`   ID ${id} aparece ${count} vezes`);
        }
      }
    } else {
      console.log('✅ Todos os IDs são únicos');
    }
    
    // 6. Verificar se o problema é no frontend
    console.log('\n🔍 Análise do problema:');
    console.log('Se os IDs são únicos no banco, o problema pode estar:');
    console.log('1. Na renderização do frontend (função renderCobrancasEmAbertoLista)');
    console.log('2. Em chamadas múltiplas à API');
    console.log('3. Em lógica que não limpa a tabela corretamente');
    
    // 7. Simular o que o frontend deveria mostrar
    console.log('\n🎯 O que deveria aparecer na página de cobranças:');
    emAberto.forEach(emp => {
      console.log(`${emp.cliente_nome || 'N/A'} - R$ ${emp.valor} - ${emp.data_vencimento} - ID: ${emp.id}`);
    });
    
    console.log(`\n📝 Total de linhas que deveriam aparecer: ${emAberto.length}`);
    
  } catch (error) {
    console.error('❌ Erro:', error.message);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

debugDuplicatasCobrancas().catch(console.error); 