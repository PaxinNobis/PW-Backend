import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const router = Router();
const prisma = new PrismaClient();

// POST /api/viewer/join/:streamId - Unirse como viewer a un stream
router.post('/join/:streamId', async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'No autenticado' });
    }

    const { streamId } = req.params;

    // Verificar que el stream existe
    const stream = await prisma.stream.findUnique({
      where: { id: streamId },
    });

    if (!stream) {
      return res.status(404).json({ error: 'Stream no encontrado' });
    }

    // Crear o actualizar el viewer activo
    await prisma.activeViewer.upsert({
      where: {
        streamId_userId: {
          streamId,
          userId: req.user.userId,
        },
      },
      create: {
        streamId,
        userId: req.user.userId,
      },
      update: {
        lastHeartbeat: new Date(),
      },
    });

    // Obtener el conteo actualizado de viewers
    const viewerCount = await prisma.activeViewer.count({
      where: { streamId },
    });

    // Actualizar el contador en el stream
    await prisma.stream.update({
      where: { id: streamId },
      data: { viewers: viewerCount },
    });

    // Obtener lista de viewers
    const viewers = await prisma.activeViewer.findMany({
      where: { streamId },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            pfp: true,
          },
        },
      },
    });

    return res.status(200).json({
      success: true,
      currentViewers: viewerCount,
      viewersList: viewers.map(v => ({
        id: v.user.id,
        name: v.user.name,
        pfp: v.user.pfp,
        joinedAt: v.joinedAt,
      })),
    });
  } catch (error) {
    console.error('Error al unirse al stream:', error);
    res.status(500).json({ error: 'Error al unirse al stream' });
  }
});

// POST /api/viewer/leave/:streamId - Salir como viewer de un stream
router.post('/leave/:streamId', async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'No autenticado' });
    }

    const { streamId } = req.params;

    // Eliminar el viewer activo
    await prisma.activeViewer.delete({
      where: {
        streamId_userId: {
          streamId,
          userId: req.user.userId,
        },
      },
    }).catch(() => {
      // Ignorar si no existe
    });

    // Obtener el conteo actualizado de viewers
    const viewerCount = await prisma.activeViewer.count({
      where: { streamId },
    });

    // Actualizar el contador en el stream
    await prisma.stream.update({
      where: { id: streamId },
      data: { viewers: viewerCount },
    });

    return res.status(200).json({
      success: true,
      currentViewers: viewerCount,
    });
  } catch (error) {
    console.error('Error al salir del stream:', error);
    res.status(500).json({ error: 'Error al salir del stream' });
  }
});

// GET /api/viewer/viewers/:streamId - Obtener lista de viewers de un stream
router.get('/viewers/:streamId', async (req: Request, res: Response) => {
  try {
    const { streamId } = req.params;

    const viewers = await prisma.activeViewer.findMany({
      where: { streamId },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            pfp: true,
          },
        },
      },
      orderBy: { joinedAt: 'asc' },
    });

    return res.status(200).json({
      success: true,
      viewers: viewers.map(v => ({
        id: v.user.id,
        name: v.user.name,
        pfp: v.user.pfp,
        joinedAt: v.joinedAt,
      }))
    });
  } catch (error) {
    console.error('Error al obtener viewers:', error);
    res.status(500).json({ error: 'Error al obtener viewers' });
  }
});

// GET /api/viewer/viewer-count/:streamId - Obtener contador de viewers
router.get('/viewer-count/:streamId', async (req: Request, res: Response) => {
  try {
    const { streamId } = req.params;

    const count = await prisma.activeViewer.count({
      where: { streamId },
    });

    return res.status(200).json({ success: true, count });
  } catch (error) {
    console.error('Error al obtener conteo de viewers:', error);
    res.status(500).json({ error: 'Error al obtener conteo de viewers' });
  }
});

// POST /api/viewer/heartbeat/:streamId - Actualizar heartbeat del viewer
router.post('/heartbeat/:streamId', async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'No autenticado' });
    }

    const { streamId } = req.params;

    await prisma.activeViewer.update({
      where: {
        streamId_userId: {
          streamId,
          userId: req.user.userId,
        },
      },
      data: {
        lastHeartbeat: new Date(),
      },
    });

    return res.status(200).json({ success: true });
  } catch (error) {
    console.error('Error al actualizar heartbeat:', error);
    res.status(500).json({ error: 'Error al actualizar heartbeat' });
  }
});

export default router;
