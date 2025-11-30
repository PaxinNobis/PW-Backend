import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { authMiddleware } from '../middleware/auth.middleware';
import { updateUserLoyaltyLevel, calculateGlobalLevel } from '../utils/level.utils';
import { broadcastToRoom } from '../services/websocket.service';

const router = Router();
const prisma = new PrismaClient();

// POST /api/gifts/send - Enviar un regalo
router.post('/send', authMiddleware, async (req: Request, res: Response) => {
    try {
        if (!req.user) {
            return res.status(401).json({ error: 'No autenticado' });
        }

        const { giftId, streamerId } = req.body;

        if (!giftId || !streamerId) {
            return res.status(400).json({ error: 'Faltan datos: giftId y streamerId son requeridos' });
        }

        // 1. Obtener el regalo y validar
        const gift = await prisma.gift.findUnique({
            where: { id: giftId },
        });

        if (!gift) {
            return res.status(404).json({ error: 'Regalo no encontrado' });
        }

        if (gift.streamerId !== streamerId) {
            return res.status(400).json({ error: 'El regalo no pertenece al streamer indicado' });
        }

        // 2. Obtener el usuario y verificar saldo
        const user = await prisma.user.findUnique({
            where: { id: req.user.userId },
        });

        if (!user) {
            return res.status(404).json({ error: 'Usuario no encontrado' });
        }

        if ((user.coins || 0) < gift.costo) {
            return res.status(400).json({
                error: `Saldo insuficiente. Tienes ${user.coins || 0} monedas, pero el regalo cuesta ${gift.costo}.`
            });
        }

        // 3. Obtener el streamer y su stream activo
        const streamer = await prisma.user.findUnique({
            where: { id: streamerId },
            include: {
                streams: {
                    where: { isLive: true },
                    take: 1,
                }
            }
        });

        if (!streamer) {
            return res.status(404).json({ error: 'Streamer no encontrado' });
        }

        const activeStream = streamer.streams[0];

        // 4. Ejecutar transacción (usando transacción de Prisma para atomicidad)
        const result = await prisma.$transaction(async (tx) => {
            // a. Descontar monedas al usuario y sumar puntos globales
            const updatedUser = await tx.user.update({
                where: { id: user.id },
                data: {
                    coins: { decrement: gift.costo },
                    points: { increment: gift.puntos }, // Puntos globales
                },
            });

            // Calcular y actualizar nivel global si cambia
            const newGlobalLevel = calculateGlobalLevel(updatedUser.points || 0);
            if (newGlobalLevel !== updatedUser.level) {
                await tx.user.update({
                    where: { id: user.id },
                    data: { level: newGlobalLevel }
                });
            }

            // b. Actualizar o crear puntos del usuario para este streamer (UserPoints)
            const userPoints = await tx.userPoints.upsert({
                where: {
                    userId_streamerId: {
                        userId: user.id,
                        streamerId: streamerId,
                    },
                },
                create: {
                    userId: user.id,
                    streamerId: streamerId,
                    points: gift.puntos,
                },
                update: {
                    points: { increment: gift.puntos },
                    lastUpdated: new Date(),
                },
            });

            // c. Actualizar analíticas del streamer (monedasRecibidas)
            await tx.analytics.upsert({
                where: { streamerId: streamerId },
                create: {
                    streamerId: streamerId,
                    monedasRecibidas: gift.costo,
                    horasTransmitidas: 0,
                },
                update: {
                    monedasRecibidas: { increment: gift.costo },
                },
            });

            // d. Registrar en historial de puntos
            await tx.pointsHistory.create({
                data: {
                    userId: user.id,
                    streamerId: streamerId,
                    action: `gift_sent:${gift.nombre}`,
                    points: gift.puntos,
                },
            });

            return { updatedUser, userPoints };
        });

        // 5. Actualizar nivel de lealtad
        const loyaltyLevels = await prisma.loyaltyLevel.findMany({
            where: { streamerId },
            orderBy: { puntosRequeridos: 'asc' },
        });

        const { levelChanged, newLevel } = await updateUserLoyaltyLevel(
            prisma,
            user.id,
            streamerId,
            result.userPoints.points,
            loyaltyLevels
        );

        // 6. Emitir evento WebSocket para notificar a todos en el stream
        if (activeStream) {
            broadcastToRoom(activeStream.id, {
                type: 'gift',
                data: {
                    giftName: gift.nombre,
                    giftCost: gift.costo,
                    senderName: user.name,
                    senderId: user.id,
                    streamerName: streamer.name,
                    streamerId: streamer.id,
                    timestamp: new Date().toISOString(),
                }
            });
        }

        return res.status(200).json({
            success: true,
            message: `Regalo ${gift.nombre} enviado exitosamente`,
            coinsSpent: gift.costo,
            pointsEarned: gift.puntos,
            newBalance: result.updatedUser.coins,
            newLevel: newLevel,
            levelChanged: levelChanged,
        });

    } catch (error) {
        console.error('Error al enviar regalo:', error);
        res.status(500).json({ error: 'Error al enviar regalo' });
    }
});

export default router;
