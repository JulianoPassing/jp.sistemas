const mysql = require('mysql2/promise');

// Configuração do banco de dados
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'jp_cobrancas',
  charset: 'utf8mb4'
};

async function testParcelaUnicaQuitado() {
  let connection;
  
  try {
    connection = await mysql.createConnection(dbConfig);
    console.log('🔗 Conectado ao banco de dados');
    
    // 1. Buscar empréstimos de parcela única
    console.log('\n📋 Buscando empréstimos de parcela única...');
    const [emprestimos] = await connection.execute(`
      SELECT e.id, e.cliente_id, e.status, e.valor, e.data_vencimento, e.tipo_emprestimo,
             c.nome as cliente_nome
      FROM emprestimos e
      LEFT JOIN clientes_cobrancas c ON e.cliente_id = c.id
      WHERE (e.tipo_emprestimo != 'in_installments' OR e.tipo_emprestimo IS NULL)
        AND e.status IN ('Ativo', 'Pendente', 'Quitado')
      ORDER BY e.id DESC
      LIMIT 5
    `);
    
    console.log(`📊 Encontrados ${emprestimos.length} empréstimos de parcela única`);
    
    for (const emprestimo of emprestimos) {
      console.log(`\n📝 Empréstimo ID: ${emprestimo.id}`);
      console.log(`   Cliente: ${emprestimo.cliente_nome}`);
      console.log(`   Status: ${emprestimo.status}`);
      console.log(`   Valor: R$ ${emprestimo.valor}`);
      console.log(`   Vencimento: ${emprestimo.data_vencimento}`);
      console.log(`   Tipo: ${emprestimo.tipo_emprestimo || 'Não definido (assumido como valor fixo)'}`);
      
      // Verificar se tem parcelas (não deveria ter)
      const [parcelas] = await connection.execute(`
        SELECT COUNT(*) as total_parcelas
        FROM parcelas
        WHERE emprestimo_id = ?
      `, [emprestimo.id]);
      
      console.log(`   📅 Parcelas: ${parcelas[0].total_parcelas}`);
      
      // Simular lógica do frontend
      const hoje = new Date();
      hoje.setHours(0, 0, 0, 0);
      const dataVencimento = new Date(emprestimo.data_vencimento);
      
      let statusCalculado = emprestimo.status;
      
      // Aplicar a lógica ANTIGA (problemática)
      let statusAntigo = emprestimo.status;
      if (dataVencimento && dataVencimento < hoje && statusAntigo !== 'QUITADO') {
        statusAntigo = 'Em Atraso';
      }
      
      // Aplicar a lógica NOVA (corrigida)
      let statusNovo = emprestimo.status;
      if (dataVencimento && dataVencimento < hoje && statusNovo.toUpperCase() !== 'QUITADO') {
        statusNovo = 'Em Atraso';
      }
      
      console.log(`   🔄 Status no banco: ${emprestimo.status}`);
      console.log(`   🔄 Status calculado (ANTIGO): ${statusAntigo}`);
      console.log(`   🔄 Status calculado (NOVO): ${statusNovo}`);
      console.log(`   ✅ Correção funcionou: ${statusAntigo !== statusNovo ? 'SIM' : 'NÃO (sem diferença)'}`);
      
      if (emprestimo.status === 'Quitado' && statusAntigo === 'Em Atraso' && statusNovo === 'Quitado') {
        console.log(`   🎉 SUCESSO: Empréstimo quitado agora é respeitado!`);
      }
    }
    
    // 2. Testar especificamente um empréstimo marcado como quitado
    console.log('\n🧪 Teste específico: marcar empréstimo como quitado...');
    
    const [emprestimosAtivos] = await connection.execute(`
      SELECT e.id, e.status, e.data_vencimento, c.nome as cliente_nome
      FROM emprestimos e
      LEFT JOIN clientes_cobrancas c ON e.cliente_id = c.id
      WHERE e.status = 'Ativo'
        AND (e.tipo_emprestimo != 'in_installments' OR e.tipo_emprestimo IS NULL)
      LIMIT 1
    `);
    
    if (emprestimosAtivos.length > 0) {
      const empTeste = emprestimosAtivos[0];
      console.log(`📝 Testando com empréstimo ID: ${empTeste.id} (${empTeste.cliente_nome})`);
      
      // Status ANTES da marcação
      console.log(`   Status ANTES: ${empTeste.status}`);
      
      // Marcar como quitado
      await connection.execute(
        'UPDATE emprestimos SET status = ? WHERE id = ?',
        ['Quitado', empTeste.id]
      );
      
      // Buscar status atualizado
      const [empAtualizado] = await connection.execute(
        'SELECT status FROM emprestimos WHERE id = ?',
        [empTeste.id]
      );
      
      console.log(`   Status DEPOIS: ${empAtualizado[0].status}`);
      
      // Simular lógica do frontend
      const hoje = new Date();
      hoje.setHours(0, 0, 0, 0);
      const dataVencimento = new Date(empTeste.data_vencimento);
      
      let statusFrontend = empAtualizado[0].status;
      if (dataVencimento && dataVencimento < hoje && statusFrontend.toUpperCase() !== 'QUITADO') {
        statusFrontend = 'Em Atraso';
      }
      
      console.log(`   Status no frontend: ${statusFrontend}`);
      console.log(`   ✅ Funcionou: ${statusFrontend === 'Quitado' ? 'SIM' : 'NÃO'}`);
      
      // Reverter para não afetar dados reais
      await connection.execute(
        'UPDATE emprestimos SET status = ? WHERE id = ?',
        ['Ativo', empTeste.id]
      );
      console.log(`   🔄 Status revertido para Ativo`);
    } else {
      console.log('⚠️ Nenhum empréstimo ativo encontrado para teste');
    }
    
    // 3. Verificar quantos empréstimos podem estar afetados
    console.log('\n📊 Estatísticas de empréstimos afetados...');
    
    const [stats] = await connection.execute(`
      SELECT 
        COUNT(CASE WHEN status = 'Quitado' THEN 1 END) as quitados_total,
        COUNT(CASE WHEN status = 'Quitado' AND data_vencimento < CURDATE() THEN 1 END) as quitados_vencidos,
        COUNT(CASE WHEN status = 'Ativo' AND data_vencimento < CURDATE() THEN 1 END) as ativos_vencidos
      FROM emprestimos
      WHERE (tipo_emprestimo != 'in_installments' OR tipo_emprestimo IS NULL)
    `);
    
    console.log(`📈 Empréstimos de parcela única quitados: ${stats[0].quitados_total}`);
    console.log(`📈 Empréstimos quitados mas vencidos: ${stats[0].quitados_vencidos} (eram afetados pelo bug)`);
    console.log(`📈 Empréstimos ativos vencidos: ${stats[0].ativos_vencidos}`);
    
    if (stats[0].quitados_vencidos > 0) {
      console.log(`\n🎯 A correção beneficia ${stats[0].quitados_vencidos} empréstimos!`);
    }
    
    console.log(`\n🎉 Teste concluído!`);
    
  } catch (error) {
    console.error('❌ Erro no teste:', error);
    console.error('Detalhes:', error.message);
  } finally {
    if (connection) {
      await connection.end();
      console.log('🔌 Conexão com banco encerrada');
    }
  }
}

// Executar o teste
testParcelaUnicaQuitado().catch(console.error); 