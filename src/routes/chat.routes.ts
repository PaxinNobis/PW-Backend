import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { getUserPersistedLevel } from '../utils/level-lookup.utils';
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
            // a. Puntos globales y monedas (opcional, aquí solo puntos)
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

        // 3. Actualizar nivel de lealtad (fuera de transacción para evitar bloqueos largos)
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

        // TODO: Aquí idealmente se emitiría el evento WebSocket si estuviera integrado
        // Por ahora confiamos en que el cliente WS también recibe el mensaje o el frontend lo maneja

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

        console.log('🔍 History Endpoint Query:', { streamId, limitNum, offsetNum });

        const [messages, total] = await Promise.all([
            prisma.chatMessage.findMany({
                where: { streamId },
                include: {
                    author: {
                        select: {
                            id: true,
                            name: true,
                            pfp: true,
                            // level: true, // NO incluir nivel global
                        },
                    },
                },
                orderBy: { createdAt: 'desc' },
                take: limitNum,
                skip: offsetNum,
            }),
            prisma.chatMessage.count({ where: { streamId } }),
        ]);

        // Obtener el streamerId del stream
        const stream = await prisma.stream.findUnique({
            where: { id: streamId },
            select: { streamerId: true },
        });

        if (!stream) {
            return res.status(404).json({ error: 'Stream no encontrado' });
        }

        // Obtener niveles persistidos para cada autor
        const authorIds = [...new Set(messages.map(m => m.authorId))];
        const userLevels = await prisma.userLoyaltyLevel.findMany({
            where: {
                streamerId: stream.streamerId,
                userId: { in: authorIds },
            },
            include: {
                loyaltyLevel: true,
            },
        });

        // Obtener todos los niveles para calcular el índice
        const allLevels = await prisma.loyaltyLevel.findMany({
            where: { streamerId: stream.streamerId },
            orderBy: { puntosRequeridos: 'asc' },
        });

        // Mapa de niveles por usuario
        const levelMap = new Map<string, { level: number; name: string }>();
        userLevels.forEach(ul => {
            const levelIndex = allLevels.findIndex(l => l.id === ul.loyaltyLevelId);
            levelMap.set(ul.userId, {
                level: levelIndex + 1,
                name: ul.loyaltyLevel.nombre,
            });
        });

        // Obtener el primer nivel configurado para fallback
        const firstLevel = allLevels[0];
        const defaultLevelName = firstLevel?.nombre || 'Espectador';

        // Enriquecer mensajes con nivel persistido
        const enrichedMessages = messages.map(msg => {
            const levelData = levelMap.get(msg.authorId) || { level: 0, name: defaultLevelName };
            const authorData = {
                ...msg.author,
                level: levelData.level,
                levelName: levelData.name,
            };

            return {
                ...msg,
                author: authorData,
                user: authorData, // Enviar también como user para compatibilidad
            };
        });

        // Debug logging
        if (enrichedMessages.length > 0) {
            console.log('🔍 History Endpoint Debug:', {
                firstMsgUser: enrichedMessages[0].user,
                firstMsgAuthor: enrichedMessages[0].author,
                levelMapSize: levelMap.size,
                defaultLevelName
            });
        }

        return res.status(200).json({
            success: true,
            messages: enrichedMessages.reverse(), // Devolver en orden cronológico para el chat
            total,
        });
    } catch (error) {
        console.error('Error al obtener mensajes:', error);
        res.status(500).json({ error: 'Error al obtener mensajes' });
    }
});

// DELETE /api/chat/message/:messageId - Eliminar mensaje
router.delete('/message/:messageId', async (req: Request, res: Response) => {
    try {
        if (!req.user) {
            return res.status(401).json({ error: 'No autenticado' });
        }

        const { messageId } = req.params;

        const message = await prisma.chatMessage.findUnique({
            where: { id: messageId },
        });

        if (!message) {
            return res.status(404).json({ error: 'Mensaje no encontrado' });
        }

        // Solo el autor o el dueño del stream pueden borrar
        if (message.authorId !== req.user.userId && message.streamOwnerId !== req.user.userId) {
            return res.status(403).json({ error: 'No tienes permiso para eliminar este mensaje' });
        }

        await prisma.chatMessage.delete({
            where: { id: messageId },
        });

        return res.status(200).json({
            success: true,
            message: 'Mensaje eliminado correctamente',
        });
    } catch (error) {
        console.error('Error al eliminar mensaje:', error);
        res.status(500).json({ error: 'Error al eliminar mensaje' });
    }
});

export default router;
