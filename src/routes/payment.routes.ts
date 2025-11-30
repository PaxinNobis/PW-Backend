import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import Stripe from 'stripe';
import { authMiddleware } from '../middleware/auth.middleware';

const router = Router();
const prisma = new PrismaClient();

// Inicializar Stripe (requiere la clave secreta)
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2025-02-24.acacia', // Actualizado a la versión requerida
});

// GET /api/payment/coin-packs - Obtener paquetes de monedas disponibles
router.get('/coin-packs', async (req: Request, res: Response) => {
  try {
    const coinPacks = await prisma.coinPack.findMany({
      orderBy: { valor: 'asc' },
    });

    return res.status(200).json({ success: true, coinPacks });
  } catch (error) {
    console.error('Error al obtener paquetes de monedas:', error);
    res.status(500).json({ error: 'Error al obtener paquetes de monedas' });
  }
});

// POST /api/payment/create-checkout-session - Crear sesión de pago con Stripe
router.post('/create-checkout-session', authMiddleware, async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'No autenticado' });
    }

    const { coinPackId, amount } = req.body;

    if (!coinPackId && !amount) {
      return res.status(400).json({ error: 'Se requiere coinPackId o amount' });
    }

    if (coinPackId && typeof coinPackId !== 'string') {
      return res.status(400).json({ error: 'coinPackId debe ser un UUID válido (string)' });
    }

    let priceInSoles = 0;
    let coinsToGive = 0;
    let productName = '';
    let productDesc = '';

    if (coinPackId) {
      // Lógica existente para paquetes
      const coinPack = await prisma.coinPack.findUnique({
        where: { id: coinPackId },
      });

      if (!coinPack) {
        return res.status(404).json({ error: 'Paquete de monedas no encontrado' });
      }

      priceInSoles = coinPack.en_soles;
      coinsToGive = coinPack.valor;
      productName = coinPack.nombre;
      productDesc = `${coinPack.valor} Astrocoins`;
    } else {
      // Lógica para cantidad personalizada
      // Tasa base: 0.05 PEN por moneda
      const BASE_RATE = 0.05;
      coinsToGive = Number(amount);

      if (isNaN(coinsToGive) || coinsToGive <= 0) {
        return res.status(400).json({ error: 'Cantidad de monedas inválida' });
      }

      priceInSoles = coinsToGive * BASE_RATE;

      // Validar mínimo de Stripe (~$0.50 USD => ~2.00 PEN)
      if (priceInSoles < 2.00) {
        return res.status(400).json({ error: 'El monto mínimo es de 40 monedas (2.00 PEN)' });
      }

      productName = `${coinsToGive} Astrocoins`;
      productDesc = `Compra personalizada de ${coinsToGive} monedas`;
    }

    // Crear sesión de checkout en Stripe (Embedded Checkout)
    const session = await stripe.checkout.sessions.create({
      ui_mode: 'embedded',
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'pen',
            product_data: {
              name: productName,
              description: productDesc,
              images: ['https://via.placeholder.com/300x300?text=AstroCoin'],
            },
            unit_amount: Math.round(priceInSoles * 100), // Stripe usa centavos
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      return_url: `${process.env.FRONTEND_URL || 'https://paxinnobis.github.io/PW-Frontend'}/payment/return?session_id={CHECKOUT_SESSION_ID}`,
      metadata: {
        userId: req.user.userId,
        coinPackId: coinPackId || 'custom',
        coinValue: coinsToGive.toString(),
      },
    });

    // Crear registro de transacción pendiente
    await prisma.transaction.create({
      data: {
        userId: req.user.userId,
        sessionId: session.id,
        amount: priceInSoles,
        coins: coinsToGive,
        status: 'pending',
        paymentMethod: 'stripe',
      },
    });

    return res.status(200).json({
      success: true,
      clientSecret: session.client_secret,
    });
  } catch (error: any) {
    console.error('Error al crear sesión de pago:', error);
    console.error('Detalles del error:', JSON.stringify(error, null, 2));
    res.status(500).json({ error: 'Error al crear sesión de pago', details: error.message });
  }
});

// POST /api/payment/verify-session - Verificar estado de sesión (para localhost/fallback)
router.post('/verify-session', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { sessionId } = req.body;

    if (!sessionId) {
      console.error(' sessionId faltante');
      return res.status(400).json({ error: 'sessionId es requerido' });
    }

    // 1. Verificar si ya fue procesada
    const existingTransaction = await prisma.transaction.findFirst({
      where: { sessionId, status: 'completed' },
    });

    if (existingTransaction) {
      return res.status(200).json({ success: true, message: 'Pago ya procesado anteriormente' });
    }

    // 2. Consultar a Stripe
    const session = await stripe.checkout.sessions.retrieve(sessionId);

    if (session.payment_status === 'paid') {
      const userId = session.metadata?.userId;
      const coinValue = Number(session.metadata?.coinValue);

      if (userId && coinValue) {
        // 3. Actualizar transacción y usuario en una transacción de BD
        await prisma.$transaction(async (tx) => {
          // Intentar marcar como completada SOLO si estaba pendiente
          const updateResult = await tx.transaction.updateMany({
            where: { sessionId, status: 'pending' },
            data: { status: 'completed', completedAt: new Date() },
          });

          if (updateResult.count > 0) {
            // Caso 1: Transacción existía y estaba pendiente -> Éxito, sumar monedas
            await tx.user.update({
              where: { id: userId },
              data: { coins: { increment: coinValue } },
            });
            return;
          }

          // Caso 2: No se actualizó ninguna fila.
          // Puede ser porque ya estaba completada O porque no existía.
          const existingTx = await tx.transaction.findFirst({ where: { sessionId } });

          if (existingTx) {
            // Si existe, significa que ya estaba completada (o fallida). No sumar monedas.
            return;
          }

          // Caso 3: No existía la transacción (raro, pero posible si falló create-checkout-session)
          // Crear la transacción directamente como completada y sumar monedas
          await tx.transaction.create({
            data: {
              userId,
              sessionId,
              amount: session.amount_total ? session.amount_total / 100 : 0,
              coins: coinValue,
              status: 'completed',
              paymentMethod: 'stripe',
              completedAt: new Date(),
            }
          });

          await tx.user.update({
            where: { id: userId },
            data: { coins: { increment: coinValue } },
          });
        });

        return res.status(200).json({ success: true, message: 'Pago verificado y monedas agregadas' });
      }
    }

    return res.status(400).json({ success: false, status: session.payment_status });

  } catch (error: any) {
    console.error('Error al verificar sesión:', error);
    res.status(500).json({ error: 'Error al verificar sesión', details: error.message });
  }
});

