import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const router = Router();
const prisma = new PrismaClient();

// GET /api/clip - Obtener clips del streamer
router.get('/', async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'No autenticado' });
    }

    const { page = '1', limit = '10' } = req.query;
    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const skip = (pageNum - 1) * limitNum;

    const [clips, total] = await Promise.all([
      prisma.clip.findMany({
        where: { streamerId: req.user.userId },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limitNum,
      }),
      prisma.clip.count({ where: { streamerId: req.user.userId } }),
    ]);

    return res.status(200).json({
      success: true,
      clips,
      total,
      page: pageNum,
      totalPages: Math.ceil(total / limitNum),
    });
  } catch (error) {
    console.error('Error al obtener clips:', error);
    res.status(500).json({ error: 'Error al obtener clips' });
  }
});

// POST /api/clip - Crear clip
router.post('/', async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'No autenticado' });
    }

    const { url, title, thumbnail, duration } = req.body;

    if (!url || !title || !thumbnail) {
      return res.status(400).json({ error: 'url, title y thumbnail son requeridos' });
    }

    const clip = await prisma.clip.create({
      data: {
        streamerId: req.user.userId,
        url,
        title,
        thumbnail,
        duration: duration || 0,
      },
    });

    return res.status(201).json({ success: true, clip });
  } catch (error) {
    console.error('Error al crear clip:', error);
    res.status(500).json({ error: 'Error al crear clip' });
  }
});

// PUT /api/clip/:id - Editar clip
router.put('/:id', async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'No autenticado' });
    }

    const { id } = req.params;
    const { title, thumbnail } = req.body;

    const clip = await prisma.clip.findUnique({ where: { id } });

    if (!clip || clip.streamerId !== req.user.userId) {
      return res.status(404).json({ error: 'Clip no encontrado' });
    }

    const updated = await prisma.clip.update({
      where: { id },
      data: { title, thumbnail },
    });

    return res.status(200).json({ success: true, clip: updated });
  } catch (error) {
    console.error('Error al editar clip:', error);
    res.status(500).json({ error: 'Error al editar clip' });
  }
});

// DELETE /api/clip/:id - Eliminar clip
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'No autenticado' });
    }

    const { id } = req.params;

    const clip = await prisma.clip.findUnique({ where: { id } });

    if (!clip || clip.streamerId !== req.user.userId) {
      return res.status(404).json({ error: 'Clip no encontrado' });
    }

    await prisma.clip.delete({ where: { id } });

    return res.status(200).json({ success: true });
  } catch (error) {
    console.error('Error al eliminar clip:', error);
    res.status(500).json({ error: 'Error al eliminar clip' });
  }
});

// POST /api/clip/:id/view - Registrar vista
router.post('/:id/view', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const clip = await prisma.clip.update({
      where: { id },
      data: { views: { increment: 1 } },
    });

    return res.status(200).json({ success: true, newViewCount: clip.views });
  } catch (error) {
    console.error('Error al registrar vista:', error);
    res.status(500).json({ error: 'Error al registrar vista' });
  }
});

// GET /api/clip/trending - Clips populares
router.get('/trending', async (req: Request, res: Response) => {
  try {
    const { limit = '10' } = req.query;
    const limitNum = parseInt(limit as string);

    const clips = await prisma.clip.findMany({
      orderBy: { views: 'desc' },
      take: limitNum,
      include: {
        streamer: {
          select: {
            id: true,
            name: true,
            pfp: true,
          },
        },
      },
    });

    return res.status(200).json({ success: true, clips });
  } catch (error) {
    console.error('Error al obtener clips trending:', error);
    res.status(500).json({ error: 'Error al obtener clips trending' });
  }
});

export default router;
