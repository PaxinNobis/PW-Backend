import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

// Datos hardcodeados para evitar problemas de rutas en Render
const tagsData = [
  { "id": 1, "name": "MOBA" },
  { "id": 2, "name": "eSports" },
  { "id": 3, "name": "Competitivo" },
  { "id": 4, "name": "Acción-Aventura" },
  { "id": 5, "name": "Mundo abierto" },
  { "id": 6, "name": "Rol-play" },
  { "id": 7, "name": "FPS" },
  { "id": 8, "name": "Táctico" },
  { "id": 9, "name": "Héroes" },
  { "id": 10, "name": "Battle Royale" },
  { "id": 11, "name": "Acción" },
  { "id": 12, "name": "Multijugador" },
  { "id": 13, "name": "MMORPG" },
  { "id": 14, "name": "Rol" },
  { "id": 15, "name": "Fantástico" },
  { "id": 16, "name": "Sandbox" },
  { "id": 17, "name": "Construcción" },
  { "id": 18, "name": "Supervivencia" },
  { "id": 19, "name": "ARPG" },
  { "id": 20, "name": "Deporte" },
  { "id": 21, "name": "Vehículos" },
  { "id": 22, "name": "Caza" },
  { "id": 23, "name": "Lucha" },
  { "id": 24, "name": "Aventura" },
  { "id": 25, "name": "Personajes de cómic" },
  { "id": 26, "name": "Fútbol" },
  { "id": 27, "name": "Simulación" },
  { "id": 28, "name": "IRL" },
  { "id": 29, "name": "Juego de Rol" },
  { "id": 30, "name": "Estrategia" },
  { "id": 31, "name": "Competitivo" },
  { "id": 32, "name": "Shooter" },
  { "id": 33, "name": "Aventura" },
  { "id": 34, "name": "Terror" },
  { "id": 35, "name": "Música" },
  { "id": 36, "name": "Creativo" },
  { "id": 37, "name": "Deportes" },
  { "id": 38, "name": "Tecnología" },
  { "id": 39, "name": "Humor" },
  { "id": 40, "name": "Educación" },
  { "id": 41, "name": "Conversación" },
  { "id": 42, "name": "Social" },
  { "id": 43, "name": "Cooperativo" },
  { "id": 44, "name": "Investigación" }
];

