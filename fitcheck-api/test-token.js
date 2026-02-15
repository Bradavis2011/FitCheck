const { PrismaClient } = require('@prisma/client');
const jwt = require('jsonwebtoken');
const prisma = new PrismaClient();

(async () => {
  try {
    const user = await prisma.user.findFirst({
      select: { id: true, email: true, name: true }
    });

    if (!user) {
      console.log('No users found');
      process.exit(1);
    }

    const token = jwt.sign(
      { userId: user.id, email: user.email },
      process.env.JWT_SECRET || 'test-secret',
      { expiresIn: '1h' }
    );

    console.log('Test User:', user.email);
    console.log('User ID:', user.id);
    console.log('\nTest Token:');
    console.log(token);

    await prisma.$disconnect();
  } catch (error) {
    console.error('Error:', error.message);
    await prisma.$disconnect();
    process.exit(1);
  }
})();
