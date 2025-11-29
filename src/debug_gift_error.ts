import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    try {
        console.log('--- Debugging Gift Sending Error ---');

        // 1. List all users and their coins
        const users = await prisma.user.findMany({
            select: { id: true, name: true, email: true, coins: true }
        });
        console.log('\nUsers:', users);

        // 2. List all gifts and their streamerIds
        const gifts = await prisma.gift.findMany({
            select: { id: true, nombre: true, costo: true, streamerId: true }
        });
        console.log('\nGifts:', gifts);

        // 3. List all streamers (users who have gifts)
        const streamerIds = [...new Set(gifts.map(g => g.streamerId))];
        const streamers = await prisma.user.findMany({
            where: { id: { in: streamerIds } },
            select: { id: true, name: true }
        });
        console.log('\nStreamers with Gifts:', streamers);

    } catch (error) {
        console.error('Debug failed:', error);
    } finally {
        await prisma.$disconnect();
    }
}

main();