const gamesData = [
  {
    "id": 1,
    "name": "League of Legends",
    "photo": "https://static-cdn.jtvnw.net/ttv-boxart/21779-285x380.jpg",
    "tags": [
      { "id": 1, "name": "MOBA" },
      { "id": 2, "name": "eSports" },
      { "id": 3, "name": "Competitivo" },
      { "id": 9, "name": "Héroes" },
      { "id": 12, "name": "Multijugador" }
    ]
  },
  {
    "id": 2,
    "name": "Grand Theft Auto V",
    "photo": "https://static-cdn.jtvnw.net/ttv-boxart/6521_IGDB-285x380.jpg",
    "tags": [
      { "id": 4, "name": "Acción-Aventura" },
      { "id": 5, "name": "Mundo abierto" },
      { "id": 12, "name": "Multijugador" },
      { "id": 42, "name": "Social" }
    ]
  },
  {
    "id": 3,
    "name": "Counter-Strike 2",
    "photo": "https://static-cdn.jtvnw.net/ttv-boxart/32399-285x380.jpg",
    "tags": [
      { "id": 7, "name": "FPS" },
      { "id": 8, "name": "Táctico" },
      { "id": 3, "name": "Competitivo" },
      { "id": 12, "name": "Multijugador" }
    ]
  },
  {
    "id": 4,
    "name": "VALORANT",
    "photo": "https://static-cdn.jtvnw.net/ttv-boxart/516575-285x380.jpg",
    "tags": [
      { "id": 7, "name": "FPS" },
      { "id": 8, "name": "Táctico" },
      { "id": 3, "name": "Competitivo" },
      { "id": 43, "name": "Cooperativo" }
    ]
  },
  {
    "id": 5,
    "name": "Dota 2",
    "photo": "https://static-cdn.jtvnw.net/ttv-boxart/29595-285x380.jpg",
    "tags": [
      { "id": 1, "name": "MOBA" },
      { "id": 2, "name": "eSports" },
      { "id": 3, "name": "Competitivo" },
      { "id": 12, "name": "Multijugador" }
    ]
  },
  {
    "id": 6,
    "name": "Fortnite",
    "photo": "https://static-cdn.jtvnw.net/ttv-boxart/33214-285x380.jpg",
    "tags": [
      { "id": 10, "name": "Battle Royale" },
      { "id": 11, "name": "Acción" },
      { "id": 12, "name": "Multijugador" },
      { "id": 43, "name": "Cooperativo" }
    ]
  },
  {
    "id": 7,
    "name": "World of Warcraft",
    "photo": "https://static-cdn.jtvnw.net/ttv-boxart/18122-285x380.jpg",
    "tags": [
      { "id": 13, "name": "MMORPG" },
      { "id": 14, "name": "Rol" },
      { "id": 15, "name": "Fantástico" },
      { "id": 12, "name": "Multijugador" }
    ]
  },
  {
    "id": 8,
    "name": "Minecraft",
    "photo": "https://static-cdn.jtvnw.net/ttv-boxart/27471_IGDB-285x380.jpg",
    "tags": [
      { "id": 16, "name": "Sandbox" },
      { "id": 17, "name": "Construcción" },
      { "id": 18, "name": "Supervivencia" },
      { "id": 36, "name": "Creativo" }
    ]
  },
  {
    "id": 9,
    "name": "Call of Duty: Warzone",
    "photo": "https://static-cdn.jtvnw.net/ttv-boxart/512710-285x380.jpg",
    "tags": [
      { "id": 7, "name": "FPS" },
      { "id": 10, "name": "Battle Royale" },
      { "id": 3, "name": "Competitivo" },
      { "id": 12, "name": "Multijugador" }
    ]
  },
  {
    "id": 10,
    "name": "Apex Legends",
    "photo": "https://static-cdn.jtvnw.net/ttv-boxart/511224-285x380.jpg",
    "tags": [
      { "id": 7, "name": "FPS" },
      { "id": 10, "name": "Battle Royale" },
      { "id": 3, "name": "Competitivo" },
      { "id": 43, "name": "Cooperativo" }
    ]
  },
  {
    "id": 11,
    "name": "Elden Ring: Nightreign",
    "photo": "https://static-cdn.jtvnw.net/ttv-boxart/982348888_IGDB-285x380.jpg",
    "tags": [
      { "id": 6, "name": "Rol-play" },
      { "id": 14, "name": "Rol" },
      { "id": 24, "name": "Aventura" },
      { "id": 44, "name": "Investigación" }
    ]
  },
  {
    "id": 12,
    "name": "Path of Exile 2",
    "photo": "https://static-cdn.jtvnw.net/ttv-boxart/1702520304_IGDB-285x380.jpg",
    "tags": [
      { "id": 19, "name": "ARPG" },
      { "id": 13, "name": "MMORPG" },
      { "id": 14, "name": "Rol" }
    ]
  },
  {
    "id": 13,
    "name": "Rocket League",
    "photo": "https://static-cdn.jtvnw.net/ttv-boxart/30921-285x380.jpg",
    "tags": [
      { "id": 20, "name": "Deporte" },
      { "id": 21, "name": "Vehículos" },
      { "id": 3, "name": "Competitivo" }
    ]
  },
  {
    "id": 14,
    "name": "Monster Hunter Wilds",
    "photo": "https://static-cdn.jtvnw.net/ttv-boxart/1286077738_IGDB-285x380.jpg",
    "tags": [
      { "id": 22, "name": "Caza" },
      { "id": 24, "name": "Aventura" },
      { "id": 43, "name": "Cooperativo" }
    ]
  },
  {
    "id": 15,
    "name": "Street Fighter 6",
    "photo": "https://static-cdn.jtvnw.net/ttv-boxart/55453844_IGDB-285x380.jpg",
    "tags": [
      { "id": 23, "name": "Lucha" },
      { "id": 3, "name": "Competitivo" },
      { "id": 12, "name": "Multijugador" }
    ]
  },
  {
    "id": 16,
    "name": "Overwatch 2",
    "photo": "https://static-cdn.jtvnw.net/ttv-boxart/515025-285x380.jpg",
    "tags": [
      { "id": 7, "name": "FPS" },
      { "id": 3, "name": "Competitivo" },
      { "id": 43, "name": "Cooperativo" }
    ]
  },
  {
    "id": 17,
    "name": "Rust",
    "photo": "https://static-cdn.jtvnw.net/ttv-boxart/263490_IGDB-285x380.jpg",
    "tags": [
      { "id": 16, "name": "Sandbox" },
      { "id": 18, "name": "Supervivencia" },
      { "id": 43, "name": "Cooperativo" }
    ]
  },
  {
    "id": 18,
    "name": "Tom Clancy’s Rainbow Six Siege",
    "photo": "https://static-cdn.jtvnw.net/ttv-boxart/460630-285x380.jpg",
    "tags": [
      { "id": 7, "name": "FPS" },
      { "id": 8, "name": "Táctico" },
      { "id": 43, "name": "Cooperativo" }
    ]
  },
  {
    "id": 19,
    "name": "Marvel Rivals",
    "photo": "https://static-cdn.jtvnw.net/ttv-boxart/1264310518-285x380.jpg",
    "tags": [
      { "id": 25, "name": "Personajes de cómic" },
      { "id": 3, "name": "Competitivo" },
      { "id": 24, "name": "Aventura" }
    ]
  },
  {
    "id": 20,
    "name": "EA Sports FC 25",
    "photo": "https://static-cdn.jtvnw.net/ttv-boxart/2011938005_IGDB-285x380.jpg",
    "tags": [
      { "id": 20, "name": "Deporte" },
      { "id": 26, "name": "Fútbol" },
      { "id": 3, "name": "Competitivo" }
    ]
  },
  {
    "id": 21,
    "name": "Just Chatting",
    "photo": "https://static-cdn.jtvnw.net/ttv-boxart/509658-285x380.jpg",
    "tags": [
      { "id": 28, "name": "IRL" },
      { "id": 15, "name": "Fantástico" },
      { "id": 41, "name": "Conversación" },
      { "id": 42, "name": "Social" }
    ]
  }
];

