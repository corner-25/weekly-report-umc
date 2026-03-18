import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const GITHUB_TOKEN = process.env.GITHUB_TOKEN_PHC;
  const GITHUB_OWNER = process.env.GITHUB_OWNER_PHC;
  const GITHUB_REPO = process.env.GITHUB_REPO_PHC;
  const DATA_FILE = 'current_dashboard_data.json';

  if (!GITHUB_TOKEN || !GITHUB_OWNER || !GITHUB_REPO) {
    console.error('Missing env vars:', {
      hasToken: !!GITHUB_TOKEN,
      hasOwner: !!GITHUB_OWNER,
      hasRepo: !!GITHUB_REPO,
    });
    return NextResponse.json(
      { error: 'GitHub credentials not configured for Phòng HC data' },
      { status: 500 }
    );
  }

  try {
    // Step 1: Get file metadata via Contents API
    const metaUrl = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${DATA_FILE}`;
    const metaRes = await fetch(metaUrl, {
      headers: {
        Authorization: `token ${GITHUB_TOKEN}`,
        Accept: 'application/vnd.github.v3+json',
      },
      cache: 'no-store',
    });

    if (!metaRes.ok) {
      const errText = await metaRes.text();
      console.error('GitHub API error:', metaRes.status, errText);
      return NextResponse.json(
        { error: `GitHub API error: ${metaRes.status}` },
        { status: metaRes.status }
      );
    }

    const metaData = await metaRes.json();

    // Step 2: Download raw content
    const rawRes = await fetch(metaData.download_url, {
      headers: {
        Authorization: `token ${GITHUB_TOKEN}`,
      },
      cache: 'no-store',
    });

    if (!rawRes.ok) {
      const errText = await rawRes.text();
      console.error('GitHub raw download error:', rawRes.status, errText);
      return NextResponse.json(
        { error: `GitHub raw download error: ${rawRes.status}` },
        { status: rawRes.status }
      );
    }

    // Python exports NaN/Infinity which are not valid JSON — replace with null
    const rawText = await rawRes.text();
    const sanitized = rawText.replace(/\bNaN\b/g, 'null').replace(/\bInfinity\b/g, 'null');
    const dataPackage = JSON.parse(sanitized);

    return NextResponse.json(dataPackage);
  } catch (error) {
    console.error('Error fetching Phòng HC data:', error);
    return NextResponse.json(
      { error: `Failed to fetch data: ${error instanceof Error ? error.message : 'Unknown'}` },
      { status: 500 }
    );
  }
}
