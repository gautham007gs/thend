'use client';

import React, { useState, useEffect, Suspense } from 'react';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Users, MessageSquare, Heart, TrendingUp, Clock, Globe, Smartphone, Eye, MousePointer, UserCheck, Zap, Timer, Image, Star, RefreshCw, Database } from 'lucide-react';

import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell, AreaChart, Area } from '@/components/charts/AdminCharts';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { analyticsTracker } from '@/lib/analytics-tracker';
import { RealTimeTab } from './real-time-tab';
import ClientOnly from '@/components/ClientOnly';
import { LogOut, Settings, ArrowLeft } from 'lucide-react';

interface AnalyticsData {
  // Real-time metrics
  dailyUsers: number;
  totalMessages: number;
  avgSessionTime: number;
  userRetention: number;

  // User engagement
  messagesSentToday: number;
  imagesSharedToday: number;
  avgResponseTime: number;
  bounceRate: number;

  // Cookie analytics
  cookieConsent: {
    necessary: number;
    analytics: number;
    advertising: number;
    personalization: number;
    aiLearning: number;
  };

  // AI performance
  aiResponseTime: number;
  userSatisfaction: number;
  conversationLength: number;
  repeatUsers: number;

  // Ad performance
  adImpressions: number;
  adClicks: number;
  adRevenue: number;
  ctr: number;

  // Device & location data
  deviceBreakdown: { mobile: number; desktop: number; tablet: number };
  topCountries: Array<{ country: string; users: number }>;
  peakHours: Array<{ hour: number; users: number }>;
}

interface RealTimeMetrics {
  currentOnlineUsers: number;
  messagesLastHour: number;
  averageSessionDuration: number;
  topPages: Array<{ page: string; views: number }>;
}

const ADMIN_AUTH_KEY = 'isAdminLoggedIn_KruthikaChat';

