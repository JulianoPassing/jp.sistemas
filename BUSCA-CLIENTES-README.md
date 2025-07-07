# Funcionalidade de Busca de Clientes - JP-Cobranças

## 📋 Visão Geral

A funcionalidade de busca de clientes foi implementada na página `clientes.html` para permitir a filtragem rápida e eficiente da lista de clientes cadastrados no sistema.

## ✨ Funcionalidades Implementadas

### 🔍 Busca por Texto
- **Busca em tempo real** conforme o usuário digita
- **Múltiplos campos** de busca:
  - Nome do cliente
  - CPF/CNPJ
  - Telefone
  - Email
  - Cidade
  - Estado
- **Case-insensitive** (não diferencia maiúsculas/minúsculas)
- **Busca parcial** (encontra resultados que contenham o termo digitado)

### 🏷️ Filtro por Status
- **Dropdown** com opções de status:
  - Todos os Status
  - Ativo
  - Lista Negra
  - Inativo
- **Combinação** com busca por texto

### 🧹 Limpeza de Filtros
- **Botão "Limpar"** para resetar todos os filtros
- **Restauração** da lista completa de clientes

### 📊 Informações de Resultados
- **Contador dinâmico** mostrando quantos clientes estão sendo exibidos
- **Feedback visual** do total de clientes vs. resultados filtrados

## 🎨 Interface do Usuário

### Layout da Caixa de Busca
```
┌─────────────────────────────────────────────────────────────┐
│ 🔍 Busca de Clientes                                        │
├─────────────────────────────────────────────────────────────┤
│ [Buscar por nome, CPF, telefone, email...] [Status ▼] [Limpar] │
│ Mostrando X de Y clientes                                   │
└─────────────────────────────────────────────────────────────┘
```

### Elementos da Interface
- **Campo de busca**: Input de texto responsivo
- **Filtro de status**: Dropdown com opções
- **Botão limpar**: Reset dos filtros
- **Informação de resultados**: Texto explicativo

## 🔧 Implementação Técnica

### Estrutura HTML
```html
<!-- Caixa de Busca -->
<div class="search-container">
  <div class="search-row">
    <input type="text" id="search-clientes" placeholder="Buscar...">
    <select id="filter-status-clientes">
      <option value="">Todos os Status</option>
      <option value="Ativo">Ativo</option>
      <option value="Lista Negra">Lista Negra</option>
      <option value="Inativo">Inativo</option>
    </select>
    <button id="clear-search-clientes">Limpar</button>
  </div>
  <div class="search-info">
    <span id="search-results-info-clientes">Mostrando todos os clientes</span>
  </div>
</div>
```

### JavaScript Principal
```javascript
// Variáveis globais
let allClientes = []; // Todos os clientes
let filteredClientes = []; // Clientes filtrados

// Função de filtragem
function applyFilters() {
  const searchTerm = searchInput.value.toLowerCase().trim();
  const statusFilter = filterStatus.value;
  
  filteredClientes = allClientes.filter(cliente => {
    const matchesSearch = !searchTerm || 
      (cliente.nome && cliente.nome.toLowerCase().includes(searchTerm)) ||
      (cliente.cpf_cnpj && cliente.cpf_cnpj.toLowerCase().includes(searchTerm)) ||
      (cliente.telefone && cliente.telefone.includes(searchTerm)) ||
      (cliente.email && cliente.email.toLowerCase().includes(searchTerm)) ||
      (cliente.cidade && cliente.cidade.toLowerCase().includes(searchTerm)) ||
      (cliente.estado && cliente.estado.toLowerCase().includes(searchTerm));
    
    const matchesStatus = !statusFilter || cliente.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });
  
  renderFilteredClientes();
  updateSearchResultsInfo();
}
```

### Event Listeners
- **Input de busca**: `input` event para busca em tempo real
- **Filtro de status**: `change` event para filtro por status
- **Botão limpar**: `click` event para resetar filtros

## 📱 Responsividade

### Desktop
- **Layout horizontal** com todos os elementos na mesma linha
- **Campo de busca** ocupa espaço flexível
- **Filtros** alinhados à direita

### Mobile
- **Layout vertical** com elementos empilhados
- **Flex-wrap** para quebra de linha
- **Largura mínima** para campos de input

