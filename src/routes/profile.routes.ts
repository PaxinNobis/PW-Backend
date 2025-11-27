import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const router = Router();
const prisma = new PrismaClient();

// GET /api/profile/:identifier - Ver perfil de usuario (por ID, email o nombre)
router.get('/:identifier', async (req: Request, res: Response) => {
  try {
    const { identifier } = req.params;

    // Buscar por ID, email o nombre
    const user = await prisma.user.findFirst({
      where: {
        OR: [
          { id: identifier },
          { email: identifier },
          { name: identifier },
        ],
      },
      select: {
        id: true,
        name: true,
        email: true,
        pfp: true,
        bio: true,
        online: true,
        lastSeen: true,
        level: true,
        points: true,
        streamingHours: true,
        _count: {
          select: {
            followedBy: true,
            following: true,
          },
        },
        socialLinks: true,
      },
    });

    if (!user) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    return res.status(200).json({
      success: true,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        pfp: user.pfp,
        bio: user.bio,
        online: user.online,
        lastSeen: user.lastSeen,
        stats: {
          followers: user._count.followedBy,
          following: user._count.following,
          streamingHours: user.streamingHours || 0,
          level: user.level,
          points: user.points,
        },
        socialLinks: user.socialLinks || {},
      }
    });
  } catch (error) {
    console.error('Error al obtener perfil:', error);
    res.status(500).json({ error: 'Error al obtener perfil' });
  }
});

// PUT /api/profile - Actualizar perfil
router.put('/', async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'No autenticado' });
    }

    const { bio, name } = req.body;

    const updatedUser = await prisma.user.update({
      where: { id: req.user.userId },
      data: {
        bio,
        name,
      },
      select: {
        id: true,
        name: true,
        email: true,
        bio: true,
        pfp: true,
      },
    });

    res.json({ success: true, user: updatedUser });
  } catch (error) {
    console.error('Error al actualizar perfil:', error);
    res.status(500).json({ error: 'Error al actualizar perfil' });
  }
});

// PUT /api/profile/avatar - Actualizar avatar (URL)
router.put('/avatar', async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'No autenticado' });
    }

    const { avatarUrl } = req.body;

    if (!avatarUrl) {
      return res.status(400).json({ error: 'avatarUrl es requerido' });
    }

    await prisma.user.update({
      where: { id: req.user.userId },
      data: { pfp: avatarUrl },
    });

    res.json({ success: true, avatarUrl });
  } catch (error) {
    console.error('Error al actualizar avatar:', error);
    res.status(500).json({ error: 'Error al actualizar avatar' });
  }
});

// PUT /api/profile/status - Actualizar estado online/offline
router.put('/status', async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'No autenticado' });
    }

    const { online } = req.body;

    await prisma.user.update({
      where: { id: req.user.userId },
      data: {
        online,
        lastSeen: online ? undefined : new Date(),
      },
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Error al actualizar estado:', error);
    res.status(500).json({ error: 'Error al actualizar estado' });
  }
});

// PUT /api/profile/social-links - Actualizar redes sociales
router.put('/social-links', async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'No autenticado' });
    }

    const { x, youtube, instagram, tiktok, discord } = req.body;

    await prisma.userSocialLinks.upsert({
      where: { userId: req.user.userId },
      create: {
        userId: req.user.userId,
        xLink: x,
        youtubeLink: youtube,
        instagramLink: instagram,
        tiktokLink: tiktok,
        discordLink: discord,
      },
      update: {
        xLink: x,
        youtubeLink: youtube,
        instagramLink: instagram,
        tiktokLink: tiktok,
        discordLink: discord,
      },
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Error al actualizar redes sociales:', error);
    res.status(500).json({ error: 'Error al actualizar redes sociales' });
  }
});

// GET /api/profile/social-links - Obtener redes sociales
router.get('/social-links/me', async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'No autenticado' });
    }

    const links = await prisma.userSocialLinks.findUnique({
      where: { userId: req.user.userId },
    });

    res.json(links || {});
  } catch (error) {
    console.error('Error al obtener redes sociales:', error);
    res.status(500).json({ error: 'Error al obtener redes sociales' });
  }
});

export default router;
