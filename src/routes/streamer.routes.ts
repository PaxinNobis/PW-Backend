import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const router = Router();
const prisma = new PrismaClient();

// Definición de los 12 niveles de streamer
const LEVELS = [
  { id: 1, name: 'Astronauta Novato', minFollowers: 0, maxFollowers: 100, minHours: 0, maxHours: 50, rewards: 'Badge de Novato', levelOrder: 1 },
  { id: 2, name: 'Explorador Planetario', minFollowers: 101, maxFollowers: 500, minHours: 51, maxHours: 150, rewards: 'Badge de Explorador + Emote personalizado', levelOrder: 2 },
  { id: 3, name: 'Piloto Lunar', minFollowers: 501, maxFollowers: 1500, minHours: 151, maxHours: 300, rewards: 'Badge de Piloto + 2 Emotes personalizados', levelOrder: 3 },
  { id: 4, name: 'Comandante Estelar', minFollowers: 1501, maxFollowers: 5000, minHours: 301, maxHours: 500, rewards: 'Badge de Comandante + 3 Emotes + Sub-badges', levelOrder: 4 },
  { id: 5, name: 'Coronel Galáctico', minFollowers: 5001, maxFollowers: 15000, minHours: 501, maxHours: 800, rewards: 'Badge de Coronel + 5 Emotes + Sub-badges + Chat personalizado', levelOrder: 5 },
  { id: 6, name: 'General Cósmico', minFollowers: 15001, maxFollowers: 50000, minHours: 801, maxHours: 1200, rewards: 'Badge de General + 10 Emotes + Verificación', levelOrder: 6 },
  { id: 7, name: 'Señor Universal', minFollowers: 50001, maxFollowers: 150000, minHours: 1201, maxHours: 2000, rewards: 'Badge de Señor + 15 Emotes + Partner', levelOrder: 7 },
  { id: 8, name: 'Emperador Multiversal', minFollowers: 150001, maxFollowers: 500000, minHours: 2001, maxHours: 3000, rewards: 'Badge de Emperador + 20 Emotes + Prioridad soporte', levelOrder: 8 },
  { id: 9, name: 'Leyenda Omniversal', minFollowers: 500001, maxFollowers: 1500000, minHours: 3001, maxHours: 4500, rewards: 'Badge de Leyenda + 30 Emotes + Eventos exclusivos', levelOrder: 9 },
  { id: 10, name: 'Entidad Primigenia', minFollowers: 1500001, maxFollowers: 5000000, minHours: 4501, maxHours: 6500, rewards: 'Badge de Entidad + 50 Emotes + Página destacada', levelOrder: 10 },
  { id: 11, name: 'Titán Dimensional', minFollowers: 5000001, maxFollowers: 10000000, minHours: 6501, maxHours: 9000, rewards: 'Badge de Titán + 75 Emotes + Merchandising oficial', levelOrder: 11 },
  { id: 12, name: 'Deidad Eterna', minFollowers: 10000001, maxFollowers: 25000000, minHours: 9001, maxHours: 12000, rewards: 'Badge de Deidad + 100 Emotes + Estatua en Hall of Fame', levelOrder: 12 },
];

// Función auxiliar para calcular el nivel actual
function calculateLevel(followers: number, hours: number) {
  // Buscar el nivel que cumple AMBAS condiciones
  const level = LEVELS.find(l => 
    followers >= l.minFollowers && 
    followers <= l.maxFollowers &&
    hours >= l.minHours && 
    hours <= l.maxHours
  );
  
  return level || LEVELS[0]; // Default: Astronauta Novato
}

// Función auxiliar para obtener el siguiente nivel
function getNextLevel(currentLevelOrder: number) {
  return LEVELS.find(l => l.levelOrder === currentLevelOrder + 1) || null;
}

