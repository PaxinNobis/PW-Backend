export interface LevelResult {
    level: number;
    name: string;
}

export function calculateStreamerLevel(points: number, levels: any[]): LevelResult {
    // Ordenar niveles por puntos requeridos de menor a mayor
    const sortedLevels = [...levels].sort((a, b) => a.puntosRequeridos - b.puntosRequeridos);

    let currentLevel = 0;
    let currentName = 'Espectador'; // Nombre por defecto

    for (let i = 0; i < sortedLevels.length; i++) {
        if (points >= sortedLevels[i].puntosRequeridos) {
            currentLevel = i + 1; // Nivel 1, 2, 3... basado en el orden
            currentName = sortedLevels[i].nombre;
        } else {
            break; // Si no alcanza el siguiente nivel, se queda en el actual
        }
    }

    return { level: currentLevel, name: currentName };
}

export async function updateUserLoyaltyLevel(
    prisma: any,
    userId: string,
    streamerId: string,
    points: number,
    levels: any[]
): Promise<{ levelChanged: boolean; newLevel: LevelResult; oldLevel: LevelResult | null }> {
    // Calculate new level
    const newLevel = calculateStreamerLevel(points, levels);

    // Get current level from database
    const currentLevelRecord = await prisma.userLoyaltyLevel.findUnique({
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

    const oldLevel = currentLevelRecord
        ? {
            level: levels.findIndex((l) => l.id === currentLevelRecord.loyaltyLevelId) + 1,
            name: currentLevelRecord.loyaltyLevel.nombre,
        }
        : null;

    // Find the loyalty level ID for the new level
    const sortedLevels = [...levels].sort((a, b) => a.puntosRequeridos - b.puntosRequeridos);
    const newLevelData = sortedLevels[newLevel.level - 1] || sortedLevels[0];

    // Update or create the level record
    await prisma.userLoyaltyLevel.upsert({
        where: {
            userId_streamerId: {
                userId,
                streamerId,
            },
        },
        create: {
            userId,
            streamerId,
            loyaltyLevelId: newLevelData.id,
        },
        update: {
            loyaltyLevelId: newLevelData.id,
            updatedAt: new Date(),
        },
    });

    // Check if level changed
    const levelChanged = !oldLevel || oldLevel.level !== newLevel.level;

    // Create notification if level changed
    if (levelChanged && oldLevel) {
        await prisma.notification.create({
            data: {
                userId,
                type: 'level_up',
                title: '¡Subiste de nivel!',
                message: `Ahora eres ${newLevel.name} en el canal`,
            },
        });
    }

    return { levelChanged, newLevel, oldLevel };
}
