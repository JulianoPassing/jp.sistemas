const mysql = require('mysql2/promise');
const bcrypt = require('bcrypt');
const dbConfig = require('../database-config');

async function initCaixaDatabase() {
  let connection;
  
  try {
    console.log('Conectando ao banco de dados...');
    connection = await mysql.createConnection(dbConfig);
    
    console.log('Criando tabelas do sistema de caixa...');
    
    // Tabela de produtos
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS produtos (
        id INT AUTO_INCREMENT PRIMARY KEY,
        codigo VARCHAR(50) UNIQUE NOT NULL,
        nome VARCHAR(255) NOT NULL,
        categoria ENUM('alimentos', 'bebidas', 'limpeza', 'higiene', 'outros') NOT NULL,
        preco DECIMAL(10,2) NOT NULL,
        estoque INT NOT NULL DEFAULT 0,
        estoque_minimo INT NOT NULL DEFAULT 0,
        descricao TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    
    console.log('✓ Tabela produtos criada');
    
    // Tabela de vendas
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS vendas (
        id INT PRIMARY KEY,
        data TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        subtotal DECIMAL(10,2) NOT NULL,
        desconto DECIMAL(10,2) NOT NULL DEFAULT 0,
        total DECIMAL(10,2) NOT NULL,
        forma_pagamento ENUM('dinheiro', 'cartao_credito', 'cartao_debito', 'pix', 'transferencia') NOT NULL,
        valor_recebido DECIMAL(10,2),
        troco DECIMAL(10,2) DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    
    console.log('✓ Tabela vendas criada');
    
    // Tabela de itens das vendas
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS vendas_itens (
        id INT AUTO_INCREMENT PRIMARY KEY,
        venda_id INT NOT NULL,
        produto_id INT NOT NULL,
        codigo VARCHAR(50) NOT NULL,
        nome VARCHAR(255) NOT NULL,
        preco DECIMAL(10,2) NOT NULL,
        quantidade INT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (venda_id) REFERENCES vendas(id) ON DELETE CASCADE,
        FOREIGN KEY (produto_id) REFERENCES produtos(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    
    console.log('✓ Tabela vendas_itens criada');
    
    // Verificar se já existe usuário para o sistema de caixa
    const [existingUsers] = await connection.execute(
      'SELECT * FROM usuarios WHERE sistema = "caixa"'
    );
    
    if (existingUsers.length === 0) {
      console.log('Criando usuário padrão para o sistema de caixa...');
      
      const hashedPassword = await bcrypt.hash('caixa123', 10);
      
      await connection.execute(`
        INSERT INTO usuarios (username, password, nome, email, sistema, ativo) 
        VALUES (?, ?, ?, ?, ?, ?)
      `, ['caixa', hashedPassword, 'Usuário Caixa', 'caixa@sistema.com', 'caixa', 1]);
      
      console.log('✓ Usuário padrão criado (username: caixa, senha: caixa123)');
    } else {
      console.log('✓ Usuário do sistema de caixa já existe');
    }
    
    // Inserir alguns produtos de exemplo
    const [existingProducts] = await connection.execute('SELECT COUNT(*) as count FROM produtos');
    
    if (existingProducts[0].count === 0) {
      console.log('Inserindo produtos de exemplo...');
      
      const produtosExemplo = [
        {
          codigo: '001',
          nome: 'Arroz Integral',
          categoria: 'alimentos',
          preco: 8.50,
          estoque: 50,
          estoque_minimo: 10,
          descricao: 'Arroz integral tipo 1, pacote 1kg'
        },
        {
          codigo: '002',
          nome: 'Feijão Preto',
          categoria: 'alimentos',
          preco: 6.80,
          estoque: 40,
          estoque_minimo: 8,
          descricao: 'Feijão preto, pacote 1kg'
        },
        {
          codigo: '003',
          nome: 'Coca-Cola',
          categoria: 'bebidas',
          preco: 4.50,
          estoque: 100,
          estoque_minimo: 20,
          descricao: 'Refrigerante Coca-Cola, lata 350ml'
        },
        {
          codigo: '004',
          nome: 'Detergente Líquido',
          categoria: 'limpeza',
          preco: 3.20,
          estoque: 30,
          estoque_minimo: 5,
          descricao: 'Detergente líquido para louças, 500ml'
        },
        {
          codigo: '005',
          nome: 'Sabonete',
          categoria: 'higiene',
          preco: 2.80,
          estoque: 60,
          estoque_minimo: 15,
          descricao: 'Sabonete em barra, 90g'
        },
        {
          codigo: '006',
          nome: 'Pão de Forma',
          categoria: 'alimentos',
          preco: 5.90,
          estoque: 25,
          estoque_minimo: 5,
          descricao: 'Pão de forma integral, 500g'
        },
        {
          codigo: '007',
          nome: 'Leite Integral',
          categoria: 'bebidas',
          preco: 4.20,
          estoque: 35,
          estoque_minimo: 8,
          descricao: 'Leite integral, caixa 1L'
        },
        {
          codigo: '008',
          nome: 'Papel Higiênico',
          categoria: 'higiene',
          preco: 3.50,
          estoque: 45,
          estoque_minimo: 10,
          descricao: 'Papel higiênico, rolo 30m'
        }
      ];
      
      for (const produto of produtosExemplo) {
        await connection.execute(`
          INSERT INTO produtos (codigo, nome, categoria, preco, estoque, estoque_minimo, descricao)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `, [
          produto.codigo,
          produto.nome,
          produto.categoria,
          produto.preco,
          produto.estoque,
          produto.estoque_minimo,
          produto.descricao
        ]);
      }
      
      console.log(`✓ ${produtosExemplo.length} produtos de exemplo inseridos`);
    } else {
      console.log('✓ Produtos já existem no banco');
    }
    
    console.log('\n🎉 Sistema de caixa inicializado com sucesso!');
    console.log('\n📋 Resumo:');
    console.log('- Tabelas criadas: produtos, vendas, vendas_itens');
    console.log('- Usuário padrão: caixa / caixa123');
    console.log('- Produtos de exemplo inseridos');
    console.log('\n🚀 O sistema está pronto para uso!');
    
  } catch (error) {
    console.error('❌ Erro ao inicializar banco de dados:', error);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

// Executar se chamado diretamente
if (require.main === module) {
  initCaixaDatabase();
}

module.exports = initCaixaDatabase; 