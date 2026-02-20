/**
 * デモ利用ログサービス
 */
import crypto from 'node:crypto';
import type { HttpRequest } from '@azure/functions';
import { authenticate } from '../middleware/auth.js';
import * as projectService from './projectService.js';
import * as groupService from './groupService.js';
import * as creatorService from './creatorService.js';
import * as blob from './blobService.js';

interface DemoUsageLog {
  id: string;
  timestamp: string;
  event: 'view_start' | 'view_complete';
  demoId: string;
  demoName: string;
  demoGroupId?: string;
  demoGroupName: string;
  // ビューワー情報
  viewerCreatorId?: string;
  viewerCreatorName?: string;
  viewerGroupId?: string;
  viewerGroupName?: string;
  role: 'viewer' | 'designer' | 'unknown';
  ip: string;
  site: string;
  userAgent: string;
}

interface IpSiteRule {
  prefix: string;
  site: string;
}

/** IPアドレスの形式を検証 (IPv4 / IPv6) */
const IP_V4_RE = /^\d{1,3}(\.\d{1,3}){3}$/;
const IP_V6_RE = /^[0-9a-fA-F:]+$/;
function isValidIp(ip: string): boolean {
  return IP_V4_RE.test(ip) || IP_V6_RE.test(ip);
}

function getClientIp(req: HttpRequest): string {
  const forwarded = req.headers.get('x-forwarded-for');
  if (forwarded) {
    const ip = forwarded.split(',')[0]?.trim();
    if (ip) return ip;
  }
  const direct = req.headers.get('x-client-ip') ?? req.headers.get('x-ms-client-ip');
  if (direct) return direct.trim();
  return 'unknown';
}

function isPrivateIp(ip: string): boolean {
  if (ip === 'unknown') return true;
  if (ip === '::1' || ip.startsWith('fc') || ip.startsWith('fd') || ip.startsWith('fe80:')) {
    return true;
  }
  return (
    ip.startsWith('10.') ||
    ip.startsWith('192.168.') ||
    /^172\.(1[6-9]|2\d|3[0-1])\./.test(ip) ||
    ip.startsWith('127.')
  );
}

function parseIpSiteRules(): IpSiteRule[] {
  const raw = process.env.IP_SITE_RULES;
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as IpSiteRule[];
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((r) => typeof r.prefix === 'string' && typeof r.site === 'string');
  } catch {
    return [];
  }
}

async function resolveSiteFromIp(ip: string): Promise<string> {
  if (isPrivateIp(ip)) return 'private-network';
  if (!isValidIp(ip)) return 'unknown';

  const siteRules = parseIpSiteRules();
  const matched = siteRules.find((r) => ip.startsWith(r.prefix));
  if (matched) return matched.site;

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 3000);
    const res = await fetch(`https://ipapi.co/${ip}/json/`, { signal: controller.signal });
    clearTimeout(timer);
    if (!res.ok) return 'unknown';

    const data = (await res.json()) as {
      city?: string;
      region?: string;
      country_name?: string;
      org?: string;
    };
    const city = data.city?.trim();
    const region = data.region?.trim();
    const country = data.country_name?.trim();
    const org = data.org?.trim();

    const geo = [country, region, city].filter(Boolean).join(' / ');
    if (geo && org) return `${geo} (${org})`;
    if (geo) return geo;
    if (org) return org;
    return 'unknown';
  } catch {
    return 'unknown';
  }
}

export async function logDemoUsage(
  req: HttpRequest,
  projectId: string,
  event: 'view_start' | 'view_complete',
): Promise<void> {
  const project = await projectService.getProject(projectId);
  if (!project) {
    throw new Error('プロジェクトが見つかりません');
  }

  const groups = await groupService.getAllGroups();
  const group = project.groupId ? groups.find((g) => g.id === project.groupId) : undefined;

  const ip = getClientIp(req);
  const site = await resolveSiteFromIp(ip);
  const auth = authenticate(req);

  // ビューワー情報の取得
  let viewerCreatorId: string | undefined;
  let viewerCreatorName: string | undefined;
  let viewerGroupId: string | undefined;
  let viewerGroupName: string | undefined;
  if (auth?.creatorId) {
    try {
      const allCreators = await creatorService.getAllCreators();
      const creator = allCreators.find((c) => c.id === auth.creatorId);
      if (creator) {
        viewerCreatorId = creator.id;
        viewerCreatorName = creator.name;
        viewerGroupId = creator.groupId;
        viewerGroupName = creator.groupId
          ? (groups.find((g) => g.id === creator.groupId)?.name ?? '未設定')
          : undefined;
      }
    } catch {
      // ビューワー情報が取れなくてもログは記録する
    }
  }

  const record: DemoUsageLog = {
    id: crypto.randomUUID(),
    timestamp: new Date().toISOString(),
    event,
    demoId: project.id,
    demoName: project.title,
    demoGroupId: project.groupId,
    demoGroupName: group?.name ?? '未設定',
    viewerCreatorId,
    viewerCreatorName,
    viewerGroupId,
    viewerGroupName,
    role: auth?.role ?? 'unknown',
    ip,
    site,
    userAgent: (req.headers.get('user-agent') ?? '').slice(0, 500),
  };

  const day = record.timestamp.slice(0, 10);
  const key = `${day}/${record.timestamp.replace(/[:.]/g, '-')}-${record.id}.json`;
  await blob.putUsageLogJson(key, JSON.stringify(record));
}
