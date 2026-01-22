# Mapeamento Completo de Status do Bling

## Objetivo
Mapear TODOS os status do Bling para:
1. Exibir o nome correto (igual ao Bling)
2. Aplicar a cor correta
3. Executar ações automáticas quando necessário

## Status Confirmados

### ✅ Status com Baixa Automática (Verde)
| ID | Nome no Bling | Ação |
|----|---------------|------|
| 5  | Verificado | Baixa no estoque |
| 10 | Checado | Baixa no estoque |
| 24 | Verificado | Baixa no estoque |

### ❌ Status de Cancelamento (Vermelho)
| ID | Nome no Bling | Ação |
|----|---------------|------|
| 2  | Cancelado | Reverter baixa (devolver ao estoque) |

### 📋 Status Iniciais (Laranja)
| ID | Nome no Bling | Ação |
|----|---------------|------|
| 0  | Em Aberto | Nenhuma |
| 9  | Em Digitação | Nenhuma |

### 🔵 Status de Processamento (Azul)
| ID | Nome no Bling | Ação |
|----|---------------|------|
| 1  | Atendido | Nenhuma |
| 14 | Faturado | Nenhuma |
| 27 | Processando | Nenhuma |

### 🟣 Status de Preparação (Roxo)
| ID | Nome no Bling | Ação |
|----|---------------|------|
| 12 | Pronto para Envio | Nenhuma |
| 15 | Pronto | Nenhuma |
| 16 | Impresso | Nenhuma |
| 17 | Separado | Nenhuma |
| 18 | Embalado | Nenhuma |

### 🔷 Status de Envio (Ciano)
| ID | Nome no Bling | Ação |
|----|---------------|------|
| 11 | Enviado | Nenhuma |
| 19 | Coletado | Nenhuma |
| 20 | Em Trânsito | Nenhuma |

### 🟢 Status de Entrega (Verde Esmeralda)
| ID | Nome no Bling | Ação |
|----|---------------|------|
| 8  | Entregue | Nenhuma |
| 23 | Tentativa de Entrega | Nenhuma |

### 🟡 Status de Espera (Amarelo)
| ID | Nome no Bling | Ação |
|----|---------------|------|
| 3  | Em Andamento | Nenhuma |
| 6  | Aguardando | Nenhuma |
| 13 | Pendente | Nenhuma |

### 🔴 Status Problemáticos (Vermelho)
| ID | Nome no Bling | Ação |
|----|---------------|------|
| 2  | Cancelado | Reverter baixa |
| 7  | Não Entregue | Nenhuma |
| 21 | Devolvido | Nenhuma |
| 22 | Extraviado | Nenhuma |
| 25 | Bloqueado | Nenhuma |
| 26 | Suspenso | Nenhuma |
| 29 | Reprovado | Nenhuma |

### 🌸 Status Especiais (Rosa)
| ID | Nome no Bling | Ação |
|----|---------------|------|
| 4  | Venda Agenciada | Nenhuma |
| 30 | Estornado | Nenhuma |

### 🟠 Status Aprovação (Laranja/Verde)
| ID | Nome no Bling | Ação |
|----|---------------|------|
| 28 | Aprovado | Baixa no estoque? (confirmar) |

## Status a Confirmar nos Logs
Aguardando captura dos logs do Railway para confirmar IDs reais.

## Como Usar Este Documento
1. Sincronize pedidos no sistema
2. Veja logs do Railway
3. Procure por `🎯 STATUS CAPTURADO:`
4. Atualize este documento com IDs reais
5. Implemente mapeamento no código
