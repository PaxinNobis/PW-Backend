import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const router = Router();
const prisma = new PrismaClient();

// GET /api/points - Obtener puntos totales y por streamer
router.get('/', async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'No autenticado' });
    }

    const userPoints = await prisma.userPoints.findMany({
      where: { userId: req.user.userId },
      include: {
        streamer: {
          select: {
            id: true,
            name: true,
            pfp: true,
          },
        },
      },
      orderBy: { points: 'desc' },
    });

    const total = userPoints.reduce((sum, up) => sum + up.points, 0);

    return res.status(200).json({
      success: true,
      total,
      byStreamer: userPoints.map(up => ({
        streamerId: up.streamerId,
        streamerName: up.streamer.name,
        streamerPfp: up.streamer.pfp,
        points: up.points,
        lastEarned: up.lastUpdated,
      })),
    });
  } catch (error) {
    console.error('Error al obtener puntos:', error);
    res.status(500).json({ error: 'Error al obtener puntos' });
  }
});

// POST /api/points/earn - Ganar puntos por una acción
router.post('/earn', async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'No autenticado' });
    }

    const { streamerId, action, amount } = req.body;

    if (!streamerId || !action || !amount) {
      return res.status(400).json({ error: 'streamerId, action y amount son requeridos' });
    }

    // Verificar que el streamer existe
    const streamer = await prisma.user.findUnique({
      where: { id: streamerId },
    });

    if (!streamer) {
      return res.status(404).json({ error: 'Streamer no encontrado' });
    }

    // Actualizar o crear puntos del usuario para este streamer
    const userPoints = await prisma.userPoints.upsert({
      where: {
        userId_streamerId: {
          userId: req.user.userId,
          streamerId,
        },
      },
      create: {
        userId: req.user.userId,
        streamerId,
        points: amount,
      },
      update: {
        points: {
          increment: amount,
        },
        lastUpdated: new Date(),
      },
    });

    // Registrar en el historial
    await prisma.pointsHistory.create({
      data: {
        userId: req.user.userId,
        streamerId,
        action,
        points: amount,
      },
    });

    // Actualizar puntos totales del usuario
    await prisma.user.update({
      where: { id: req.user.userId },
      data: {
        points: {
          increment: amount,
        },
      },
    });

    return res.status(200).json({
      success: true,
      pointsEarned: amount,
      newTotal: userPoints.points,
    });
  } catch (error) {
    console.error('Error al ganar puntos:', error);
    res.status(500).json({ error: 'Error al ganar puntos' });
  }
});

// GET /api/points/history - Obtener historial de puntos
router.get('/history', async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'No autenticado' });
    }

    const { streamerId, page = '1', limit = '10' } = req.query;
    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const skip = (pageNum - 1) * limitNum;

    const where: any = { userId: req.user.userId };
    if (streamerId) {
      where.streamerId = streamerId;
    }

    const [history, total] = await Promise.all([
      prisma.pointsHistory.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limitNum,
      }),
      prisma.pointsHistory.count({ where }),
    ]);

    return res.status(200).json({
      success: true,
      history: history.map(h => ({
        id: h.id,
        action: h.action,
        points: h.points,
        streamerId: h.streamerId,
        date: h.createdAt,
      })),
      total,
      page: pageNum,
      totalPages: Math.ceil(total / limitNum),
    });
  } catch (error) {
    console.error('Error al obtener historial:', error);
    res.status(500).json({ error: 'Error al obtener historial' });
  }
});

export default router;
