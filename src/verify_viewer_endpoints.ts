import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const API_URL = 'http://localhost:8080/api';

async function main() {
    try {
        // 1. Setup: Get a stream
        const stream = await prisma.stream.findFirst();
        if (!stream) throw new Error('No stream found');

        console.log(`Testing with Stream ID: ${stream.id}`);

        // 2. Create a viewer
        const viewer: any = await createTestUser('viewer_test');
        console.log(`Viewer created: ${viewer.user.name}`);

        // 3. Test Join Stream
        console.log('\n--- Testing Join Stream ---');
        const joinRes = await fetch(`${API_URL}/viewer/join/${stream.id}`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${viewer.token}` }
        });
        const joinData: any = await joinRes.json();

        if (joinData.success) {
            console.log(`Join Stream: OK (Current Viewers: ${joinData.currentViewers})`);
        } else {
            console.error('Join Stream: FAILED', joinData);
        }

        // 4. Test Get Viewers List
        console.log('\n--- Testing Get Viewers List ---');
        const listRes = await fetch(`${API_URL}/viewer/viewers/${stream.id}`, {
            method: 'GET',
            headers: { 'Authorization': `Bearer ${viewer.token}` }
        });
        const listData: any = await listRes.json();

        const found = listData.viewers.find((v: any) => v.id === viewer.user.id);
        if (listData.success && found) {
            console.log('Get Viewers List: OK (Viewer found in list)');
        } else {
            console.error('Get Viewers List: FAILED', listData);
        }

        // 5. Test Heartbeat
        console.log('\n--- Testing Heartbeat ---');
        const heartbeatRes = await fetch(`${API_URL}/viewer/heartbeat/${stream.id}`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${viewer.token}` }
        });
        const heartbeatData: any = await heartbeatRes.json();

        if (heartbeatData.success) {
            console.log('Heartbeat: OK');
        } else {
            console.error('Heartbeat: FAILED', heartbeatData);
        }

        // 6. Test Leave Stream
        console.log('\n--- Testing Leave Stream ---');
        const leaveRes = await fetch(`${API_URL}/viewer/leave/${stream.id}`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${viewer.token}` }
        });
        const leaveData: any = await leaveRes.json();

        if (leaveData.success) {
            console.log(`Leave Stream: OK (Current Viewers: ${leaveData.currentViewers})`);
        } else {
            console.error('Leave Stream: FAILED', leaveData);
        }

    } catch (error) {
        console.error('Test failed:', error);
    } finally {
        await prisma.$disconnect();
    }
}

async function createTestUser(prefix: string) {
    const email = `${prefix}_${Date.now()}@test.com`;
    await fetch(`${API_URL}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password: 'password123', name: prefix })
    });

    const loginRes = await fetch(`${API_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password: 'password123' })
    });
    return await loginRes.json();
}

main();
