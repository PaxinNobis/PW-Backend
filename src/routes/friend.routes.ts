import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const router = Router();
const prisma = new PrismaClient();

// GET /api/friend - Lista de amigos
router.get('/', async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'No autenticado' });
    }

    const friendships = await prisma.friendship.findMany({
      where: { userId: req.user.userId },
      include: {
        friend: {
          select: {
            id: true,
            name: true,
            email: true,
            pfp: true,
            online: true,
            lastSeen: true,
          },
        },
      },
    });

    return res.status(200).json({ success: true, friends: friendships.map(f => f.friend) });
  } catch (error) {
    console.error('Error al obtener amigos:', error);
    res.status(500).json({ error: 'Error al obtener amigos' });
  }
});

// POST /api/friend/request - Enviar solicitud de amistad
router.post('/request', async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'No autenticado' });
    }

    const { friendId } = req.body;

    if (!friendId) {
      return res.status(400).json({ error: 'friendId es requerido' });
    }

    if (friendId === req.user.userId) {
      return res.status(400).json({ error: 'No puedes enviarte solicitud a ti mismo' });
    }

    // Verificar que no exista ya una solicitud
    const existing = await prisma.friendRequest.findFirst({
      where: {
        OR: [
          { fromUserId: req.user.userId, toUserId: friendId },
          { fromUserId: friendId, toUserId: req.user.userId },
        ],
        status: 'pending',
      },
    });

    if (existing) {
      return res.status(400).json({ error: 'Ya existe una solicitud pendiente' });
    }

    const request = await prisma.friendRequest.create({
      data: {
        fromUserId: req.user.userId,
        toUserId: friendId,
      },
    });

    return res.status(200).json({ success: true, requestId: request.id });
  } catch (error) {
    console.error('Error al enviar solicitud:', error);
    res.status(500).json({ error: 'Error al enviar solicitud' });
  }
});

// GET /api/friend/requests - Obtener solicitudes
router.get('/requests', async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'No autenticado' });
    }

    const [received, sent] = await Promise.all([
      prisma.friendRequest.findMany({
        where: { toUserId: req.user.userId, status: 'pending' },
        include: {
          fromUser: {
            select: {
              id: true,
              name: true,
              pfp: true,
            },
          },
        },
      }),
      prisma.friendRequest.findMany({
        where: { fromUserId: req.user.userId, status: 'pending' },
        include: {
          toUser: {
            select: {
              id: true,
              name: true,
              pfp: true,
            },
          },
        },
      }),
    ]);

    return res.status(200).json({
      success: true,
      received: received.map(r => ({
        id: r.id,
        from: r.fromUser,
        date: r.createdAt,
      })),
      sent: sent.map(r => ({
        id: r.id,
        to: r.toUser,
        date: r.createdAt,
      })),
    });
  } catch (error) {
    console.error('Error al obtener solicitudes:', error);
    res.status(500).json({ error: 'Error al obtener solicitudes' });
  }
});

// POST /api/friend/accept/:requestId - Aceptar solicitud
router.post('/accept/:requestId', async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'No autenticado' });
    }

    const { requestId } = req.params;

    const request = await prisma.friendRequest.findUnique({
      where: { id: requestId },
    });

    if (!request || request.toUserId !== req.user.userId) {
      return res.status(404).json({ error: 'Solicitud no encontrada' });
    }

    // Crear amistad bidireccional
    await prisma.$transaction([
      prisma.friendship.create({
        data: {
          userId: request.fromUserId,
          friendId: request.toUserId,
        },
      }),
      prisma.friendship.create({
        data: {
          userId: request.toUserId,
          friendId: request.fromUserId,
        },
      }),
      prisma.friendRequest.update({
        where: { id: requestId },
        data: {
          status: 'accepted',
          respondedAt: new Date(),
        },
      }),
    ]);

    return res.status(200).json({ success: true });
  } catch (error) {
    console.error('Error al aceptar solicitud:', error);
    res.status(500).json({ error: 'Error al aceptar solicitud' });
  }
});

// POST /api/friend/reject/:requestId - Rechazar solicitud
router.post('/reject/:requestId', async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'No autenticado' });
    }

    const { requestId } = req.params;

    const request = await prisma.friendRequest.findUnique({
      where: { id: requestId },
    });

    if (!request || request.toUserId !== req.user.userId) {
      return res.status(404).json({ error: 'Solicitud no encontrada' });
    }

    await prisma.friendRequest.update({
      where: { id: requestId },
      data: {
        status: 'rejected',
        respondedAt: new Date(),
      },
    });

    return res.status(200).json({ success: true });
  } catch (error) {
    console.error('Error al rechazar solicitud:', error);
    res.status(500).json({ error: 'Error al rechazar solicitud' });
  }
});

// DELETE /api/friend/:friendId - Eliminar amigo
router.delete('/:friendId', async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'No autenticado' });
    }

    const { friendId } = req.params;

    await prisma.$transaction([
      prisma.friendship.deleteMany({
        where: {
          userId: req.user.userId,
          friendId,
        },
      }),
      prisma.friendship.deleteMany({
        where: {
          userId: friendId,
          friendId: req.user.userId,
        },
      }),
    ]);

    return res.status(200).json({ success: true });
  } catch (error) {
    console.error('Error al eliminar amigo:', error);
    res.status(500).json({ error: 'Error al eliminar amigo' });
  }
});

export default router;
