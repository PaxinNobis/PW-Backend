import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

// Leer los archivos JSON - ajustar rutas para ejecución desde prisma/
const gamesData = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'public', 'data', 'games.json'), 'utf-8'));
const tagsData = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'public', 'data', 'tags.json'), 'utf-8'));
const streamsData = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'public', 'data', 'streams.json'), 'utf-8'));

async function main() {
  console.log('Iniciando seed de la base de datos...');
  console.log('Directorio actual:', __dirname);
  console.log('Buscando archivos JSON en:', path.join(__dirname, '..', 'public', 'data'));

  try {
    console.log('Games Data:', gamesData.length);
    console.log('Tags Data:', tagsData.length);
    console.log('Streams Data:', streamsData.length);
  } catch (e) {
    console.error('Error leyendo JSONs:', e);
  }

  // Crear tags
  await prisma.tag.createMany({
    data: tagsData.map((tag: any) => ({
      name: tag.name,
    })),
    skipDuplicates: true,
  });
  console.log(`Tags creados: ${tagsData.length}`);

  // Crear juegos
  await prisma.game.createMany({
    data: gamesData.map((game: any) => ({
      name: game.name,
      photo: game.photo,
    })),
    skipDuplicates: true,
  });
  console.log(`Juegos creados: ${gamesData.length}`);

  // Obtener todos los tags y games creados para hacer las relaciones
  const allTags = await prisma.tag.findMany();
  const allGames = await prisma.game.findMany();

  // Crear relación entre games y tags
  for (const gameData of gamesData) {
    const game = allGames.find(g => g.name === gameData.name);
    if (game && gameData.tags) {
      for (const tagData of gameData.tags) {
        const tag = allTags.find(t => t.name === tagData.name);
        if (tag) {
          await prisma.game.update({
            where: { id: game.id },
            data: {
              tags: {
                connect: { id: tag.id },
              },
            },
          });
        }
      }
    }
  }
  console.log('Relaciones game-tag creadas');

  // Crear usuarios streamers desde el JSON
  const hashedPassword = await bcrypt.hash('password123', 10);
  const uniqueStreamers = new Map();

  streamsData.forEach((stream: any) => {
    if (!uniqueStreamers.has(stream.streamer.nickname)) {
      uniqueStreamers.set(stream.streamer.nickname, stream.streamer);
    }
  });

  await prisma.user.createMany({
    data: Array.from(uniqueStreamers.values()).map((streamer: any) => ({
      email: `${streamer.nickname.toLowerCase()}@astrotv.com`,
      name: streamer.nickname,
      password: hashedPassword,
      pfp: streamer.pfp || `https://api.dicebear.com/7.x/avataaars/svg?seed=${streamer.nickname}`, // Avatar del streamer
      level: Math.floor(Math.random() * 30) + 20, // Nivel entre 20-50
      points: Math.floor(Math.random() * 10000) + 5000, // Puntos entre 5000-15000
      coins: Math.floor(Math.random() * 500) + 100, // Coins entre 100-600
    })),
    skipDuplicates: true,
  });
  console.log(`Streamers creados: ${uniqueStreamers.size}`);

  // Obtener todos los streamers creados
  const allStreamers = await prisma.user.findMany();

  // Crear streams desde el JSON - asegurar que cada streamer tenga solo un stream
  const usedStreamers = new Set<string>();
  let streamsCreated = 0;

  for (const streamData of streamsData) {
    const streamer = allStreamers.find(s => s.name === streamData.streamer.nickname);
    const game = allGames.find(g => g.name === streamData.game.name);

    // Solo crear stream si el streamer no tiene uno ya
    if (streamer && game && !usedStreamers.has(streamer.id)) {
      usedStreamers.add(streamer.id);

      // Buscar los tags del stream
      const streamTags: { id: string }[] = [];
      if (streamData.game.tags) {
        for (const tagData of streamData.game.tags.slice(0, 3)) { // Máximo 3 tags por stream
          const tag = allTags.find(t => t.name === tagData.name);
          if (tag) {
            streamTags.push({ id: tag.id });
          }
        }
      }

      await prisma.stream.create({
        data: {
          title: streamData.title,
          thumbnail: streamData.thumbnail,
          viewers: streamData.viewers,
          isLive: true,
          startedAt: new Date(), // Fecha de inicio del stream
          streamerId: streamer.id,
          gameId: game.id,
          tags: {
            connect: streamTags,
          },
        },
      });

      streamsCreated++;

      // Limitar a 10 streams
      if (streamsCreated >= 10) break;
    }
  }
  console.log(`Streams creados: ${streamsCreated}`);

  // Crear analíticas para los streamers
  // Actualizar datos de streamer (horas y monedas)
  for (const streamer of allStreamers) {
    await prisma.user.update({
      where: { id: streamer.id },
      data: {
        streamingHours: Math.floor(Math.random() * 300) + 100,
        monedasRecibidas: Math.floor(Math.random() * 20000) + 5000,
      }
    });
  }
  console.log(`Datos de streamer actualizados para ${allStreamers.length} usuarios`);
  console.log(`Analíticas creadas: ${allStreamers.length}`);

  // Crear paquetes de monedas
  // Limpiar paquetes existentes
  await prisma.coinPack.deleteMany({});

  await prisma.coinPack.createMany({
    data: [
      { nombre: 'Starter Astrocoin Pack', valor: 30, en_soles: 3.0 },
      { nombre: 'Basic Astrocoin Pack', valor: 100, en_soles: 6.0 },
      { nombre: 'Premium Astrocoin Pack', valor: 500, en_soles: 22.0 },
      { nombre: 'Ultimate Astrocoin Pack', valor: 1000, en_soles: 40.0 },
    ],
    skipDuplicates: true,
  });

  console.log('Paquetes de monedas creados: 4');

  // Crear regalos por defecto para cada streamer
  let giftsCreated = 0;
  for (const streamer of allStreamers) {
    // Limpiar regalos existentes para evitar duplicados
    await prisma.gift.deleteMany({
      where: { streamerId: streamer.id }
    });

    await prisma.gift.createMany({
      data: [
        { nombre: 'Rosa', costo: 10, puntos: 5, streamerId: streamer.id },
        { nombre: 'GG', costo: 50, puntos: 25, streamerId: streamer.id },
        { nombre: 'Cofre', costo: 100, puntos: 50, streamerId: streamer.id },
        { nombre: 'Dragón', costo: 1000, puntos: 500, streamerId: streamer.id },
      ],
    });
    giftsCreated += 4;
  }
  console.log(`Regalos creados: ${giftsCreated}`);

  // Crear niveles de lealtad por defecto para cada streamer
  let levelsCreated = 0;
  for (const streamer of allStreamers) {
    // Limpiar niveles existentes
    await prisma.loyaltyLevel.deleteMany({
      where: { streamerId: streamer.id }
    });

    await prisma.loyaltyLevel.createMany({
      data: [
        { nombre: 'Novato', puntosRequeridos: 10, recompensa: 'Emblema Novato', streamerId: streamer.id },
        { nombre: 'Fan', puntosRequeridos: 20, recompensa: 'Emblema Fan', streamerId: streamer.id },
        { nombre: 'Super Fan', puntosRequeridos: 30, recompensa: 'Emblema Super Fan', streamerId: streamer.id },
        { nombre: 'Leyenda', puntosRequeridos: 40, recompensa: 'Emblema Leyenda', streamerId: streamer.id },
      ],
    });
    levelsCreated += 4;
  }
  console.log(`Niveles de lealtad creados: ${levelsCreated}`);

  console.log('Seed completado exitosamente!');
}

main()
  .catch((e) => {
    console.error('Error en seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
