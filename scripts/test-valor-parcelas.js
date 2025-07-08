// Teste de Valores das Parcelas
// Este script testa se os valores das parcelas estão sendo retornados corretamente

const fetch = require('node-fetch');

// Configuração da API
const API_BASE = 'http://localhost:3000';

// Função para fazer requisições
async function makeRequest(endpoint) {
  try {
    const response = await fetch(`${API_BASE}${endpoint}`);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    return response.json();
  } catch (error) {
    console.error(`Erro na requisição ${endpoint}:`, error.message);
    return null;
  }
}

// Função para testar valores das parcelas
async function testValoresParcelas() {
  console.log('🧪 Testando valores das parcelas...\n');
  
  try {
    // Buscar empréstimos
    const emprestimos = await makeRequest('/api/cobrancas/emprestimos');
    if (!emprestimos || emprestimos.length === 0) {
      console.log('⚠️  Nenhum empréstimo encontrado');
      return;
    }
    
    // Filtrar empréstimos parcelados
    const emprestimosParcelados = emprestimos.filter(e => 
      e.tipo_emprestimo === 'in_installments' && e.numero_parcelas > 1
    );
    
    if (emprestimosParcelados.length === 0) {
      console.log('⚠️  Nenhum empréstimo parcelado encontrado');
      return;
    }
    
    console.log(`📋 Encontrados ${emprestimosParcelados.length} empréstimos parcelados\n`);
    
    // Testar cada empréstimo parcelado
    for (const emp of emprestimosParcelados) {
      console.log(`💰 Empréstimo #${emp.id}:`);
      console.log(`   - Cliente ID: ${emp.cliente_id}`);
      console.log(`   - Valor: R$ ${emp.valor}`);
      console.log(`   - Valor Parcela (empréstimo): R$ ${emp.valor_parcela}`);
      console.log(`   - Número de Parcelas: ${emp.numero_parcelas}`);
      console.log(`   - Tipo: ${emp.tipo_emprestimo}`);
      
      // Buscar parcelas
      const parcelas = await makeRequest(`/api/cobrancas/emprestimos/${emp.id}/parcelas`);
      
      if (!parcelas) {
        console.log('   ❌ Erro ao buscar parcelas');
        continue;
      }
      
      console.log(`   📊 Parcelas encontradas: ${parcelas.length}`);
      
      if (parcelas.length === 0) {
        console.log('   ⚠️  Nenhuma parcela encontrada para este empréstimo');
        continue;
      }
      
      // Verificar estrutura de cada parcela
      console.log('   📋 Detalhes das parcelas:');
      parcelas.forEach((parcela, index) => {
        console.log(`      Parcela ${parcela.numero_parcela}:`);
        console.log(`        - ID: ${parcela.id}`);
        console.log(`        - Empréstimo ID: ${parcela.emprestimo_id}`);
        console.log(`        - Número: ${parcela.numero_parcela}`);
        console.log(`        - valor_parcela: ${parcela.valor_parcela} (${typeof parcela.valor_parcela})`);
        console.log(`        - valor: ${parcela.valor} (${typeof parcela.valor})`);
        console.log(`        - Data Vencimento: ${parcela.data_vencimento}`);
        console.log(`        - Status: ${parcela.status}`);
        console.log(`        - Data Pagamento: ${parcela.data_pagamento || 'N/A'}`);
        
        // Verificar qual campo tem o valor
        const valorParcela = Number(parcela.valor_parcela) || 0;
        const valorAlternativo = Number(parcela.valor) || 0;
        
        console.log(`        - Valor formatado (valor_parcela): R$ ${valorParcela.toFixed(2)}`);
        console.log(`        - Valor formatado (valor): R$ ${valorAlternativo.toFixed(2)}`);
        
        if (valorParcela > 0) {
          console.log(`        ✅ Campo 'valor_parcela' tem valor válido`);
        } else if (valorAlternativo > 0) {
          console.log(`        ⚠️  Campo 'valor' tem valor, mas 'valor_parcela' está vazio`);
        } else {
          console.log(`        ❌ Ambos os campos estão vazios ou inválidos`);
        }
        
        console.log('');
      });
      
      // Verificar consistência
      const totalParcelas = parcelas.reduce((sum, p) => sum + (Number(p.valor_parcela) || 0), 0);
      const valorEsperado = Number(emp.valor_parcela) * Number(emp.numero_parcelas);
      
      console.log(`   💡 Verificação de consistência:`);
      console.log(`      - Soma das parcelas: R$ ${totalParcelas.toFixed(2)}`);
      console.log(`      - Valor esperado: R$ ${valorEsperado.toFixed(2)}`);
      console.log(`      - Diferença: R$ ${Math.abs(totalParcelas - valorEsperado).toFixed(2)}`);
      
      if (Math.abs(totalParcelas - valorEsperado) < 0.01) {
        console.log(`      ✅ Valores consistentes`);
      } else {
        console.log(`      ⚠️  Valores inconsistentes`);
      }
      
      console.log('\n' + '='.repeat(50) + '\n');
    }
    
  } catch (error) {
    console.error('❌ Erro no teste:', error.message);
  }
}

