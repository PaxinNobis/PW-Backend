import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const API_URL = 'http://localhost:8080/api';

function sleep(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function main() {
    try {
        console.log('🧪 Verifying Stream Analytics & Duration Tracking\n');

        // 1. Create a test streamer
        const email = `analytics_${Date.now()}@test.com`;
        const name = `Analytics${Date.now()}`;
        const registerRes = await fetch(`${API_URL}/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password: 'test123', name })
        });
        const userData: any = await registerRes.json();
        const token = userData.token;
        const userId = userData.user.id;

        if (!userData.success) {
            throw new Error(`Registration failed: ${JSON.stringify(userData)}`);
        }

        console.log(`👤 Created streamer: ${name}`);

        // 2. Start Stream
        console.log('🔴 Starting stream...');
        await fetch(`${API_URL}/streamer/settings`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ isLive: true })
        });

        // 3. Wait for 3 seconds
        console.log('⏳ Streaming for 3 seconds...');
        await sleep(3000);

        // 4. Stop Stream
        console.log('⚫ Stopping stream...');
        await fetch(`${API_URL}/streamer/settings`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ isLive: false })
        });

        // 5. Verify Analytics
        console.log('🔍 Checking user stats...');
        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: { streamingHours: true }
        });

        const analytics = await prisma.analytics.findUnique({
            where: { streamerId: userId }
        });

        console.log(`   - User Streaming Hours: ${user?.streamingHours}`);
        console.log(`   - Analytics Hours: ${analytics?.horasTransmitidas}`);

        if (user?.streamingHours && user.streamingHours > 0) {
            console.log('\n✅ SUCCESS: Streaming hours updated!');
        } else {
            console.error('\n❌ FAILURE: Streaming hours did not update.');
        }

    } catch (error) {
        console.error('❌ Test failed:', error);
    } finally {
        await prisma.$disconnect();
    }
}

main();
