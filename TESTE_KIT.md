# 🧪 COMO TESTAR A LÓGICA DE KITS

## Objetivo
Verificar se a API do Bling retorna o código EAN (gtin/gtinEmbalagem) para cada componente de um kit, permitindo que o sistema faça a baixa automática correta nos produtos individuais.

## Passo a Passo

### 1. Encontrar o ID de um Produto Kit no Bling

Acesse o Bling e abra um produto que seja um KIT:
- Vá em: **Produtos > Produtos**
- Clique em um produto que seja do tipo KIT
- Na URL, você verá algo como: `https://www.bling.com.br/produtos/12345`
- O número `12345` é o **ID do produto**

### 2. Executar o Teste no Sistema

1. Acesse a página **Contas Bling** no sistema
2. Localize a conta Bling conectada
3. Clique no botão **🧪 Testar Kit**
4. Digite o ID do produto kit (ex: `12345`)
5. Clique em OK

### 3. Analisar o Resultado

O sistema mostrará um alerta com:
- ✅ Se o produto é um kit ou não
- Número de componentes encontrados
- Mensagem para verificar os logs do servidor

### 4. IMPORTANTE: Verificar os Logs do Servidor

Os logs do servidor mostrarão a estrutura COMPLETA de cada componente. Procure por:

```
📦 Componente 1: {
  "produto": {
    "id": "123",
    "codigo": "SKU001",
    "nome": "Produto A",
    "gtin": "7891234567890",        ← ESTE É O EAN!
    "gtinEmbalagem": "...",
    ...
  },
  "quantidade": 2
}
```

### 5. O Que Verificar

✅ **Campos importantes:**
- `gtin` - Código EAN principal
- `gtinEmbalagem` - Código EAN da embalagem
- `codigo` - SKU do produto
- `nome` - Nome do produto
- `quantidade` - Quantidade do componente no kit

❓ **Perguntas a responder:**
1. O campo `gtin` existe e tem valor?
2. O campo `gtinEmbalagem` existe e tem valor?
3. Se não tiver EAN, quais campos estão disponíveis?
4. Todos os componentes têm as mesmas informações?

## Lógica Atual de Busca de Componentes

O sistema busca componentes na seguinte ordem de prioridade:

1. **EAN (gtin/gtinEmbalagem)** - PRIORIDADE MÁXIMA
2. **SKU (codigo)** - Segunda opção
3. **Nome (nome)** - Última opção

## Próximos Passos

Após o teste, você deve:

1. ✅ Confirmar se o EAN está presente nos componentes
2. ✅ Verificar se todos os componentes têm EAN
3. ✅ Se não tiver EAN, identificar qual campo usar
4. ✅ Ajustar a lógica de busca se necessário

## Exemplo de Teste Real

```
🧪 TESTE DE KIT

Digite o ID do produto kit no Bling: 12345

Resultado:
✅ É Kit: SIM
✅ Componentes: 4

⚠️ Verifique os logs do servidor!
```

**Logs do Servidor:**
```
🎁 Buscando componentes do kit (produto ID: 12345)...
✅ Kit detectado com 4 componentes

📦 Componente 1: {
  "produto": {
    "id": "789",
    "codigo": "COMP-001",
    "nome": "Componente A",
    "gtin": "7891234567890"
  },
  "quantidade": 2
}

📦 Componente 2: {
  "produto": {
    "id": "790",
    "codigo": "COMP-002",
    "nome": "Componente B",
    "gtin": "7891234567891"
  },
  "quantidade": 1
}
...
```

## Conclusão

Se o EAN estiver presente em todos os componentes, a lógica atual funcionará perfeitamente! ✅

Se o EAN NÃO estiver presente, precisaremos ajustar a lógica para usar SKU ou nome como identificador principal.
