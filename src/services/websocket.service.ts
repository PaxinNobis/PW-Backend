import { WebSocket, WebSocketServer } from 'ws';
import { PrismaClient } from '@prisma/client';
import jwt from 'jsonwebtoken';
import { getUserPersistedLevel } from '../utils/level-lookup.utils';
import { updateUserLoyaltyLevel, calculateGlobalLevel } from '../utils/level.utils';

const prisma = new PrismaClient();

interface JwtPayload {
  userId: string;
  email: string;
}

interface WebSocketClient extends WebSocket {
  userId?: string;
  userName?: string;
  userLevel?: number;
  userLevelName?: string;
  streamId?: string;
  hasReceivedHistory?: boolean;
}

// Map para mantener las "salas" de chat por streamId
const chatRooms = new Map<string, Set<WebSocketClient>>();
// Map auxiliar para referenciar rápidamente conexiones por usuario dentro de un stream
const roomParticipants = new Map<string, Map<string, WebSocketClient>>();
// Map global de usuarios conectados (userId -> WebSocket)
const connectedUsers = new Map<string, WebSocketClient>();

export const handleWebSocketConnection = (ws: WebSocketClient) => {
  console.log('Nueva conexión WebSocket establecida');

  ws.on('message', async (data: Buffer) => {
    try {
      const message = JSON.parse(data.toString());

      // Manejar diferentes tipos de mensajes
      switch (message.type) {
        case 'join':
          await handleJoin(ws, message);
          // Registrar usuario en el mapa global si se autentica
          if (ws.userId) {
            connectedUsers.set(ws.userId, ws);
          }
          break;
        case 'chat':
          await handleChatMessage(ws, message);
          break;
        case 'typing':
          handleTyping(ws, message);
          break;
        case 'leave':
          handleLeave(ws);
          break;
        default:
          ws.send(JSON.stringify({ type: 'error', message: 'Tipo de mensaje desconocido' }));
      }
    } catch (error) {
      console.error('Error al procesar mensaje WebSocket:', error);
      ws.send(JSON.stringify({ type: 'error', message: 'Error al procesar mensaje' }));
    }
  });

  ws.on('close', () => {
    console.log('Conexión WebSocket cerrada');
    if (ws.userId) {
      connectedUsers.delete(ws.userId);
    }
    handleLeave(ws);
  });

  ws.on('error', (error) => {
    console.error('Error en WebSocket:', error);
    if (ws.userId) {
      connectedUsers.delete(ws.userId);
    }
  });
};

// Helper para enviar mensaje a un usuario específico
export function sendToUser(userId: string, data: any) {
  const client = connectedUsers.get(userId);
  if (client && client.readyState === WebSocket.OPEN) {
    client.send(JSON.stringify(data));
    return true;
  }
  return false;
}

