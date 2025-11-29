# 📡 API Endpoints - AstroTV Backend

## 🔐 Autenticación (`/api/auth`)

### POST `/api/auth/register`
Registrar un nuevo usuario.

**Body:**
```json
{
  "email": "string",
  "name": "string",
  "password": "string"
}
```

**Response (201):**
```json
{
  "message": "Usuario registrado exitosamente",
  "token": "string",
  "user": {
    "id": "string",
    "email": "string",
    "name": "string"
  }
}
```

---

### POST `/api/auth/login`
Iniciar sesión.

**Body:**
```json
{
  "email": "string",
  "password": "string"
}
```

**Response (200):**
```json
{
  "message": "Inicio de sesión exitoso",
  "token": "string",
  "user": {
    "id": "string",
    "email": "string",
    "name": "string",
    "level": "number",
    "points": "number",
    "coins": "number"
  }
}
```

---

### GET `/api/auth/me`
Obtener información del usuario actual.

**Headers:**
```
Authorization: Bearer <token>
```

**Response (200):**
```json
{
  "id": "string",
  "email": "string",
  "name": "string",
  "level": "number",
  "points": "number",
  "coins": "number"
}
```

---

## 👤 Usuario (`/api/user`)

### GET `/api/user/following`
Obtener lista de streamers que el usuario sigue.

**Headers:**
```
Authorization: Bearer <token>
```

**Response (200):**
```json
[
  {
    "id": "string",
    "name": "string",
    "email": "string",
    "stream": {
      "id": "string",
      "title": "string",
      "thumbnail": "string",
      "viewers": "number",
      "isLive": "boolean"
    }
  }
]
```

---

### POST `/api/user/follow/:streamerId`
Seguir o dejar de seguir a un streamer.

**Headers:**
```
Authorization: Bearer <token>
```

**Params:**
- `streamerId`: ID del streamer

**Response (200):**
```json
{
  "message": "Ahora sigues al streamer" | "Has dejado de seguir al streamer",
  "isFollowing": "boolean"
}
```

---

## 📊 Datos Públicos (`/api/data`)

### GET `/api/data/streams`
Obtener todos los streams.

**Response (200):**
```json
[
  {
    "id": "string",
    "title": "string",
    "thumbnail": "string",
    "viewers": "number",
    "isLive": "boolean",
    "streamer": {
      "id": "string",
      "name": "string",
      "email": "string"
    },
    "game": {
      "id": "string",
      "name": "string",
      "photo": "string"
    },
    "tags": [
      {
        "id": "string",
        "name": "string"
      }
    ]
  }
]
```

---

### GET `/api/data/tags`
Obtener todos los tags.

**Response (200):**
```json
[
  {
    "id": "string",
    "name": "string",
    "_count": {
      "streams": "number",
      "games": "number"
    }
  }
]
```

---

### GET `/api/data/games`
Obtener todos los juegos.

**Response (200):**
```json
[
  {
    "id": "string",
    "name": "string",
    "photo": "string",
    "tags": [
      {
        "id": "string",
        "name": "string"
      }
    ],
    "_count": {
      "streams": "number"
    }
  }
]
```

---

### GET `/api/data/streams/details/:nickname`
Obtener detalles de un stream por nickname del streamer.

**Params:**
- `nickname`: Nombre del streamer

**Response (200):**
```json
{
  "id": "string",
  "title": "string",
  "thumbnail": "string",
  "viewers": "number",
  "isLive": "boolean",
  "streamer": {
    "id": "string",
    "name": "string",
    "email": "string"
  },
  "game": {
    "id": "string",
    "name": "string",
    "photo": "string"
  },
  "tags": [
    {
      "id": "string",
      "name": "string"
    }
  ]
}
```

---

### GET `/api/data/search/:query`
Buscar streams por título o nombre del streamer.

**Params:**
- `query`: Término de búsqueda

**Response (200):**
```json
[
  {
    "id": "string",
    "title": "string",
    "thumbnail": "string",
    "viewers": "number",
    "isLive": "boolean",
    "streamer": {
      "id": "string",
      "name": "string",
      "email": "string"
    },
    "game": {
      "id": "string",
      "name": "string",
      "photo": "string"
    },
    "tags": [
      {
        "id": "string",
        "name": "string"
      }
    ]
  }
]
```

---

## 🎨 Panel de Creador (`/api/panel`)

> **Nota:** Todas las rutas de panel requieren autenticación con rol STREAMER

