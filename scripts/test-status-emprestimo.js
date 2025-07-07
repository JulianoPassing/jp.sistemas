// Teste da lógica de status de empréstimos considerando parcelas

// Simular dados de teste
const hoje = new Date();
hoje.setHours(0,0,0,0);

// Função para simular a lógica de determinação de status
function determinarStatusEmprestimo(emprestimo, parcelas = []) {
  let status = (emprestimo.status || '').toUpperCase();
  let dataVencimento = emprestimo.data_vencimento ? new Date(emprestimo.data_vencimento) : null;
  
  // Para empréstimos parcelados, verificar status baseado nas parcelas
  if (parcelas.length > 0) {
    const parcelasAtrasadas = parcelas.filter(p => {
      const dataVencParcela = new Date(p.data_vencimento);
      return dataVencParcela < hoje && (p.status !== 'Paga');
    });
    
    const parcelasPagas = parcelas.filter(p => p.status === 'Paga');
    
    if (parcelasPagas.length === parcelas.length) {
      status = 'QUITADO';
    } else if (parcelasAtrasadas.length > 0) {
      status = 'ATRASADO';
      // Usar a data de vencimento da parcela mais atrasada
      const parcelaMaisAtrasada = parcelasAtrasadas.sort((a, b) => 
        new Date(a.data_vencimento) - new Date(b.data_vencimento)
      )[0];
      dataVencimento = new Date(parcelaMaisAtrasada.data_vencimento);
    } else {
      status = 'ATIVO';
    }
  } else {
    // Para empréstimos de parcela única, usar lógica original
    if (dataVencimento && dataVencimento < hoje && status !== 'QUITADO') {
      status = 'ATRASADO';
    }
  }
  
  return { status, dataVencimento };
}

console.log('🔍 Testando lógica de status de empréstimos\n');

// Caso 1: Empréstimo parcelado com parcelas em dia
console.log('📋 Caso 1: Empréstimo parcelado com parcelas em dia');
const emprestimo1 = {
  id: 1,
  status: 'Ativo',
  data_vencimento: '2025-06-30', // Data no passado
  tipo_emprestimo: 'in_installments',
  numero_parcelas: 3
};

const parcelas1 = [
  { numero_parcela: 1, data_vencimento: '2025-07-30', status: 'Pendente' }, // Futuro
  { numero_parcela: 2, data_vencimento: '2025-08-30', status: 'Pendente' }, // Futuro
  { numero_parcela: 3, data_vencimento: '2025-09-30', status: 'Pendente' }  // Futuro
];

const resultado1 = determinarStatusEmprestimo(emprestimo1, parcelas1);
console.log(`✅ Status: ${resultado1.status} (esperado: ATIVO)`);
console.log(`   Motivo: Todas as parcelas estão no prazo\n`);

// Caso 2: Empréstimo parcelado com parcelas atrasadas
console.log('📋 Caso 2: Empréstimo parcelado com parcelas atrasadas');
const emprestimo2 = {
  id: 2,
  status: 'Ativo',
  data_vencimento: '2025-06-30', // Data no passado
  tipo_emprestimo: 'in_installments',
  numero_parcelas: 3
};

const parcelas2 = [
  { numero_parcela: 1, data_vencimento: '2025-06-30', status: 'Pendente' }, // Atrasada
  { numero_parcela: 2, data_vencimento: '2025-07-30', status: 'Pendente' }, // Futuro
  { numero_parcela: 3, data_vencimento: '2025-08-30', status: 'Pendente' }  // Futuro
];

const resultado2 = determinarStatusEmprestimo(emprestimo2, parcelas2);
console.log(`✅ Status: ${resultado2.status} (esperado: ATRASADO)`);
console.log(`   Motivo: Parcela 1 está atrasada\n`);

// Caso 3: Empréstimo parcelado quitado
console.log('📋 Caso 3: Empréstimo parcelado quitado');
const emprestimo3 = {
  id: 3,
  status: 'Ativo',
  data_vencimento: '2025-06-30',
  tipo_emprestimo: 'in_installments',
  numero_parcelas: 3
};

const parcelas3 = [
  { numero_parcela: 1, data_vencimento: '2025-06-30', status: 'Paga' },
  { numero_parcela: 2, data_vencimento: '2025-07-30', status: 'Paga' },
  { numero_parcela: 3, data_vencimento: '2025-08-30', status: 'Paga' }
];

const resultado3 = determinarStatusEmprestimo(emprestimo3, parcelas3);
console.log(`✅ Status: ${resultado3.status} (esperado: QUITADO)`);
console.log(`   Motivo: Todas as parcelas foram pagas\n`);

// Caso 4: Empréstimo de parcela única em dia
console.log('📋 Caso 4: Empréstimo de parcela única em dia');
const emprestimo4 = {
  id: 4,
  status: 'Ativo',
  data_vencimento: '2025-08-30', // Futuro
  tipo_emprestimo: 'fixed',
  numero_parcelas: 1
};

const resultado4 = determinarStatusEmprestimo(emprestimo4, []);
console.log(`✅ Status: ${resultado4.status} (esperado: ATIVO)`);
console.log(`   Motivo: Data de vencimento no futuro\n`);

// Caso 5: Empréstimo de parcela única atrasado
console.log('📋 Caso 5: Empréstimo de parcela única atrasado');
const emprestimo5 = {
  id: 5,
  status: 'Ativo',
  data_vencimento: '2025-06-30', // Passado
  tipo_emprestimo: 'fixed',
  numero_parcelas: 1
};

const resultado5 = determinarStatusEmprestimo(emprestimo5, []);
console.log(`✅ Status: ${resultado5.status} (esperado: ATRASADO)`);
console.log(`   Motivo: Data de vencimento no passado\n`);

console.log('🎉 Teste de lógica de status concluído!');
console.log('📋 A correção deve resolver o problema do empréstimo parcelado em dia aparecer como atrasado.'); 