### CSS Responsivo
```css
.search-container {
  display: flex;
  gap: 1rem;
  align-items: center;
  flex-wrap: wrap;
}

.search-input {
  flex: 1;
  min-width: 250px;
}

.search-filters {
  display: flex;
  gap: 0.5rem;
}
```

## 🧪 Testes

### Script de Teste
Execute o script `scripts/test-busca-clientes.js` para verificar:

1. **Conexão com API**
2. **Dados de clientes disponíveis**
3. **Cenários de busca**
4. **Estatísticas dos dados**
5. **Validação de campos**

### Como Executar
```bash
node scripts/test-busca-clientes.js
```

### Cenários Testados
- ✅ Busca por nome
- ✅ Busca por CPF
- ✅ Busca por telefone
- ✅ Busca por email
- ✅ Busca por cidade
- ✅ Filtro por status
- ✅ Busca inexistente
- ✅ Combinação de filtros

## 🎯 Casos de Uso

### 1. Busca Rápida por Nome
```
Usuário digita: "João"
Resultado: Todos os clientes com "João" no nome
```

### 2. Busca por CPF
```
Usuário digita: "123.456"
Resultado: Clientes com CPF contendo "123.456"
```

### 3. Filtro por Status
```
Usuário seleciona: "Lista Negra"
Resultado: Apenas clientes em lista negra
```

### 4. Combinação de Filtros
```
Usuário digita: "São Paulo" + seleciona "Ativo"
Resultado: Clientes ativos de São Paulo
```

### 5. Limpeza de Filtros
```
Usuário clica: "Limpar"
Resultado: Lista completa restaurada
```

## 🔄 Integração com Sistema

### Compatibilidade
- ✅ **API de Clientes** (`/api/cobrancas/clientes`)
- ✅ **Sistema de Sessão** (autenticação)
- ✅ **Funções Globais** (`renderClientesLista`, `viewCliente`, etc.)
- ✅ **Sistema de Status** (Ativo, Lista Negra, Inativo)

### Dependências
- **main.js**: Funções globais e API service
- **style.css**: Estilos da interface
- **Backend API**: Endpoint de clientes

## 🚀 Performance

### Otimizações Implementadas
- **Busca client-side** (sem requisições adicionais)
- **Filtragem eficiente** com JavaScript nativo
- **Renderização otimizada** da tabela
- **Debounce implícito** através de eventos nativos

### Limitações
- **Busca local** (não busca no servidor)
- **Depende** do carregamento inicial de todos os clientes
- **Performance** pode degradar com muitos clientes (>1000)

## 🐛 Troubleshooting

### Problemas Comuns

#### 1. Busca não funciona
**Sintomas**: Digita no campo mas não filtra
**Solução**: Verificar se `allClientes` está carregado

#### 2. Filtro de status não funciona
**Sintomas**: Seleciona status mas não filtra
**Solução**: Verificar se os clientes têm campo `status` preenchido

#### 3. Botão limpar não funciona
**Sintomas**: Clica mas não limpa os filtros
**Solução**: Verificar event listener do botão

#### 4. Performance lenta
**Sintomas**: Busca demora para responder
**Solução**: Verificar quantidade de clientes carregados

### Logs de Debug
```javascript
// Adicionar logs para debug
console.log('Clientes carregados:', allClientes.length);
console.log('Termo de busca:', searchTerm);
console.log('Filtro de status:', statusFilter);
console.log('Resultados filtrados:', filteredClientes.length);
```

## 📈 Melhorias Futuras

### Funcionalidades Sugeridas
- [ ] **Busca no servidor** para grandes volumes
- [ ] **Histórico de buscas** recentes
- [ ] **Busca avançada** com múltiplos critérios
- [ ] **Exportação** de resultados filtrados
- [ ] **Filtros salvos** para uso frequente

### Otimizações Técnicas
- [ ] **Debounce** explícito para busca
- [ ] **Virtualização** de lista para muitos itens
- [ ] **Cache** de resultados de busca
- [ ] **Indexação** de dados para busca mais rápida

## 📞 Suporte

Para dúvidas ou problemas com a funcionalidade de busca:

1. **Verifique** se há clientes cadastrados
2. **Execute** o script de teste
3. **Consulte** os logs do navegador
4. **Teste** em diferentes navegadores
5. **Verifique** a conexão com a API

---

**Versão**: 1.0  
**Data**: Dezembro 2024  
**Autor**: JP-Sistemas 