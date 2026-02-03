-- Script para corrigir status "Em Digitação" para "Atendido"
-- Execute este script no banco de dados de produção

UPDATE "BlingOrder"
SET status = 'Atendido'
WHERE status = 'Em Digitação';

-- Verificar quantos foram atualizados
SELECT COUNT(*) as "Pedidos Atualizados" 
FROM "BlingOrder" 
WHERE status = 'Atendido';
