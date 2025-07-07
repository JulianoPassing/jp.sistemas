// Teste simples para verificar a correção da formatação de data

// Simular a função utils.formatDateForInput
function formatDateForInput(dateString) {
  if (!dateString) return '';
  try {
    const date = new Date(dateString);
    // Verificar se a data é válida
    if (isNaN(date.getTime())) return '';
    return date.toISOString().split('T')[0];
  } catch (error) {
    console.error('Erro ao formatar data para input:', error);
    return '';
  }
}

// Teste do caso específico que estava causando erro
console.log('🔍 Testando correção do erro de formatação de data\n');

const problematicDate = '2025-06-30T03:00:00.000Z';
console.log(`❌ Valor original que causava erro: "${problematicDate}"`);

const fixedDate = formatDateForInput(problematicDate);
console.log(`✅ Valor corrigido: "${fixedDate}"`);

// Verificar se está no formato correto
const isValidFormat = /^\d{4}-\d{2}-\d{2}$/.test(fixedDate);
console.log(`📋 Formato válido para input[type="date"]: ${isValidFormat ? 'SIM' : 'NÃO'}`);

// Teste com outros casos
console.log('\n📝 Testando outros casos:');

const testCases = [
  { input: '2025-06-30T03:00:00.000Z', expected: '2025-06-30' },
  { input: '2024-12-25T00:00:00.000Z', expected: '2024-12-25' },
  { input: '2024-01-01', expected: '2024-01-01' },
  { input: '', expected: '' },
  { input: null, expected: '' },
  { input: undefined, expected: '' }
];

testCases.forEach((testCase, index) => {
  const result = formatDateForInput(testCase.input);
  const passed = result === testCase.expected;
  const status = passed ? '✅' : '❌';
  console.log(`${status} Teste ${index + 1}: "${testCase.input}" → "${result}" (esperado: "${testCase.expected}")`);
});

console.log('\n🎉 Teste de correção de data concluído!');
console.log('📋 Agora o campo de data no modal de edição deve funcionar corretamente.'); 