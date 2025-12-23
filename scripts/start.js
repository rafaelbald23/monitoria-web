import { execSync } from 'child_process';

console.log('🚀 Iniciando aplicação...');

try {
  console.log('📦 Gerando Prisma Client...');
  execSync('npx prisma generate', { stdio: 'inherit' });

  console.log('🗄️ Sincronizando banco de dados...');
  execSync('npx prisma db push', { stdio: 'inherit' });

  console.log('🌱 Executando seed...');
  execSync('npx tsx prisma/seed.ts', { stdio: 'inherit' });

  console.log('✅ Setup completo! Iniciando servidor...');
} catch (error) {
  console.error('⚠️ Erro no setup, mas continuando...', error.message);
}

// Importa e inicia o servidor
import('../dist/server/index.js');
