const mysql = require('mysql2/promise');
const express = require('express');
const session = require('express-session');
const path = require('path');

// Configurar sessão de teste
const app = express();
app.use(session({
  secret: 'test-secret',
  resave: false,
  saveUninitialized: false
}));

async function debugDuplicatasAPI() {
  console.log('🔧 DEBUG ESPECÍFICO - Duplicatas na API de Empréstimos\n');
  
  try {
    // Criar conexão direta com o banco
    const connection = await mysql.createConnection({
      host: 'localhost',
      user: 'jpsistemas',
      password: 'Juliano@95',
      database: 'jpcobrancas_cobranca'
    });
    
    console.log('🔗 Conexão estabelecida com o banco jpcobrancas_cobranca');
    
    // 1. Verificar dados brutos no banco
    console.log('\n📊 1. DADOS BRUTOS NO BANCO:');
    const [emprestimos] = await connection.execute('SELECT * FROM emprestimos ORDER BY id');
    console.log(`📋 Total de registros na tabela emprestimos: ${emprestimos.length}`);
    
    emprestimos.forEach((emp, index) => {
      console.log(`  ${index + 1}. ID: ${emp.id} | Cliente: ${emp.cliente_id} | Nome: ${emp.cliente_nome} | Valor: R$ ${emp.valor} | Status: ${emp.status}`);
    });
    
    // 2. Verificar query com JOIN (similar à API)
    console.log('\n📊 2. QUERY COM JOIN (como na API):');
    const [emprestimosJoin] = await connection.execute(`
      SELECT e.*, c.nome as cliente_nome, c.telefone as telefone
      FROM emprestimos e
      LEFT JOIN clientes_cobrancas c ON e.cliente_id = c.id
      ORDER BY e.created_at DESC
    `);
    
    console.log(`📋 Query COM JOIN retornou: ${emprestimosJoin.length} registros`);
    emprestimosJoin.forEach((emp, index) => {
      console.log(`  ${index + 1}. ID: ${emp.id} | Cliente: ${emp.cliente_nome} | Valor: R$ ${emp.valor} | Status: ${emp.status}`);
    });
    
    // 3. Verificar query com DISTINCT
    console.log('\n📊 3. QUERY COM DISTINCT:');
    const [emprestimosDistinct] = await connection.execute(`
      SELECT DISTINCT e.*, c.nome as cliente_nome, c.telefone as telefone
      FROM emprestimos e
      LEFT JOIN clientes_cobrancas c ON e.cliente_id = c.id
      ORDER BY e.created_at DESC
    `);
    
    console.log(`📋 Query COM DISTINCT retornou: ${emprestimosDistinct.length} registros`);
    emprestimosDistinct.forEach((emp, index) => {
      console.log(`  ${index + 1}. ID: ${emp.id} | Cliente: ${emp.cliente_nome} | Valor: R$ ${emp.valor} | Status: ${emp.status}`);
    });
    
    // 4. Analisar diferenças
    console.log('\n🔍 4. ANÁLISE DAS DIFERENÇAS:');
    console.log(`📊 Registros na tabela: ${emprestimos.length}`);
    console.log(`📊 Query COM JOIN: ${emprestimosJoin.length}`);
    console.log(`📊 Query COM DISTINCT: ${emprestimosDistinct.length}`);
    
    if (emprestimos.length === emprestimosJoin.length && emprestimosJoin.length === emprestimosDistinct.length) {
      console.log('✅ Todas as queries retornam o mesmo número de registros - problema não está na API');
    } else {
      console.log('🚨 Há diferenças entre as queries - problema pode estar na API');
    }
    
    // 5. Verificar se há duplicatas por ID
    console.log('\n🔍 5. VERIFICAÇÃO DE DUPLICATAS POR ID:');
    const idCount = {};
    
    emprestimosJoin.forEach(emp => {
      idCount[emp.id] = (idCount[emp.id] || 0) + 1;
    });
    
    let duplicatasEncontradas = 0;
    Object.entries(idCount).forEach(([id, count]) => {
      if (count > 1) {
        duplicatasEncontradas++;
        console.log(`🚨 ID ${id} aparece ${count} vezes na query JOIN!`);
      }
    });
    
    if (duplicatasEncontradas === 0) {
      console.log('✅ Nenhuma duplicata encontrada na query JOIN');
    } else {
      console.log(`⚠️  ${duplicatasEncontradas} IDs duplicados encontrados na query JOIN`);
    }
    
    // 6. Verificar clientes
    console.log('\n📊 6. VERIFICAÇÃO DE CLIENTES:');
    const [clientes] = await connection.execute('SELECT * FROM clientes_cobrancas ORDER BY id');
    console.log(`📋 Total de clientes: ${clientes.length}`);
    
    clientes.forEach((cliente, index) => {
      console.log(`  ${index + 1}. ID: ${cliente.id} | Nome: ${cliente.nome} | Status: ${cliente.status}`);
    });
    
    // 7. Verificar se há clientes duplicados
    console.log('\n🔍 7. VERIFICAÇÃO DE CLIENTES DUPLICADOS:');
    const nomeClientes = {};
    clientes.forEach(cliente => {
      const nome = cliente.nome.toLowerCase();
      nomeClientes[nome] = (nomeClientes[nome] || 0) + 1;
    });
    
    let clientesDuplicados = 0;
    Object.entries(nomeClientes).forEach(([nome, count]) => {
      if (count > 1) {
        clientesDuplicados++;
        console.log(`🚨 Cliente "${nome}" aparece ${count} vezes!`);
      }
    });
    
    if (clientesDuplicados === 0) {
      console.log('✅ Nenhum cliente duplicado encontrado');
    } else {
      console.log(`⚠️  ${clientesDuplicados} nomes de clientes duplicados encontrados`);
    }
    
    console.log('\n📝 CONCLUSÕES:');
    console.log('1. Se as queries retornam o mesmo número → problema está no frontend');
    console.log('2. Se há diferenças entre JOIN e DISTINCT → problema está na query');
    console.log('3. Se há IDs duplicados na query → problema está no banco/JOIN');
    console.log('4. Se há clientes duplicados → pode estar causando problemas no JOIN');
    
    await connection.end();
    
  } catch (error) {
    console.error('❌ Erro no debug:', error);
  }
}

debugDuplicatasAPI(); 