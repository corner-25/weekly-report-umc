import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const GITHUB_TOKEN = process.env.GITHUB_TOKEN_FLEET;
const REPO_OWNER = 'corner-25';
const REPO_NAME = 'vehicle-storage';
const FILE_PATH = 'data/latest/fleet_data_latest.json';

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!GITHUB_TOKEN) {
    console.error('Missing GITHUB_TOKEN_FLEET env var');
    return NextResponse.json(
      { error: 'GitHub token not configured for fleet data' },
      { status: 500 }
    );
  }

  try {
    // Use raw.githubusercontent.com directly — works for any file size, no base64
    const rawUrl = `https://raw.githubusercontent.com/${REPO_OWNER}/${REPO_NAME}/main/${FILE_PATH}`;
    const rawRes = await fetch(rawUrl, {
      headers: { Authorization: `token ${GITHUB_TOKEN}` },
      cache: 'no-store',
    });

    if (!rawRes.ok) {
      throw new Error(`GitHub raw fetch failed: ${rawRes.status}`);
    }

    const rawText = await rawRes.text();
    const sanitized = rawText
      .replace(/\bNaN\b/g, 'null')
      .replace(/\bInfinity\b/g, 'null')
      .replace(/-Infinity\b/g, 'null');
    const data = JSON.parse(sanitized);

    return NextResponse.json({ data, fetchedAt: new Date().toISOString() });
  } catch (error) {
    console.error('Error fetching fleet data:', error);
    return NextResponse.json(
      { error: `Failed to fetch data: ${error instanceof Error ? error.message : 'Unknown'}` },
      { status: 500 }
    );
  }
}
