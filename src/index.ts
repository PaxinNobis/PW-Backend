import express from 'express';
import cors from 'cors';
import http from 'http';
import { WebSocketServer } from 'ws';
import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';

// Importar middlewares
import { authMiddleware } from './middleware/auth.middleware';

// Importar rutas
import authRoutes from './routes/auth.routes';
import dataRoutes from './routes/data.routes';
import userRoutes from './routes/user.routes';
import panelRoutes from './routes/panel.routes';
import paymentRoutes from './routes/payment.routes';
import viewerRoutes from './routes/viewer.routes';
import pointsRoutes from './routes/points.routes';
import medalRoutes from './routes/medal.routes';
import profileRoutes from './routes/profile.routes';
import notificationRoutes from './routes/notification.routes';
import clipRoutes from './routes/clip.routes';
import friendRoutes from './routes/friend.routes';
import streamerRoutes from './routes/streamer.routes';
import chatRoutes from './routes/chat.routes';
import giftRoutes from './routes/gift.routes';

// Importar servicio de WebSocket
import { handleWebSocketConnection } from './services/websocket.service';

// Cargar variables de entorno
dotenv.config();

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

export const prisma = new PrismaClient();

// Middlewares globales de Express
app.use(cors());

// Middleware para webhook de Stripe (necesita raw body)
app.use('/api/payment/webhook', express.raw({ type: 'application/json' }));

// Middleware global para JSON (excluyendo webhook)
app.use((req, res, next) => {
  if (req.originalUrl === '/api/payment/webhook') {
    next();
  } else {
    express.json()(req, res, next);
  }
});

// Ruta de salud
app.get('/health', (req, res) => {
  res.json({ status: 'OK', message: 'AstroTV Backend funcionando correctamente' });
});

// --- Rutas de API ---
app.use('/api/auth', authRoutes);
app.use('/api/data', dataRoutes);
app.use('/api/user', authMiddleware, userRoutes); // Protegida
app.use('/api/panel', authMiddleware, panelRoutes); // Protegida
app.use('/api/payment', paymentRoutes); // Parcialmente protegida (coin-packs público)
app.use('/api/viewer', authMiddleware, viewerRoutes); // Protegida
app.use('/api/points', authMiddleware, pointsRoutes); // Protegida
app.use('/api/medal', authMiddleware, medalRoutes); // Protegida
app.use('/api/profile', profileRoutes); // Parcialmente protegida
app.use('/api/notification', authMiddleware, notificationRoutes); // Protegida
app.use('/api/clip', clipRoutes); // Parcialmente protegida
app.use('/api/friend', authMiddleware, friendRoutes); // Protegida
app.use('/api/streamer', authMiddleware, streamerRoutes); // Protegida
app.use('/api/chat', authMiddleware, chatRoutes); // Protegida
app.use('/api/gifts', authMiddleware, giftRoutes); // Protegida

// --- Servidor WebSocket ---
wss.on('connection', handleWebSocketConnection);

// --- Manejo de errores global ---
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Error no manejado:', err);
  res.status(500).json({ error: 'Error interno del servidor' });
});

// --- Iniciar Servidor ---
const PORT = process.env.PORT || 8080;
server.listen(PORT, () => {
  console.log(`Servidor HTTP y WebSocket corriendo en http://localhost:${PORT}`);
  console.log(`WebSocket disponible en ws://localhost:${PORT}`);
});

// Manejo de cierre graceful
process.on('SIGINT', async () => {
  console.log('\nCerrando servidor...');
  await prisma.$disconnect();
  server.close(() => {
    console.log('Servidor cerrado correctamente');
    process.exit(0);
  });
});
