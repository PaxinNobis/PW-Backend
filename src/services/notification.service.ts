import { PrismaClient } from '@prisma/client';
import { sendToUser } from './websocket.service';

const prisma = new PrismaClient();

export type NotificationType =
    | 'friend_request'
    | 'new_follower'
    | 'stream_live'
    | 'level_up'
    | 'gift_received'
    | 'system';

interface CreateNotificationParams {
    userId: string;
    type: NotificationType;
    title: string;
    message: string;
    data?: any;
}

/**
 * Crea una notificación en la base de datos y la envía por WebSocket si el usuario está conectado.
 */
export async function createNotification({ userId, type, title, message, data }: CreateNotificationParams) {
    try {
        // 1. Guardar en base de datos
        const notification = await prisma.notification.create({
            data: {
                userId,
                type,
                title,
                message,
                data: data ? JSON.stringify(data) : undefined,
                read: false,
            },
        });

        // 2. Enviar por WebSocket (tiempo real)
        const sent = sendToUser(userId, {
            type: 'notification',
            notification: {
                id: notification.id,
                type: notification.type,
                title: notification.title,
                message: notification.message,
                data: notification.data,
                read: notification.read,
                createdAt: notification.createdAt,
            },
        });

        console.log(`Notificación creada para ${userId} (${type}). Enviada por WS: ${sent}`);
        return notification;
    } catch (error) {
        console.error('Error al crear notificación:', error);
        throw error;
    }
}
