import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

const GITHUB_TOKEN = process.env.GITHUB_TOKEN_PHC;
const GITHUB_OWNER = process.env.GITHUB_OWNER_PHC;
const GITHUB_REPO = process.env.GITHUB_REPO_PHC;
const DATA_FILE = 'current_dashboard_data.json';

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!GITHUB_TOKEN || !GITHUB_OWNER || !GITHUB_REPO) {
    return NextResponse.json(
      { error: 'GitHub credentials not configured for Phòng HC data' },
      { status: 500 }
    );
  }

  try {
    const url = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${DATA_FILE}`;
    const response = await fetch(url, {
      headers: {
        Authorization: `token ${GITHUB_TOKEN}`,
        Accept: 'application/vnd.github.v3+json',
      },
      next: { revalidate: 300 }, // Cache 5 minutes
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: `GitHub API error: ${response.status}` },
        { status: response.status }
      );
    }

    const fileData = await response.json();
    const content = Buffer.from(fileData.content, 'base64').toString('utf-8');
    const dataPackage = JSON.parse(content);

    return NextResponse.json(dataPackage);
  } catch (error) {
    console.error('Error fetching Phòng HC data:', error);
    return NextResponse.json(
      { error: 'Failed to fetch data from GitHub' },
      { status: 500 }
    );
  }
}
