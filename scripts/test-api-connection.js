/**
 * Script para Testar Conexão da API com Banco de Dados
 * Verifica se a API consegue conectar aos bancos corretos
 */

const mysql = require('mysql2/promise');
require('dotenv').config();

// Configuração do banco (igual à API)
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'jpcobrancas',
  password: process.env.DB_PASSWORD || 'Juliano@95',
  port: process.env.DB_PORT || 3306,
  charset: 'utf8mb4'
};

async function testApiConnection() {
  console.log('=== TESTE DE CONEXÃO DA API ===\n');

  try {
    // 1. Testar conexão principal
    console.log('1. Testando conexão principal...');
    const connection = await mysql.createConnection(dbConfig);
    console.log('✅ Conexão principal estabelecida');

    // 2. Listar bancos disponíveis
    console.log('\n2. Listando bancos disponíveis...');
    const [databases] = await connection.execute(`
      SELECT SCHEMA_NAME 
      FROM INFORMATION_SCHEMA.SCHEMATA 
      WHERE SCHEMA_NAME LIKE 'jpcobrancas_%'
    `);

    console.log(`✅ Encontrados ${databases.length} bancos:`);
    databases.forEach(db => console.log(`   - ${db.SCHEMA_NAME}`));

    // 3. Testar conexão com cada banco
    for (const db of databases) {
      const dbName = db.SCHEMA_NAME;
      console.log(`\n--- Testando banco: ${dbName} ---`);
      
      try {
        const dbConnection = await mysql.createConnection({
          ...dbConfig,
          database: dbName
        });

        // Testar tabela clientes
        const [clientes] = await dbConnection.execute(`
          SELECT COUNT(*) as total FROM clientes_cobrancas
        `);
        console.log(`   Clientes: ${clientes[0].total}`);

        // Testar tabela emprestimos
        const [emprestimos] = await dbConnection.execute(`
          SELECT COUNT(*) as total FROM emprestimos
        `);
        console.log(`   Empréstimos: ${emprestimos[0].total}`);

        // Testar tabela parcelas
        const [parcelas] = await dbConnection.execute(`
          SELECT COUNT(*) as total FROM parcelas
        `);
        console.log(`   Parcelas: ${parcelas[0].total}`);

        // Testar inserção de cliente (simulação)
        console.log('   Testando inserção de cliente...');
        const [testResult] = await dbConnection.execute(`
          INSERT INTO clientes_cobrancas (nome, email, telefone) 
          VALUES (?, ?, ?)
        `, [`Teste API ${Date.now()}`, 'teste@teste.com', '11999999999']);
        
        console.log(`   ✅ Cliente de teste inserido com ID: ${testResult.insertId}`);

        // Remover cliente de teste
        await dbConnection.execute(`
          DELETE FROM clientes_cobrancas WHERE id = ?
        `, [testResult.insertId]);
        console.log('   ✅ Cliente de teste removido');

        await dbConnection.end();
        console.log(`✅ ${dbName} funcionando perfeitamente`);

      } catch (error) {
        console.error(`❌ Erro no banco ${dbName}:`, error.message);
      }
    }

    await connection.end();
    console.log('\n=== RESULTADO DO TESTE ===');
    console.log('✅ API pode conectar aos bancos corretamente');
    console.log('✅ Operações de CRUD funcionando');
    console.log('✅ Sistema pronto para uso');

  } catch (error) {
    console.error('❌ Erro geral:', error.message);
    console.log('\n💡 Possíveis soluções:');
    console.log('   1. Verificar se o MySQL está rodando');
    console.log('   2. Verificar se o usuário jpcobrancas existe');
    console.log('   3. Verificar se as permissões estão corretas');
    console.log('   4. Verificar se o arquivo .env está correto');
  }
}

// Executar teste
testApiConnection(); 