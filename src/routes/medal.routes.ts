import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const router = Router();
const prisma = new PrismaClient();

// GET /api/medal/user - Obtener medallas del usuario
router.get('/user', async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'No autenticado' });
    }

    const medals = await prisma.userMedal.findMany({
      where: { userId: req.user.userId },
      include: {
        medal: {
          include: {
            streamer: {
              select: { id: true, name: true },
            },
          },
        },
      },
      orderBy: { earnedAt: 'desc' },
    });

    return res.status(200).json({
      success: true,
      medals: medals.map(um => ({
        id: um.medal.id,
        level: um.medal.level,
        name: um.medal.name,
        description: um.medal.description,
        earnedDate: um.earnedAt,
        streamer: um.medal.streamer,
      }))
    });
  } catch (error) {
    console.error('Error al obtener medallas:', error);
    res.status(500).json({ error: 'Error al obtener medallas' });
  }
});

// GET /api/medal/available - Obtener medallas disponibles del streamer
router.get('/available', async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'No autenticado' });
    }

    const medals = await prisma.medal.findMany({
      where: { streamerId: req.user.userId },
      orderBy: { createdAt: 'desc' },
    });

    return res.status(200).json({
      success: true,
      medals: medals.map(m => ({
        id: m.id,
        level: m.level,
        name: m.name,
        description: m.description,
        requirements: {
          min_messages: m.minMessages,
          min_points: m.minPoints,
        },
      }))
    });
  } catch (error) {
    console.error('Error al obtener medallas disponibles:', error);
    res.status(500).json({ error: 'Error al obtener medallas disponibles' });
  }
});

// POST /api/medal - Crear medalla
router.post('/', async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'No autenticado' });
    }

    const { level, name, description, requirements } = req.body;

    if (!level || !name || !description) {
      return res.status(400).json({ error: 'level, name y description son requeridos' });
    }

    const medal = await prisma.medal.create({
      data: {
        streamerId: req.user.userId,
        level,
        name,
        description,
        minMessages: requirements?.min_messages || 0,
        minPoints: requirements?.min_points || 0,
      },
    });

    res.status(201).json(medal);
  } catch (error) {
    console.error('Error al crear medalla:', error);
    res.status(500).json({ error: 'Error al crear medalla' });
  }
});

// PUT /api/medal/:id - Editar medalla
router.put('/:id', async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'No autenticado' });
    }

    const { id } = req.params;
    const { level, name, description, requirements } = req.body;

    const medal = await prisma.medal.findUnique({ where: { id } });

    if (!medal || medal.streamerId !== req.user.userId) {
      return res.status(404).json({ error: 'Medalla no encontrada' });
    }

    const updated = await prisma.medal.update({
      where: { id },
      data: {
        level,
        name,
        description,
        minMessages: requirements?.min_messages,
        minPoints: requirements?.min_points,
      },
    });

    return res.status(200).json({ success: true, medal: updated });
  } catch (error) {
    console.error('Error al editar medalla:', error);
    res.status(500).json({ error: 'Error al editar medalla' });
  }
});

// DELETE /api/medal/:id - Eliminar medalla
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'No autenticado' });
    }

    const { id } = req.params;

    const medal = await prisma.medal.findUnique({ where: { id } });

    if (!medal || medal.streamerId !== req.user.userId) {
      return res.status(404).json({ error: 'Medalla no encontrada' });
    }

    await prisma.medal.delete({ where: { id } });

    return res.status(200).json({ success: true });
  } catch (error) {
    console.error('Error al eliminar medalla:', error);
    res.status(500).json({ error: 'Error al eliminar medalla' });
  }
});

// POST /api/medal/award - Otorgar medalla a un usuario
router.post('/award', async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'No autenticado' });
    }

    const { userId, medalId } = req.body;

    if (!userId || !medalId) {
      return res.status(400).json({ error: 'userId y medalId son requeridos' });
    }

    const medal = await prisma.medal.findUnique({ where: { id: medalId } });

    if (!medal || medal.streamerId !== req.user.userId) {
      return res.status(404).json({ error: 'Medalla no encontrada' });
    }

    await prisma.userMedal.create({
      data: {
        userId,
        medalId,
        streamerId: req.user.userId,
      },
    });

    return res.status(200).json({ success: true });
  } catch (error) {
    console.error('Error al otorgar medalla:', error);
    res.status(500).json({ error: 'Error al otorgar medalla' });
  }
});

export default router;
