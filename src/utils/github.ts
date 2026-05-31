import { GitHubRepo, GitHubCommit } from '../types';

const CLIENT_ID = process.env.EXPO_PUBLIC_GITHUB_CLIENT_ID ?? '';

export interface DeviceFlowData {
  device_code: string;
  user_code: string;
  verification_uri: string;
  expires_in: number;
  interval: number;
}

export interface GitHubUser {
  login: string;
  name: string;
}

export async function startDeviceFlow(): Promise<DeviceFlowData> {
  const res = await fetch('https://github.com/login/device/code', {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify({ client_id: CLIENT_ID, scope: 'repo read:user' }),
  });
  const data = await res.json();
  if (data.error) throw new Error(data.error_description ?? data.error);
  if (!data.device_code) throw new Error('device_flow_failed');
  return data;
}

export async function pollDeviceFlow(deviceCode: string): Promise<string | null> {
  const res = await fetch('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: CLIENT_ID,
      device_code: deviceCode,
      grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
    }),
  });
  const data = await res.json();
  if (data.access_token) return data.access_token as string;
  if (data.error === 'authorization_pending' || data.error === 'slow_down') return null;
  throw new Error(data.error ?? 'auth_failed');
}

export async function fetchGitHubUser(token: string): Promise<GitHubUser | null> {
  try {
    const res = await fetch('https://api.github.com/user', {
      headers: { Authorization: `token ${token}`, Accept: 'application/vnd.github.v3+json' },
    });
    if (!res.ok) return null;
    const d = await res.json();
    return { login: d.login, name: d.name ?? d.login };
  } catch {
    return null;
  }
}

export async function fetchUserRepos(token: string): Promise<GitHubRepo[]> {
  const repos: GitHubRepo[] = [];
  let page = 1;
  while (true) {
    const res = await fetch(
      `https://api.github.com/user/repos?per_page=100&page=${page}&sort=updated&affiliation=owner,collaborator`,
      { headers: { Authorization: `token ${token}`, Accept: 'application/vnd.github.v3+json' } }
    );
    if (!res.ok) break;
    const data = await res.json();
    if (!Array.isArray(data) || !data.length) break;
    repos.push(...data.map((r: any) => ({ owner: r.owner.login, repo: r.name, token })));
    if (data.length < 100) break;
    page++;
  }
  return repos;
}

export async function fetchCommitsForRepo(repo: GitHubRepo): Promise<GitHubCommit[]> {
  try {
    const headers: Record<string, string> = { Accept: 'application/vnd.github.v3+json' };
    if (repo.token) headers['Authorization'] = `token ${repo.token}`;

    const res = await fetch(
      `https://api.github.com/repos/${repo.owner}/${repo.repo}/commits?per_page=30`,
      { headers }
    );
    if (!res.ok) return [];

    const items = await res.json();
    if (!Array.isArray(items)) return [];

    const repoKey = `${repo.owner}/${repo.repo}`;
    return items.map((item: any): GitHubCommit => ({
      sha: (item.sha ?? '').substring(0, 7),
      repo: repoKey,
      message: ((item.commit?.message ?? '') as string).split('\n')[0].substring(0, 120),
      author: item.commit?.author?.name ?? 'Unknown',
      date: ((item.commit?.author?.date ?? '') as string).substring(0, 10),
      url: item.html_url ?? '',
    })).filter(c => !!c.date);
  } catch {
    return [];
  }
}

export async function fetchAllCommits(repos: GitHubRepo[]): Promise<GitHubCommit[]> {
  if (!repos.length) return [];
  const results = await Promise.all(repos.map(fetchCommitsForRepo));
  const all = results.flat();
  all.sort((a, b) => b.date.localeCompare(a.date));
  return all;
}
