// Teste de formatação de datas para inputs HTML

function formatDateForInput(dateString) {
  if (!dateString) return '';
  try {
    const date = new Date(dateString);
    // Verificar se a data é válida
    if (isNaN(date.getTime())) return '';
    return date.toISOString().split('T')[0];
  } catch (error) {
    console.error('Erro ao formatar data:', error);
    return '';
  }
}

// Teste com diferentes formatos de data
const testCases = [
  '2025-06-30T03:00:00.000Z',
  '2025-06-30',
  '2025-06-30T00:00:00',
  '2025-06-30 03:00:00',
  '06/30/2025',
  '30/06/2025',
  '',
  null,
  undefined,
  'invalid-date',
  '2025-13-45', // Data inválida
];

console.log('🔍 Testando formatação de datas para inputs HTML:\n');

testCases.forEach((testCase, index) => {
  const result = formatDateForInput(testCase);
  const status = result ? '✅' : '❌';
  console.log(`${status} Teste ${index + 1}: "${testCase}" → "${result}"`);
});

console.log('\n📋 Resultados esperados:');
console.log('✅ Datas válidas devem retornar formato "yyyy-MM-dd"');
console.log('❌ Datas inválidas/vazias devem retornar string vazia');
console.log('✅ Não deve gerar erros no console');

// Teste específico para o caso do erro
console.log('\n🎯 Teste específico do erro reportado:');
const problematicDate = '2025-06-30T03:00:00.000Z';
const fixedDate = formatDateForInput(problematicDate);
console.log(`Entrada: ${problematicDate}`);
console.log(`Saída: ${fixedDate}`);
console.log(`Válido para input[type="date"]: ${/^\d{4}-\d{2}-\d{2}$/.test(fixedDate) ? 'SIM' : 'NÃO'}`); 