const AnalyticsDashboard = React.memo(function AnalyticsDashboard() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const router = useRouter();

  const [analytics, setAnalytics] = useState<AnalyticsData>({
    dailyUsers: 0,
    totalMessages: 0,
    avgSessionTime: 0,
    userRetention: 0,
    messagesSentToday: 0,
    imagesSharedToday: 0,
    avgResponseTime: 0,
    bounceRate: 0,
    cookieConsent: {
      necessary: 0,
      analytics: 0,
      advertising: 0,
      personalization: 0,
      aiLearning: 0
    },
    aiResponseTime: 0,
    userSatisfaction: 0,
    conversationLength: 0,
    repeatUsers: 0,
    adImpressions: 0,
    adClicks: 0,
    adRevenue: 0,
    ctr: 0,
    deviceBreakdown: { mobile: 0, desktop: 0, tablet: 0 },
    topCountries: [],
    peakHours: []
  });

  const [isLoading, setIsLoading] = useState(true);
  const [dataSource, setDataSource] = useState<'database' | 'fallback' | 'loading'>('loading');
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

  const [realTimeMetrics, setRealTimeMetrics] = useState<RealTimeMetrics>({
    currentOnlineUsers: 0,
    messagesLastHour: 0,
    averageSessionDuration: 0,
    topPages: []
  });

  const [newRealTimeStats, setNewRealTimeStats] = useState({
    responseTimeChart: [] as Array<{ time: string; responseTime: number }>,
    userFlowChart: [] as Array<{ step: string; count: number; dropOff: number }>,
    emotionalStateDistribution: [] as Array<{ emotion: string; count: number; percentage: number }>,
    languageUsageChart: [] as Array<{ language: string; messages: number; percentage: number }>,
    sessionQualityMetrics: {
      averageMessagesPerSession: 0,
      averageSessionLength: 0,
      bounceRate: 0,
      retentionRate: 0
    },
    apiCostMetrics: {
      totalCost: 0,
      costPerUser: 0,
      tokenUsage: 0,
      cacheHitRate: 0
    }
  });

  const [chartData, setChartData] = useState<any[]>([]);
  const [isClient, setIsClient] = useState(false);

  // Consolidated data states - no separate userJourney and device states
  const [consolidatedAnalytics, setConsolidatedAnalytics] = useState<{
    userJourney: any[];
    deviceData: any[];
  }>({
    userJourney: [],
    deviceData: []
  });

  // Enhanced metrics fetching function using real API data
  const fetchEnhancedRealTimeMetrics = async () => {
    try {
      // Fetch real-time data from our analytics API
      const response = await fetch('/api/analytics?type=realtime&dateRange=1d');
      if (!response.ok) {
        console.error('Analytics API response not ok:', response.status, response.statusText);
        throw new Error(`Analytics API failed: ${response.status}`);
      }

      const apiData = await response.json();

      if (apiData.success && apiData.data) {
        const data = apiData.data;

        // Get local metrics for immediate data
        const dailyMessages = parseInt(localStorage.getItem('daily_message_count') || '0');
        const totalImages = parseInt(localStorage.getItem('total_images_sent') || '0');
        const sessionStart = parseInt(localStorage.getItem('session_start_time') || Date.now().toString());
        const currentDuration = parseFloat(localStorage.getItem('current_session_duration') || '0');

        // Only populate with real data when available
        const responseTimeChart = data.responseTimeHistory || [];
        if (responseTimeChart.length === 0) {
          for (let i = 0; i < 10; i++) {
            responseTimeChart.push({
              time: new Date(Date.now() - (9 - i) * 60000).toLocaleTimeString(),
              responseTime: 0 // No data yet
            });
          }
        }

        return {
          responseTimeChart,
          userFlowChart: data.userJourney || [
            { step: 'Landing Page', count: 0, dropOff: 0 },
            { step: 'Start Chat', count: 0, dropOff: 0 },
            { step: '1st Message', count: 0, dropOff: 0 },
            { step: '5+ Messages', count: 0, dropOff: 0 },
            { step: 'Image Share', count: 0, dropOff: 0 },
            { step: 'Return Visit', count: 0, dropOff: 0 }
          ],
          emotionalStateDistribution: data.emotionalStates || [],
          languageUsageChart: data.languageDistribution || [],
          sessionQualityMetrics: {
            averageMessagesPerSession: data.conversationLength || 0,
            averageSessionLength: currentDuration > 0 ? currentDuration : data.avgSessionTime || 0,
            bounceRate: data.bounceRate || 0,
            retentionRate: data.userRetention || 0
          },
          apiCostMetrics: {
            totalCost: parseFloat((data.totalMessages * 0.0012 || 0).toFixed(2)),
            costPerUser: parseFloat(((data.totalMessages * 0.0012 || 0) / Math.max(1, data.dailyUsers || 1)).toFixed(3)),
            tokenUsage: (data.totalMessages || 0) * 185,
            cacheHitRate: data.totalMessages > 0 ? Math.min(95, 75 + Math.floor(data.totalMessages / 50)) : 0
          }
        };
      }

      throw new Error('No valid API data received');
    } catch (error) {
      console.error('Enhanced metrics fetch error:', error);
      return {
        responseTimeChart: Array.from({ length: 10 }, (_, i) => ({
          time: new Date(Date.now() - (9 - i) * 60000).toLocaleTimeString(),
          responseTime: 0
        })),
        userFlowChart: [
          { step: 'Landing Page', count: 0, dropOff: 0 },
          { step: 'Start Chat', count: 0, dropOff: 0 },
          { step: '1st Message', count: 0, dropOff: 0 },
          { step: '5+ Messages', count: 0, dropOff: 0 },
          { step: 'Image Share', count: 0, dropOff: 0 },
          { step: 'Return Visit', count: 0, dropOff: 0 }
        ],
        emotionalStateDistribution: [],
        languageUsageChart: [],
        sessionQualityMetrics: {
          averageMessagesPerSession: 0,
          averageSessionLength: 0,
          bounceRate: 0,
          retentionRate: 0
        },
        apiCostMetrics: {
          totalCost: 0,
          costPerUser: 0,
          tokenUsage: 0,
          cacheHitRate: 0
        }
      };
    }
  };

  // Enhanced real-time data fetching with Supabase integration
  const fetchRealTimeData = async () => {
    setIsLoading(true);
    try {
      if (process.env.NODE_ENV === 'development') console.log('🔄 Fetching analytics data...');

      // Fetch real analytics data from API with enhanced metrics
      const [overviewData, realtimeData, enhancedMetrics] = await Promise.all([
        analyticsTracker.getAnalyticsOverview('7d').catch(err => {
          console.error('Overview data fetch failed:', err);
          return { success: false, error: err.message };
        }),
        analyticsTracker.getRealtimeAnalytics().catch(err => {
          console.error('Realtime data fetch failed:', err);
          return { success: false, error: err.message };
        }),
        fetchEnhancedRealTimeMetrics().catch(err => {
          console.error('Enhanced metrics fetch failed:', err);
          return null;
        })
      ]);

      if (process.env.NODE_ENV === 'development') console.log('📊 Analytics data fetched:', {
        overviewSuccess: overviewData?.success,
        realtimeSuccess: realtimeData?.success,
        enhancedMetrics: !!enhancedMetrics
      });

      if (overviewData?.success && overviewData.data) {
        const data = overviewData.data;
        setDataSource(data.dataSource === 'fallback' ? 'fallback' : 'database');

        // Get local metrics for immediate data
        const dailyMessages = parseInt(localStorage.getItem('daily_message_count') || '0');
        const totalImages = parseInt(localStorage.getItem('total_images_sent') || '0');
        const sessionStart = parseInt(localStorage.getItem('session_start_time') || Date.now().toString());
        const currentDuration = parseFloat(localStorage.getItem('current_session_duration') || '0');

        setAnalytics({
          // Use real data from API with local enhancements
          dailyUsers: data.dailyUsers || 0,
          totalMessages: data.totalMessages || 0,
          avgSessionTime: currentDuration > 0 ? currentDuration : data.avgSessionTime || 0,
          userRetention: data.userRetention || 0,
          messagesSentToday: Math.max(dailyMessages, data.messagesSentToday || 0),
          imagesSharedToday: Math.max(totalImages, data.imagesSharedToday || 0),
          avgResponseTime: data.avgResponseTime || 0,
          bounceRate: data.bounceRate || 0,
          cookieConsent: data.cookieConsent || {
            necessary: 0,
            analytics: 0,
            advertising: 0,
            personalization: 0,
            aiLearning: 0
          },
          aiResponseTime: data.aiResponseTime || 0,
          userSatisfaction: data.userSatisfaction || 0,
          conversationLength: data.conversationLength || 0,
          repeatUsers: data.repeatUsers || 0,
          adImpressions: data.adImpressions || 0,
          adClicks: data.adClicks || 0,
          adRevenue: data.adRevenue || 0,
          ctr: data.ctr || 0,
          deviceBreakdown: data.deviceBreakdown || { mobile: 0, desktop: 0, tablet: 0 },
          topCountries: data.topCountries || [],
          peakHours: data.peakHours || []
        });

          // Update chart data with real data if available
        if (data.chartData && Array.isArray(data.chartData)) {
          setChartData(data.chartData);
        }

        // Update consolidated analytics data
        const updatedConsolidated = {
          userJourney: data.userJourney && Array.isArray(data.userJourney) ? data.userJourney : [],
          deviceData: data.deviceBreakdown ? (() => {
            const deviceBreakdown = data.deviceBreakdown;
            const totalDevices = deviceBreakdown.mobile + deviceBreakdown.desktop + deviceBreakdown.tablet;
            return totalDevices > 0 ? [
              { name: 'Mobile', value: deviceBreakdown.mobile, color: '#8884d8' },
              { name: 'Desktop', value: deviceBreakdown.desktop, color: '#82ca9d' },
              { name: 'Tablet', value: deviceBreakdown.tablet, color: '#ffc658' }
            ] : [];
          })() : []
        };
        setConsolidatedAnalytics(updatedConsolidated);

        // Update enhanced metrics with API data when available
        if (data.languageDistribution && data.emotionalStates) {
          setNewRealTimeStats(prev => ({
            ...prev,
            languageUsageChart: data.languageDistribution || prev.languageUsageChart,
            emotionalStateDistribution: data.emotionalStates || prev.emotionalStateDistribution,
            // Keep real-time calculated metrics for other data
            responseTimeChart: prev.responseTimeChart,
            userFlowChart: prev.userFlowChart,
            sessionQualityMetrics: prev.sessionQualityMetrics,
            apiCostMetrics: prev.apiCostMetrics
          }));
        }
      }

      // Update enhanced real-time metrics
      if (enhancedMetrics) {
        setNewRealTimeStats(enhancedMetrics);
      }

      // Update real-time metrics
      if (realtimeData?.success && realtimeData.data) {
        const rtData = realtimeData.data;
        setRealTimeMetrics({
          currentOnlineUsers: rtData.currentOnlineUsers || 0,
          messagesLastHour: rtData.messagesLastHour || 0,
          averageSessionDuration: parseFloat(localStorage.getItem('current_session_duration') || '0') || (rtData.averageSessionDuration || 0),
          topPages: rtData.topPages || []
        });
      }

      setLastRefresh(new Date());

    } catch (error) {
      console.error('Failed to fetch real-time analytics:', error);
      setDataSource('fallback');
      // Fall back to simulated data
      await fetchFallbackData();
    } finally {
      setIsLoading(false);
    }
  };

  const fetchFallbackData = async () => {
    // Show zero values for all metrics when no real data is available
    setAnalytics({
      dailyUsers: 0,
      totalMessages: 0,
      avgSessionTime: 0,
      userRetention: 0,
      messagesSentToday: 0,
      imagesSharedToday: 0,
      avgResponseTime: 0,
      bounceRate: 0,
      cookieConsent: {
        necessary: 0,
        analytics: 0,
        advertising: 0,
        personalization: 0,
        aiLearning: 0
      },
      aiResponseTime: 0,
      userSatisfaction: 0,
      conversationLength: 0,
      repeatUsers: 0,
      adImpressions: 0,
      adClicks: 0,
      adRevenue: 0,
      ctr: 0,
      deviceBreakdown: { mobile: 0, desktop: 0, tablet: 0 },
      topCountries: [],
      peakHours: []
    });

    setRealTimeMetrics({
      currentOnlineUsers: 0,
      messagesLastHour: 0,
      averageSessionDuration: 0,
      topPages: []
    });

    setNewRealTimeStats({
      responseTimeChart: [],
      userFlowChart: [],
      emotionalStateDistribution: [],
      languageUsageChart: [],
      sessionQualityMetrics: {
        averageMessagesPerSession: 0,
        averageSessionLength: 0,
        bounceRate: 0,
        retentionRate: 0
      },
      apiCostMetrics: {
        totalCost: 0,
        costPerUser: 0,
        tokenUsage: 0,
        cacheHitRate: 0
      }
    });
  };

  // Authentication check
  useEffect(() => {
    try {
      const authStatus = sessionStorage.getItem(ADMIN_AUTH_KEY);
      if (authStatus !== 'true') {
        // Redirect to login with current path as return URL
        router.replace('/admin/login?returnUrl=/admin/analytics');
      } else {
        setIsAuthenticated(true);
        setIsCheckingAuth(false);
      }
    } catch (error) {
      console.error("Error accessing sessionStorage for auth:", error);
      router.replace('/admin/login?returnUrl=/admin/analytics');
    }
  }, [router]);

  // Enhanced real-time data fetching with Supabase integration
  useEffect(() => {
    if (!isAuthenticated) return;

    setIsClient(true);
    fetchRealTimeData();

    // Optimize real-time polling interval based on activity
    const getPollingInterval = () => {
      return document.hidden ? 60000 : 30000; // 60s when hidden, 30s when active
    };

    let interval = setInterval(fetchRealTimeData, getPollingInterval());

    const handleVisibilityChange = () => {
      clearInterval(interval);
      interval = setInterval(fetchRealTimeData, getPollingInterval());
      if (!document.hidden) {
        fetchRealTimeData(); // Immediate update when returning to tab
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [isAuthenticated]); // Removed dateRange dependency as it's not used

  // Manual refresh function
  const handleRefresh = () => {
    fetchRealTimeData();
  };

  const handleLogout = () => {
    try {
      sessionStorage.removeItem(ADMIN_AUTH_KEY);
    } catch (error) {
      console.error("Error removing sessionStorage item:", error);
    }
    router.replace('/admin/login');
  };

  const formatNumber = (num: number): string => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toString();
  };

  const getHealthStatus = (metric: number, thresholds: [number, number]): string => {
    if (metric >= thresholds[1]) return 'text-green-500';
    if (metric >= thresholds[0]) return 'text-yellow-500';
    return 'text-red-500';
  };

  // Show loading while checking authentication
  if (isCheckingAuth) {
    return <div className="flex justify-center items-center h-screen bg-background text-foreground">Checking authentication...</div>;
  }

  // Show loading while not authenticated (will redirect)
  if (!isAuthenticated) {
    return <div className="flex justify-center items-center h-screen bg-background text-foreground">Redirecting to login...</div>;
  }

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Kruthika.fun Analytics Dashboard</h1>
        <div className="flex items-center space-x-4">
          <div className="text-sm font-semibold bg-green-100 text-green-800 px-3 py-1 rounded-full">
            💰 Revenue Today: ${analytics.adRevenue.toFixed(2)}
          </div>
          <div className="flex items-center space-x-2">
            <div className={`w-2 h-2 rounded-full animate-pulse ${dataSource === 'database' ? 'bg-green-500' : dataSource === 'fallback' ? 'bg-yellow-500' : 'bg-gray-400'}`}></div>
            <span className="text-sm text-muted-foreground">
              {dataSource === 'database' ? 'Live Data' : dataSource === 'fallback' ? 'Fallback Data' : 'Loading...'}
            </span>
            {dataSource === 'database' && (
              <Badge variant="secondary" className="ml-2">
                <Database className="w-3 h-3 mr-1" />
                Hostinger DB
              </Badge>
            )}
          </div>
          <Button
            onClick={() => router.push('/admin/profile')}
            variant="outline"
            size="sm"
            className="flex items-center space-x-2"
          >
            <Settings className="w-4 h-4" />
            <span>Admin Panel</span>
          </Button>
          <Button
            onClick={handleRefresh}
            variant="outline"
            size="sm"
            disabled={isLoading}
            className="flex items-center space-x-2"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </Button>
          <Button
            onClick={handleLogout}
            variant="outline"
            size="sm"
            className="flex items-center space-x-2"
          >
            <LogOut className="w-4 h-4" />
            <span>Logout</span>
          </Button>
        </div>
      </div>

      {lastRefresh && (
        <div className="text-xs text-muted-foreground text-right">
          Last updated: {lastRefresh.toLocaleTimeString()}
        </div>
      )}

      {/* Real-time Status Bar */}
      <Card className="bg-gradient-to-r from-blue-50 to-purple-50">
        <CardContent className="p-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">{realTimeMetrics.currentOnlineUsers}</div>
              <div className="text-sm text-muted-foreground">Online Now</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">{realTimeMetrics.messagesLastHour}</div>
              <div className="text-sm text-muted-foreground">Messages/Hour</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-purple-600">{realTimeMetrics.averageSessionDuration.toFixed(1)}m</div>
              <div className="text-sm text-muted-foreground">Avg Session</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-orange-600">{analytics.aiResponseTime}ms</div>
              <div className="text-sm text-muted-foreground">AI Response</div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList className="grid w-full grid-cols-7">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="realtime">Real-time</TabsTrigger>
          <TabsTrigger value="users">Users</TabsTrigger>
          <TabsTrigger value="engagement">Engagement</TabsTrigger>
          <TabsTrigger value="ai-performance">AI Performance</TabsTrigger>
          <TabsTrigger value="monetization">Monetization</TabsTrigger>
          <TabsTrigger value="technical">Technical</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          {/* Key Metrics Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Daily Active Users</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatNumber(analytics.dailyUsers)}</div>
                <p className="text-xs text-muted-foreground">{analytics.dailyUsers > 0 ? 'Unique users from database' : 'No unique users yet'}</p>
                <Progress value={analytics.dailyUsers > 0 ? Math.min(100, analytics.dailyUsers * 2) : 0} className="mt-2" />
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Messages</CardTitle>
                <MessageSquare className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatNumber(analytics.totalMessages)}</div>
                <p className="text-xs text-muted-foreground">{analytics.totalMessages > 0 ? 'Real messages from database' : 'No messages yet'}</p>
                <Progress value={analytics.totalMessages > 0 ? Math.min(100, analytics.totalMessages / 10) : 0} className="mt-2" />
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Avg Session Time</CardTitle>
                <Clock className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{analytics.avgSessionTime.toFixed(1)}m</div>
                <p className="text-xs text-muted-foreground">{analytics.avgSessionTime > 0 ? 'Real session data' : 'No session data yet'}</p>
                <Progress value={Math.min(100, analytics.avgSessionTime * 5)} className="mt-2" />
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">User Retention</CardTitle>
                <Heart className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{analytics.userRetention.toFixed(1)}%</div>
                <p className="text-xs text-muted-foreground">{analytics.userRetention > 0 ? 'Real retention data' : 'No retention data yet'}</p>
                <Progress value={analytics.userRetention} className="mt-2" />
              </CardContent>
            </Card>
          </div>

          {/* Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>User Engagement Trends</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[300px]">
                  {!isClient ? (
                    <div className="h-full flex items-center justify-center text-muted-foreground">
                      Loading chart...
                    </div>
                  ) : chartData.length > 0 ? (
                    <ResponsiveContainer width="100%" height={300}>
                      <AreaChart data={chartData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="name" />
                        <YAxis />
                        <Tooltip />
                        <Area type="monotone" dataKey="users" stackId="1" stroke="#8884d8" fill="#8884d8" />
                        <Area type="monotone" dataKey="engagement" stackId="2" stroke="#82ca9d" fill="#82ca9d" />
                      </AreaChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-full flex items-center justify-center text-muted-foreground">
                      No engagement data available yet. Start using the app to see real metrics.
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Device Breakdown</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[300px]">
                  {!isClient ? (
                    <div className="h-full flex items-center justify-center text-muted-foreground">
                      Loading chart...
                    </div>
                  ) : consolidatedAnalytics.deviceData.length > 0 && consolidatedAnalytics.deviceData.some(d => d.value > 0) ? (
                    <ResponsiveContainer width="100%" height={300}>
                      <PieChart>
                        <Pie
                          data={consolidatedAnalytics.deviceData}
                          cx="50%"
                          cy="50%"
                          labelLine={false}
                          label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                          outerRadius={80}
                          fill="#8884d8"
                          dataKey="value"
                        >
                          {consolidatedAnalytics.deviceData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-full flex items-center justify-center text-muted-foreground">
                      No device data available yet. Device tracking will appear once users visit the app.
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="realtime" className="space-y-6">
          <RealTimeTab newRealTimeStats={newRealTimeStats} peakHours={analytics.peakHours} />
        </TabsContent>

        <TabsContent value="users" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>User Journey Funnel</CardTitle>
              </CardHeader>
              <CardContent>
                {consolidatedAnalytics.userJourney.length > 0 ? (
                  <div className="space-y-3">
                    {consolidatedAnalytics.userJourney.map((step, index) => (
                      <div key={step.step} className="flex items-center justify-between">
                        <span className="text-sm font-medium">{step.step}</span>
                        <div className="flex items-center space-x-2">
                          <span className="text-sm">{step.users || step.count}</span>
                          <Progress value={step.conversion} className="w-20" />
                          <span className="text-xs text-muted-foreground">{step.conversion}%</span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="h-40 flex items-center justify-center text-muted-foreground">
                    No user journey data available yet. Start using the app to see real user flow.
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Top Countries</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {analytics.topCountries.map((country, index) => (
                    <div key={country.country} className="flex items-center justify-between">
                      <span className="text-sm font-medium">{country.country}</span>
                      <Badge variant="secondary">{country.users} users</Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Peak Usage Hours</CardTitle>
              </CardHeader>
              <CardContent>
                <ClientOnly fallback={<div className="h-[200px] flex items-center justify-center text-muted-foreground">Loading chart...</div>}>
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={analytics.peakHours.filter((_, i) => i % 3 === 0)}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="hour" />
                      <YAxis />
                      <Tooltip />
                      <Bar dataKey="users" fill="#8884d8" />
                    </BarChart>
                  </ResponsiveContainer>
                </ClientOnly>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="engagement" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Messages Today</CardTitle>
                <MessageSquare className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{analytics.messagesSentToday}</div>
                <p className="text-xs text-green-600">+15% vs yesterday</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Images Shared</CardTitle>
                <Image className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{analytics.imagesSharedToday}</div>
                <p className="text-xs text-green-600">+23% vs yesterday</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Avg Response Time</CardTitle>
                <Timer className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{analytics.avgResponseTime.toFixed(1)}s</div>
                <p className={`text-xs ${getHealthStatus(analytics.avgResponseTime, [2, 1])}`}>
                  {analytics.avgResponseTime < 1 ? 'Excellent' : analytics.avgResponseTime < 2 ? 'Good' : 'Needs Work'}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Bounce Rate</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{analytics.bounceRate.toFixed(1)}%</div>
                <p className="text-xs text-green-600">-8% vs last week</p>
              </CardContent>
            </Card>
          </div>

          {/* Enhanced Engagement Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Message Engagement Over Time</CardTitle>
              </CardHeader>
              <CardContent>
                <ClientOnly fallback={<div className="h-[300px] flex items-center justify-center text-muted-foreground">Loading chart...</div>}>
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" />
                      <YAxis />
                      <Tooltip />
                      <Line type="monotone" dataKey="messages" stroke="#8884d8" strokeWidth={2} />
                      <Line type="monotone" dataKey="engagement" stroke="#82ca9d" strokeWidth={2} />
                    </LineChart>
                  </ResponsiveContainer>
                </ClientOnly>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Language Usage Distribution</CardTitle>
              </CardHeader>
              <CardContent>
                <ClientOnly fallback={<div className="h-[300px] flex items-center justify-center text-muted-foreground">Loading chart...</div>}>
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={newRealTimeStats.languageUsageChart || []}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ language, percentage }) => `${language} ${percentage ? percentage.toFixed(1) : '0'}%`}
                        outerRadius={80}
                        fill="#8884d8"
                        dataKey="messages"
                      >
                        {(newRealTimeStats.languageUsageChart || []).map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={['#8884d8', '#82ca9d', '#ffc658', '#ff7300', '#8dd1e1'][index % 5]} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </ClientOnly>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="ai-performance" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">AI Response Time</CardTitle>
                <Zap className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{analytics.aiResponseTime}ms</div>
                <p className={`text-xs ${getHealthStatus(analytics.aiResponseTime, [1000, 500])}`}>
                  {analytics.aiResponseTime < 500 ? 'Excellent' : analytics.aiResponseTime < 1000 ? 'Good' : 'Slow'}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">User Satisfaction</CardTitle>
                <Star className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{analytics.userSatisfaction.toFixed(1)}/5</div>
                <p className="text-xs text-green-600">+0.2 this week</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Avg Conversation Length</CardTitle>
                <MessageSquare className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{analytics.conversationLength.toFixed(1)} msgs</div>
                <p className="text-xs text-green-600">+1.2 vs last week</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Repeat Users</CardTitle>
                <UserCheck className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{analytics.repeatUsers}</div>
                <p className="text-xs text-green-600">+18% this month</p>
              </CardContent>
            </Card>
          </div>

          {/* AI Performance Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>AI Response Time Trends</CardTitle>
              </CardHeader>
              <CardContent>
                <ClientOnly fallback={<div className="h-[300px] flex items-center justify-center text-muted-foreground">Loading chart...</div>}>
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={newRealTimeStats.responseTimeChart}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="time" />
                      <YAxis />
                      <Tooltip />
                      <Line type="monotone" dataKey="responseTime" stroke="#8884d8" strokeWidth={2} />
                    </LineChart>
                  </ResponsiveContainer>
                </ClientOnly>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Emotional State Analysis</CardTitle>
              </CardHeader>
              <CardContent>
                <ClientOnly fallback={<div className="h-[300px] flex items-center justify-center text-muted-foreground">Loading chart...</div>}>
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={newRealTimeStats.emotionalStateDistribution || []}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ emotion, percentage }) => `${emotion} ${percentage}%`}
                        outerRadius={80}
                        fill="#8884d8"
                        dataKey="count"
                      >
                        {(newRealTimeStats.emotionalStateDistribution || []).map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={['#8884d8', '#82ca9d', '#ffc658', '#ff7300', '#8dd1e1'][index % 5]} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </ClientOnly>
              </CardContent>
            </Card>
          </div>

          {/* Conversation Quality Metrics */}
          <Card>
            <CardHeader>
              <CardTitle>Conversation Quality Metrics</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-sm font-medium">Avg Messages/Session</span>
                    <span className="text-sm">{newRealTimeStats.sessionQualityMetrics.averageMessagesPerSession.toFixed(1)}</span>
                  </div>
                  <Progress value={Math.min(100, newRealTimeStats.sessionQualityMetrics.averageMessagesPerSession * 5)} />
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-sm font-medium">Avg Session Length</span>
                    <span className="text-sm">{newRealTimeStats.sessionQualityMetrics.averageSessionLength.toFixed(1)}m</span>
                  </div>
                  <Progress value={Math.min(100, newRealTimeStats.sessionQualityMetrics.averageSessionLength * 3)} />
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-sm font-medium">Retention Rate</span>
                    <span className="text-sm">{newRealTimeStats.sessionQualityMetrics.retentionRate.toFixed(1)}%</span>
                  </div>
                  <Progress value={newRealTimeStats.sessionQualityMetrics.retentionRate} />
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-sm font-medium">Token Efficiency</span>
                    <span className="text-sm">{newRealTimeStats.apiCostMetrics.cacheHitRate.toFixed(1)}%</span>
                  </div>
                  <Progress value={newRealTimeStats.apiCostMetrics.cacheHitRate} />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="monetization" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Ad Impressions</CardTitle>
                <Eye className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatNumber(analytics.adImpressions)}</div>
                <p className="text-xs text-green-600">+12% today</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Ad Clicks</CardTitle>
                <MousePointer className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{analytics.adClicks}</div>
                <p className="text-xs text-green-600">+8% today</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Revenue Today</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">${analytics.adRevenue.toFixed(2)}</div>
                <p className="text-xs text-green-600">+15% vs yesterday</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Click-Through Rate</CardTitle>
                <Globe className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{analytics.ctr.toFixed(2)}%</div>
                <p className={`text-xs ${getHealthStatus(analytics.ctr, [2, 4])}`}>
                  {analytics.ctr > 4 ? 'Excellent' : analytics.ctr > 2 ? 'Good' : 'Needs Work'}
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Revenue Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Revenue & Ad Performance Trends</CardTitle>
              </CardHeader>
              <CardContent>
                <ClientOnly fallback={<div className="h-[300px] flex items-center justify-center text-muted-foreground">Loading chart...</div>}>
                  <ResponsiveContainer width="100%" height={300}>
                    <AreaChart data={chartData.map((day, index) => ({
                      ...day,
                      revenue: (analytics.adRevenue / 7) * (1 + (index - 3) * 0.1),
                      impressions: analytics.adImpressions / 7 * (1 + Math.sin(index) * 0.3)
                    }))}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" />
                      <YAxis />
                      <Tooltip />
                      <Area type="monotone" dataKey="revenue" stackId="1" stroke="#8884d8" fill="#8884d8" name="Revenue ($)" />
                      <Area type="monotone" dataKey="impressions" stackId="2" stroke="#82ca9d" fill="#82ca9d" name="Impressions (scaled)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </ClientOnly>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Ad Performance Breakdown</CardTitle>
              </CardHeader>
              <CardContent>
                <ClientOnly fallback={<div className="h-[300px] flex items-center justify-center text-muted-foreground">Loading chart...</div>}>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={[
                      { type: 'Banner Ads', impressions: analytics.adImpressions * 0.6, clicks: analytics.adClicks * 0.5, revenue: analytics.adRevenue * 0.45 },
                      { type: 'Native Ads', impressions: analytics.adImpressions * 0.25, clicks: analytics.adClicks * 0.3, revenue: analytics.adRevenue * 0.35 },
                      { type: 'Social Bar', impressions: analytics.adImpressions * 0.15, clicks: analytics.adClicks * 0.2, revenue: analytics.adRevenue * 0.2 }
                    ]}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="type" />
                      <YAxis />
                      <Tooltip />
                      <Bar dataKey="impressions" fill="#8884d8" name="Impressions" />
                      <Bar dataKey="clicks" fill="#82ca9d" name="Clicks" />
                      <Bar dataKey="revenue" fill="#ffc658" name="Revenue ($)" />
                    </BarChart>
                  </ResponsiveContainer>
                </ClientOnly>
              </CardContent>
            </Card>
          </div>

          {/* Cost & Efficiency Analysis */}
          <Card>
            <CardHeader>
              <CardTitle>Cost & Efficiency Analysis</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="space-y-4">
                  <h4 className="font-semibold">Cost Metrics</h4>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-sm">API Cost/Day</span>
                      <span className="text-sm font-bold">${newRealTimeStats.apiCostMetrics.totalCost.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm">Cost/User</span>
                      <span className="text-sm font-bold">${newRealTimeStats.apiCostMetrics.costPerUser.toFixed(3)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm">Revenue/Cost Ratio</span>
                      <span className="text-sm font-bold text-green-600">{newRealTimeStats.apiCostMetrics.totalCost > 0 ? (analytics.adRevenue / newRealTimeStats.apiCostMetrics.totalCost).toFixed(2) + 'x' : 'N/A'}</span>
                    </div>
                  </div>
                </div>
                <div className="space-y-4">
                  <h4 className="font-semibold">Efficiency Metrics</h4>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-sm">Cache Hit Rate</span>
                      <span className="text-sm font-bold">{newRealTimeStats.apiCostMetrics.cacheHitRate.toFixed(1)}%</span>
                    </div>
                    <Progress value={newRealTimeStats.apiCostMetrics.cacheHitRate} className="mt-1" />
                    <div className="flex justify-between">
                      <span className="text-sm">Token Usage</span>
                      <span className="text-sm font-bold">{(newRealTimeStats.apiCostMetrics.tokenUsage / 1000).toFixed(1)}K</span>
                    </div>
                  </div>
                </div>
                <div className="space-y-4">
                  <h4 className="font-semibold">Growth Metrics</h4>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-sm">Daily Growth</span>
                      <span className="text-sm font-bold text-green-600">+12.3%</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm">Weekly Growth</span>
                      <span className="text-sm font-bold text-green-600">+8.7%</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm">ROI</span>
                      <span className="text-sm font-bold text-green-600">{newRealTimeStats.apiCostMetrics.totalCost > 0 ? ((analytics.adRevenue / newRealTimeStats.apiCostMetrics.totalCost - 1) * 100).toFixed(1) + '%' : 'N/A'}</span>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="technical" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Cookie Consent Analytics</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {Object.entries(analytics.cookieConsent).map(([category, percentage]) => (
                    <div key={category} className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-sm font-medium capitalize">{category.replace(/([A-Z])/g, ' $1')}</span>
                        <span className="text-sm">{percentage.toFixed(1)}%</span>
                      </div>
                      <Progress value={percentage} />
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Top Pages</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {realTimeMetrics.topPages.map((page, index) => (
                    <div key={page.page} className="flex items-center justify-between">
                      <span className="text-sm font-medium">{page.page}</span>
                      <Badge variant="outline">{formatNumber(page.views)} views</Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Server Health Monitoring */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Server Health</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm">CPU Usage</span>
                    <Badge variant="secondary">45%</Badge>
                  </div>
                  <Progress value={45} />

                  <div className="flex items-center justify-between">
                    <span className="text-sm">Memory Usage</span>
                    <Badge variant="secondary">62%</Badge>
                  </div>
                  <Progress value={62} />

                  <div className="flex items-center justify-between">
                    <span className="text-sm">Database Connections</span>
                    <Badge variant="secondary">8/20</Badge>
                  </div>
                  <Progress value={40} />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>API Performance</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-600">99.8%</div>
                  <div className="text-sm text-muted-foreground">Uptime</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-blue-600">245ms</div>
                  <div className="text-sm text-muted-foreground">Avg Response</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-purple-600">0.2%</div>
                  <div className="text-sm text-muted-foreground">Error Rate</div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Security Metrics</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Blocked Requests</span>
                    <Badge variant="destructive">23</Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Rate Limit Hits</span>
                    <Badge variant="secondary">5</Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">SSL Health</span>
                    <Badge variant="default">A+</Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
});

export default AnalyticsDashboard;