### GET `/api/panel/analytics`
Obtener analíticas del streamer.

**Headers:**
```
Authorization: Bearer <token>
```

**Response (200):**
```json
{
  "id": "string",
  "horasTransmitidas": "number",
  "monedasRecibidas": "number",
  "streamerId": "string"
}
```

---

### GET `/api/panel/gifts`
Obtener regalos personalizados del streamer.

**Headers:**
```
Authorization: Bearer <token>
```

**Response (200):**
```json
[
  {
    "id": "string",
    "nombre": "string",
    "costo": "number",
    "puntos": "number",
    "streamerId": "string"
  }
]
```

---

### POST `/api/panel/gifts`
Crear un nuevo regalo personalizado.

**Headers:**
```
Authorization: Bearer <token>
```

**Body:**
```json
{
  "nombre": "string",
  "costo": "number",
  "puntos": "number"
}
```

**Response (201):**
```json
{
  "id": "string",
  "nombre": "string",
  "costo": "number",
  "puntos": "number",
  "streamerId": "string"
}
```

---

### PUT `/api/panel/gifts/:id`
Editar un regalo existente.

**Headers:**
```
Authorization: Bearer <token>
```

**Params:**
- `id`: ID del regalo

**Body:**
```json
{
  "nombre": "string",
  "costo": "number",
  "puntos": "number"
}
```

**Response (200):**
```json
{
  "id": "string",
  "nombre": "string",
  "costo": "number",
  "puntos": "number",
  "streamerId": "string"
}
```

---

### DELETE `/api/panel/gifts/:id`
Eliminar un regalo.

**Headers:**
```
Authorization: Bearer <token>
```

**Params:**
- `id`: ID del regalo

**Response (200):**
```json
{
  "message": "Regalo eliminado exitosamente"
}
```

---

### GET `/api/panel/loyalty-levels`
Obtener niveles de lealtad del streamer.

**Headers:**
```
Authorization: Bearer <token>
```

**Response (200):**
```json
[
  {
    "id": "string",
    "nombre": "string",
    "puntosRequeridos": "number",
    "recompensa": "string",
    "streamerId": "string"
  }
]
```

---

### PUT `/api/panel/loyalty-levels`
Actualizar/crear niveles de lealtad.

**Headers:**
```
Authorization: Bearer <token>
```

**Body:**
```json
{
  "levels": [
    {
      "nombre": "string",
      "puntosRequeridos": "number",
      "recompensa": "string"
    }
  ]
}
```

**Response (200):**
```json
[
  {
    "id": "string",
    "nombre": "string",
    "puntosRequeridos": "number",
    "recompensa": "string",
    "streamerId": "string"
  }
]
```

---

## 🎥 Streamer (`/api/streamer`)

### GET `/api/streamer/:streamerId/gifts`
Obtener lista de regalos de un streamer específico.

**Headers:**
```
Authorization: Bearer <token>
```

**Params:**
- `streamerId`: ID del streamer

**Response (200):**
```json
{
  "success": true,
  "gifts": [
    {
      "id": "string",
      "nombre": "string",
      "costo": "number",
      "puntos": "number"
    }
  ]
}
```

---

## 💰 Pagos (`/api/payment`)

### GET `/api/payment/coin-packs`
Obtener paquetes de monedas disponibles.

**Response (200):**
```json
[
  {
    "id": "string",
    "nombre": "string",
    "valor": "number",
    "en_soles": "number"
  }
]
```

---

### POST `/api/payment/create-checkout-session`
Crear sesión de pago con Stripe.

**Headers:**
```
Authorization: Bearer <token>
```

**Body:**
```json
{
  "coinPackId": "string"
}
```

**Response (200):**
```json
{
  "sessionId": "string",
  "url": "string"
}
```

---

### POST `/api/payment/webhook`
Webhook de Stripe para confirmar pagos.

**Headers:**
```
stripe-signature: <signature>
```

**Body:** (Raw Stripe event)

**Response (200):**
```json
{
  "received": true
}
```

---

## 🔑 Códigos de Estado HTTP

- **200** - OK
- **201** - Created
- **400** - Bad Request
- **401** - Unauthorized
- **403** - Forbidden
- **404** - Not Found
- **500** - Internal Server Error

---

## 🛡️ Autenticación

La mayoría de los endpoints requieren autenticación mediante JWT. Incluye el token en el header:

```
Authorization: Bearer <tu_token_jwt>
```

El token se obtiene al hacer login o registro exitoso.
