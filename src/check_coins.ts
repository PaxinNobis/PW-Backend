import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    try {
        const richUsers = await prisma.user.findMany({
            where: { coins: { gt: 0 } },
            select: { id: true, name: true, email: true, coins: true }
        });

        console.log('Users with coins:', richUsers);

        if (richUsers.length === 0) {
            console.log('NO USERS HAVE COINS. This is likely the cause of the 400 error.');
        }

    } catch (error) {
        console.error(error);
    } finally {
        await prisma.$disconnect();
    }
}

main();
