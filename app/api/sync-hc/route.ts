import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

export const dynamic = 'force-dynamic';
export const maxDuration = 60; // Allow up to 60s for sync

// HC API config
const API_BASE_URL = process.env.HC_API_BASE_URL || 'https://officeapi.umc.edu.vn';
const API_USERNAME = process.env.HC_API_USERNAME || '';
const API_PASSWORD = process.env.HC_API_PASSWORD || '';

// GitHub config for dashboard-storage
const GITHUB_TOKEN = process.env.GITHUB_TOKEN_PHC || '';
const GITHUB_OWNER = process.env.GITHUB_OWNER_PHC || '';
const GITHUB_REPO = process.env.GITHUB_REPO_PHC || '';

// ─── HC API ENDPOINTS ───────────────────────────────────────

const DATA_SOURCES = [
  { name: 'Tổng hợp', category: 'all', endpoint: '/v1/dashboard_phc/documents/summary', file: 'tonghop.json' },
  { name: 'Văn bản đến', category: 'incoming', endpoint: '/v1/dashboard_phc/documents/daily', file: 'vanbanden.json' },
  { name: 'Văn bản phát hành', category: 'outgoing', endpoint: '/v1/dashboard_phc/documents/daily', file: 'vanbanphathanh.json' },
  { name: 'Quản lý công việc', category: 'task_management', endpoint: '/v1/dashboard_phc/documents/daily', file: 'congviec.json' },
  { name: 'Đăng ký phòng họp', category: 'meeting_room', endpoint: '/v1/dashboard_phc/documents/daily', file: 'phonghop.json' },
  { name: 'Đăng ký lịch họp', category: 'meeting_schedules', endpoint: '/v1/dashboard_phc/documents/daily', file: 'lichhop.json' },
];

// ─── HELPERS ────────────────────────────────────────────────

async function getApiToken(): Promise<string> {
  const res = await fetch(`${API_BASE_URL}/v1/auth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userName: API_USERNAME, password: API_PASSWORD }),
  });

  if (!res.ok) throw new Error(`Auth failed: ${res.status}`);
  const data = await res.json();
  const token = data.data || data.token || data.access_token;
  if (!token) throw new Error('No token in response');
  return token;
}

async function fetchFromApi(token: string, endpoint: string, category: string, startDate: string, endDate: string) {
  const params = new URLSearchParams({
    Start_Date: startDate,
    End_Date: endDate,
    Category: category,
  });

  const res = await fetch(`${API_BASE_URL}${endpoint}?${params}`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });

  if (!res.ok) throw new Error(`API ${endpoint} failed: ${res.status}`);
  return res.json();
}

async function uploadToGitHub(filename: string, content: unknown, commitMessage: string): Promise<{ success: boolean; message: string }> {
  if (!GITHUB_TOKEN || !GITHUB_OWNER || !GITHUB_REPO) {
    return { success: false, message: 'GitHub credentials not configured' };
  }

  const url = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${filename}`;
  const headers = {
    'Authorization': `token ${GITHUB_TOKEN}`,
    'Accept': 'application/vnd.github.v3+json',
  };

  // Check if file exists to get SHA
  let sha: string | undefined;
  try {
    const getRes = await fetch(url, { headers });
    if (getRes.ok) {
      const existing = await getRes.json();
      sha = existing.sha;
    }
  } catch { /* file doesn't exist yet */ }

  // Upload
  const contentStr = JSON.stringify(content, null, 2);
  const contentEncoded = Buffer.from(contentStr, 'utf-8').toString('base64');

  const payload: Record<string, string> = {
    message: commitMessage,
    content: contentEncoded,
    branch: 'main',
  };
  if (sha) payload.sha = sha;

  const putRes = await fetch(url, {
    method: 'PUT',
    headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (putRes.ok) {
    return { success: true, message: `Uploaded ${filename}` };
  }
  const errText = await putRes.text();
  return { success: false, message: `Upload ${filename} failed: ${putRes.status} ${errText}` };
}

// ─── POST handler ───────────────────────────────────────────

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Validate config
  if (!API_USERNAME || !API_PASSWORD) {
    return NextResponse.json({ error: 'HC API credentials not configured (HC_API_USERNAME, HC_API_PASSWORD)' }, { status: 500 });
  }
  if (!GITHUB_TOKEN || !GITHUB_OWNER || !GITHUB_REPO) {
    return NextResponse.json({ error: 'GitHub credentials not configured (GITHUB_TOKEN_PHC, GITHUB_OWNER_PHC, GITHUB_REPO_PHC)' }, { status: 500 });
  }

  try {
    const body = await request.json();
    const startDate = body.startDate || '2025-01-01';
    const endDate = body.endDate || new Date().toISOString().split('T')[0];

    // Step 1: Get API token
    const token = await getApiToken();

    // Step 2: Fetch all data sources
    const results: { name: string; file: string; fetchOk: boolean; uploadOk: boolean; message: string }[] = [];
    const now = new Date().toISOString().replace('T', ' ').substring(0, 16);

    for (const source of DATA_SOURCES) {
      try {
        const data = await fetchFromApi(token, source.endpoint, source.category, startDate, endDate);

        // Upload to GitHub
        const uploadResult = await uploadToGitHub(
          source.file,
          data,
          `📊 Update ${source.name} (${now})`
        );

        results.push({
          name: source.name,
          file: source.file,
          fetchOk: true,
          uploadOk: uploadResult.success,
          message: uploadResult.message,
        });
      } catch (err) {
        results.push({
          name: source.name,
          file: source.file,
          fetchOk: false,
          uploadOk: false,
          message: err instanceof Error ? err.message : 'Unknown error',
        });
      }
    }

    const successCount = results.filter((r) => r.uploadOk).length;
    return NextResponse.json({
      success: successCount === results.length,
      results,
      summary: `${successCount}/${results.length} files synced`,
      syncedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('HC sync error:', error);
    return NextResponse.json(
      { error: `Sync failed: ${error instanceof Error ? error.message : 'Unknown'}` },
      { status: 500 }
    );
  }
}
