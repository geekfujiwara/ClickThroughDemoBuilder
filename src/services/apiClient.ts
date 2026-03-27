/**
 * API クライアント — fetch ラッパー
 * Cookie ベースの認証を自動で扱う (credentials: 'same-origin')
 * 認証切れ（401）を検出し、自動的にログイン画面へリダイレクトする。
 */

const API_BASE = '/api';

/** 認証切れリダイレクト済みフラグ（多重リダイレクトを防止） */
let redirecting = false;

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/**
 * 401 を検出してログイン画面にリダイレクトする。
 * /auth/ 系エンドポイントからの 401 はリダイレクト対象外（init 用）。
 */
function handleSessionExpiry(path: string, status: number): void {
  if (status !== 401) return;
  // auth エンドポイントは除外（getMe のエラーでリダイレクトループを防止）
  if (path.startsWith('/auth/')) return;
  if (redirecting) return;

  // localStorage にログインソースが残っている = セッション切れ
  const hadSession = localStorage.getItem('loginSource');
  if (hadSession) {
    redirecting = true;
    // 現在のページを記憶して再ログイン後に戻れるようにする
    sessionStorage.setItem('returnTo', window.location.pathname + window.location.search);
    window.location.assign('/login?expired=1');
  }
}

async function handleResponse<T>(res: Response, path: string): Promise<T> {
  if (!res.ok) {
    let msg = res.statusText;
    try {
      const body = (await res.json()) as { error?: string };
      if (body.error) msg = body.error;
    } catch {
      // ignore
    }
    handleSessionExpiry(path, res.status);
    throw new ApiError(res.status, msg);
  }
  return res.json() as Promise<T>;
}

export async function apiGet<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    credentials: 'same-origin',
  });
  return handleResponse<T>(res, path);
}

export async function apiPost<T>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  return handleResponse<T>(res, path);
}

export async function apiPut<T>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'PUT',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  return handleResponse<T>(res, path);
}

export async function apiDelete<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'DELETE',
    credentials: 'same-origin',
  });
  return handleResponse<T>(res, path);
}
