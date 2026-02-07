import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminSession } from '@/lib/admin-auth';
import { executeServerQuery, type QueryState } from '@/lib/supabaseClient';

const publicReadTables = new Set([
  'app_configurations'
]);

const adminWriteTables = new Set([
  'app_configurations',
  'ai_media_assets',
  'global_statuses',
  'managed_demo_contacts',
  'ad_settings'
]);

const allowedTables = new Set([
  'app_configurations',
  'ai_media_assets',
  'global_statuses',
  'managed_demo_contacts',
  'ad_settings',
  'messages_log',
  'daily_activity_log',
  'user_sessions',
  'user_analytics',
  'page_views',
  'ad_interactions',
  'ad_revenue_log',
  'user_journey_steps',
  'cookie_consents'
]);

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as QueryState;

    if (!allowedTables.has(body.table)) {
      return NextResponse.json({ error: 'Table not allowed' }, { status: 400 });
    }

    if (body.action === 'rpc') {
      return NextResponse.json({ error: 'RPC not allowed via this endpoint' }, { status: 400 });
    }

    const isWrite = ['insert', 'update', 'upsert', 'delete'].includes(body.action);
    const isAdminTable = adminWriteTables.has(body.table);

    if (isWrite && isAdminTable) {
      const session = await verifyAdminSession(request);
      if (!session.isValid) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
    }

    if (body.action === 'select' && !publicReadTables.has(body.table)) {
      const session = await verifyAdminSession(request);
      if (!session.isValid) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
    }

    const result = await executeServerQuery(body);
    if (result.error) {
      return NextResponse.json({ error: result.error.message }, { status: 400 });
    }
    return NextResponse.json({ data: result.data });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Database request failed' }, { status: 500 });
  }
}
