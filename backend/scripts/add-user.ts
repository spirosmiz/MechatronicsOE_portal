import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import * as readline from 'readline';

const prisma = new PrismaClient();

const ROLES = ['admin', 'project_manager', 'technician'] as const;
type Role = (typeof ROLES)[number];

function ask(rl: readline.Interface, question: string): Promise<string> {
  return new Promise((resolve) => rl.question(question, resolve));
}

async function main() {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

  console.log('\n--- Add New User ---\n');

  const name = (await ask(rl, 'Full name: ')).trim();
  const email = (await ask(rl, 'Email: ')).trim().toLowerCase();
  const password = (await ask(rl, 'Password: ')).trim();

  console.log(`\nRoles: ${ROLES.join(' | ')}`);
  const roleInput = (await ask(rl, 'Role: ')).trim() as Role;

  rl.close();

  if (!name || !email || !password) {
    console.error('Error: name, email, and password are required.');
    process.exit(1);
  }

  if (!ROLES.includes(roleInput)) {
    console.error(`Error: invalid role "${roleInput}". Must be one of: ${ROLES.join(', ')}`);
    process.exit(1);
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    console.error(`Error: a user with email "${email}" already exists.`);
    process.exit(1);
  }

  const passwordHash = await bcrypt.hash(password, 12);

  const user = await prisma.user.create({
    data: { name, email, passwordHash, role: roleInput },
  });

  console.log(`\nUser created successfully:`);
  console.log(`  ID:    ${user.id}`);
  console.log(`  Name:  ${user.name}`);
  console.log(`  Email: ${user.email}`);
  console.log(`  Role:  ${user.role}`);
}

main()
  .catch((e) => {
    console.error(e.message);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