// Función para unirse a un chat de un stream
async function handleJoin(ws: WebSocketClient, message: any) {
  try {
    const { token, streamerNickname } = message;

    if (!token || !streamerNickname) {
      ws.send(JSON.stringify({ type: 'error', message: 'Token y streamerNickname son requeridos' }));
      return;
    }

    // Validar token JWT
    let decoded: JwtPayload;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET || 'default_secret') as JwtPayload;
    } catch (error) {
      ws.send(JSON.stringify({ type: 'error', message: 'Token inválido' }));
      return;
    }

    // Buscar el stream del streamer
    const stream = await prisma.stream.findFirst({
      where: {
        streamer: {
          name: streamerNickname,
        },
        isLive: true, // Solo el stream activo
      },
      include: {
        streamer: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    if (!stream) {
      ws.send(JSON.stringify({ type: 'error', message: 'Stream no encontrado' }));
      return;
    }

    // Buscar información del usuario
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: {
        id: true,
        name: true,
        level: true,
      },
    });

    if (!user) {
      ws.send(JSON.stringify({ type: 'error', message: 'Usuario no encontrado' }));
      return;
    }

    // Evitar joins duplicados en la misma conexión
    if (ws.streamId === stream.id && ws.userId === user.id) {
      ws.send(JSON.stringify({ type: 'info', message: 'Ya te encuentras en este chat' }));
      return;
    }

    // Obtener nivel persistido del usuario
    const levelData = await getUserPersistedLevel(prisma, user.id, stream.streamerId);

    // Guardar información en el WebSocket
    ws.userId = user.id;
    ws.userName = user.name;
    ws.userLevel = levelData.level;
    ws.userLevelName = levelData.name;
    ws.streamId = stream.id;

    // Agregar a la sala de chat
    if (!chatRooms.has(stream.id)) {
      chatRooms.set(stream.id, new Set());
    }
    if (!roomParticipants.has(stream.id)) {
      roomParticipants.set(stream.id, new Map());
    }

    const participants = roomParticipants.get(stream.id)!;
    const room = chatRooms.get(stream.id)!;

    // Si ya existe otra conexión activa del mismo usuario, cerrarla para evitar historial duplicado
    const existingClient = participants.get(user.id);
    if (existingClient && existingClient !== ws) {
      existingClient.send(JSON.stringify({ type: 'info', message: 'Se ha iniciado una nueva sesión de chat' }));
      room.delete(existingClient);
      try {
        existingClient.terminate();
      } catch (error) {
        console.error('Error al cerrar sesión duplicada:', error);
      }
    }

    participants.set(user.id, ws);
    room.add(ws);

    // Enviar confirmación al usuario
    ws.send(JSON.stringify({
      type: 'joined',
      message: 'Te has unido al chat',
      streamId: stream.id,
      streamerName: stream.streamer.name,
    }));

    // Broadcast: Usuario se unió
    broadcastToRoom(stream.id, {
      type: 'viewer_joined',
      viewer: {
        id: user.id,
        name: user.name,
        level: ws.userLevel,
        levelName: ws.userLevelName,
      },
      newCount: participants.size,
    });

    // Broadcast: Actualizar contador
    broadcastToRoom(stream.id, {
      type: 'viewer_count_update',
      count: participants.size,
    });

    // Enviar historial de mensajes recientes
    if (!ws.hasReceivedHistory) {
      const recentMessages = await prisma.chatMessage.findMany({
        where: { streamId: stream.id },
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
        take: 50,
      });

      // Obtener niveles de lealtad para enriquecer el historial
      const authorIds = [...new Set(recentMessages.map(m => m.authorId))];
      const userLevels = await prisma.userLoyaltyLevel.findMany({
        where: {
          streamerId: stream.streamerId,
          userId: { in: authorIds },
        },
        include: {
          loyaltyLevel: true,
        },
      });

      const allLevels = await prisma.loyaltyLevel.findMany({
        where: { streamerId: stream.streamerId },
        orderBy: { puntosRequeridos: 'asc' },
      });

      // Primer nivel para fallback
      const firstLevel = allLevels[0];
      const defaultLevelName = firstLevel?.nombre || 'Espectador';

      const levelMap = new Map<string, { level: number; name: string }>();
      userLevels.forEach(ul => {
        const levelIndex = allLevels.findIndex(l => l.id === ul.loyaltyLevelId);
        levelMap.set(ul.userId, {
          level: levelIndex + 1,
          name: ul.loyaltyLevel.nombre,
        });
      });

      const enrichedMessages = recentMessages.map(msg => {
        const levelData = levelMap.get(msg.authorId) || { level: 0, name: defaultLevelName };
        const authorData = {
          ...msg.author,
          level: levelData.level,
          levelName: levelData.name,
        };
        return {
          ...msg,
          author: authorData,
          user: authorData, // Compatibilidad
        };
      });

      ws.send(JSON.stringify({
        type: 'history',
        messages: enrichedMessages.reverse(),
      }));

      ws.hasReceivedHistory = true;
    }

    console.log(`Usuario ${user.name} se unió al chat de ${stream.streamer.name}`);
  } catch (error) {
    console.error('Error al unirse al chat:', error);
    ws.send(JSON.stringify({ type: 'error', message: 'Error al unirse al chat' }));
  }
}

