
import { NextRequest, NextResponse } from 'next/server';
import { executeServerQuery } from '@/lib/supabaseClient';

export async function GET(request: NextRequest) {
  try {
    let dbStatus: 'healthy' | 'unhealthy' = 'healthy';
    const { error } = await executeServerQuery({
      action: 'select',
      table: 'messages_log',
      filters: [],
      selectColumns: 'message_id',
      limit: 1
    });
    dbStatus = error ? 'unhealthy' : 'healthy';

    // Check environment variables
    const configStatus = process.env.MYSQL_HOST &&
                        process.env.MYSQL_USER &&
                        process.env.MYSQL_DATABASE &&
                        process.env.ADMIN_EMAIL &&
                        process.env.ADMIN_SESSION_SECRET ? 'healthy' : 'unhealthy';

    const overall = dbStatus === 'healthy' && configStatus === 'healthy' ? 'healthy' : 'degraded';

    return NextResponse.json({
      status: overall,
      timestamp: new Date().toISOString(),
      checks: {
        database: dbStatus,
        config: configStatus,
        memory: process.memoryUsage().heapUsed / 1024 / 1024 + ' MB'
      },
      uptime: process.uptime()
    });
  } catch (error) {
    return NextResponse.json({
      status: 'unhealthy',
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
