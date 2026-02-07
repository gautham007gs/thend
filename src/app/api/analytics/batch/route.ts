
import { NextRequest, NextResponse } from 'next/server';
import { isDatabaseConfigured, supabase } from '@/lib/supabaseClient';
import MaximumSecurity from '@/lib/enhanced-security';
import { APISecurityManager } from '@/lib/api-security';

interface BatchAnalyticsEvent {
  eventType: string;
  eventData: any;
  userId?: string;
  sessionId: string;
  timestamp: number;
}

export async function POST(request: NextRequest) {
  // Apply MAXIMUM security protection
  const enhancedSecurityCheck = await MaximumSecurity.secureRequest(request);
  if (enhancedSecurityCheck) return enhancedSecurityCheck;

  // Apply API security with rate limiting
  const securityCheck = await APISecurityManager.secureAPIRoute(request, {
    allowedMethods: ['POST'],
    rateLimit: { requests: 200, window: 60000 } // 200 requests per minute for batch analytics
  });
  if (securityCheck) return securityCheck;

  try {
    if (!isDatabaseConfigured) {
      return NextResponse.json({ error: 'Database not configured' }, { status: 500 });
    }

    const body = await request.json();
    
    // Validate and sanitize POST data
    const postValidation = await MaximumSecurity.validatePostData(request, body);
    if (!postValidation.valid) {
      return NextResponse.json(
        { error: postValidation.error || 'Invalid request' },
        { status: 400 }
      );
    }

    const { events, sessionId } = postValidation.sanitized;
    
    if (!Array.isArray(events) || events.length === 0) {
      return NextResponse.json({ error: 'No events provided' }, { status: 400 });
    }

    // Limit batch size to prevent abuse
    if (events.length > 100) {
      return NextResponse.json({ error: 'Batch size too large. Maximum 100 events per request.' }, { status: 400 });
    }

    const results = await Promise.allSettled(
      events.map((event: BatchAnalyticsEvent) => processEvent(event))
    );

    const successful = results.filter(r => r.status === 'fulfilled').length;
    const failed = results.filter(r => r.status === 'rejected').length;

    return NextResponse.json({
      success: true,
      processed: events.length,
      successful,
      failed,
      sessionId
    });

  } catch (error: any) {
    console.error('Batch Analytics Error:', error);
    return NextResponse.json(
      { error: 'Failed to process batch events', details: error.message },
      { status: 500 }
    );
  }
}

