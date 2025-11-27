import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const router = Router();
const prisma = new PrismaClient();

// GET /api/user/following - Obtener lista de streamers que el usuario sigue
router.get('/following', async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'No autenticado' });
    }

    const user = await prisma.user.findUnique({
      where: { id: req.user.userId },
      include: {
        following: {
          select: {
            id: true,
            name: true,
            email: true,
            stream: {
              select: {
                id: true,
                title: true,
                thumbnail: true,
                viewers: true,
                isLive: true,
              },
            },
          },
        },
      },
    });

    if (!user) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    return res.status(200).json({ 
      success: true,
      following: user.following 
    });
  } catch (error) {
    console.error('Error al obtener following:', error);
    res.status(500).json({ error: 'Error al obtener lista de seguidos' });
  }
});

// POST /api/user/follow/:identifier - Seguir o dejar de seguir a un streamer (por ID, email o nombre)
router.post('/follow/:identifier', async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'No autenticado' });
    }

    const { identifier } = req.params;
    const userId = req.user.userId;

    // Buscar por ID, email o nombre
    const streamer = await prisma.user.findFirst({
      where: {
        OR: [
          { id: identifier },
          { email: identifier },
          { name: identifier },
        ],
      },
    });

    if (!streamer) {
      return res.status(404).json({ error: 'Streamer no encontrado' });
    }

    const streamerId = streamer.id;

    // Verificar si ya sigue al streamer
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        following: true,
      },
    });

    const isFollowing = user?.following.some((f) => f.id === streamerId);

    if (isFollowing) {
      // Dejar de seguir
      await prisma.user.update({
        where: { id: userId },
        data: {
          following: {
            disconnect: { id: streamerId },
          },
        },
      });

      return res.status(200).json({ 
        success: true,
        message: 'Has dejado de seguir al streamer', 
        isFollowing: false 
      });
    } else {
      // Seguir
      await prisma.user.update({
        where: { id: userId },
        data: {
          following: {
            connect: { id: streamerId },
          },
        },
      });

      return res.status(200).json({ 
        success: true,
        message: 'Ahora sigues al streamer', 
        isFollowing: true 
      });
    }
  } catch (error) {
    console.error('Error al seguir/dejar de seguir:', error);
    res.status(500).json({ error: 'Error al procesar la acción' });
  }
});

export default router;
