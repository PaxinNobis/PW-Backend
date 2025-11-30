import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const API_URL = 'http://localhost:8080/api';

async function main() {
    try {
        console.log('🧪 Verifying Streaming Implementation (VDO.Ninja)\n');

        // 1. Create a test streamer
        const email = `streamer_${Date.now()}@test.com`;
        const name = `Streamer${Date.now()}`;
        const registerRes = await fetch(`${API_URL}/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password: 'test123', name })
        });
        const userData: any = await registerRes.json();
        const token = userData.token;

        if (!userData.success) {
            throw new Error(`Registration failed: ${JSON.stringify(userData)}`);
        }

        console.log(`👤 Created streamer: ${name}`);

        // 2. Update Stream Settings (Set iframeUrl)
        const iframeUrl = 'https://vdo.ninja/?view=test_stream_id';
        console.log(`📝 Updating stream settings with iframeUrl: ${iframeUrl}...`);

        const updateRes = await fetch(`${API_URL}/streamer/settings`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                title: 'Test Stream VDO.Ninja',
                iframeUrl: iframeUrl,
                isLive: true
            })
        });

        const updateData: any = await updateRes.json();

        if (!updateData.success) {
            throw new Error(`Update failed: ${JSON.stringify(updateData)}`);
        }

        console.log('✅ Stream settings updated successfully.');

        // 3. Verify Public Data
        console.log('🔍 Fetching public stream details...');
        const detailsRes = await fetch(`${API_URL}/data/streams/details/${name}`);
        const detailsData: any = await detailsRes.json();

        if (!detailsData.success) {
            throw new Error(`Fetch details failed: ${JSON.stringify(detailsData)}`);
        }

        const stream = detailsData.stream;
        console.log('\n📺 Stream Details:');
        console.log(`   - Title: ${stream.title}`);
        console.log(`   - Iframe URL: ${stream.iframeUrl}`);
        console.log(`   - Is Live: ${stream.isLive}`);

        if (stream.iframeUrl === iframeUrl) {
            console.log('\n✅ SUCCESS: iframeUrl matches!');
        } else {
            console.error('\n❌ FAILURE: iframeUrl does not match.');
        }

    } catch (error) {
        console.error('❌ Test failed:', error);
    } finally {
        await prisma.$disconnect();
    }
}

main();
