import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import jwt from 'jsonwebtoken';
import { createNotification } from '../services/notification.service';

const router = Router();
const prisma = new PrismaClient();

// Definición de los 12 niveles de streamer
const LEVELS = [
  { id: 1, name: 'Astronauta Novato', minFollowers: 0, maxFollowers: 100, minHours: 0, maxHours: 50, rewards: 'Badge de Novato', levelOrder: 1 },
  { id: 2, name: 'Explorador Planetario', minFollowers: 0, maxFollowers: 500, minHours: 51, maxHours: 150, rewards: 'Badge de Explorador + Emote personalizado', levelOrder: 2 },
  { id: 3, name: 'Piloto Lunar', minFollowers: 0, maxFollowers: 1500, minHours: 151, maxHours: 300, rewards: 'Badge de Piloto + 2 Emotes personalizados', levelOrder: 3 },
  { id: 4, name: 'Comandante Estelar', minFollowers: 0, maxFollowers: 5000, minHours: 301, maxHours: 500, rewards: 'Badge de Comandante + 3 Emotes + Sub-badges', levelOrder: 4 },
  { id: 5, name: 'Coronel Galáctico', minFollowers: 0, maxFollowers: 15000, minHours: 501, maxHours: 800, rewards: 'Badge de Coronel + 5 Emotes + Sub-badges + Chat personalizado', levelOrder: 5 },
  { id: 6, name: 'General Cósmico', minFollowers: 0, maxFollowers: 50000, minHours: 801, maxHours: 1200, rewards: 'Badge de General + 10 Emotes + Verificación', levelOrder: 6 },
  { id: 7, name: 'Señor Universal', minFollowers: 0, maxFollowers: 150000, minHours: 1201, maxHours: 2000, rewards: 'Badge de Señor + 15 Emotes + Partner', levelOrder: 7 },
  { id: 8, name: 'Emperador Multiversal', minFollowers: 0, maxFollowers: 500000, minHours: 2001, maxHours: 3000, rewards: 'Badge de Emperador + 20 Emotes + Prioridad soporte', levelOrder: 8 },
  { id: 9, name: 'Leyenda Omniversal', minFollowers: 0, maxFollowers: 1500000, minHours: 3001, maxHours: 4500, rewards: 'Badge de Leyenda + 30 Emotes + Eventos exclusivos', levelOrder: 9 },
  { id: 10, name: 'Entidad Primigenia', minFollowers: 0, maxFollowers: 5000000, minHours: 4501, maxHours: 6500, rewards: 'Badge de Entidad + 50 Emotes + Página destacada', levelOrder: 10 },
  { id: 11, name: 'Titán Dimensional', minFollowers: 0, maxFollowers: 10000000, minHours: 6501, maxHours: 9000, rewards: 'Badge de Titán + 75 Emotes + Merchandising oficial', levelOrder: 11 },
  { id: 12, name: 'Deidad Eterna', minFollowers: 0, maxFollowers: 25000000, minHours: 9001, maxHours: 12000, rewards: 'Badge de Deidad + 100 Emotes + Estatua en Hall of Fame', levelOrder: 12 },
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

    if (levelUp) {
      await createNotification({
        userId,
        type: 'level_up',
        title: '¡Subiste de Nivel!',
        message: `¡Felicidades! Has alcanzado el nivel ${levelAfter.name}.`,
        data: {
          oldLevel: levelBefore.name,
          newLevel: levelAfter.name,
          rewards: levelAfter.rewards
        }
      });
    }

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
        streams: {
          where: { isLive: true },
          select: {
            viewers: true,
          },
          take: 1
        }
      },
    });

    if (!user) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    const finalStreamingHours = user.streamingHours || 0;
    const currentViewers = user.streams[0]?.viewers || 0;

    return res.status(200).json({
      success: true,
      followers: user._count.followedBy,
      streamingHours: finalStreamingHours,
      totalViewers: currentViewers, // Simplificado
      averageViewers: currentViewers, // Simplificado
    });
  } catch (error) {
    console.error('Error al obtener estadísticas:', error);
    res.status(500).json({ error: 'Error al obtener estadísticas' });
  }
});

// GET /api/streamer/:streamerId/gifts - Obtener regalos de un streamer específico
router.get('/:streamerId/gifts', async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'No autenticado' });
    }

    const { streamerId } = req.params;

    const gifts = await prisma.gift.findMany({
      where: { streamerId },
      select: {
        id: true,
        nombre: true,
        costo: true,
        puntos: true,
      },
      orderBy: { costo: 'asc' },
    });

    return res.status(200).json({ success: true, gifts });
  } catch (error) {
    console.error('Error al obtener regalos del streamer:', error);
    res.status(500).json({ error: 'Error al obtener regalos del streamer' });
  }
});

// GET /api/streamer/:streamerId/loyalty-levels - Obtener niveles de lealtad de un streamer específico (Público)
router.get('/:streamerId/loyalty-levels', async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'No autenticado' });
    }

    const { streamerId } = req.params;

    const levels = await prisma.loyaltyLevel.findMany({
      where: { streamerId },
      orderBy: { puntosRequeridos: 'asc' },
      select: {
        nombre: true,
        puntosRequeridos: true,
        recompensa: true,
      }
    });

    return res.status(200).json({ success: true, levels });
  } catch (error) {
    console.error('Error al obtener niveles de lealtad del streamer:', error);
    res.status(500).json({ error: 'Error al obtener niveles de lealtad del streamer' });
  }
});

