import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const router = Router();
const prisma = new PrismaClient();

// GET /api/panel/analytics - Obtener analíticas del streamer
router.get('/analytics', async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'No autenticado' });
    }

    const user = await prisma.user.findUnique({
      where: { id: req.user.userId },
      select: {
        streamingHours: true,
        monedasRecibidas: true
      }
    });

    if (!user) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    // Mantener estructura de respuesta para compatibilidad frontend
    const analytics = {
      id: 'user-analytics', // Dummy ID
      streamerId: req.user.userId,
      horasTransmitidas: user.streamingHours || 0,
      monedasRecibidas: user.monedasRecibidas || 0
    };

    return res.status(200).json({ success: true, analytics });
  } catch (error) {
    console.error('Error al obtener analíticas:', error);
    res.status(500).json({ error: 'Error al obtener analíticas' });
  }
});

// GET /api/panel/gifts - Obtener regalos del streamer
router.get('/gifts', async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'No autenticado' });
    }

    const gifts = await prisma.gift.findMany({
      where: { streamerId: req.user.userId },
      orderBy: { costo: 'asc' },
    });

    return res.status(200).json({ success: true, gifts });
  } catch (error) {
    console.error('Error al obtener regalos:', error);
    res.status(500).json({ error: 'Error al obtener regalos' });
  }
});

// POST /api/panel/gifts - Crear nuevo regalo
router.post('/gifts', async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'No autenticado' });
    }

    const { nombre, costo, puntos } = req.body;

    if (!nombre || costo === undefined || puntos === undefined) {
      return res.status(400).json({ error: 'Nombre, costo y puntos son requeridos' });
    }

    const gift = await prisma.gift.create({
      data: {
        nombre,
        costo: Number(costo),
        puntos: Number(puntos),
        streamerId: req.user.userId,
      },
    });

    return res.status(201).json({ success: true, gift });
  } catch (error) {
    console.error('Error al crear regalo:', error);
    res.status(500).json({ error: 'Error al crear regalo' });
  }
});

// PUT /api/panel/gifts/:id - Editar regalo
router.put('/gifts/:id', async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'No autenticado' });
    }

    const { id } = req.params;
    const { nombre, costo, puntos } = req.body;

    // Verificar que el regalo pertenece al streamer
    const existingGift = await prisma.gift.findUnique({
      where: { id },
    });

    if (!existingGift || existingGift.streamerId !== req.user.userId) {
      return res.status(404).json({ error: 'Regalo no encontrado' });
    }

    const updatedGift = await prisma.gift.update({
      where: { id },
      data: {
        nombre,
        costo: Number(costo),
        puntos: Number(puntos),
      },
    });

    return res.status(200).json({ success: true, gift: updatedGift });
  } catch (error) {
    console.error('Error al editar regalo:', error);
    res.status(500).json({ error: 'Error al editar regalo' });
  }
});

// DELETE /api/panel/gifts/:id - Eliminar regalo
router.delete('/gifts/:id', async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'No autenticado' });
    }

    const { id } = req.params;

    // Verificar que el regalo pertenece al streamer
    const existingGift = await prisma.gift.findUnique({
      where: { id },
    });

    if (!existingGift || existingGift.streamerId !== req.user.userId) {
      return res.status(404).json({ error: 'Regalo no encontrado' });
    }

    await prisma.gift.delete({
      where: { id },
    });

    return res.status(200).json({ success: true, message: 'Regalo eliminado exitosamente' });
  } catch (error) {
    console.error('Error al eliminar regalo:', error);
    res.status(500).json({ error: 'Error al eliminar regalo' });
  }
});

// GET /api/panel/loyalty-levels - Obtener niveles de lealtad
router.get('/loyalty-levels', async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'No autenticado' });
    }

    const levels = await prisma.loyaltyLevel.findMany({
      where: { streamerId: req.user.userId },
      orderBy: { puntosRequeridos: 'asc' },
    });

    return res.status(200).json({ success: true, levels });
  } catch (error) {
    console.error('Error al obtener niveles de lealtad:', error);
    res.status(500).json({ error: 'Error al obtener niveles de lealtad' });
  }
});

// PUT /api/panel/loyalty-levels - Actualizar/crear niveles de lealtad
router.put('/loyalty-levels', async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'No autenticado' });
    }

    const { levels } = req.body;

    if (!Array.isArray(levels)) {
      return res.status(400).json({ error: 'Se requiere un array de niveles' });
    }

    const userId = req.user.userId;

    // Eliminar niveles existentes
    await prisma.loyaltyLevel.deleteMany({
      where: { streamerId: userId },
    });

    // Crear nuevos niveles
    const createdLevels = await prisma.loyaltyLevel.createMany({
      data: levels.map((level: any) => ({
        nombre: level.nombre,
        puntosRequeridos: Number(level.puntosRequeridos),
        recompensa: level.recompensa,
        streamerId: userId,
      })),
    });

    // Obtener los niveles creados
    const newLevels = await prisma.loyaltyLevel.findMany({
      where: { streamerId: userId },
      orderBy: { puntosRequeridos: 'asc' },
    });

    return res.status(200).json({ success: true, levels: newLevels });
  } catch (error) {
    console.error('Error al actualizar niveles de lealtad:', error);
    res.status(500).json({ error: 'Error al actualizar niveles de lealtad' });
  }
});

export default router;
