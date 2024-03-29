import { validateRequest } from '@/lib/auth';
import { dbConnect } from '@/lib/db';
import { NextRequest } from 'next/server';
import lastBatchFor from './lastBatchFor';

export async function GET(_req: NextRequest) {
  await dbConnect();
  const { user } = await validateRequest();
  if (!user) {
    return new Response('Unauthorized', { status: 401 });
  }
  return new Response(JSON.stringify(await lastBatchFor(user)), {
    status: 200,
  });
}
