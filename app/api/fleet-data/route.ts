import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

export const dynamic = 'force-dynamic';

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

  const headers = {
    Authorization: `token ${GITHUB_TOKEN}`,
    Accept: 'application/vnd.github.v3+json',
    'User-Agent': 'Fleet-Dashboard-App',
  };

  try {
    // Try Contents API first
    const apiUrl = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${FILE_PATH}`;
    const metaRes = await fetch(apiUrl, { headers, cache: 'no-store' });

    if (!metaRes.ok) {
      // Fallback: try Git API for large files
      return await fetchLargeFile(headers);
    }

    const metaData = await metaRes.json();

    // If file is too large for Contents API (>1MB), use Git API
    if (metaData.size > 1000000) {
      return await fetchLargeFile(headers);
    }

    const rawRes = await fetch(metaData.download_url, {
      headers: { Authorization: `token ${GITHUB_TOKEN}` },
      cache: 'no-store',
    });

    if (!rawRes.ok) {
      return await fetchLargeFile(headers);
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

async function fetchLargeFile(headers: Record<string, string>) {
  try {
    // Get latest commit
    const commitsUrl = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/commits/main`;
    const commitsRes = await fetch(commitsUrl, { headers, cache: 'no-store' });
    if (!commitsRes.ok) throw new Error('Cannot get latest commit');

    const latestCommit = await commitsRes.json();
    const treeSha = latestCommit.commit.tree.sha;

    // Navigate tree: root -> data -> latest
    let currentSha = treeSha;
    for (const segment of ['data', 'latest']) {
      const treeUrl = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/git/trees/${currentSha}`;
      const treeRes = await fetch(treeUrl, { headers, cache: 'no-store' });
      if (!treeRes.ok) throw new Error(`Cannot get tree for ${segment}`);
      const treeData = await treeRes.json();
      const folder = treeData.tree.find(
        (item: { path: string; type: string }) => item.path === segment && item.type === 'tree'
      );
      if (!folder) throw new Error(`Folder ${segment} not found`);
      currentSha = folder.sha;
    }

    // Find the JSON file
    const latestTreeUrl = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/git/trees/${currentSha}`;
    const latestTreeRes = await fetch(latestTreeUrl, { headers, cache: 'no-store' });
    if (!latestTreeRes.ok) throw new Error('Cannot get latest tree');
    const latestTreeData = await latestTreeRes.json();
    const fileBlob = latestTreeData.tree.find(
      (item: { path: string; type: string }) =>
        item.path === 'fleet_data_latest.json' && item.type === 'blob'
    );
    if (!fileBlob) throw new Error('fleet_data_latest.json not found');

    // Get blob content
    const blobUrl = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/git/blobs/${fileBlob.sha}`;
    const blobRes = await fetch(blobUrl, { headers, cache: 'no-store' });
    if (!blobRes.ok) throw new Error('Cannot get blob content');

    const blobData = await blobRes.json();
    const content = Buffer.from(blobData.content, 'base64').toString('utf-8');
    const sanitized = content
      .replace(/\bNaN\b/g, 'null')
      .replace(/\bInfinity\b/g, 'null')
      .replace(/-Infinity\b/g, 'null');
    const data = JSON.parse(sanitized);

    return NextResponse.json({ data, fetchedAt: new Date().toISOString() });
  } catch (error) {
    console.error('Error in large file fetch:', error);
    return NextResponse.json(
      { error: `Failed to fetch large file: ${error instanceof Error ? error.message : 'Unknown'}` },
      { status: 500 }
    );
  }
}
