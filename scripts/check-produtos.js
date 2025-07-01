const mysql = require('mysql2/promise');
require('dotenv').config();

async function checkProdutos() {
  try {
    // Conectar ao banco de dados
    const connection = await mysql.createConnection({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: 'jpsistemas_admin', // ou o banco específico do usuário
      charset: 'utf8mb4'
    });

    console.log('Conectado ao banco de dados');

    // Verificar todos os produtos
    const [produtos] = await connection.execute('SELECT * FROM produtos ORDER BY nome');
    
    console.log('\n=== PRODUTOS NO BANCO DE DADOS ===');
    produtos.forEach(prod => {
      console.log(`ID: ${prod.id}`);
      console.log(`Nome: ${prod.nome}`);
      console.log(`Preço Custo: ${prod.preco_custo} (tipo: ${typeof prod.preco_custo})`);
      console.log(`Preço Venda: ${prod.preco_venda} (tipo: ${typeof prod.preco_venda})`);
      console.log(`Estoque: ${prod.estoque}`);
      console.log('---');
    });

    // Verificar especificamente o produto "teste2"
    const [teste2] = await connection.execute('SELECT * FROM produtos WHERE nome LIKE "%teste2%"');
    if (teste2.length > 0) {
      console.log('\n=== PRODUTO TESTE2 ===');
      console.log(JSON.stringify(teste2[0], null, 2));
    } else {
      console.log('\nProduto "teste2" não encontrado');
    }

    await connection.end();
    
  } catch (error) {
    console.error('❌ Erro ao verificar produtos:', error);
  }
}

// Executar se chamado diretamente
if (require.main === module) {
  checkProdutos();
}

module.exports = checkProdutos; 