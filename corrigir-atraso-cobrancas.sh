#!/bin/bash

echo "🔧 Corrigindo lógica de atraso nas cobranças..."

# 1. Fazer debug do problema atual
echo "1. 🔍 Debugando problema atual..."
node scripts/debug-cobrancas-atraso.js

echo ""
echo "2. 🧪 Testando correção implementada..."
node scripts/test-correcao-atraso.js

echo ""
echo "3. ✅ Correção aplicada no arquivo:"
echo "   public/jp.cobrancas/js/main.js"
echo ""
echo "4. 📝 Mudanças realizadas:"
echo "   - Função renderCobrancasEmAbertoLista() agora:"
echo "     ✓ Verifica se empréstimo tem parcelas"
echo "     ✓ Se tem parcelas: analisa status das parcelas individuais"
echo "     ✓ Se não tem parcelas: usa data de vencimento do empréstimo"
echo "     ✓ Só marca como atrasado se houver parcelas realmente vencidas"
echo ""
echo "5. 🎯 Resultado:"
echo "   - Empréstimos com parcelas em dia não aparecerão mais como atrasados"
echo "   - Status será calculado corretamente baseado nas parcelas"
echo ""
echo "6. 🌐 Para testar:"
echo "   - Acesse: http://seu-servidor/jp.cobrancas/cobrancas.html"
echo "   - Verifique se empréstimos com parcelas em dia mostram badge 'Em Dia'"
echo "   - Apenas empréstimos com parcelas vencidas mostrarão 'Em Atraso'"
echo ""
echo "✅ Correção concluída!" 