import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { authMiddleware } from '../middleware/auth.middleware';
import { updateUserLoyaltyLevel } from '../utils/level.utils';

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

        // 3. Obtener el streamer
        const streamer = await prisma.user.findUnique({
            where: { id: streamerId },
        });

        if (!streamer) {
            return res.status(404).json({ error: 'Streamer no encontrado' });
        }

        // 4. Ejecutar transacción (usando transacción de Prisma para atomicidad)
        const result = await prisma.$transaction(async (tx) => {
            // a. Descontar monedas al usuario
            const updatedUser = await tx.user.update({
                where: { id: user.id },
                data: {
                    coins: { decrement: gift.costo },
                    points: { increment: gift.puntos }, // Puntos globales
                },
            });

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

            // d. Registrar transacción (historial de compra)
            // Nota: Asumimos que Transaction se usa para compras de monedas, pero podemos reusarlo o crear uno nuevo.
            // Dado que Transaction parece estar ligado a Stripe/Pagos reales, tal vez sea mejor usar PointsHistory o crear GiftHistory.
            // Por simplicidad y siguiendo el esquema existente, usaremos PointsHistory para el rastro de puntos y crearemos una notificación.

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

        // 5. Actualizar nivel de lealtad (fuera de la transacción para no bloquear si falla algo no crítico, o dentro si es crítico)
        // Lo hacemos fuera para usar la utilidad existente que maneja su propia lógica
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
