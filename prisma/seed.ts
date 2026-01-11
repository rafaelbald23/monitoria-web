import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('Verificando configuração inicial...');

  // Verificar se usuário master já existe
  const existingMaster = await prisma.user.findFirst({
    where: { isMaster: true },
  });

  if (!existingMaster) {
    // Criar usuário MASTER apenas se não existir
    const masterPassword = await bcrypt.hash('master2024!', 12);
    
    await prisma.user.create({
      data: {
        username: 'master',
        password: masterPassword,
        name: 'Administrador Master',
        email: 'master@monitoria.com',
        role: 'admin',
        isActive: true,
        isMaster: true,
      },
    });

    console.log('Usuario master criado com sucesso');
    console.log('Login: master / Senha: master2024!');
  } else {
    console.log('Usuario master ja existe, pulando criacao');
  }

  console.log('Setup concluido');
}

main()
  .catch((e) => {
    console.error('Erro no seed:', e);
    // Não falha o processo se der erro no seed
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
