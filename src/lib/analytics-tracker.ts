// Enhanced Analytics Tracking System for Kruthika.fun - Real Data Only
import { CookieManager } from './cookie-manager';

export interface AnalyticsEvent {
  eventType: 'message_sent' | 'session_start' | 'page_view' | 'ad_interaction' | 'user_action' | 'journey_step' | 'cookie_consent' | 'session_update' | 'session_message_increment' | 'user_analytics';
  eventData: {
    chatId?: string;
    messageId?: string;
    senderType?: 'user' | 'ai';
    content?: string;
    hasImage?: boolean;
    adType?: string;
    action?: string;
    page?: string;
    title?: string;
    referrer?: string;
    deviceType?: string;
    browser?: string;
    countryCode?: string;
    countryName?: string;
    timezone?: string;
    stepName?: string;
    stepOrder?: number;
    [key: string]: any;
  };
  userId?: string;
  sessionId?: string;
  timestamp: number;
}

export class AnalyticsTracker {
  private static instance: AnalyticsTracker;
  private sessionId: string;
  private userId: string;
  private sessionStartTime: number;
  private isTrackingEnabled: boolean = false;
  private eventQueue: AnalyticsEvent[] = [];
  private flushInterval: NodeJS.Timeout | null = null;
  private deviceInfo: any = {};

  private constructor() {
    this.sessionId = this.generateSessionId();
    this.userId = this.getUserId();
    this.sessionStartTime = Date.now();
    this.initializeTracking();
    this.startEventQueue();
  }

  public static getInstance(): AnalyticsTracker {
    if (!AnalyticsTracker.instance) {
      AnalyticsTracker.instance = new AnalyticsTracker();
    }
    return AnalyticsTracker.instance;
  }

  private async initializeTracking(): Promise<void> {
    if (typeof window === 'undefined') return;

    const preferences = CookieManager.getConsentPreferences();
    this.isTrackingEnabled = preferences?.analytics || false;

    if (this.isTrackingEnabled) {
      await this.detectDeviceAndLocation();
      await this.trackSessionStart();
      this.setupRealTimeTracking();
    }
  }

  private async detectDeviceAndLocation(): Promise<void> {
    if (typeof window === 'undefined') return;

    try {
      // Device detection
      const userAgent = navigator.userAgent;
      let deviceType = 'desktop';

      if (/Mobile|Android|iPhone|iPad/.test(userAgent)) {
        deviceType = /iPad/.test(userAgent) ? 'tablet' : 'mobile';
      }

      const browser = this.getBrowserName(userAgent);
      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      const language = navigator.language;
      const screenResolution = `${screen.width}x${screen.height}`;

      this.deviceInfo = {
        deviceType,
        browser,
        timezone,
        language,
        screenResolution,
        userAgent
      };

      // Get location data from IP (using a free service)
      try {
        const response = await fetch('https://ipapi.co/json/');
        const locationData = await response.json();

        this.deviceInfo.countryCode = locationData.country_code;
        this.deviceInfo.countryName = locationData.country_name;
        this.deviceInfo.city = locationData.city;
      } catch (error) {
        console.warn('Could not detect location:', error);
      }

      await this.trackEvent({
        eventType: 'user_analytics',
        eventData: {
          sessionId: this.sessionId,
          userPseudoId: this.userId,
          countryCode: this.deviceInfo.countryCode,
          countryName: this.deviceInfo.countryName,
          timezone: this.deviceInfo.timezone,
          deviceType: this.deviceInfo.deviceType,
          browser: this.deviceInfo.browser,
          os: this.getOS(),
          screenResolution: this.deviceInfo.screenResolution,
          language: this.deviceInfo.language
        },
        userId: this.userId,
        sessionId: this.sessionId,
        timestamp: Date.now()
      });

    } catch (error) {
      console.warn('Device detection error:', error);
    }
  }

  private getBrowserName(userAgent: string): string {
    if (userAgent.includes('Chrome')) return 'Chrome';
    if (userAgent.includes('Firefox')) return 'Firefox';
    if (userAgent.includes('Safari')) return 'Safari';
    if (userAgent.includes('Edge')) return 'Edge';
    return 'Other';
  }

