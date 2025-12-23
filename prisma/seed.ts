import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Iniciando seed do banco de dados...');

  // Criar usuário MASTER (dono do sistema)
  const masterPassword = await bcrypt.hash('master2024!', 12);
  
  const master = await prisma.user.upsert({
    where: { username: 'master' },
    update: {},
    create: {
      username: 'master',
      password: masterPassword,
      name: 'Administrador Master',
      email: 'master@monitoria.com',
      role: 'admin',
      isActive: true,
      isMaster: true,
    },
  });

  console.log('✅ Usuário MASTER criado:', master.username);

  // Criar usuário admin padrão (cliente de exemplo)
  const hashedPassword = await bcrypt.hash('admin123', 12);
  
  const admin = await prisma.user.upsert({
    where: { username: 'admin' },
    update: {},
    create: {
      username: 'admin',
      password: hashedPassword,
      name: 'Administrador',
      email: 'admin@monitoria.com',
      role: 'admin',
      isActive: true,
      isMaster: false,
      companyName: 'Empresa Demo',
      subscriptionStatus: 'active',
      subscriptionPlan: 'basic',
      subscriptionStart: new Date(),
      subscriptionEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    },
  });

  console.log('✅ Usuário admin criado:', admin.username);

  // Criar alguns produtos de exemplo
  const products = [
    { sku: 'PROD001', name: 'Produto Exemplo 1', salePrice: 99.90 },
    { sku: 'PROD002', name: 'Produto Exemplo 2', salePrice: 149.90 },
    { sku: 'PROD003', name: 'Produto Exemplo 3', salePrice: 199.90 },
  ];

  for (const product of products) {
    await prisma.product.upsert({
      where: { sku: product.sku },
      update: {},
      create: {
        sku: product.sku,
        name: product.name,
        salePrice: product.salePrice,
        isActive: true,
      },
    });
  }

  console.log('✅ Produtos de exemplo criados');
  console.log('');
  console.log('📋 Credenciais de acesso:');
  console.log('');
  console.log('   🔐 MASTER (seu acesso):');
  console.log('   Usuário: master');
  console.log('   Senha: master2024!');
  console.log('   Painel: /master');
  console.log('');
  console.log('   👤 Cliente demo:');
  console.log('   Usuário: admin');
  console.log('   Senha: admin123');
  console.log('');
}

main()
  .catch((e) => {
    console.error('❌ Erro no seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
