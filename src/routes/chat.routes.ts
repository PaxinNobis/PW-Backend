import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { getUserPersistedLevel } from '../utils/level-lookup.utils';

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

        // Guardar mensaje
        const message = await prisma.chatMessage.create({
            data: {
                text: texto,
                streamId,
                authorId: req.user.userId,
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

        // Obtener nivel persistido del usuario
        const levelData = await getUserPersistedLevel(prisma, req.user.userId, stream.streamerId);

        // TODO: Aquí idealmente se emitiría el evento WebSocket si estuviera integrado
        // Por ahora confiamos en que el cliente WS también recibe el mensaje o el frontend lo maneja

        return res.status(201).json({
            success: true,
            message: {
                id: message.id,
                streamId: message.streamId,
                userId: message.authorId,
                texto: message.text,
                hora: message.createdAt.toISOString(),
                user: {
                    ...message.author,
                    level: levelData.level,
                    levelName: levelData.name,
                },
                createdAt: message.createdAt,
            },
            pointsEarned: 0, // Placeholder para futura implementación de puntos por mensaje
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

        const [messages, total] = await Promise.all([
            prisma.chatMessage.findMany({
                where: { streamId },
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

        // Enriquecer mensajes con nivel persistido
        const enrichedMessages = messages.map(msg => {
            const levelData = levelMap.get(msg.authorId) || { level: 0, name: 'Espectador' };
            return {
                ...msg,
                author: {
                    ...msg.author,
                    level: levelData.level,
                    levelName: levelData.name,
                },
            };
        });

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