// Função para testar a estrutura da tabela parcelas
async function testEstruturaParcelas() {
  console.log('🔍 Testando estrutura da tabela parcelas...\n');
  
  try {
    // Buscar um empréstimo parcelado
    const emprestimos = await makeRequest('/api/cobrancas/emprestimos');
    const empParcelado = emprestimos?.find(e => 
      e.tipo_emprestimo === 'in_installments' && e.numero_parcelas > 1
    );
    
    if (!empParcelado) {
      console.log('⚠️  Nenhum empréstimo parcelado encontrado para testar');
      return;
    }
    
    // Buscar parcelas
    const parcelas = await makeRequest(`/api/cobrancas/emprestimos/${empParcelado.id}/parcelas`);
    
    if (!parcelas || parcelas.length === 0) {
      console.log('⚠️  Nenhuma parcela encontrada');
      return;
    }
    
    // Analisar estrutura da primeira parcela
    const primeiraParcela = parcelas[0];
    console.log('📋 Estrutura da primeira parcela:');
    
    Object.keys(primeiraParcela).forEach(key => {
      const value = primeiraParcela[key];
      console.log(`   - ${key}: ${value} (${typeof value})`);
    });
    
    // Verificar campos de valor
    console.log('\n💰 Campos relacionados a valor:');
    const camposValor = Object.keys(primeiraParcela).filter(key => 
      key.toLowerCase().includes('valor')
    );
    
    camposValor.forEach(campo => {
      const valor = primeiraParcela[campo];
      console.log(`   - ${campo}: ${valor} (${typeof valor})`);
    });
    
    // Recomendar qual campo usar
    console.log('\n💡 Recomendação:');
    if (primeiraParcela.valor_parcela !== undefined && Number(primeiraParcela.valor_parcela) > 0) {
      console.log('   ✅ Use o campo "valor_parcela" para acessar o valor da parcela');
    } else if (primeiraParcela.valor !== undefined && Number(primeiraParcela.valor) > 0) {
      console.log('   ⚠️  Use o campo "valor" para acessar o valor da parcela');
    } else {
      console.log('   ❌ Nenhum campo de valor válido encontrado');
    }
    
  } catch (error) {
    console.error('❌ Erro no teste de estrutura:', error.message);
  }
}

// Função principal
async function runTests() {
  console.log('🚀 Iniciando testes de valores das parcelas...\n');
  
  await testEstruturaParcelas();
  console.log('\n' + '='.repeat(60) + '\n');
  await testValoresParcelas();
  
  console.log('🎉 Testes concluídos!');
  console.log('\n📋 Resumo:');
  console.log('   - Verificou estrutura da tabela parcelas');
  console.log('   - Testou valores de empréstimos parcelados');
  console.log('   - Verificou consistência dos dados');
  console.log('   - Identificou qual campo usar para valores');
  console.log('\n💡 Se os valores ainda aparecem como R$ 0,00:');
  console.log('   1. Verifique se o campo correto está sendo usado');
  console.log('   2. Confirme se as parcelas foram criadas corretamente');
  console.log('   3. Verifique se a API está retornando os dados corretos');
}

// Executar se chamado diretamente
if (require.main === module) {
  runTests().catch(console.error);
}

module.exports = { testValoresParcelas, testEstruturaParcelas }; 