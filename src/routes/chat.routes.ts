import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { updateUserLoyaltyLevel, calculateGlobalLevel } from '../utils/level.utils';

const router = Router();
const prisma = new PrismaClient();

// POST /api/chat/send - Enviar mensaje al chat
router.post('/send', async (req: Request, res: Response) => {
    try {
        if (!req.user) {
            return res.status(401).json({ error: 'No autenticado' });
        }

        const { streamId, texto } = req.body;

        if (!streamId || !texto) {
            return res.status(400).json({ error: 'streamId y texto son requeridos' });
        }

        // Verificar que el stream existe
        const stream = await prisma.stream.findUnique({
            where: { id: streamId },
            select: { streamerId: true },
        });

        if (!stream) {
            return res.status(404).json({ error: 'Stream no encontrado' });
        }

        const userId = req.user.userId;

        // Ejecutar transacción para guardar mensaje y actualizar puntos
        const result = await prisma.$transaction(async (tx) => {
            // 1. Guardar mensaje
            const message = await tx.chatMessage.create({
                data: {
                    text: texto,
                    streamId,
                    authorId: userId,
                    streamOwnerId: stream.streamerId,
                },
                include: {
                    author: {
                        select: {
                            id: true,
                            name: true,
                            pfp: true,
                            level: true,
                        },
                    },
                },
            });

            // 2. Actualizar puntos del usuario (1 punto por mensaje)
            // a. Puntos globales
            const updatedUser = await tx.user.update({
                where: { id: userId },
                data: {
                    points: { increment: 1 },
                },
            });

            // b. Nivel global
            const newGlobalLevel = calculateGlobalLevel(updatedUser.points || 0);
            if (newGlobalLevel !== updatedUser.level) {
                await tx.user.update({
                    where: { id: userId },
                    data: { level: newGlobalLevel }
                });
            }

            // c. Puntos por streamer (UserPoints)
            const userPoints = await tx.userPoints.upsert({
                where: {
                    userId_streamerId: {
                        userId: userId,
                        streamerId: stream.streamerId,
                    },
                },
                create: {
                    userId: userId,
                    streamerId: stream.streamerId,
                    points: 1,
                },
                update: {
                    points: { increment: 1 },
                    lastUpdated: new Date(),
                },
            });

            return { message, userPoints };
        });

        // 3. Actualizar nivel de lealtad (fuera de transacción)
        const loyaltyLevels = await prisma.loyaltyLevel.findMany({
            where: { streamerId: stream.streamerId },
            orderBy: { puntosRequeridos: 'asc' },
        });

        const { newLevel } = await updateUserLoyaltyLevel(
            prisma,
            userId,
            stream.streamerId,
            result.userPoints.points,
            loyaltyLevels
        );

        return res.status(201).json({
            success: true,
            message: {
                id: result.message.id,
                streamId: result.message.streamId,
                userId: result.message.authorId,
                texto: result.message.text,
                hora: result.message.createdAt.toISOString(),
                user: {
                    id: result.message.author.id,
                    name: result.message.author.name,
                    pfp: result.message.author.pfp,
                    level: newLevel.level,
                    levelName: newLevel.name,
                },
                createdAt: result.message.createdAt,
            },
            pointsEarned: 1,
        });
    } catch (error) {
        console.error('Error al enviar mensaje:', error);
        res.status(500).json({ error: 'Error al enviar mensaje' });
    }
});

// GET /api/chat/messages/:streamId - Obtener historial de mensajes
router.get('/messages/:streamId', async (req: Request, res: Response) => {
    try {
        const { streamId } = req.params;
        const { limit = '50', offset = '0' } = req.query;

        const limitNum = parseInt(limit as string);
        const offsetNum = parseInt(offset as string);

        const messages = await prisma.chatMessage.findMany({
            where: { streamId },
            include: {
                author: {
                    select: {
                        id: true,
                        name: true,
                        pfp: true,
                    },
                },
            },
            orderBy: { createdAt: 'desc' },
            take: limitNum,
            skip: offsetNum,
        });

        // Obtener el streamerId del stream
        const stream = await prisma.stream.findUnique({
            where: { id: streamId },
            select: { streamerId: true },
        });

        if (!stream) {
            return res.status(404).json({ error: 'Stream no encontrado' });
        }

        // Enriquecer mensajes con levelName
        const enrichedMessages = await Promise.all(messages.map(async (msg) => {
            // Obtener nivel de lealtad
            const userLoyalty = await prisma.userLoyaltyLevel.findUnique({
                where: {
                    userId_streamerId: {
                        userId: msg.authorId,
                        streamerId: stream.streamerId,
                    },
                },
                include: { loyaltyLevel: true },
            });

            return {
                id: msg.id,
                streamId: msg.streamId,
                userId: msg.authorId,
                texto: msg.text,
                hora: msg.createdAt.toISOString(),
                user: {
                    id: msg.author.id,
                    name: msg.author.name,
                    pfp: msg.author.pfp,
                    levelName: userLoyalty?.loyaltyLevel?.nombre || 'Novato',
                },
                createdAt: msg.createdAt,
            };
        }));

        return res.status(200).json({
            success: true,
            messages: enrichedMessages.reverse(), // Devolver en orden cronológico
        });
    } catch (error) {
        console.error('Error al obtener historial:', error);
        res.status(500).json({ error: 'Error al obtener historial' });
    }
});

// GET /api/chat/message/:messageId - Obtener un mensaje específico
router.get('/message/:messageId', async (req: Request, res: Response) => {
    try {
        const { messageId } = req.params;

        const message = await prisma.chatMessage.findUnique({
            where: { id: messageId },
            include: {
                author: {
                    select: {
                        id: true,
                        name: true,
                        pfp: true,
                    },
                },
            },
        });

        if (!message) {
            return res.status(404).json({ error: 'Mensaje no encontrado' });
        }

        return res.status(200).json({ success: true, message });
    } catch (error) {
        console.error('Error al obtener mensaje:', error);
        res.status(500).json({ error: 'Error al obtener mensaje' });
    }
});

export default router;
