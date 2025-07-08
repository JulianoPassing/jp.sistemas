const mysql = require('mysql2/promise');

// Configuração do banco - ajuste conforme necessário
const username = 'admin'; // Substitua pelo seu usuário
const dbName = `jpcobrancas_${username.toLowerCase().replace(/[^a-z0-9]/g, '_')}`;

const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'jpcobrancas',
  password: process.env.DB_PASSWORD || 'Juliano@95',
  database: dbName,
  charset: 'utf8mb4'
};

async function popularDadosTeste() {
  console.log('=== POPULANDO BANCO COM DADOS DE TESTE ===\n');
  
  try {
    const connection = await mysql.createConnection(dbConfig);
    console.log('✅ Conexão estabelecida com sucesso\n');
    
    // 1. Limpar dados existentes (opcional)
    console.log('1. Limpando dados existentes...');
    await connection.execute('DELETE FROM pagamentos');
    await connection.execute('DELETE FROM cobrancas');
    await connection.execute('DELETE FROM parcelas');
    await connection.execute('DELETE FROM emprestimos');
    await connection.execute('DELETE FROM clientes_cobrancas');
    console.log('✅ Dados limpos');
    
    // 2. Inserir clientes de teste
    console.log('\n2. Inserindo clientes de teste...');
    const clientes = [
      ['João Silva', '123.456.789-00', 'joao@email.com', '(11) 99999-1111', 'Rua A, 123', 'São Paulo', 'SP', '01234-567'],
      ['Maria Santos', '987.654.321-00', 'maria@email.com', '(11) 99999-2222', 'Rua B, 456', 'São Paulo', 'SP', '01234-568'],
      ['Pedro Costa', '456.789.123-00', 'pedro@email.com', '(11) 99999-3333', 'Rua C, 789', 'São Paulo', 'SP', '01234-569'],
      ['Ana Oliveira', '789.123.456-00', 'ana@email.com', '(11) 99999-4444', 'Rua D, 012', 'São Paulo', 'SP', '01234-570'],
      ['Carlos Mendes', '321.654.987-00', 'carlos@email.com', '(11) 99999-5555', 'Rua E, 345', 'São Paulo', 'SP', '01234-571']
    ];
    
    for (const cliente of clientes) {
      await connection.execute(`
        INSERT INTO clientes_cobrancas (nome, cpf_cnpj, email, telefone, endereco, cidade, estado, cep, status)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'Ativo')
      `, cliente);
    }
    console.log(`✅ ${clientes.length} clientes inseridos`);
    
    // 3. Inserir empréstimos de teste
    console.log('\n3. Inserindo empréstimos de teste...');
    const emprestimos = [
      [1, 1000.00, '2024-01-15', '2024-02-15', 5.00, 2.00, 'Ativo', 'Empréstimo para capital de giro'],
      [2, 2500.00, '2024-01-20', '2024-03-20', 4.50, 2.50, 'Ativo', 'Empréstimo para investimento'],
      [3, 800.00, '2024-02-01', '2024-03-01', 6.00, 3.00, 'Ativo', 'Empréstimo emergencial'],
      [4, 1500.00, '2024-01-10', '2024-01-25', 5.50, 2.00, 'Ativo', 'Empréstimo para pagamento de dívidas'],
      [5, 3000.00, '2024-01-05', '2024-04-05', 4.00, 1.50, 'Ativo', 'Empréstimo para expansão do negócio']
    ];
    
    for (const emprestimo of emprestimos) {
      // Calcular valor inicial e valor com juros
      const valorInicial = emprestimo[1];
      const jurosPercentual = emprestimo[4] / 100;
      const valorComJuros = valorInicial * (1 + jurosPercentual);
      
      await connection.execute(`
        INSERT INTO emprestimos (cliente_id, valor, valor_inicial, data_emprestimo, data_vencimento, juros_mensal, multa_atraso, status, observacoes)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [emprestimo[0], valorComJuros, valorInicial, emprestimo[2], emprestimo[3], emprestimo[4], emprestimo[5], emprestimo[6], emprestimo[7]]);
    }
    console.log(`✅ ${emprestimos.length} empréstimos inseridos`);
    
    // 4. Inserir cobranças de teste
    console.log('\n4. Inserindo cobranças de teste...');
    const [emprestimosResult] = await connection.execute('SELECT * FROM emprestimos');
    
    for (const emprestimo of emprestimosResult) {
      const valorOriginal = emprestimo.valor_inicial || emprestimo.valor;
      const valorAtualizado = emprestimo.valor;
      const jurosCalculados = valorAtualizado - valorOriginal;
      
      // Determinar status baseado na data de vencimento
      const dataVencimento = new Date(emprestimo.data_vencimento);
      const hoje = new Date();
      const status = dataVencimento < hoje ? 'Pendente' : 'Pendente';
      
      await connection.execute(`
        INSERT INTO cobrancas (emprestimo_id, cliente_id, valor_original, valor_atualizado, juros_calculados, multa_calculada, data_vencimento, status, observacoes)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [emprestimo.id, emprestimo.cliente_id, valorOriginal, valorAtualizado, jurosCalculados, 0, emprestimo.data_vencimento, status, 'Cobrança gerada automaticamente']);
    }
    console.log(`✅ ${emprestimosResult.length} cobranças inseridas`);
    
    // 5. Inserir alguns pagamentos de teste
    console.log('\n5. Inserindo pagamentos de teste...');
    const [cobrancasResult] = await connection.execute('SELECT * FROM cobrancas LIMIT 2');
    
    for (const cobranca of cobrancasResult) {
      await connection.execute(`
        INSERT INTO pagamentos (cobranca_id, valor_pago, data_pagamento, forma_pagamento, observacoes)
        VALUES (?, ?, ?, ?, ?)
      `, [cobranca.id, cobranca.valor_atualizado, '2024-01-30', 'Dinheiro', 'Pagamento em dinheiro']);
      
      // Atualizar status da cobrança para Paga
      await connection.execute(`
        UPDATE cobrancas SET status = 'Paga' WHERE id = ?
      `, [cobranca.id]);
    }
    console.log(`✅ ${cobrancasResult.length} pagamentos inseridos`);
    
    // 6. Verificar dados inseridos
    console.log('\n6. Verificando dados inseridos...');
    
    const [clientesCount] = await connection.execute('SELECT COUNT(*) as total FROM clientes_cobrancas');
    const [emprestimosCount] = await connection.execute('SELECT COUNT(*) as total FROM emprestimos');
    const [cobrancasCount] = await connection.execute('SELECT COUNT(*) as total FROM cobrancas');
    const [pagamentosCount] = await connection.execute('SELECT COUNT(*) as total FROM pagamentos');
    
    console.log(`📊 Resumo dos dados inseridos:`);
    console.log(`   - Clientes: ${clientesCount[0].total}`);
    console.log(`   - Empréstimos: ${emprestimosCount[0].total}`);
    console.log(`   - Cobranças: ${cobrancasCount[0].total}`);
    console.log(`   - Pagamentos: ${pagamentosCount[0].total}`);
    
    // 7. Testar queries do dashboard
    console.log('\n7. Testando queries do dashboard...');
    
    const [statsEmprestimos] = await connection.execute(`
      SELECT 
        COUNT(CASE WHEN status IN ('Ativo', 'Pendente') AND cliente_id IS NOT NULL THEN 1 END) as total_emprestimos,
        COALESCE(SUM(CASE WHEN status IN ('Ativo', 'Pendente') AND cliente_id IS NOT NULL THEN COALESCE(valor_inicial, valor) ELSE 0 END), 0) as valor_total_emprestimos
      FROM emprestimos
    `);
    
    const [statsCobrancas] = await connection.execute(`
      SELECT 
        COUNT(*) as total_cobrancas,
        COALESCE(SUM(valor_atualizado), 0) as valor_total_cobrancas,
        COUNT(CASE WHEN status = 'Pendente' THEN 1 END) as cobrancas_pendentes,
        COUNT(CASE WHEN status = 'Paga' THEN 1 END) as cobrancas_pagas
      FROM cobrancas
    `);
    
    console.log(`📈 Estatísticas para o dashboard:`);
    console.log(`   - Total de empréstimos: ${statsEmprestimos[0].total_emprestimos}`);
    console.log(`   - Valor total investido: R$ ${statsEmprestimos[0].valor_total_emprestimos.toFixed(2)}`);
    console.log(`   - Total de cobranças: ${statsCobrancas[0].total_cobrancas}`);
    console.log(`   - Valor a receber: R$ ${statsCobrancas[0].valor_total_cobrancas.toFixed(2)}`);
    console.log(`   - Cobranças pendentes: ${statsCobrancas[0].cobrancas_pendentes}`);
    console.log(`   - Cobranças pagas: ${statsCobrancas[0].cobrancas_pagas}`);
    
    await connection.end();
    console.log('\n🎉 DADOS DE TESTE INSERIDOS COM SUCESSO!');
    console.log('📱 Agora você pode acessar o dashboard e ver as informações preenchidas.');
    
  } catch (error) {
    console.error('❌ Erro ao popular dados de teste:', error);
    console.error('Stack trace:', error.stack);
  }
}

// Executar o script
popularDadosTeste(); 