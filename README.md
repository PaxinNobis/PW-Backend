# AstroTV Backend

Backend API para la plataforma de streaming AstroTV construido con Node.js, Express, Prisma y PostgreSQL.

## 📋 Requisitos Previos

- Node.js (v18 o superior)
- npm o yarn
- PostgreSQL (v14 o superior)

## 🚀 Instalación

### 1. Instalar dependencias

```bash
npm install
```

### 2. Configurar variables de entorno

Copia el archivo `.env.example` a `.env` y configura tus credenciales:

```bash
cp .env.example .env
```

Edita el archivo `.env` con tus valores:

```env
DATABASE_URL="postgresql://usuario:password@localhost:5432/astrotv_db?schema=public"
JWT_SECRET="tu_secreto_jwt_super_seguro"
PORT=8080
STRIPE_SECRET_KEY="sk_test_..."
STRIPE_WEBHOOK_SECRET="whsec_..."
```

### 3. Configurar Base de Datos

```bash
# Generar el cliente de Prisma
npm run prisma:generate

# Ejecutar migraciones
npm run prisma:migrate

# (Opcional) Poblar la base de datos con datos de ejemplo
npm run prisma:seed
```

## 🏃‍♂️ Ejecutar el Proyecto

### Modo Desarrollo

```bash
npm run dev
```

El servidor estará disponible en `http://localhost:8080`

### Modo Producción

```bash
# Compilar TypeScript
npm run build

# Ejecutar servidor
npm start
```

## 📡 Endpoints de API

### Autenticación (`/api/auth`)

- `POST /api/auth/register` - Registrar nuevo usuario
- `POST /api/auth/login` - Iniciar sesión
- `GET /api/auth/me` - Obtener usuario actual (requiere autenticación)

### Datos Públicos (`/api/data`)

- `GET /api/data/streams` - Obtener todos los streams
- `GET /api/data/tags` - Obtener todos los tags
- `GET /api/data/games` - Obtener todos los juegos
- `GET /api/data/streams/details/:nickname` - Obtener detalles de un stream
- `GET /api/data/search/:query` - Buscar streams

### Usuario (`/api/user`) - Rutas Protegidas

- `GET /api/user/following` - Obtener streamers seguidos
- `POST /api/user/follow/:streamerId` - Seguir/dejar de seguir
- `POST /api/user/become-creator` - Convertirse en creador

### Panel de Creador (`/api/panel`) - Rutas Protegidas (Solo Streamers)

- `GET /api/panel/analytics` - Obtener analíticas
- `GET /api/panel/gifts` - Obtener regalos
- `POST /api/panel/gifts` - Crear regalo
- `PUT /api/panel/gifts/:id` - Editar regalo
- `DELETE /api/panel/gifts/:id` - Eliminar regalo
- `GET /api/panel/loyalty-levels` - Obtener niveles de lealtad
- `PUT /api/panel/loyalty-levels` - Actualizar niveles de lealtad

### Pagos (`/api/payment`) - Rutas Protegidas

- `GET /api/payment/coin-packs` - Obtener paquetes de monedas
- `POST /api/payment/create-checkout-session` - Crear sesión de pago
- `POST /api/payment/webhook` - Webhook de Stripe

## 🔌 WebSocket (Chat)

El servidor WebSocket está disponible en `ws://localhost:8080`

### Mensajes del Cliente

**Unirse a un chat:**
```json
{
  "type": "join",
  "token": "JWT_TOKEN",
  "streamerNickname": "nickname_del_streamer"
}
```

**Enviar mensaje:**
```json
{
  "type": "chat",
  "text": "Hola! 👋"
}
```

**Salir del chat:**
```json
{
  "type": "leave"
}
```

### Mensajes del Servidor

**Confirmación de unión:**
```json
{
  "type": "joined",
  "message": "Te has unido al chat",
  "streamId": "uuid",
  "streamerName": "nombre"
}
```

**Historial de mensajes:**
```json
{
  "type": "history",
  "messages": [...]
}
```

**Nuevo mensaje:**
```json
{
  "type": "message",
  "message": {
    "id": "uuid",
    "text": "Mensaje",
    "createdAt": "timestamp",
    "author": { "id": "uuid", "name": "nombre" }
  }
}
```

## 🗄️ Esquema de Base de Datos

El proyecto utiliza Prisma ORM con PostgreSQL. Los modelos principales son:

- **User** - Usuarios (espectadores y streamers)
- **Stream** - Transmisiones en vivo
- **Game** - Juegos/categorías
- **Tag** - Etiquetas
- **ChatMessage** - Mensajes del chat
- **Analytics** - Analíticas del streamer
- **Gift** - Regalos personalizados
- **LoyaltyLevel** - Niveles de lealtad
- **CoinPack** - Paquetes de monedas

## 🛠️ Comandos Útiles

```bash
# Ver base de datos con Prisma Studio
npm run prisma:studio

# Crear nueva migración
npx prisma migrate dev --name nombre_migracion

# Resetear base de datos
npx prisma migrate reset

# Formatear código Prisma
npx prisma format
```

## 📦 Tecnologías

- **Node.js** - Runtime de JavaScript
- **Express** - Framework web
- **Prisma** - ORM para base de datos
- **PostgreSQL** - Base de datos relacional
- **TypeScript** - Tipado estático
- **JWT** - Autenticación
- **bcryptjs** - Hash de contraseñas
- **WebSocket (ws)** - Chat en tiempo real
- **Stripe** - Pasarela de pagos

## 🔒 Seguridad

- Las contraseñas se hashean con bcryptjs
- Las rutas protegidas requieren JWT válido
- Los tokens expiran después de 7 días
- Validación de roles para rutas de streamer

## 📝 Notas

- Asegúrate de tener PostgreSQL corriendo antes de iniciar el servidor
- Configura correctamente las credenciales de Stripe para el módulo de pagos
- Los errores de TypeScript se resolverán una vez instaladas las dependencias

## 🤝 Contribución

Este proyecto es parte del desarrollo de AstroTV.

## 📄 Licencia

ISC
