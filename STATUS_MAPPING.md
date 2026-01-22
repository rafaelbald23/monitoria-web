# Mapeamento de Status do Bling

## Status Confirmados
| ID | Nome no Bling | Nome no Sistema | Cor | Ação |
|----|---------------|-----------------|-----|------|
| 24 | Verificado | Verificado | Verde | Baixa Automática |
| 5  | Verificado | Verificado | Verde | Baixa Automática |
| 10 | Checado | Checado | Verde | Baixa Automática |

## Status a Confirmar
Precisamos confirmar os IDs corretos para cada status que aparece na interface do Bling.

### Como descobrir o ID de um status:
1. Abra um pedido no sistema
2. Veja o console do navegador (F12)
3. Procure por "situacao completa" nos logs
4. Anote o ID e o nome

### Status Comuns do Bling:
- Em Aberto
- Em Digitação
- Verificado ✅
- Checado ✅
- Aprovado
- Atendido
- Faturado
- Pronto para Envio
- Impresso
- Separado
- Embalado
- Enviado
- Coletado
- Em Trânsito
- Entregue
- Cancelado
- Devolvido
- Não Entregue
- Extraviado
- Bloqueado
- Suspenso
- Reagendado
- Tentativa de Entrega
- Aguardando
- Pendente
- Processando
- Reprovado
- Estornado
- Venda Agenciada

## Ações por Status
- **Baixa Automática**: Verificado, Checado, Aprovado
- **Sem Ação**: Todos os outros