  private getOS(): string {
    const userAgent = navigator.userAgent;
    if (userAgent.includes('Windows')) return 'Windows';
    if (userAgent.includes('Mac')) return 'macOS';
    if (userAgent.includes('Linux')) return 'Linux';
    if (userAgent.includes('Android')) return 'Android';
    if (userAgent.includes('iOS')) return 'iOS';
    return 'Other';
  }

  private async trackSessionStart(): Promise<void> {
    await this.trackEvent({
      eventType: 'session_start',
      eventData: {
        chatId: 'kruthika_chat',
        ...this.deviceInfo,
        referrer: document.referrer
      },
      userId: this.userId,
      sessionId: this.sessionId,
      timestamp: this.sessionStartTime
    });

    // Track cookie consent
    const preferences = CookieManager.getConsentPreferences();
    if (preferences) {
      await this.trackEvent({
        eventType: 'cookie_consent',
        eventData: {
          sessionId: this.sessionId,
          necessary: preferences.necessary,
          analytics: preferences.analytics,
          advertising: preferences.advertising,
          personalization: preferences.personalization,
          aiLearning: preferences.aiLearning || false,
          intimacyLevel: preferences.intimacyLevel || false
        },
        userId: this.userId,
        sessionId: this.sessionId,
        timestamp: Date.now()
      });
    }

    // Track user journey step
    await this.trackJourneyStep('landing', 1);
  }