// GET /api/streamer/level - Obtener nivel actual del streamer
router.get('/level', async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'No autenticado' });
    }

    const userId = req.user.userId;

    // Obtener datos del usuario
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        streamingHours: true,
        _count: {
          select: {
            followedBy: true, // Número de seguidores
          },
        },
      },
    });

    if (!user) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    const hours = user.streamingHours || 0;
    const followers = user._count.followedBy;

    // Calcular nivel actual
    const currentLevel = calculateLevel(followers, hours);
    const nextLevel = getNextLevel(currentLevel.levelOrder);

    // Calcular progreso
    const hoursProgress = nextLevel 
      ? Math.min(100, ((hours - currentLevel.minHours) / (nextLevel.minHours - currentLevel.minHours)) * 100)
      : 100;

    const followersProgress = nextLevel
      ? Math.min(100, ((followers - currentLevel.minFollowers) / (nextLevel.minFollowers - currentLevel.minFollowers)) * 100)
      : 100;

    return res.status(200).json({
      success: true,
      currentLevel: {
        id: currentLevel.id,
        name: currentLevel.name,
        minFollowers: currentLevel.minFollowers,
        maxFollowers: currentLevel.maxFollowers,
        minHours: currentLevel.minHours,
        maxHours: currentLevel.maxHours,
        rewards: currentLevel.rewards,
      },
      progress: {
        currentHours: hours,
        currentFollowers: followers,
        hoursProgress: Math.round(hoursProgress),
        followersProgress: Math.round(followersProgress),
      },
      nextLevel: nextLevel ? {
        id: nextLevel.id,
        name: nextLevel.name,
        minFollowers: nextLevel.minFollowers,
        maxFollowers: nextLevel.maxFollowers,
        minHours: nextLevel.minHours,
        maxHours: nextLevel.maxHours,
        rewards: nextLevel.rewards,
      } : null,
    });
  } catch (error) {
    console.error('Error al obtener nivel:', error);
    res.status(500).json({ error: 'Error al obtener nivel' });
  }
});

// GET /api/streamer/levels/all - Obtener todos los niveles disponibles
router.get('/levels/all', async (req: Request, res: Response) => {
  try {
    return res.status(200).json({
      success: true,
      levels: LEVELS.map(l => ({
        id: l.id,
        name: l.name,
        minFollowers: l.minFollowers,
        maxFollowers: l.maxFollowers,
        minHours: l.minHours,
        maxHours: l.maxHours,
        rewards: l.rewards,
        levelOrder: l.levelOrder,
      }))
    });
  } catch (error) {
    console.error('Error al obtener niveles:', error);
    res.status(500).json({ error: 'Error al obtener niveles' });
  }
});

// PUT /api/streamer/hours - Actualizar horas transmitidas
router.put('/hours', async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'No autenticado' });
    }

    const userId = req.user.userId;
    const { hours } = req.body;

    if (typeof hours !== 'number' || hours <= 0) {
      return res.status(400).json({ error: 'hours debe ser un número positivo' });
    }

    // Obtener datos actuales del usuario
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        streamingHours: true,
        _count: {
          select: {
            followedBy: true,
          },
        },
      },
    });

    if (!user) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    const currentHours = user.streamingHours || 0;
    const followers = user._count.followedBy;

    // Calcular nivel antes de actualizar
    const levelBefore = calculateLevel(followers, currentHours);

    // Actualizar horas
    const newTotal = currentHours + hours;

    await prisma.user.update({
      where: { id: userId },
      data: {
        streamingHours: newTotal,
      },
    });

    // Calcular nivel después de actualizar
    const levelAfter = calculateLevel(followers, newTotal);

    // Verificar si subió de nivel
    const levelUp = levelAfter.levelOrder > levelBefore.levelOrder;

    return res.status(200).json({
      success: true,
      newTotal,
      levelUp,
      newLevel: levelUp ? {
        id: levelAfter.id,
        name: levelAfter.name,
        minFollowers: levelAfter.minFollowers,
        maxFollowers: levelAfter.maxFollowers,
        minHours: levelAfter.minHours,
        maxHours: levelAfter.maxHours,
        rewards: levelAfter.rewards,
      } : null,
    });
  } catch (error) {
    console.error('Error al actualizar horas:', error);
    res.status(500).json({ error: 'Error al actualizar horas' });
  }
});

// GET /api/streamer/stats - Obtener estadísticas del streamer
router.get('/stats', async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'No autenticado' });
    }

    const userId = req.user.userId;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        streamingHours: true,
        _count: {
          select: {
            followedBy: true,
          },
        },
        stream: {
          select: {
            viewers: true,
          },
        },
      },
    });

    if (!user) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    // Calcular promedio de viewers (esto es simplificado, idealmente guardarías histórico)
    const currentViewers = user.stream?.viewers || 0;

    return res.status(200).json({
      success: true,
      followers: user._count.followedBy,
      streamingHours: user.streamingHours || 0,
      totalViewers: currentViewers, // Simplificado
      averageViewers: currentViewers, // Simplificado
    });
  } catch (error) {
    console.error('Error al obtener estadísticas:', error);
    res.status(500).json({ error: 'Error al obtener estadísticas' });
  }
});

export default router;
