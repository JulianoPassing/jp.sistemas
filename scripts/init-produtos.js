const mysql = require('mysql2/promise');
require('dotenv').config();

async function initProdutos() {
  try {
    // Conectar ao banco de dados
    const connection = await mysql.createConnection({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: 'jpsistemas_admin',
      charset: 'utf8mb4'
    });

    console.log('Conectado ao banco de dados');

    // Verificar se já existem produtos
    const [existingProducts] = await connection.execute('SELECT COUNT(*) as count FROM produtos');
    
    if (existingProducts[0].count > 0) {
      console.log('Produtos já existem no banco de dados. Pulando inserção.');
      await connection.end();
      return;
    }

    // Produtos de exemplo
    const produtosExemplo = [
      {
        nome: 'Notebook Dell Inspiron',
        descricao: 'Notebook Dell Inspiron 15 polegadas com processador Intel i5, 8GB RAM, 256GB SSD. Ideal para trabalho e estudos.',
        preco_custo: 2500.00,
        preco_venda: 3200.00,
        categoria: 'Informática',
        codigo: 'DELL-001',
        estoque: 15,
        fornecedor: 'Dell Brasil',
        peso: '2.1 kg',
        dimensoes: '35 x 24 x 2 cm',
        status: 'Ativo'
      },
      {
        nome: 'Mouse Wireless Logitech',
        descricao: 'Mouse sem fio Logitech com sensor óptico de alta precisão, bateria de longa duração e design ergonômico.',
        preco_custo: 45.00,
        preco_venda: 79.90,
        categoria: 'Periféricos',
        codigo: 'LOG-002',
        estoque: 50,
        fornecedor: 'Logitech Brasil',
        peso: '0.1 kg',
        dimensoes: '12 x 6 x 4 cm',
        status: 'Ativo'
      },
      {
        nome: 'Teclado Mecânico RGB',
        descricao: 'Teclado mecânico com switches Cherry MX Blue, iluminação RGB personalizável e teclas anti-ghosting.',
        preco_custo: 180.00,
        preco_venda: 299.90,
        categoria: 'Periféricos',
        codigo: 'MECH-003',
        estoque: 25,
        fornecedor: 'Corsair Brasil',
        peso: '0.9 kg',
        dimensoes: '44 x 13 x 3 cm',
        status: 'Ativo'
      },
      {
        nome: 'Monitor LG 24"',
        descricao: 'Monitor LG 24 polegadas Full HD, painel IPS, tempo de resposta 1ms, ideal para jogos e trabalho.',
        preco_custo: 450.00,
        preco_venda: 699.90,
        categoria: 'Monitores',
        codigo: 'LG-004',
        estoque: 12,
        fornecedor: 'LG Electronics',
        peso: '3.2 kg',
        dimensoes: '54 x 32 x 20 cm',
        status: 'Ativo'
      },
      {
        nome: 'SSD Samsung 500GB',
        descricao: 'SSD Samsung 500GB com tecnologia NVMe, velocidade de leitura até 3500MB/s, ideal para upgrade de performance.',
        preco_custo: 220.00,
        preco_venda: 349.90,
        categoria: 'Componentes',
        codigo: 'SAMS-005',
        estoque: 30,
        fornecedor: 'Samsung Brasil',
        peso: '0.08 kg',
        dimensoes: '8 x 2 x 0.7 cm',
        status: 'Ativo'
      }
    ];

    // Inserir produtos de exemplo
    for (const produto of produtosExemplo) {
      await connection.execute(
        'INSERT INTO produtos (nome, descricao, preco_custo, preco_venda, categoria, codigo, estoque, fornecedor, peso, dimensoes, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [produto.nome, produto.descricao, produto.preco_custo, produto.preco_venda, produto.categoria, produto.codigo, produto.estoque, produto.fornecedor, produto.peso, produto.dimensoes, produto.status]
      );
    }

    console.log('✅ Produtos de exemplo inseridos com sucesso!');
    console.log(`📦 ${produtosExemplo.length} produtos foram adicionados ao banco de dados.`);
    await connection.end();
    
  } catch (error) {
    console.error('❌ Erro ao inicializar produtos:', error);
  }
}

// Executar se chamado diretamente
if (require.main === module) {
  initProdutos();
}

module.exports = initProdutos; 