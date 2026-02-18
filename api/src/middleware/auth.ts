/**
 * 認証ミドルウェア — JWT Cookie の検証・ロールチェック
 */
import jwt from 'jsonwebtoken';
import type { HttpRequest } from '@azure/functions';
import type { JwtPayload, UserRole } from '../shared/types.js';

function getRequiredEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

const JWT_SECRET = getRequiredEnv('JWT_SECRET');
const VIEWER_PASSWORD = getRequiredEnv('VIEWER_PASSWORD');
const DESIGNER_PASSWORD = getRequiredEnv('DESIGNER_PASSWORD');

/**
 * Cookie ヘッダーから指定キーの値を取り出す
 */
function parseCookie(req: HttpRequest, key: string): string | undefined {
  const header = req.headers.get('cookie') ?? '';
  const match = header.split(';').find((c) => c.trim().startsWith(`${key}=`));
  return match?.split('=').slice(1).join('=').trim();
}

/**
 * パスワード検証
 */
export function verifyPassword(role: UserRole, password: string): boolean {
  if (role === 'viewer') return password === VIEWER_PASSWORD;
  if (role === 'designer') return password === DESIGNER_PASSWORD;
  return false;
}

/**
 * JWT トークン生成
 */
export function createToken(role: UserRole, creatorId?: string): string {
  const expiresIn = role === 'viewer' ? '24h' : '8h';
  const payload: Pick<JwtPayload, 'role' | 'creatorId'> = { role };
  if (creatorId) payload.creatorId = creatorId;
  return jwt.sign(payload, JWT_SECRET, { expiresIn });
}

/**
 * JWT Cookie の Set-Cookie ヘッダー値を生成
 */
export function buildSessionCookie(token: string, maxAge: number): string {
  return `session=${token}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=${maxAge}`;
}

/**
 * Cookie を消去する Set-Cookie ヘッダー値
 */
export function buildClearCookie(): string {
  return 'session=; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0';
}

/**
 * リクエストから JWT を検証してロールを返す。失敗時は null。
 */
export function authenticate(req: HttpRequest): JwtPayload | null {
  const token = parseCookie(req, 'session');
  if (!token) return null;
  try {
    const payload = jwt.verify(token, JWT_SECRET) as JwtPayload;
    if (!payload.role) return null;
    return payload;
  } catch {
    return null;
  }
}

/**
 * 指定ロールの認証を要求するヘルパー。
 * 認証失敗時は 401 レスポンスオブジェクトを返す。成功時は null。
 */
export function requireRole(
  req: HttpRequest,
  ...allowedRoles: UserRole[]
): { status: 401; body: string } | { payload: JwtPayload } {
  const payload = authenticate(req);
  if (!payload) {
    return { status: 401, body: 'Unauthorized' };
  }
  if (!allowedRoles.includes(payload.role)) {
    return { status: 401, body: 'Unauthorized' };
  }
  return { payload };
}