async function processEvent(event: BatchAnalyticsEvent) {
  const { eventType, eventData, userId, sessionId, timestamp } = event;
  const chatId = eventData.chatId || 'kruthika_chat';

  try {
    switch (eventType) {
      case 'message_sent':
        // Insert message log
        const { error: msgError } = await supabase
          .from('messages_log')
          .insert({
            message_id: eventData.messageId || `msg_${timestamp}`,
            sender_type: eventData.senderType || 'user',
            chat_id: chatId,
            text_content: eventData.content?.substring(0, 500),
            has_image: eventData.hasImage || false,
            created_at: new Date(timestamp).toISOString()
          });

        if (msgError) throw msgError;

        // Update daily activity
        const today = new Date(timestamp).toISOString().split('T')[0];
        const userPseudoId = userId || sessionId || 'anonymous_' + timestamp;

        await supabase
          .from('daily_activity_log')
          .upsert({
            user_pseudo_id: userPseudoId,
            activity_date: today,
            chat_id: chatId
          }, {
            onConflict: 'user_pseudo_id,activity_date,chat_id',
            ignoreDuplicates: true
          });

        // Update daily analytics aggregation
        await updateDailyAnalytics(today, eventData.senderType === 'user' ? 1 : 0);
        break;

      case 'session_start':
      case 'session_resume':
        const sessionDate = new Date(timestamp).toISOString().split('T')[0];
        const sessionUserId = userId || sessionId || 'anonymous_' + timestamp;

        await supabase
          .from('daily_activity_log')
          .upsert({
            user_pseudo_id: sessionUserId,
            activity_date: sessionDate,
            chat_id: chatId
          }, {
            onConflict: 'user_pseudo_id,activity_date,chat_id',
            ignoreDuplicates: true
          });
        break;

      case 'ad_interaction':
        const adDate = new Date(timestamp).toISOString().split('T')[0];
        const impressions = eventData.action === 'view' ? 1 : 0;
        const clicks = eventData.action === 'click' ? 1 : 0;
        const revenue = clicks * 0.01 + impressions * 0.001; // Estimate

        await supabase
          .from('ad_revenue_log')
          .upsert({
            date: adDate,
            ad_network: eventData.network || 'unknown',
            ad_type: eventData.adType || 'unknown',
            impressions: impressions,
            clicks: clicks,
            estimated_revenue: revenue,
            cpm: revenue / Math.max(impressions, 1) * 1000
          }, {
            onConflict: 'date,ad_network,ad_type'
          });
        break;

      case 'image_shared':
        // Track in messages_log with has_image flag
        await supabase
          .from('messages_log')
          .insert({
            message_id: `img_${timestamp}`,
            sender_type: 'user',
            chat_id: chatId,
            text_content: 'Image shared',
            has_image: true,
            created_at: new Date(timestamp).toISOString()
          });
        break;

      case 'page_view':
        await supabase.from('page_views').insert({
          session_id: sessionId,
          page_path: eventData.page,
          page_title: eventData.title,
          referrer: eventData.referrer
        });
        break;

      case 'user_action':
        // Log user actions for behavior analysis
        if (eventData.action === 'performance_metric') {
          await updateDailyAnalytics(
            new Date(timestamp).toISOString().split('T')[0], 
            0, 
            0, 
            eventData.details?.duration || 0
          );
        }
        break;
      case 'cookie_consent':
        await supabase.from('cookie_consents').insert({
          session_id: sessionId,
          necessary: eventData.necessary,
          analytics: eventData.analytics,
          advertising: eventData.advertising,
          personalization: eventData.personalization,
          ai_learning: eventData.aiLearning || false,
          intimacy_level: eventData.intimacyLevel || false
        });
        break;
      case 'journey_step':
        await supabase.from('user_journey_steps').insert({
          session_id: sessionId,
          step_name: eventData.stepName,
          step_order: eventData.stepOrder,
          page_path: eventData.pagePath
        });
        break;
      case 'session_update':
        await supabase
          .from('user_sessions')
          .update({
            ended_at: eventData.endedAt,
            duration_seconds: eventData.durationSeconds,
            is_active: eventData.isActive
          })
          .eq('session_id', sessionId);
        break;
      case 'session_message_increment':
        await supabase.rpc('increment_session_messages', {
          session_id_param: sessionId
        });
        break;
      case 'user_analytics':
        await supabase.from('user_analytics').upsert({
          session_id: sessionId,
          user_pseudo_id: eventData.userPseudoId || sessionId,
          country_code: eventData.countryCode,
          country_name: eventData.countryName,
          timezone: eventData.timezone,
          device_type: eventData.deviceType,
          browser: eventData.browser,
          os: eventData.os,
          screen_resolution: eventData.screenResolution,
          language: eventData.language
        });
        break;

      default:
        console.warn('Unknown batch event type:', eventType);
    }

    return { success: true, eventType };
  } catch (error: any) {
    console.error(`Error processing ${eventType}:`, error);
    throw error;
  }
}

async function updateDailyAnalytics(date: string, messageCount: number = 0, errorCount: number = 0, responseTime: number = 0) {
  try {
    // Get current DAU for the date
    const { data: dauData } = await supabase
      .from('daily_activity_log')
      .select('user_pseudo_id')
      .eq('activity_date', date);

    const dau = dauData ? new Set(dauData.map(d => d.user_pseudo_id)).size : 0;

    // Upsert daily analytics
    await supabase
      .from('daily_analytics')
      .upsert({
        date: date,
        dau: dau,
        message_count: messageCount,
        error_count: errorCount,
        response_time: responseTime,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'date'
      });

  } catch (error) {
    console.error('Error updating daily analytics:', error);
  }
}
