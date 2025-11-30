import { PrismaClient } from '@prisma/client';
import { LevelResult } from './level.utils';

export async function getUserPersistedLevel(
    prisma: PrismaClient,
    userId: string,
    streamerId: string
): Promise<LevelResult> {
    const userLevel = await prisma.userLoyaltyLevel.findUnique({
        where: {
            userId_streamerId: {
                userId,
                streamerId,
            },
        },
        include: {
            loyaltyLevel: true,
        },
    });

    if (!userLevel) {
        // Get the first configured level for this streamer
        const firstLevel = await prisma.loyaltyLevel.findFirst({
            where: { streamerId },
            orderBy: { puntosRequeridos: 'asc' },
        });

        // Return first level name or fallback
        return { level: 0, name: firstLevel?.nombre || 'Sin configurar' };
    }

    // Find the level index
    const allLevels = await prisma.loyaltyLevel.findMany({
        where: { streamerId },
        orderBy: { puntosRequeridos: 'asc' },
    });

    const levelIndex = allLevels.findIndex((l) => l.id === userLevel.loyaltyLevelId);

    return {
        level: levelIndex + 1,
        name: userLevel.loyaltyLevel.nombre,
    };
}
