# Debug do Erro 500 na Criação de Empréstimos

## Problema
O sistema está retornando erro HTTP 500 (Internal Server Error) ao tentar criar empréstimos com a nova funcionalidade de valor fixo.

## Ferramentas de Debug Criadas

### 1. Logs Detalhados na API (`api/cobrancas.js`)
- Adicionados logs completos dos dados recebidos
- Validação detalhada de tipos de dados
- Verificação da estrutura do banco de dados
- Logs de cada etapa do processo

### 2. Logs Detalhados no Frontend (`public/jp.cobrancas/js/main.js`)
- Logs dos dados enviados para a API
- Verificação de tipos de cada campo
- Tratamento de erro mais detalhado
- Logs da requisição HTTP

### 3. Script de Teste Isolado (`scripts/test-emprestimo-debug.js`)
- Testa a criação de empréstimo sem dependências de sessão
- Verifica estrutura do banco
- Simula dados reais

### 4. Servidor de Teste (`api/test-emprestimo.js`)
- API simplificada para testes
- Sem autenticação de sessão
- Logs detalhados
- Verificação de estrutura do banco

### 5. Interface de Teste (`test-emprestimo.html`)
- Formulário completo para testar criação de empréstimo
- Botões para verificar estrutura do banco
- Visualização de resultados em tempo real

## Como Usar as Ferramentas

### Passo 1: Verificar Logs do Sistema Principal
1. Abra o navegador no sistema JP-Cobranças
2. Abra o Developer Tools (F12)
3. Vá para a aba Console
4. Tente criar um empréstimo
5. Observe os logs detalhados que foram adicionados

### Passo 2: Usar o Servidor de Teste
1. Abra terminal na raiz do projeto
2. Execute: `node api/test-emprestimo.js`
3. Abra `test-emprestimo.html` no navegador
4. Teste a criação de empréstimos

### Passo 3: Executar Script de Debug
1. Execute: `node scripts/test-emprestimo-debug.js`
2. Verifique se há erros na criação direta

### Passo 4: Verificar Estrutura do Banco
1. Use a interface de teste para verificar a estrutura
2. Confirme se a coluna `tipo_calculo` existe
3. Verifique se todas as tabelas necessárias estão presentes

## Possíveis Causas do Erro 500

### 1. Problema de Sessão
- Usuário não autenticado
- Sessão expirada
- Problema na criação do banco de dados do usuário

### 2. Problema de Banco de Dados
- Coluna `tipo_calculo` não existe
- Tabelas não foram criadas corretamente
- Problema de conexão com MySQL

### 3. Problema de Validação
- Dados inválidos sendo enviados
- Tipos de dados incorretos
- Campos obrigatórios ausentes

### 4. Problema de Cálculo
- Divisão por zero
- Valores NaN ou undefined
- Erro nas fórmulas matemáticas

## Soluções Implementadas

### 1. Validação Robusta
```javascript
// Validação de tipos
if (isNaN(Number(cliente_id))) {
  return res.status(400).json({ error: 'ID do cliente inválido' });
}

if (isNaN(Number(valor))) {
  return res.status(400).json({ error: 'Valor do empréstimo inválido' });
}
```

### 2. Verificação de Estrutura
```javascript
// Verificar se coluna existe antes de usar
const [columns] = await connection.execute(`
  SELECT COLUMN_NAME 
  FROM INFORMATION_SCHEMA.COLUMNS 
  WHERE TABLE_NAME = 'emprestimos' AND COLUMN_NAME = 'tipo_calculo'
`);
```

### 3. Tratamento de Erro Detalhado
```javascript
} catch (error) {
  console.error('Erro ao criar empréstimo:', error);
  console.error('Stack trace:', error.stack);
  res.status(500).json({ 
    error: 'Erro interno do servidor', 
    details: error.message 
  });
}
```

## Próximos Passos

1. **Execute as ferramentas de debug** para identificar a causa exata
2. **Verifique os logs** no console do navegador e no servidor
3. **Teste com dados simples** usando a interface de teste
4. **Confirme a estrutura do banco** usando as ferramentas
5. **Aplique as correções** baseadas nos resultados

## Comandos Úteis

```bash
# Executar servidor de teste
node api/test-emprestimo.js

# Executar script de debug
node scripts/test-emprestimo-debug.js

# Verificar estrutura do banco
node scripts/add-tipo-calculo-simple.js

# Reiniciar servidor principal
npm start
```

## Arquivos Modificados

- `api/cobrancas.js` - Logs detalhados
- `public/jp.cobrancas/js/main.js` - Logs e tratamento de erro
- `scripts/test-emprestimo-debug.js` - Script de teste
- `api/test-emprestimo.js` - Servidor de teste
- `test-emprestimo.html` - Interface de teste

## Contato

Se o problema persistir após usar essas ferramentas, documente:
1. Os logs completos do console
2. A estrutura do banco retornada
3. Os dados exatos que estão sendo enviados
4. A mensagem de erro específica 