import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { authMiddleware } from '../middleware/auth.middleware';

const router = Router();
const prisma = new PrismaClient();

// POST /api/auth/register - Registrar nuevo usuario
router.post('/register', async (req: Request, res: Response) => {
  const { email, name, password } = req.body;

  // Validar datos requeridos
  if (!email || !name || !password) {
    return res.status(400).json({ error: 'Email, nombre y contraseña son requeridos' });
  }

  // Verificar si el email ya existe
  const existingUser = await prisma.user.findUnique({ where: { email } });
  if (existingUser) {
    return res.status(400).json({ error: 'El email ya está registrado' });
  }

  // Hashear contraseña
  const hashedPassword = await bcrypt.hash(password, 10);

  // Obtener plantillas de niveles de lealtad
  const templates = await prisma.loyaltyLevelTemplate.findMany({
    orderBy: { id: 'asc' }
  });

  // Si no hay plantillas (caso raro), usar fallback
  const loyaltyLevelsData = templates.length > 0
    ? templates.map(t => ({
      nombre: t.level,
      puntosRequeridos: t.id * 10, // 10, 20, 30...
      recompensa: `Emblema ${t.level}`,
      image: t.foto
    }))
    : [
      { nombre: 'Novato', puntosRequeridos: 10, recompensa: 'Emblema Novato' },
      { nombre: 'Fan', puntosRequeridos: 20, recompensa: 'Emblema Fan' }
    ];

  // Crear usuario
  const user = await prisma.user.create({
    data: {
      email,
      name,
      password: hashedPassword,
      level: 1,
      points: 0,
      coins: 0,
      // Crear niveles de lealtad por defecto para este usuario (como streamer)
      loyaltyLevels: {
        create: loyaltyLevelsData
      }
    },
  });

  // Generar token JWT
  const token = jwt.sign(
    { userId: user.id, email: user.email },
    process.env.JWT_SECRET || 'default_secret',
    { expiresIn: '7d' }
  );

  return res.status(201).json({
    success: true,
    message: 'Usuario registrado exitosamente',
    token,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
    },
  });
});

// POST /api/auth/login - Iniciar sesión
router.post('/login', async (req: Request, res: Response) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email y contraseña son requeridos' });
  }

  // Buscar usuario
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    return res.status(401).json({ error: 'Credenciales inválidas' });
  }

  // Verificar contraseña
  const isPasswordValid = await bcrypt.compare(password, user.password);
  if (!isPasswordValid) {
    return res.status(401).json({ error: 'Credenciales inválidas' });
  }

  // Generar token JWT
  const token = jwt.sign(
    { userId: user.id, email: user.email },
    process.env.JWT_SECRET || 'default_secret',
    { expiresIn: '7d' }
  );

  return res.status(200).json({
    success: true,
    message: 'Inicio de sesión exitoso',
    token,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      level: user.level,
      points: user.points,
      coins: user.coins,
    },
  });
});

// GET /api/auth/me - Obtener usuario actual (protegida)
router.get('/me', authMiddleware, async (req: Request, res: Response) => {
  if (!req.user) {
    return res.status(401).json({ error: 'No autenticado' });
  }

  const user = await prisma.user.findUnique({
    where: { id: req.user.userId },
    select: {
      id: true,
      email: true,
      name: true,
      level: true,
      points: true,
      coins: true,
    },
  });

  if (!user) {
    return res.status(404).json({ error: 'Usuario no encontrado' });
  }

  return res.status(200).json({ success: true, user });
});

export default router;
