import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import Stripe from 'stripe';
import { authMiddleware } from '../middleware/auth.middleware';

const router = Router();
const prisma = new PrismaClient();

// Inicializar Stripe (requiere la clave secreta)
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2024-11-20.acacia',
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

    const { coinPackId } = req.body;

    if (!coinPackId) {
      return res.status(400).json({ error: 'coinPackId es requerido' });
    }

    // Buscar el paquete de monedas
    const coinPack = await prisma.coinPack.findUnique({
      where: { id: coinPackId },
    });

    if (!coinPack) {
      return res.status(404).json({ error: 'Paquete de monedas no encontrado' });
    }

    // Crear sesión de checkout en Stripe
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'pen',
            product_data: {
              name: coinPack.nombre,
              description: `${coinPack.valor} DogeCoins`,
            },
            unit_amount: Math.round(coinPack.en_soles * 100), // Stripe usa centavos
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      success_url: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/payment/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/payment/cancel`,
      metadata: {
        userId: req.user.userId,
        coinPackId: coinPack.id,
        coinValue: coinPack.valor.toString(),
      },
    });

    return res.status(200).json({
      success: true,
      sessionId: session.id,
      url: session.url,
    });
  } catch (error) {
    console.error('Error al crear sesión de pago:', error);
    res.status(500).json({ error: 'Error al crear sesión de pago' });
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

    const userId = session.metadata?.userId;
    const coinValue = session.metadata?.coinValue;

    if (userId && coinValue) {
      try {
        // Actualizar las monedas del usuario
        const user = await prisma.user.findUnique({
          where: { id: userId },
        });

        if (user) {
          await prisma.user.update({
            where: { id: userId },
            data: {
              coins: (user.coins || 0) + Number(coinValue),
            },
          });

          console.log(`Se agregaron ${coinValue} monedas al usuario ${userId}`);
        }
      } catch (error) {
        console.error('Error al actualizar monedas del usuario:', error);
      }
    }
  }

  return res.status(200).json({ success: true, received: true });
});

export default router;
