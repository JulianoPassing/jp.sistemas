const mysql = require('mysql2/promise');

// Configurações do banco
const config = {
  host: 'localhost',
  user: 'root',
  password: '',
  database: 'cobrancas_test',
  charset: 'utf8mb4'
};

async function testEmprestimoCreation() {
  let connection;
  
  try {
    console.log('Conectando ao banco...');
    connection = await mysql.createConnection(config);
    
    // Dados de teste (simulando o que vem do frontend)
    const testData = {
      cliente_id: 1,
      valor: 1000,
      valor_final: 1500,
      valor_inicial_final: 1000,
      data_emprestimo: '2024-01-15',
      data_vencimento: '2024-02-15',
      juros_mensal: 50,
      multa_atraso: 0,
      observacoes: 'Teste de empréstimo',
      tipo_emprestimo: 'fixed',
      numero_parcelas: 3,
      frequencia: 'monthly',
      tipo_calculo: 'valor_final'
    };
    
    console.log('Dados de teste:', JSON.stringify(testData, null, 2));
    
    // Verificar se cliente existe
    console.log('Verificando se cliente existe...');
    const [clienteRows] = await connection.execute(`
      SELECT id, nome FROM clientes_cobrancas WHERE id = ?
    `, [testData.cliente_id]);
    
    if (clienteRows.length === 0) {
      console.log('Cliente não encontrado, criando cliente de teste...');
      await connection.execute(`
        INSERT INTO clientes_cobrancas (nome, telefone, email, status)
        VALUES ('Cliente Teste', '11999999999', 'teste@teste.com', 'Ativo')
      `);
      console.log('Cliente de teste criado');
    } else {
      console.log('Cliente encontrado:', clienteRows[0]);
    }
    
    // Verificar estrutura da tabela emprestimos
    console.log('Verificando estrutura da tabela emprestimos...');
    const [columns] = await connection.execute(`
      DESCRIBE emprestimos
    `);
    
    console.log('Colunas da tabela emprestimos:');
    columns.forEach(col => {
      console.log(`- ${col.Field}: ${col.Type} (${col.Null === 'YES' ? 'NULL' : 'NOT NULL'})`);
    });
    
    // Verificar se coluna tipo_calculo existe
    const hasColumnTipoCalculo = columns.some(col => col.Field === 'tipo_calculo');
    console.log('Coluna tipo_calculo existe:', hasColumnTipoCalculo);
    
    // Calcular valores
    let valorInicial = parseFloat(testData.valor) || 0;
    let valorFinalCalculado = parseFloat(testData.valor_final) || valorInicial;
    let valorParcelaCalculado = valorFinalCalculado / parseInt(testData.numero_parcelas);
    let jurosMensalFinal = valorInicial > 0 ? ((valorFinalCalculado - valorInicial) / valorInicial) * 100 : 0;
    
    console.log('Valores calculados:');
    console.log('- Valor inicial:', valorInicial);
    console.log('- Valor final:', valorFinalCalculado);
    console.log('- Valor parcela:', valorParcelaCalculado);
    console.log('- Juros mensal:', jurosMensalFinal);
    
    // Tentar inserir empréstimo
    console.log('Tentando inserir empréstimo...');
    
    let emprestimoResult;
    if (hasColumnTipoCalculo) {
      console.log('Inserindo com coluna tipo_calculo...');
      [emprestimoResult] = await connection.execute(`
        INSERT INTO emprestimos (
          cliente_id, valor, data_emprestimo, data_vencimento, juros_mensal, multa_atraso, observacoes,
          tipo_emprestimo, numero_parcelas, frequencia, valor_parcela, tipo_calculo
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        testData.cliente_id, valorInicial, testData.data_emprestimo, testData.data_vencimento, 
        jurosMensalFinal, testData.multa_atraso || 0, testData.observacoes || '',
        testData.tipo_emprestimo, testData.numero_parcelas, testData.frequencia, 
        valorParcelaCalculado, testData.tipo_calculo || 'valor_inicial'
      ]);
    } else {
      console.log('Inserindo sem coluna tipo_calculo...');
      [emprestimoResult] = await connection.execute(`
        INSERT INTO emprestimos (
          cliente_id, valor, data_emprestimo, data_vencimento, juros_mensal, multa_atraso, observacoes,
          tipo_emprestimo, numero_parcelas, frequencia, valor_parcela
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        testData.cliente_id, valorInicial, testData.data_emprestimo, testData.data_vencimento, 
        jurosMensalFinal, testData.multa_atraso || 0, testData.observacoes || '',
        testData.tipo_emprestimo, testData.numero_parcelas, testData.frequencia, valorParcelaCalculado
      ]);
    }
    
    console.log('Empréstimo inserido com sucesso! ID:', emprestimoResult.insertId);
    
    // Criar parcela
    console.log('Criando parcela...');
    await connection.execute(`
      INSERT INTO parcelas (emprestimo_id, numero_parcela, valor_parcela, data_vencimento)
      VALUES (?, ?, ?, ?)
    `, [emprestimoResult.insertId, 1, valorFinalCalculado, testData.data_vencimento]);
    
    console.log('Parcela criada com sucesso!');
    
    // Criar cobrança
    console.log('Criando cobrança...');
    await connection.execute(`
      INSERT INTO cobrancas (emprestimo_id, cliente_id, valor_original, valor_atualizado, data_vencimento, status)
      VALUES (?, ?, ?, ?, ?, 'Pendente')
    `, [emprestimoResult.insertId, testData.cliente_id, valorFinalCalculado, valorFinalCalculado, testData.data_vencimento]);
    
    console.log('Cobrança criada com sucesso!');
    
    console.log('=== TESTE CONCLUÍDO COM SUCESSO ===');
    
  } catch (error) {
    console.error('ERRO NO TESTE:', error);
    console.error('Stack trace:', error.stack);
    
    // Verificar se é erro de conexão
    if (error.code === 'ECONNREFUSED') {
      console.error('Erro de conexão: Verifique se o MySQL está rodando');
    } else if (error.code === 'ER_ACCESS_DENIED_ERROR') {
      console.error('Erro de acesso: Verifique usuário e senha do MySQL');
    } else if (error.code === 'ER_BAD_DB_ERROR') {
      console.error('Erro de banco: Banco de dados não existe');
    } else if (error.code === 'ER_NO_SUCH_TABLE') {
      console.error('Erro de tabela: Tabela não existe');
    } else if (error.code === 'ER_BAD_FIELD_ERROR') {
      console.error('Erro de campo: Campo não existe na tabela');
    }
    
  } finally {
    if (connection) {
      await connection.end();
      console.log('Conexão fechada');
    }
  }
}

// Executar teste
testEmprestimoCreation(); 