import prisma from './config/db';

async function checkUsers() {
  try {
    const users = await prisma.user.findMany({
      include: { wallet: true },
    });
    console.log('--- DATABASE USERS ---');
    console.log(JSON.stringify(users, null, 2));
    console.log('----------------------');
  } catch (err) {
    console.error('Error querying users:', err);
  } finally {
    process.exit(0);
  }
}

checkUsers();