// PUT /api/streamer/settings - Actualizar configuración del stream
router.put('/settings', async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'No autenticado' });
    }

    const { title, gameId, tags, iframeUrl, isLive } = req.body;
    const userId = req.user.userId;

    // Cast decoded token to any to access userName or update interface if possible. Since I cannot see the interface definition easily, casting to any is safer for now or just removing the property access if not needed. Wait, the error says 'userName' does not exist on 'JwtPayload'. I will check where JwtPayload is defined or just cast it.
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(401).json({ error: 'Token no proporcionado' });
    }
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'default_secret') as any;
    const userName = decoded.userName || decoded.name || 'Streamer';

    // Buscar el stream activo actual (si existe)
    const activeStream = await prisma.stream.findFirst({
      where: {
        streamerId: userId,
        isLive: true
      },
    });

    let updatedStream;

    // CASO 1: Iniciar stream (isLive: true)
    if (isLive === true) {
      // Si ya hay un stream activo, terminarlo primero
      if (activeStream) {
        const now = new Date();
        const durationMs = activeStream.startedAt
          ? now.getTime() - activeStream.startedAt.getTime()
          : 0;
        const durationHours = durationMs / (1000 * 60 * 60);

        if (durationHours > 0) {
          await prisma.user.update({
            where: { id: userId },
            data: { streamingHours: { increment: durationHours } }
          });

        }

        await prisma.stream.update({
          where: { id: activeStream.id },
          data: {
            isLive: false,
            endedAt: now
          }
        });
      }

      // Obtener gameId: usar el proporcionado o el del stream anterior o el primero disponible
      let finalGameId = gameId;
      if (!finalGameId && activeStream) {
        finalGameId = activeStream.gameId;
      }

      // Validar que el juego exista
      if (finalGameId) {
        const gameExists = await prisma.game.findUnique({ where: { id: finalGameId } });
        if (!gameExists) {
          // Si el ID proporcionado no existe, buscar uno por defecto
          const defaultGame = await prisma.game.findFirst();
          finalGameId = defaultGame?.id;
        }
      } else {
        const defaultGame = await prisma.game.findFirst();
        finalGameId = defaultGame?.id;
      }

      if (!finalGameId) {
        return res.status(400).json({ error: 'No hay juegos disponibles en la base de datos. Contacta al administrador.' });
      }

      // Obtener nombre de usuario de forma segura
      const userAny = req.user as any;
      const streamTitle = title || `Stream de ${userAny.userName || 'Usuario'}`;

      // CREAR NUEVO STREAM con ID único
      updatedStream = await prisma.stream.create({
        data: {
          title: streamTitle,
          thumbnail: activeStream?.thumbnail || 'https://via.placeholder.com/300x200',
          streamerId: userId,
          gameId: finalGameId,
          isLive: true,
          startedAt: new Date(),
          iframeUrl: iframeUrl || activeStream?.iframeUrl || null,
          tags: tags ? {
            connect: tags.map((tagId: string) => ({ id: tagId }))
          } : undefined,
        },
        include: {
          game: true,
          tags: true,
        }
      });
    }
    // CASO 2: Detener stream (isLive: false)
    else if (isLive === false && activeStream) {
      const now = new Date();
      const durationMs = activeStream.startedAt
        ? now.getTime() - activeStream.startedAt.getTime()
        : 0;
      const durationHours = parseFloat((durationMs / (1000 * 60 * 60)).toFixed(2));

      if (durationHours > 0) {
        // Actualizar horas del usuario (Fuente de verdad única)
        await prisma.user.update({
          where: { id: userId },
          data: { streamingHours: { increment: durationHours } }
        });
      }

      updatedStream = await prisma.stream.update({
        where: { id: activeStream.id },
        data: {
          isLive: false,
          endedAt: now
        },
        include: {
          game: true,
          tags: true,
        }
      });
    }
    // CASO 3: Actualizar configuración sin cambiar estado de live
    else if (activeStream) {
      updatedStream = await prisma.stream.update({
        where: { id: activeStream.id },
        data: {
          title: title !== undefined ? title : undefined,
          gameId: gameId !== undefined ? gameId : undefined,
          iframeUrl: iframeUrl !== undefined ? iframeUrl : undefined,
          tags: tags ? {
            set: [],
            connect: tags.map((tagId: string) => ({ id: tagId })),
          } : undefined,
        },
        include: {
          game: true,
          tags: true,
        }
      });
    } else {
      return res.status(404).json({ error: 'No hay stream activo para actualizar' });
    }

    return res.status(200).json({
      success: true,
      message: 'Configuración de stream actualizada',
      stream: updatedStream,
    });
  } catch (error) {
    console.error('Error al actualizar configuración del stream:', error);
    // @ts-ignore
    console.error('Detalles del error:', error.message, error.code, error.meta);
    res.status(500).json({ error: 'Error al actualizar configuración del stream', details: (error as any).message });
  }
});

// GET /api/streamer/levels - Obtener todos los niveles globales de streamer
router.get('/levels', (req: Request, res: Response) => {
  res.json({
    success: true,
    levels: LEVELS
  });
});

export default router;
