# Importação de Clientes - J.P Sistemas

## Funcionalidade Implementada

Foi implementada a funcionalidade de importação de clientes via planilha Excel no painel de clientes (`painel-clientes.html`).

## Como Funciona

### 1. Botões Adicionados

- **Baixar Modelo**: Gera e baixa uma planilha modelo com a estrutura correta
- **Importar Planilha**: Permite selecionar e importar uma planilha de clientes

### 2. Processo de Importação

#### Passo 1: Baixar o Modelo
1. Clique no botão **"Baixar Modelo"** (ícone de download)
2. O sistema gera automaticamente um arquivo `modelo_clientes.xlsx`
3. O modelo contém:
   - Cabeçalhos corretos
   - Exemplos de dados
   - Formatação adequada

#### Passo 2: Preencher a Planilha
1. Abra o arquivo `modelo_clientes.xlsx`
2. Preencha os dados dos clientes seguindo o modelo
3. **Importante**: Mantenha os cabeçalhos exatamente como estão
4. Salve o arquivo

#### Passo 3: Importar
1. Clique no botão **"Importar Planilha"** (ícone de upload)
2. Selecione o arquivo Excel preenchido
3. O sistema valida e processa os dados
4. Confirme a importação
5. Visualize o resultado

### 3. Estrutura da Planilha

| Coluna | Campo | Obrigatório | Exemplo |
|--------|-------|-------------|---------|
| A | Razão Social | ✅ | Empresa Exemplo Ltda |
| B | CPF/CNPJ | ❌ | 12.345.678/0001-90 |
| C | Inscrição Estadual | ❌ | 123456789 |
| D | Endereço | ❌ | Rua das Flores, 123 |
| E | Bairro | ❌ | Centro |
| F | Cidade | ❌ | São Paulo |
| G | Estado | ❌ | SP |
| H | CEP | ❌ | 01234-567 |
| I | Email | ❌ | contato@empresa.com |
| J | Telefone | ❌ | (11) 99999-9999 |
| K | Transporte | ❌ | Transportadora ABC |
| L | Prazo | ❌ | 30 dias |
| M | Observações | ❌ | Cliente preferencial |

### 4. Validações Implementadas

#### Validação de Cabeçalhos
- Verifica se os cabeçalhos estão corretos
- Rejeita planilhas com formato incorreto
- Garante compatibilidade com o modelo

#### Validação de Dados
- Verifica se há pelo menos uma razão social
- Ignora linhas vazias
- Trata dados nulos/indefinidos

#### Validação de Importação
- Confirma quantidade de clientes antes de importar
- Mostra progresso durante a importação
- Relata sucessos e erros

### 5. Características Técnicas

#### Formatos Suportados
- ✅ Excel (.xlsx)
- ✅ Excel (.xls)
- ✅ CSV (.csv)

#### Biblioteca Utilizada
- **SheetJS (XLSX)**: Para leitura e escrita de arquivos Excel
- **CDN**: Carregada automaticamente do CDN

#### Tratamento de Erros
- Validação de formato de arquivo
- Verificação de cabeçalhos
- Tratamento de dados inválidos
- Feedback detalhado para o usuário

### 6. Fluxo de Importação

```javascript
1. Usuário seleciona arquivo
2. Sistema lê arquivo Excel
3. Valida cabeçalhos
4. Processa dados
5. Confirma importação
6. Importa clientes via API
7. Mostra resultado
8. Atualiza lista de clientes
```

### 7. Exemplo de Uso

#### Planilha Modelo
```
Razão Social          | CPF/CNPJ           | Cidade    | Estado
Empresa Exemplo Ltda  | 12.345.678/0001-90 | São Paulo | SP
João Silva           | 123.456.789-00     | Rio de Janeiro | RJ
```

#### Resultado
- 2 clientes importados com sucesso
- Dados salvos no banco de dados
- Lista de clientes atualizada automaticamente

### 8. Benefícios

1. **Eficiência**: Importa múltiplos clientes de uma vez
2. **Padronização**: Modelo garante formato correto
3. **Validação**: Verifica dados antes da importação
4. **Feedback**: Mostra progresso e resultados
5. **Flexibilidade**: Aceita diferentes formatos de arquivo

### 9. Limitações

- **Cabeçalhos fixos**: Deve seguir exatamente o modelo
- **Razão Social obrigatória**: Clientes sem razão social são ignorados
- **Tamanho do arquivo**: Arquivos muito grandes podem demorar

### 10. Troubleshooting

#### Erro: "Formato da planilha inválido"
- Use o modelo fornecido pelo sistema
- Verifique se os cabeçalhos estão corretos
- Não altere a ordem das colunas

#### Erro: "Nenhum cliente válido encontrado"
- Verifique se há dados na planilha
- Certifique-se de que a razão social está preenchida
- Verifique se não há linhas completamente vazias

#### Erro: "Erro ao processar a planilha"
- Verifique se o arquivo não está corrompido
- Tente salvar novamente no Excel
- Verifique se o formato é suportado (.xlsx, .xls, .csv)

## Arquivos Modificados

- `public/painel-clientes.html`: Interface e funcionalidades de importação
- `IMPORTACAO-CLIENTES.md`: Esta documentação

## Status

✅ **Implementado e Funcionando**
- Download de modelo de planilha
- Importação de clientes via Excel
- Validação de dados
- Feedback visual
- Tratamento de erros 