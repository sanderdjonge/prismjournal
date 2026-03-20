/**
 * Bootstrap script: promote a user to superuser (admin).
 *
 * Usage:
 *   npx tsx scripts/make-admin.ts <email>
 *
 * In production (inside Docker):
 *   docker exec prod_app npx tsx scripts/make-admin.ts user@example.com
 *
 * This script requires direct server access — it cannot be triggered remotely.
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const email = process.argv[2];

  if (!email) {
    console.error('Usage: npx tsx scripts/make-admin.ts <email>');
    process.exit(1);
  }

  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, name: true, email: true, isSuperuser: true },
  });

  if (!user) {
    console.error(`No user found with email: ${email}`);
    process.exit(1);
  }

  if (user.isSuperuser) {
    console.log(`✓ ${user.name} (${user.email}) is already an admin.`);
    process.exit(0);
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { isSuperuser: true },
  });

  console.log(`✓ ${user.name} (${user.email}) has been granted admin access.`);
}

main()
  .catch((e) => {
    console.error('Error:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