  private setupRealTimeTracking(): void {
    // Track page visibility changes
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        this.updateSessionDuration();
      }
    });

    // Track page unload
    window.addEventListener('beforeunload', () => {
      this.updateSessionDuration();
      this.flushEvents(true);
    });

    // Track user interactions for journey funnel
    document.addEventListener('click', (event) => {
      const target = event.target as HTMLElement;
      if (target.closest('.chat-input') || target.closest('[data-action="send-message"]')) {
        this.trackJourneyStep('message_sent', 3);
      }
    });
  }

  private async updateSessionDuration(): Promise<void> {
    const duration = Math.floor((Date.now() - this.sessionStartTime) / 1000);

    await this.trackEvent({
      eventType: 'session_update',
      eventData: {
        sessionId: this.sessionId,
        endedAt: new Date().toISOString(),
        durationSeconds: duration,
        isActive: false
      },
      userId: this.userId,
      sessionId: this.sessionId,
      timestamp: Date.now()
    });
  }

  public async trackEvent(event: AnalyticsEvent): Promise<void> {
    if (!this.isTrackingEnabled) return;
    if (!event || !event.eventType || !event.eventData) return;

    if (!event.userId) event.userId = this.userId;
    if (!event.sessionId) event.sessionId = this.sessionId;
    if (!event.timestamp) event.timestamp = Date.now();

    this.eventQueue.push(event);

    // Batch all events except session_start for better performance
    if (event.eventType === 'session_start') {
      this.flushEvents();
    } else if (this.eventQueue.length >= 50) {
      // Flush when queue reaches 50 events (increased from 10 for better efficiency)
      this.flushEvents();
    }
  }

  public async trackMessage(messageId: string, senderType: 'user' | 'ai', content: string, hasImage: boolean = false): Promise<void> {
    await this.trackEvent({
      eventType: 'message_sent',
      eventData: {
        chatId: 'kruthika_chat',
        messageId,
        senderType,
        content: content.substring(0, 500),
        hasImage
      },
      userId: this.userId,
      sessionId: this.sessionId,
      timestamp: Date.now()
    });

    // Update session message count
    await this.trackEvent({
      eventType: 'session_message_increment',
      eventData: {
        sessionId: this.sessionId
      },
      userId: this.userId,
      sessionId: this.sessionId,
      timestamp: Date.now()
    });

    // Track journey steps
    if (senderType === 'user') {
      await this.trackJourneyStep('message_sent', 3);

      // Check for long session (15+ minutes)
      if (Date.now() - this.sessionStartTime > 15 * 60 * 1000) {
        await this.trackJourneyStep('long_session', 5);
      }
    }
  }

  public async trackPageView(page: string, title?: string): Promise<void> {
    await this.trackEvent({
      eventType: 'page_view',
      eventData: {
        page,
        title,
        referrer: document.referrer
      },
      userId: this.userId,
      sessionId: this.sessionId,
      timestamp: Date.now()
    });
  }

  public async trackAdInteraction(adType: string, action: 'view' | 'click', adNetwork?: string): Promise<void> {
    await this.trackEvent({
      eventType: 'ad_interaction',
      eventData: {
        adType,
        action,
        network: adNetwork || 'unknown',
        page: window.location.pathname
      },
      userId: this.userId,
      sessionId: this.sessionId,
      timestamp: Date.now()
    });
  }

  public async trackAdInteractionPublic(adType: string, action: 'view' | 'click', adNetwork?: string): Promise<void> {
    return this.trackAdInteraction(adType, action, adNetwork);
  }

  public async trackUserAction(action: string, metadata?: Record<string, any>): Promise<void> {
    await this.trackEvent({
      eventType: 'user_action',
      eventData: {
        action,
        ...metadata,
        page: window.location.pathname
      },
      userId: this.userId,
      sessionId: this.sessionId,
      timestamp: Date.now()
    });
  }

  public async trackImageShare(imageUrl: string, context?: string): Promise<void> {
    await this.trackEvent({
      eventType: 'user_action',
      eventData: {
        action: 'image_share',
        imageUrl,
        context,
        page: window.location.pathname
      },
      userId: this.userId,
      sessionId: this.sessionId,
      timestamp: Date.now()
    });

    // Track journey step for image sharing
    await this.trackJourneyStep('image_share', 4);
  }

  public async trackJourneyStep(stepName: string, order: number): Promise<void> {
    await this.trackEvent({
      eventType: 'journey_step',
      eventData: {
        stepName,
        stepOrder: order,
        pagePath: window.location.pathname
      },
      userId: this.userId,
      sessionId: this.sessionId,
      timestamp: Date.now()
    });
  }

  private generateSessionId(): string {
    if (typeof window === 'undefined') return 'server_session';

    let sessionId = sessionStorage.getItem('kruthika_session_id');
    if (!sessionId) {
      sessionId = 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
      sessionStorage.setItem('kruthika_session_id', sessionId);
    }
    return sessionId;
  }

  private getUserId(): string {
    if (typeof window === 'undefined') return 'server_user';

    let userId = localStorage.getItem('kruthika_user_id');
    if (!userId) {
      userId = 'user_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
      localStorage.setItem('kruthika_user_id', userId);
    }
    return userId;
  }

  private startEventQueue() {
    // Optimized: Increased from 10 seconds to 30 seconds to reduce API calls
    this.flushInterval = setInterval(() => {
      this.flushEvents();
    }, 30000);
  }

  private async flushEvents(immediate = false): Promise<void> {
    if (this.eventQueue.length === 0) return;

    const eventsToSend = [...this.eventQueue];
    this.eventQueue = [];

    try {
      await fetch('/api/analytics/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ events: eventsToSend, sessionId: this.sessionId })
      });
    } catch (error) {
      console.warn('Error flushing analytics events:', error);
      this.eventQueue.unshift(...eventsToSend);
    }
  }

  public async getAnalyticsOverview(dateRange: string = '7d') {
    try {
      const response = await fetch(`/api/analytics?type=overview&dateRange=${dateRange}`);
      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Analytics overview error:', error);
      return null;
    }
  }

  public async getRealtimeAnalytics() {
    try {
      const response = await fetch('/api/analytics?type=realtime');
      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Real-time analytics error:', error);
      return null;
    }
  }

  public enableTracking(): void {
    this.isTrackingEnabled = true;
    this.initializeTracking();
  }

  public disableTracking(): void {
    this.isTrackingEnabled = false;
  }

  destroy() {
    if (this.flushInterval) {
      clearInterval(this.flushInterval);
      this.flushInterval = null;
    }
    this.updateSessionDuration();
    this.flushEvents(true);
  }
}

export const analyticsTracker = AnalyticsTracker.getInstance();

if (typeof window !== 'undefined') {
  setTimeout(() => {
    const preferences = CookieManager.getConsentPreferences();
    if (preferences?.analytics) {
      analyticsTracker.enableTracking();
    }
  }, 1000);
}
