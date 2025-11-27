import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const router = Router();
const prisma = new PrismaClient();

// GET /api/data/streams - Obtener todos los streams
router.get('/streams', async (req: Request, res: Response) => {
  try {
    const streams = await prisma.stream.findMany({
      include: {
        streamer: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        game: {
          select: {
            id: true,
            name: true,
            photo: true,
          },
        },
        tags: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    return res.status(200).json({ success: true, streams });
  } catch (error) {
    console.error('Error al obtener streams:', error);
    res.status(500).json({ error: 'Error al obtener streams' });
  }
});

// GET /api/data/tags - Obtener todos los tags
router.get('/tags', async (req: Request, res: Response) => {
  try {
    const tags = await prisma.tag.findMany({
      include: {
        _count: {
          select: {
            streams: true,
            games: true,
          },
        },
      },
    });

    return res.status(200).json({ success: true, tags });
  } catch (error) {
    console.error('Error al obtener tags:', error);
    res.status(500).json({ error: 'Error al obtener tags' });
  }
});

// GET /api/data/games - Obtener todos los juegos
router.get('/games', async (req: Request, res: Response) => {
  try {
    const games = await prisma.game.findMany({
      include: {
        tags: {
          select: {
            id: true,
            name: true,
          },
        },
        _count: {
          select: {
            streams: true,
          },
        },
      },
    });

    return res.status(200).json({ success: true, games });
  } catch (error) {
    console.error('Error al obtener juegos:', error);
    res.status(500).json({ error: 'Error al obtener juegos' });
  }
});

// GET /api/data/streams/details/:nickname - Obtener detalles de un stream por nickname del streamer
router.get('/streams/details/:nickname', async (req: Request, res: Response) => {
  try {
    const { nickname } = req.params;

    // Buscar el stream por el nombre del streamer
    const stream = await prisma.stream.findFirst({
      where: {
        streamer: {
          name: nickname,
        },
      },
      include: {
        streamer: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        game: {
          select: {
            id: true,
            name: true,
            photo: true,
          },
        },
        tags: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    if (!stream) {
      return res.status(404).json({ error: 'Stream no encontrado' });
    }

    return res.status(200).json({ success: true, stream });
  } catch (error) {
    console.error('Error al obtener detalles del stream:', error);
    res.status(500).json({ error: 'Error al obtener detalles del stream' });
  }
});

// GET /api/data/search/:query - Buscar streams por título o nombre del streamer
router.get('/search/:query', async (req: Request, res: Response) => {
  try {
    const { query } = req.params;

    const streams = await prisma.stream.findMany({
      where: {
        OR: [
          {
            title: {
              contains: query,
              mode: 'insensitive',
            },
          },
          {
            streamer: {
              name: {
                contains: query,
                mode: 'insensitive',
              },
            },
          },
        ],
      },
      include: {
        streamer: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        game: {
          select: {
            id: true,
            name: true,
            photo: true,
          },
        },
        tags: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    return res.status(200).json({ success: true, streams });
  } catch (error) {
    console.error('Error al buscar streams:', error);
    res.status(500).json({ error: 'Error al buscar streams' });
  }
});

export default router;
