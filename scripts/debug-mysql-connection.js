const mysql = require('mysql2/promise');

console.log('🔍 Descobrindo usuário e credenciais corretas...');

async function testConnections() {
  const credenciais = [
    { user: 'jpsistemas', password: 'Juliano@95', desc: 'jpsistemas (sem !)' },
    { user: 'jpsistemas', password: 'Juliano@95!', desc: 'jpsistemas (com !)' },
    { user: 'jpcobrancas', password: 'Juliano@95', desc: 'jpcobrancas (sem !)' },
    { user: 'jpcobrancas', password: 'Juliano@95!', desc: 'jpcobrancas (com !)' },
    { user: 'root', password: 'Juliano@95', desc: 'root (sem !)' },
    { user: 'root', password: 'Juliano@95!', desc: 'root (com !)' }
  ];

  console.log('\n1. Testando conexões básicas...');
  
  let connectionWorked = null;
  
  for (const cred of credenciais) {
    try {
      const connection = await mysql.createConnection({
        host: 'localhost',
        user: cred.user,
        password: cred.password
      });
      
      console.log(`✅ ${cred.desc} - FUNCIONOU!`);
      connectionWorked = cred;
      await connection.end();
      break;
      
    } catch (error) {
      console.log(`❌ ${cred.desc} - ${error.message}`);
    }
  }
  
  if (!connectionWorked) {
    console.log('\n❌ Nenhuma credencial funcionou!');
    return;
  }
  
  console.log('\n2. Listando bancos disponíveis...');
  
  try {
    const connection = await mysql.createConnection({
      host: 'localhost',
      user: connectionWorked.user,
      password: connectionWorked.password
    });
    
    const [databases] = await connection.execute('SHOW DATABASES');
    console.log('\n📊 Bancos disponíveis:');
    
    const cobrancasBanks = [];
    databases.forEach(db => {
      console.log(`  - ${db.Database}`);
      if (db.Database.includes('cobranca')) {
        cobrancasBanks.push(db.Database);
      }
    });
    
    console.log('\n🎯 Bancos relacionados a cobranças:');
    cobrancasBanks.forEach(db => {
      console.log(`  ✅ ${db}`);
    });
    
    if (cobrancasBanks.length === 0) {
      console.log('  ❌ Nenhum banco de cobranças encontrado!');
    }
    
    // Testar cada banco de cobranças
    console.log('\n3. Testando bancos de cobranças...');
    
    for (const dbName of cobrancasBanks) {
      try {
        const dbConnection = await mysql.createConnection({
          host: 'localhost',
          user: connectionWorked.user,
          password: connectionWorked.password,
          database: dbName
        });
        
        const [emprestimos] = await dbConnection.execute('SELECT COUNT(*) as total FROM emprestimos');
        console.log(`  📊 ${dbName}: ${emprestimos[0].total} empréstimos`);
        
        if (emprestimos[0].total > 0) {
          const [dados] = await dbConnection.execute(`
            SELECT 
              id, valor, status, cliente_id 
            FROM emprestimos 
            ORDER BY id DESC 
            LIMIT 3
          `);
          
          console.log(`    💰 Empréstimos em ${dbName}:`);
          dados.forEach(emp => {
            console.log(`      ID ${emp.id}: R$ ${emp.valor} (${emp.status})`);
          });
        }
        
        await dbConnection.end();
        
      } catch (error) {
        console.log(`  ❌ ${dbName}: ${error.message}`);
      }
    }
    
    await connection.end();
    
  } catch (error) {
    console.error('❌ Erro ao listar bancos:', error.message);
  }
}

testConnections().catch(console.error); 