// Función para manejar mensajes de chat
async function handleChatMessage(ws: WebSocketClient, message: any) {
  try {
    const { text } = message;

    if (!ws.userId || !ws.userName || !ws.streamId) {
      ws.send(JSON.stringify({ type: 'error', message: 'Debes unirte a un chat primero' }));
      return;
    }

    if (!text || text.trim() === '') {
      ws.send(JSON.stringify({ type: 'error', message: 'El mensaje no puede estar vacío' }));
      return;
    }

    // Buscar el stream para obtener el streamOwnerId
    const stream = await prisma.stream.findUnique({
      where: { id: ws.streamId },
      select: { streamerId: true },
    });

    if (!stream) {
      ws.send(JSON.stringify({ type: 'error', message: 'Stream no encontrado' }));
      return;
    }

    // Ejecutar transacción para guardar mensaje y actualizar puntos
    const result = await prisma.$transaction(async (tx) => {
      // 1. Guardar mensaje
      const chatMessage = await tx.chatMessage.create({
        data: {
          text: text.trim(),
          streamId: ws.streamId!,
          authorId: ws.userId!,
          streamOwnerId: stream.streamerId,
        },
        include: {
          author: {
            select: {
              id: true,
              name: true,
              level: true,
              pfp: true,
            },
          },
        },
      });

      // 2. Actualizar puntos del usuario (1 punto por mensaje)
      // a. Puntos globales
      const updatedUser = await tx.user.update({
        where: { id: ws.userId! },
        data: {
          points: { increment: 1 },
        },
      });

      // b. Nivel global
      const newGlobalLevel = calculateGlobalLevel(updatedUser.points || 0);
      if (newGlobalLevel !== updatedUser.level) {
        await tx.user.update({
          where: { id: ws.userId! },
          data: { level: newGlobalLevel }
        });
      }

      // c. Puntos por streamer (UserPoints)
      const userPoints = await tx.userPoints.upsert({
        where: {
          userId_streamerId: {
            userId: ws.userId!,
            streamerId: stream.streamerId,
          },
        },
        create: {
          userId: ws.userId!,
          streamerId: stream.streamerId,
          points: 1,
        },
        update: {
          points: { increment: 1 },
          lastUpdated: new Date(),
        },
      });

      return { chatMessage, userPoints };
    });

    // 3. Actualizar nivel de lealtad
    const loyaltyLevels = await prisma.loyaltyLevel.findMany({
      where: { streamerId: stream.streamerId },
      orderBy: { puntosRequeridos: 'asc' },
    });

    const { newLevel } = await updateUserLoyaltyLevel(
      prisma,
      ws.userId!,
      stream.streamerId,
      result.userPoints.points,
      loyaltyLevels
    );

    // Debug logging
    console.log('🔍 WebSocket Level Debug:', {
      userId: ws.userId,
      streamerId: stream.streamerId,
      points: result.userPoints.points,
      loyaltyLevelsCount: loyaltyLevels.length,
      newLevel: newLevel,
      levelName: newLevel.name
    });

    // Broadcast del mensaje a todos los usuarios en la sala
    broadcastToRoom(ws.streamId, {
      type: 'message',
      message: {
        id: result.chatMessage.id,
        text: result.chatMessage.text,
        createdAt: result.chatMessage.createdAt,
        author: {
          id: result.chatMessage.author.id,
          name: result.chatMessage.author.name,
          pfp: result.chatMessage.author.pfp,
          level: newLevel.level,
          levelName: newLevel.name,
        },
        user: {
          id: result.chatMessage.author.id,
          name: result.chatMessage.author.name,
          pfp: result.chatMessage.author.pfp,
          level: newLevel.level,
          levelName: newLevel.name,
        },
      },
      pointsEarned: 1,
    });

    console.log(`Mensaje de ${ws.userName} en stream ${ws.streamId}: ${text}`);
  } catch (error) {
    console.error('Error al enviar mensaje de chat:', error);
    ws.send(JSON.stringify({ type: 'error', message: 'Error al enviar mensaje' }));
  }
}

// Función para manejar evento de "escribiendo"
function handleTyping(ws: WebSocketClient, message: any) {
  if (!ws.streamId || !ws.userName) return;

  const { isTyping } = message;

  broadcastToRoom(ws.streamId, {
    type: 'typing',
    user: {
      id: ws.userId,
      name: ws.userName,
    },
    isTyping: !!isTyping,
  }, ws); // Excluir al remitente
}

// Función para salir del chat
function handleLeave(ws: WebSocketClient) {
  if (ws.streamId) {
    const room = chatRooms.get(ws.streamId);
    if (room) {
      room.delete(ws);
      if (room.size === 0) {
        chatRooms.delete(ws.streamId);
      }
    }

    const participants = roomParticipants.get(ws.streamId);
    if (participants && ws.userId) {
      const storedClient = participants.get(ws.userId);
      if (storedClient === ws) {
        participants.delete(ws.userId);
      }
      if (participants.size === 0) {
        roomParticipants.delete(ws.streamId);
      }
    }

    ws.hasReceivedHistory = false;
    console.log(`Usuario ${ws.userName} salió del chat ${ws.streamId}`);

    // Broadcast: Usuario salió y nuevo contador
    const currentCount = roomParticipants.get(ws.streamId)?.size || 0;

    broadcastToRoom(ws.streamId, {
      type: 'viewer_left',
      viewerId: ws.userId,
      newCount: currentCount,
    });

    broadcastToRoom(ws.streamId, {
      type: 'viewer_count_update',
      count: currentCount,
    });
  }
}

// Helper para broadcast
export function broadcastToRoom(streamId: string, data: any, excludeClient?: WebSocketClient) {
  const room = chatRooms.get(streamId);
  if (room) {
    const messageData = JSON.stringify(data);
    room.forEach((client) => {
      if (client !== excludeClient && client.readyState === WebSocket.OPEN) {
        client.send(messageData);
      }
    });
  }
}
