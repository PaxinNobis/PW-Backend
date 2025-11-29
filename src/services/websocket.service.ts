import { WebSocket, WebSocketServer } from 'ws';
import { PrismaClient } from '@prisma/client';
import jwt from 'jsonwebtoken';
import { getUserPersistedLevel } from '../utils/level-lookup.utils';

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

export const handleWebSocketConnection = (ws: WebSocketClient) => {
  console.log('Nueva conexión WebSocket establecida');

  ws.on('message', async (data: Buffer) => {
    try {
      const message = JSON.parse(data.toString());

      // Manejar diferentes tipos de mensajes
      switch (message.type) {
        case 'join':
          await handleJoin(ws, message);
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
    handleLeave(ws);
  });

  ws.on('error', (error) => {
    console.error('Error en WebSocket:', error);
  });
};

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
              level: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: 50,
      });

      ws.send(JSON.stringify({
        type: 'history',
        messages: recentMessages.reverse(),
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

    // Obtener nivel persistido del usuario
    const levelData = await getUserPersistedLevel(prisma, ws.userId, stream.streamerId);

    // Guardar mensaje en la base de datos
    const chatMessage = await prisma.chatMessage.create({
      data: {
        text: text.trim(),
        streamId: ws.streamId,
        authorId: ws.userId,
        streamOwnerId: stream.streamerId,
      },
      include: {
        author: {
          select: {
            id: true,
            name: true,
            level: true, // Mantenemos level global por si acaso, pero usaremos el calculado
          },
        },
      },
    });

    // Broadcast del mensaje a todos los usuarios en la sala
    broadcastToRoom(ws.streamId, {
      type: 'message',
      message: {
        id: chatMessage.id,
        text: chatMessage.text,
        createdAt: chatMessage.createdAt,
        author: {
          ...chatMessage.author,
          level: levelData.level,
          levelName: levelData.name,
        },
      },
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
function broadcastToRoom(streamId: string, data: any, excludeClient?: WebSocketClient) {
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
