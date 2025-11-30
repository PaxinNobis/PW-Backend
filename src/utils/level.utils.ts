export interface LevelResult {
    level: number;
    name: string;
}

export function calculateStreamerLevel(points: number, levels: any[]): LevelResult {
    // Ordenar niveles por puntos requeridos de menor a mayor
    const sortedLevels = [...levels].sort((a, b) => a.puntosRequeridos - b.puntosRequeridos);

    // Si no hay niveles configurados, devolver nivel 0 sin nombre
    if (sortedLevels.length === 0) {
        return { level: 0, name: 'Sin configurar' };
    }

    let currentLevel = 0;
    let currentName = sortedLevels[0]?.nombre || 'Sin configurar'; // Usar el primer nivel como base

    for (let i = 0; i < sortedLevels.length; i++) {
        if (points >= sortedLevels[i].puntosRequeridos) {
            currentLevel = i + 1; // Nivel 1, 2, 3... basado en el orden
            currentName = sortedLevels[i].nombre || sortedLevels[0]?.nombre || 'Sin configurar';
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
    const newLevelData = newLevel.level > 0 ? sortedLevels[newLevel.level - 1] : null;

    // Update or create the level record ONLY if a valid level is reached
    if (newLevelData) {
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
    }

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

export function calculateGlobalLevel(totalPoints: number): number {
    // Formula: Level = floor(sqrt(points / 10)) + 1
    // 0 points = Level 1
    // 10 points = Level 2
    // 40 points = Level 3
    // 90 points = Level 4
    // 100 points = Level 4 (sqrt(10) = 3.16 -> 3 + 1 = 4)
    if (totalPoints < 0) return 1;
    return Math.floor(Math.sqrt(totalPoints / 10)) + 1;
}