const streamsData = [
  {
    "id": 1,
    "streamer": {
      "id": 1,
      "nickname": "ElRichMC",
      "photo": "https://yt3.googleusercontent.com/ytc/AIdro_lTzHSJYR8J23ApXpLf7Twi-9JB1tDiO2RsSrm3LZdX5b4=s900-c-k-c0x00ffffff-no-rj",
      "onLine": true
    },
    "game": {
      "id": 8,
      "name": "Minecraft",
      "photo": "https://static-cdn.jtvnw.net/ttv-boxart/27471_IGDB-285x380.jpg",
      "tags": [
        { "id": 16, "name": "Sandbox" },
        { "id": 17, "name": "Construcción" },
        { "id": 18, "name": "Supervivencia" },
        { "id": 36, "name": "Creativo" }
      ]
    },
    "title": "MindCrack Ep11! La caída de la dragona!",
    "thumbnail": "https://pbs.twimg.com/media/G3UuNjGX0AAoiE0?format=jpg&name=large",
    "viewers": 13600
  },
  {
    "id": 2,
    "streamer": {
      "id": 2,
      "nickname": "alexelcapo",
      "photo": "https://static-cdn.jtvnw.net/jtv_user_pictures/78528288-6216-4e21-872b-7f415b602a9a-profile_image-300x300.png",
      "onLine": true
    },
    "game": {
      "id": 21,
      "name": "Just Chatting",
      "photo": "https://static-cdn.jtvnw.net/ttv-boxart/509658-285x380.jpg",
      "tags": [
        { "id": 28, "name": "IRL" },
        { "id": 15, "name": "Fantástico" },
        { "id": 41, "name": "Conversación" },
        { "id": 42, "name": "Social" }
      ]
    },
    "title": "Hoy se viene 70% Dead God!",
    "thumbnail": "https://static-cdn.jtvnw.net/twitch-clips/AT-cm%7C1242630999-preview-480x272.jpg",
    "viewers": 10450
  },
  {
    "id": 3,
    "streamer": {
      "id": 3,
      "nickname": "Jankos",
      "photo": "https://static-cdn.jtvnw.net/jtv_user_pictures/6ac8f214-a7f3-461f-8181-ce0c25fa4f04-profile_image-300x300.png",
      "onLine": true
    },
    "game": {
      "id": 1,
      "name": "League of Legends",
      "photo": "https://static-cdn.jtvnw.net/ttv-boxart/21779-285x380.jpg",
      "tags": [
        { "id": 1, "name": "MOBA" },
        { "id": 2, "name": "eSports" },
        { "id": 3, "name": "Competitivo" },
        { "id": 9, "name": "Héroes" },
        { "id": 12, "name": "Multijugador" }
      ]
    },
    "title": "WE ARE BACK AT RANKED BOYS",
    "thumbnail": "https://static-cdn.jtvnw.net/twitch-clips-thumbnails-prod/StormyPolishedFennelJonCarnage-uNQirpq5oSr_zjm1/5d74b0e0-2aa2-482a-a22b-d294b01984cd/preview.jpg",
    "viewers": 10450
  },
  {
    "id": 4,
    "streamer": {
      "id": 4,
      "nickname": "TheGrefg",
      "photo": "https://static-cdn.jtvnw.net/jtv_user_pictures/bc9e7c87-c85a-45a6-9e45-0eb1e87eb47a-profile_image-300x300.png",
      "onLine": true
    },
    "game": {
      "id": 21,
      "name": "Just Chatting",
      "photo": "https://static-cdn.jtvnw.net/ttv-boxart/509658-285x380.jpg",
      "tags": [
        { "id": 28, "name": "IRL" },
        { "id": 15, "name": "Fantástico" },
        { "id": 41, "name": "Conversación" },
        { "id": 42, "name": "Social" }
      ]
    },
    "title": "EL CONTADOR LLEGA A SU FIN",
    "thumbnail": "https://img2.rtve.es/i/?w=1600&i=1610439490655.jpg",
    "viewers": 7200000
  },
  {
    "id": 5,
    "streamer": {
      "id": 5,
      "nickname": "Rubius",
      "photo": "https://static-cdn.jtvnw.net/jtv_user_pictures/a2592e98-5ba6-4c9a-9d9e-cf036d6f64c2-profile_image-300x300.jpg",
      "onLine": true
    },
    "game": {
      "id": 6,
      "name": "Fortnite",
      "photo": "https://static-cdn.jtvnw.net/ttv-boxart/33214-285x380.jpg",
      "tags": [
        { "id": 10, "name": "Battle Royale" },
        { "id": 11, "name": "Acción" },
        { "id": 12, "name": "Multijugador" },
        { "id": 43, "name": "Cooperativo" }
      ]
    },
    "title": "Llegaremos a top 1?",
    "thumbnail": "https://static-cdn.jtvnw.net/jtv_user_pictures/55771cd6-e4ce-4ad6-a765-f5159977feb3-profile_banner-480.jpeg",
    "viewers": 7200000
  },
  {
    "id": 6,
    "streamer": {
      "id": 6,
      "nickname": "Ibai",
      "photo": "https://static-cdn.jtvnw.net/jtv_user_pictures/574228be-01ef-4eab-bc0e-a4f6b68bedba-profile_image-300x300.png",
      "onLine": true
    },
    "game": {
      "id": 1,
      "name": "League of Legends",
      "photo": "https://static-cdn.jtvnw.net/ttv-boxart/21779-285x380.jpg",
      "tags": [
        { "id": 1, "name": "MOBA" },
        { "id": 2, "name": "eSports" },
        { "id": 3, "name": "Competitivo" },
        { "id": 9, "name": "Héroes" },
        { "id": 12, "name": "Multijugador" }
      ]
    },
    "title": "HOY WORLDS GRAN FINAL",
    "thumbnail": "https://imagenes.elpais.com/resizer/v2/CXXYSBZMDJHJNOBCTFECTL7B7Y.png?auth=ceeab292caea93ced568b9ec1239f2a1d5b218dbd33f192fd281b5631169eb23&width=1200",
    "viewers": 83500
  },
  {
    "id": 7,
    "streamer": {
      "id": 7,
      "nickname": "AuronPlay",
      "photo": "https://static-cdn.jtvnw.net/jtv_user_pictures/bf1d52e3-b46b-4c07-9b4f-a1ab8c4e40f8-profile_image-70x70.png",
      "onLine": true
    },
    "game": {
      "id": 2,
      "name": "Grand Theft Auto V",
      "photo": "https://static-cdn.jtvnw.net/ttv-boxart/6521_IGDB-285x380.jpg",
      "tags": [
        { "id": 4, "name": "Acción-Aventura" },
        { "id": 5, "name": "Mundo abierto" },
        { "id": 12, "name": "Multijugador" },
        { "id": 42, "name": "Social" }
      ]
    },
    "title": "Caos en Los Santos 😎🚗",
    "thumbnail": "https://static-cdn.jtvnw.net/twitch-clips-thumbnails-prod/GorgeousDirtyOkapiMVGame-L9rvyFD_MRtoAJDu/365ccc47-96e0-4195-bcc6-ff954950555d/preview.jpg",
    "viewers": 143200
  },
  {
    "id": 8,
    "streamer": {
      "id": 8,
      "nickname": "Pokimane",
      "photo": "https://static-cdn.jtvnw.net/jtv_user_pictures/912232e8-9e53-4fb7-aac4-14aed07869ca-profile_image-150x150.png",
      "onLine": true
    },
    "game": {
      "id": 4,
      "name": "VALORANT",
      "photo": "https://static-cdn.jtvnw.net/ttv-boxart/516575-285x380.jpg",
      "tags": [
        { "id": 7, "name": "FPS" },
        { "id": 8, "name": "Táctico" },
        { "id": 3, "name": "Competitivo" },
        { "id": 43, "name": "Cooperativo" }
      ]
    },
    "title": "¡Full ranked grind! 💥",
    "thumbnail": "https://static-cdn.jtvnw.net/twitch-clips/AT-cm%7C916665463-preview-480x272.jpg",
    "viewers": 50200
  },
  {
    "id": 9,
    "streamer": {
      "id": 9,
      "nickname": "xQc",
      "photo": "https://static-cdn.jtvnw.net/jtv_user_pictures/xqc-profile_image-9298dca608632101-70x70.jpeg",
      "onLine": true
    },
    "game": {
      "id": 16,
      "name": "Overwatch 2",
      "photo": "https://static-cdn.jtvnw.net/ttv-boxart/515025-285x380.jpg",
      "tags": [
        { "id": 7, "name": "FPS" },
        { "id": 3, "name": "Competitivo" },
        { "id": 43, "name": "Cooperativo" }
      ]
    },
    "title": "SoloQ till top 10 boys",
    "thumbnail": "https://cdn.oneesports.gg/cdn-data/2023/03/xqc_twitch_stream.jpg",
    "viewers": 99300
  },
  {
    "id": 10,
    "streamer": {
      "id": 10,
      "nickname": "Shroud",
      "photo": "https://static-cdn.jtvnw.net/jtv_user_pictures/7ed5e0c6-0191-4eef-8328-4af6e4ea5318-profile_image-70x70.png",
      "onLine": true
    },
    "game": {
      "id": 3,
      "name": "Counter-Strike 2",
      "photo": "https://static-cdn.jtvnw.net/ttv-boxart/32399-285x380.jpg",
      "tags": [
        { "id": 7, "name": "FPS" },
        { "id": 8, "name": "Táctico" },
        { "id": 3, "name": "Competitivo" },
        { "id": 12, "name": "Multijugador" }
      ]
    },
    "title": "Loot or die 💀",
    "thumbnail": "https://static-cdn.jtvnw.net/twitch-clips-thumbnails-prod/SecretiveSnappyShieldWOOP-eL0I7TEToQDzZvXC/390f0e4e-94cf-4a8f-b84e-0e1936b0e3ed/preview.jpg",
    "viewers": 47300
  },
  {
    "id": 11,
    "streamer": {
      "id": 11,
      "nickname": "Ninja",
      "photo": "https://static-cdn.jtvnw.net/jtv_user_pictures/90d40495-f467-4911-9035-72d8d10a49c5-profile_image-150x150.png",
      "onLine": true
    },
    "game": {
      "id": 6,
      "name": "Fortnite",
      "photo": "https://static-cdn.jtvnw.net/ttv-boxart/33214-285x380.jpg",
      "tags": [
        { "id": 10, "name": "Battle Royale" },
        { "id": 11, "name": "Acción" },
        { "id": 12, "name": "Multijugador" },
        { "id": 43, "name": "Cooperativo" }
      ]
    },
    "title": "wanna play fw with me",
    "thumbnail": "https://static-cdn.jtvnw.net/twitch-clips-thumbnails-prod/SmokyTameMouseLitty-R-U5Xgu-YZc0pzPW/9016f90f-95db-4db9-8b04-fbe8b9374f48/preview.jpg",
    "viewers": 61000
  },
  {
    "id": 12,
    "streamer": {
      "id": 12,
      "nickname": "PewDiePie",
      "photo": "https://static-cdn.jtvnw.net/jtv_user_pictures/fb3a0d41-4cd4-4d2c-9c1c-8d49c195b4a2-profile_image-70x70.png",
      "onLine": true
    },
    "game": {
      "id": 8,
      "name": "Minecraft",
      "photo": "https://static-cdn.jtvnw.net/ttv-boxart/27471_IGDB-285x380.jpg",
      "tags": [
        { "id": 16, "name": "Sandbox" },
        { "id": 17, "name": "Construcción" },
        { "id": 18, "name": "Supervivencia" },
        { "id": 36, "name": "Creativo" }
      ]
    },
    "title": "what is this...",
    "thumbnail": "https://static-cdn.jtvnw.net/twitch-clips-thumbnails-prod/EagerPopularScallionStinkyCheese-nCeBi7UF4Ar6sIeC/a00e06dc-fb9a-4a3b-9903-1cb54aa9e14c/preview.jpg",
    "viewers": 35600
  },
  {
    "id": 13,
    "streamer": {
      "id": 13,
      "nickname": "Asmongold247",
      "photo": "https://static-cdn.jtvnw.net/jtv_user_pictures/e9f84ea0-72b8-486f-9afd-4a5e8c62305f-profile_image-70x70.png",
      "onLine": true
    },
    "game": {
      "id": 7,
      "name": "World of Warcraft",
      "photo": "https://static-cdn.jtvnw.net/ttv-boxart/18122-285x380.jpg",
      "tags": [
        { "id": 13, "name": "MMORPG" },
        { "id": 14, "name": "Rol" },
        { "id": 15, "name": "Fantástico" },
        { "id": 12, "name": "Multijugador" }
      ]
    },
    "title": "Raid night with the boys ⚔️",
    "thumbnail": "https://www.hindustantimes.com/ht-img/img/2024/10/16/550x309/Asmongold_1729050470634_1729050478502.jpg",
    "viewers": 81200
  },
  {
    "id": 14,
    "streamer": {
      "id": 14,
      "nickname": "Quackity",
      "photo": "https://static-cdn.jtvnw.net/jtv_user_pictures/823b1a32-eb4e-425a-b1e6-48913ed58f1b-profile_image-70x70.png",
      "onLine": true
    },
    "game": {
      "id": 8,
      "name": "Minecraft",
      "photo": "https://static-cdn.jtvnw.net/ttv-boxart/27471_IGDB-285x380.jpg",
      "tags": [
        { "id": 16, "name": "Sandbox" },
        { "id": 17, "name": "Construcción" },
        { "id": 18, "name": "Supervivencia" },
        { "id": 36, "name": "Creativo" }
      ]
    },
    "title": "Quackity SMP is back?",
    "thumbnail": "https://staticg.sportskeeda.com/editor/2025/03/2c2a3-17423534322506-1920.jpg?w=640",
    "viewers": 24900
  },
  {
    "id": 15,
    "streamer": {
      "id": 15,
      "nickname": "Luzu",
      "photo": "https://static-cdn.jtvnw.net/jtv_user_pictures/2f3b8fd5-b2d2-403b-9aaf-16e69073b584-profile_image-70x70.png",
      "onLine": true
    },
    "game": {
      "id": 8,
      "name": "Minecraft",
      "photo": "https://static-cdn.jtvnw.net/ttv-boxart/27471_IGDB-285x380.jpg",
      "tags": [
        { "id": 16, "name": "Sandbox" },
        { "id": 17, "name": "Construcción" },
        { "id": 18, "name": "Supervivencia" },
        { "id": 36, "name": "Creativo" }
      ]
    },
    "title": "Luzu modo diablo XD",
    "thumbnail": "https://i.ytimg.com/vi/pjcoakh1m38/hq720.jpg?sqp=-oaymwEhCK4FEIIDSFryq4qpAxMIARUAAAAAGAElAADIQj0AgKJD&rs=AOn4CLCsyW8YUYCEzdzhAh5_yslHaPpZlA",
    "viewers": 28200
  }
];

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
