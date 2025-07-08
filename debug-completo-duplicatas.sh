#!/bin/bash

echo "🔧 DEBUG COMPLETO - Eliminação Definitiva de Duplicatas"
echo "======================================================"
echo

echo "🎯 SITUAÇÃO ATUAL:"
echo "Empréstimos ainda aparecem duplicados na página emprestimos.html"
echo "Preciso identificar a origem exata do problema"
echo

echo "🔍 EXECUTANDO DEBUG COMPLETO..."
echo

echo "📋 1. Verificando dados diretos no banco..."
node scripts/debug-duplicatas-api.js

echo
echo "🔄 2. INSTRUÇÕES PARA TESTE NO NAVEGADOR:"
echo "======================================="
echo
echo "1. Reinicie o servidor primeiro:"
echo "   Ctrl+C para parar o servidor"
echo "   node server.js para reiniciar"
echo
echo "2. Abra emprestimos.html no navegador"
echo "   URL: http://localhost:3000/jp.cobrancas/emprestimos.html"
echo
echo "3. Abra o Console do navegador (F12)"
echo
echo "4. Clique no botão '🔧 Debug Limpar Cache' (canto superior direito)"
echo
echo "5. Observe atentamente os logs no console:"
echo "   🔍 [DEBUG] Histórico: Iniciando carregamento..."
echo "   📋 [DEBUG] Histórico: API retornou X empréstimos"
echo "   📝 [DEBUG] Empréstimos recebidos da API:"
echo "   🔄 [DEBUG] Iniciando filtragem de duplicatas..."
echo "   🚨 [DEBUG] DUPLICATA DETECTADA E IGNORADA (se houver)"
echo "   📊 [DEBUG] RESULTADO DA FILTRAGEM:"
echo "   🔍 [DEBUG] Após verificação de renderização:"
echo "   📝 [DEBUG] Empréstimos que serão renderizados:"
echo

echo "🧪 3. PONTOS CRÍTICOS A VERIFICAR:"
echo "================================="
echo
echo "A) Se 'API retornou X empréstimos' mostra número alto:"
echo "   → Problema está na API (banco ou query)"
echo
echo "B) Se 'DUPLICATA DETECTADA E IGNORADA' aparece:"
echo "   → Filtro funcionando, mas API envia duplicatas"
echo
echo "C) Se 'Empréstimos que serão renderizados' mostra duplicatas:"
echo "   → Problema na lógica de renderização"
echo
echo "D) Se ainda há duplicatas na tela:"
echo "   → Problema em múltiplas chamadas ou cache"
echo

echo "🔧 4. AÇÕES BASEADAS NO RESULTADO:"
echo "================================="
echo
echo "📊 Se o script debug-duplicatas-api.js mostrar:"
echo
echo "✅ 'Todas as queries retornam o mesmo número' + nenhuma duplicata:"
echo "   → Problema é 100% no frontend"
echo "   → Verificar se há múltiplas chamadas à API"
echo
echo "⚠️  'Há diferenças entre as queries' ou 'IDs duplicados':"
echo "   → Problema está na API/banco"
echo "   → Verificar estrutura do banco"
echo
echo "🚨 'Clientes duplicados encontrados':"
echo "   → Problema pode estar no JOIN da query"
echo "   → Limpeza dos dados necessária"
echo

echo "📞 5. PRÓXIMOS PASSOS:"
echo "====================="
echo
echo "✅ Se logs mostram filtragem funcionando mas ainda há duplicatas:"
echo "   → Verificar se há múltiplas instâncias da função rodando"
echo "   → Verificar se há interferência de cache"
echo "   → Verificar se há outras funções modificando a lista"
echo
echo "🚨 Se logs mostram que API envia duplicatas:"
echo "   → Verificar se DISTINCT foi aplicado corretamente"
echo "   → Verificar se há problemas no banco de dados"
echo "   → Verificar se há dados corrompidos"
echo

echo "🔍 6. LOGS ESPERADOS PARA FUNCIONAMENTO CORRETO:"
echo "================================================"
echo
echo "📋 [DEBUG] Histórico: API retornou 3 empréstimos"
echo "📝 [DEBUG] Empréstimos recebidos da API:"
echo "  1. ID: 1 | Cliente: teste | Valor: R$ 1300 | Status: ATIVO"
echo "  2. ID: 2 | Cliente: testeprazo | Valor: R$ 10000.2 | Status: ATIVO"
echo "  3. ID: 3 | Cliente: testeparcelado | Valor: R$ 8100 | Status: ATIVO"
echo "🔄 [DEBUG] Iniciando filtragem de duplicatas..."
echo "✅ [DEBUG] Processando empréstimo único: ID 1 - teste"
echo "✅ [DEBUG] Processando empréstimo único: ID 2 - testeprazo"
echo "✅ [DEBUG] Processando empréstimo único: ID 3 - testeparcelado"
echo "📊 [DEBUG] RESULTADO DA FILTRAGEM:"
echo "  - Empréstimos recebidos: 3"
echo "  - Empréstimos únicos: 3"
echo "  - Duplicatas removidas: 0"
echo "🔍 [DEBUG] Após verificação de renderização: 3 empréstimos únicos"
echo "📝 [DEBUG] Empréstimos que serão renderizados:"
echo "  1. ID: 1 | Cliente: teste | Status: ATIVO"
echo "  2. ID: 2 | Cliente: testeprazo | Status: ATIVO"
echo "  3. ID: 3 | Cliente: testeparcelado | Status: ATIVO"
echo "✅ [DEBUG] Renderização concluída: 3 linhas adicionadas à tabela"
echo

echo "🚨 IMPORTANTE:"
echo "=============="
echo "Se após todas essas verificações ainda houver duplicatas:"
echo "1. Anote exatamente quais logs aparecem no console"
echo "2. Verifique se há erros em vermelho no console"
echo "3. Tire screenshot dos logs para análise"
echo "4. Verifique se não há outros scripts interferindo"
echo

echo "✅ A correção implementada é robusta e deve eliminar as duplicatas"
echo "   Se ainda persistir, o problema é mais profundo e precisa de análise específica"
echo 