// POST /api/payment/webhook - Webhook de Stripe para confirmar pagos
router.post('/webhook', async (req: Request, res: Response) => {
  const sig = req.headers['stripe-signature'];

  if (!sig) {
    return res.status(400).json({ error: 'No se proporcionó firma de Stripe' });
  }

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(
      req.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET || ''
    );
  } catch (err: any) {
    console.error('Error al verificar webhook:', err.message);
    return res.status(400).json({ error: `Webhook Error: ${err.message}` });
  }

  // Manejar el evento de pago exitoso
  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session;
    const sessionId = session.id;

    // Verificar si ya fue procesada (Idempotencia rápida)
    const existingTransaction = await prisma.transaction.findFirst({
      where: { sessionId, status: 'completed' },
    });

    if (existingTransaction) {
      return res.status(200).json({ received: true });
    }

    const userId = session.metadata?.userId;
    const coinValue = Number(session.metadata?.coinValue);

    if (userId && coinValue) {
      try {
        await prisma.$transaction(async (tx) => {
          // Intentar marcar como completada SOLO si estaba pendiente
          const updateResult = await tx.transaction.updateMany({
            where: { sessionId, status: 'pending' },
            data: { status: 'completed', completedAt: new Date() },
          });

          if (updateResult.count > 0) {
            // Caso 1: Transición exitosa de pending -> completed
            await tx.user.update({
              where: { id: userId },
              data: { coins: { increment: coinValue } },
            });
            return;
          }

          // Caso 2: Verificar si ya existe (para evitar duplicados si update falló por status)
          const existingTx = await tx.transaction.findFirst({ where: { sessionId } });
          if (existingTx) {
            // Ya existe (completada o fallida), no hacer nada
            return;
          }

          // Caso 3: No existía, crearla
          await tx.transaction.create({
            data: {
              userId,
              sessionId,
              amount: session.amount_total ? session.amount_total / 100 : 0,
              coins: coinValue,
              status: 'completed',
              paymentMethod: 'stripe',
              completedAt: new Date(),
            }
          });

          await tx.user.update({
            where: { id: userId },
            data: { coins: { increment: coinValue } },
          });
        });
      } catch (error) {
        console.error('Error al actualizar monedas del usuario:', error);
      }
    }
  }

  return res.status(200).json({ success: true, received: true });
});

// GET /api/payment/transaction-history - Obtener historial de transacciones
router.get('/transaction-history', authMiddleware, async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'No autenticado' });
    }

    const { page = '1', limit = '10', status } = req.query;
    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const skip = (pageNum - 1) * limitNum;

    const where: any = { userId: req.user.userId };
    if (status) {
      where.status = status;
    }

    // Nota: Asumimos que existe el modelo Transaction basado en schema.prisma
    // Si no existe, esto fallará y requerirá ajuste en schema.prisma, pero el usuario indicó que ya estaba en la BD propuesta
    const [transactions, total] = await Promise.all([
      prisma.transaction.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limitNum,
      }),
      prisma.transaction.count({ where }),
    ]);

    return res.status(200).json({
      success: true,
      transactions,
      total,
      page: pageNum,
      totalPages: Math.ceil(total / limitNum),
    });
  } catch (error) {
    console.error('Error al obtener historial de transacciones:', error);
    res.status(500).json({ error: 'Error al obtener historial de transacciones' });
  }
});

// GET /api/payment/balance - Obtener balance de monedas
router.get('/balance', authMiddleware, async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'No autenticado' });
    }

    const user = await prisma.user.findUnique({
      where: { id: req.user.userId },
      select: { coins: true },
    });

    if (!user) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    // Obtener última compra
    const lastPurchase = await prisma.transaction.findFirst({
      where: {
        userId: req.user.userId,
        status: 'completed'
      },
      orderBy: { completedAt: 'desc' },
    });

    return res.status(200).json({
      success: true,
      coins: user.coins || 0,
      lastPurchase: lastPurchase ? {
        date: lastPurchase.completedAt,
        amount: lastPurchase.amount,
        coins: lastPurchase.coins,
      } : null,
    });
  } catch (error) {
    console.error('Error al obtener balance:', error);
    res.status(500).json({ error: 'Error al obtener balance' });
  }
});

export default router;
