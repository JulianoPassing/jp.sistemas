const express = require('express');
const mysql = require('mysql2/promise');
const path = require('path');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

// Configuração do banco de dados
const dbConfig = {
  host: 'localhost',
  user: 'root',
  password: '',
  database: 'cobrancas_test',
  charset: 'utf8mb4'
};

// Rota de teste para criar empréstimo
app.post('/test-emprestimo', async (req, res) => {
  let connection;
  
  try {
    console.log('=== TESTE DE CRIAÇÃO DE EMPRÉSTIMO ===');
    console.log('Dados recebidos:', JSON.stringify(req.body, null, 2));
    
    // Conectar ao banco
    connection = await mysql.createConnection(dbConfig);
    console.log('Conexão estabelecida com sucesso');
    
    const { 
      cliente_id, 
      valor, 
      valor_final,
      valor_parcela,
      data_emprestimo, 
      data_vencimento, 
      juros_mensal, 
      multa_atraso, 
      observacoes,
      tipo_emprestimo = 'fixed',
      numero_parcelas = 1,
      frequencia = 'monthly',
      tipo_calculo = 'valor_inicial'
    } = req.body;
    
    // Validação básica
    if (!cliente_id || !valor || !data_emprestimo) {
      return res.status(400).json({ 
        error: 'Dados obrigatórios faltando',
        details: { cliente_id, valor, data_emprestimo }
      });
    }
    
    // Verificar se cliente existe
    const [clienteRows] = await connection.execute(`
      SELECT id, nome FROM clientes_cobrancas WHERE id = ?
    `, [cliente_id]);
    
    if (clienteRows.length === 0) {
      // Criar cliente de teste
      await connection.execute(`
        INSERT INTO clientes_cobrancas (nome, telefone, email, status)
        VALUES ('Cliente Teste', '11999999999', 'teste@teste.com', 'Ativo')
      `);
      console.log('Cliente de teste criado');
    }
    
    // Calcular valores
    let valorInicial = parseFloat(valor) || 0;
    let valorFinalCalculado = parseFloat(valor_final) || valorInicial;
    let valorParcelaCalculado = parseFloat(valor_parcela) || 0;
    let jurosMensalFinal = parseFloat(juros_mensal) || 0;
    
    if (tipo_calculo === 'valor_final' && valor_final) {
      valorParcelaCalculado = valorFinalCalculado / parseInt(numero_parcelas);
      jurosMensalFinal = valorInicial > 0 ? ((valorFinalCalculado - valorInicial) / valorInicial) * 100 : 0;
    } else if (tipo_calculo === 'parcela_fixa' && valor_parcela) {
      valorFinalCalculado = valorParcelaCalculado * parseInt(numero_parcelas);
      jurosMensalFinal = valorInicial > 0 ? ((valorFinalCalculado - valorInicial) / valorInicial) * 100 : 0;
    }
    
    console.log('Valores calculados:', {
      valorInicial,
      valorFinalCalculado,
      valorParcelaCalculado,
      jurosMensalFinal
    });
    
    // Verificar se coluna tipo_calculo existe
    const [columns] = await connection.execute(`
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_NAME = 'emprestimos' AND COLUMN_NAME = 'tipo_calculo'
    `);
    
    let emprestimoResult;
    if (columns.length > 0) {
      console.log('Inserindo com coluna tipo_calculo...');
      [emprestimoResult] = await connection.execute(`
        INSERT INTO emprestimos (
          cliente_id, valor, data_emprestimo, data_vencimento, juros_mensal, multa_atraso, observacoes,
          tipo_emprestimo, numero_parcelas, frequencia, valor_parcela, tipo_calculo
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        cliente_id, valorInicial, data_emprestimo, data_vencimento, 
        jurosMensalFinal, multa_atraso || 0, observacoes || '',
        tipo_emprestimo, numero_parcelas, frequencia, valorParcelaCalculado, tipo_calculo
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
        cliente_id, valorInicial, data_emprestimo, data_vencimento, 
        jurosMensalFinal, multa_atraso || 0, observacoes || '',
        tipo_emprestimo, numero_parcelas, frequencia, valorParcelaCalculado
      ]);
    }
    
    console.log('Empréstimo criado com ID:', emprestimoResult.insertId);
    
    // Criar parcela
    await connection.execute(`
      INSERT INTO parcelas (emprestimo_id, numero_parcela, valor_parcela, data_vencimento)
      VALUES (?, ?, ?, ?)
    `, [emprestimoResult.insertId, 1, valorFinalCalculado, data_vencimento]);
    
    console.log('Parcela criada');
    
    // Criar cobrança
    await connection.execute(`
      INSERT INTO cobrancas (emprestimo_id, cliente_id, valor_original, valor_atualizado, data_vencimento, status)
      VALUES (?, ?, ?, ?, ?, 'Pendente')
    `, [emprestimoResult.insertId, cliente_id, valorFinalCalculado, valorFinalCalculado, data_vencimento]);
    
    console.log('Cobrança criada');
    
    res.json({ 
      success: true,
      id: emprestimoResult.insertId, 
      message: 'Empréstimo criado com sucesso',
      valores: {
        valorInicial,
        valorFinalCalculado,
        valorParcelaCalculado,
        jurosMensalFinal
      }
    });
    
  } catch (error) {
    console.error('Erro no teste:', error);
    res.status(500).json({ 
      error: 'Erro interno do servidor',
      details: error.message,
      stack: error.stack
    });
  } finally {
    if (connection) {
      await connection.end();
    }
  }
});

// Rota para verificar estrutura do banco
app.get('/test-db-structure', async (req, res) => {
  let connection;
  
  try {
    connection = await mysql.createConnection(dbConfig);
    
    const [tables] = await connection.execute(`
      SELECT TABLE_NAME 
      FROM INFORMATION_SCHEMA.TABLES 
      WHERE TABLE_SCHEMA = ?
    `, [dbConfig.database]);
    
    const structure = {};
    
    for (const table of tables) {
      const [columns] = await connection.execute(`
        DESCRIBE ${table.TABLE_NAME}
      `);
      structure[table.TABLE_NAME] = columns;
    }
    
    res.json({ success: true, structure });
    
  } catch (error) {
    console.error('Erro ao verificar estrutura:', error);
    res.status(500).json({ 
      error: 'Erro ao verificar estrutura do banco',
      details: error.message
    });
  } finally {
    if (connection) {
      await connection.end();
    }
  }
});

const PORT = 3001;
app.listen(PORT, () => {
  console.log(`Servidor de teste rodando na porta ${PORT}`);
  console.log(`Acesse: http://localhost:${PORT}/test-db-structure`);
}); 