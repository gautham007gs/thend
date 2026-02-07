"use client";

import React, { useState, useEffect, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import ProfileEditor from '@/components/chat/ProfileEditor';
import type { AIProfile, AdminStatusDisplay, ManagedContactStatus, AdSettings, AIMediaAssetsConfig, AIMediaAsset } from '@/types';
import { AD_SETTINGS_CONFIG_KEY, AI_PROFILE_CONFIG_KEY, ADMIN_OWN_STATUS_CONFIG_KEY, MANAGED_DEMO_CONTACTS_CONFIG_KEY, AI_MEDIA_ASSETS_CONFIG_KEY } from '@/types';
import { defaultAIProfile, defaultAdminStatusDisplay, availableAvatars, defaultManagedContactStatuses, defaultAdSettings, DEFAULT_ADSTERRA_DIRECT_LINK, DEFAULT_MONETAG_DIRECT_LINK, defaultAIMediaAssetsConfig } from '@/config/ai';
import { useToast } from "@/hooks/use-toast";
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { ChartContainer, ChartTooltip, ChartTooltipContent, ChartLegend, ChartLegendContent } from "@/components/ui/chart";

import { BarChart as RechartsBarChart, CartesianGrid, XAxis, YAxis, Bar } from '@/components/charts/AdminCharts';
import type { ChartConfig } from "@/components/ui/chart";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Terminal, Database, Users, MessageSquare, LogOut, Link, Settings, ExternalLink, Palette, Info, UserCircle, Globe, ImagePlus, Music2, Trash2, PlusCircle, Edit3, Sparkles, BarChartHorizontalBig, Edit, FileText, RefreshCcw, RotateCcw, Newspaper, LayoutPanelLeft, TrendingUp, ShieldAlert } from "lucide-react"
import { isDatabaseConfigured, supabase } from '@/lib/supabaseClient';
import { format, subDays, eachDayOfInterval } from 'date-fns';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAIProfile, setExternalIsLoadingAIProfile } from '@/contexts/AIProfileContext'; // Import setter
import { useGlobalStatus } from '@/contexts/GlobalStatusContext';
import { useAIMediaAssets } from '@/contexts/AIMediaAssetsContext';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import Image from 'next/image';


const ADMIN_AUTH_KEY = 'isAdminLoggedIn_KruthikaChat';

const messagesChartConfig = { messages: { label: "Messages Sent", color: "hsl(var(--chart-2))" } } satisfies ChartConfig;
const dauChartConfig = { active_users: { label: "Active Users", color: "hsl(var(--chart-1))" } } satisfies ChartConfig;

interface DailyCount {
  date: string;
  count: number;
}

const AdminProfilePage: React.FC = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const router = useRouter();
  const { toast } = useToast();

  const { aiProfile: contextAIProfile, fetchAIProfile, updateAIProfile, isLoadingAIProfile } = useAIProfile();
  const { adminOwnStatus: contextAdminStatus, managedDemoContacts: contextManagedContacts, fetchGlobalStatuses, isLoadingGlobalStatuses } = useGlobalStatus();
  const { mediaAssetsConfig: contextMediaAssets, fetchMediaAssets, isLoadingMediaAssets } = useAIMediaAssets();

  const [currentGlobalAIProfile, setCurrentGlobalAIProfile] = useState<AIProfile>(defaultAIProfile);
  const [adminStatus, setAdminStatus] = useState<AdminStatusDisplay>(defaultAdminStatusDisplay);
  const [managedContactStatuses, setManagedContactStatuses] = useState<ManagedContactStatus[]>(defaultManagedContactStatuses);
  const [adSettings, setAdSettings] = useState<AdSettings>(defaultAdSettings);
  const [aiMediaAssets, setAiMediaAssets] = useState<AIMediaAssetsConfig>(defaultAIMediaAssetsConfig);

  const [newImageUrl, setNewImageUrl] = useState('');
  const [newAudioPath, setNewAudioPath] = useState('');
  const [uploadingFile, setUploadingFile] = useState<boolean>(false);
  const [uploadProgress, setUploadProgress] = useState<string>('');

  const [isProfileEditorOpen, setIsProfileEditorOpen] = useState(false);

  const [realTotalUserMessages, setRealTotalUserMessages] = useState<number | null>(null);
  const [realTotalAiMessages, setRealTotalAiMessages] = useState<number | null>(null);
  const [realMessagesSentLast7Days, setRealMessagesSentLast7Days] = useState<DailyCount[]>([]);

  const [dailyActiveUsersData, setDailyActiveUsersData] = useState<DailyCount[]>([]);
  const [currentDAU, setCurrentDAU] = useState<number | null>(null);

  const [analyticsLoading, setAnalyticsLoading] = useState(true);
  const [supabaseError, setSupabaseError] = useState<string | null>(null);

  const combinedIsLoadingSupabaseData = isLoadingAIProfile || isLoadingGlobalStatuses || isLoadingMediaAssets;


  useEffect(() => {
    try {
        const authStatus = sessionStorage.getItem(ADMIN_AUTH_KEY);
        if (authStatus !== 'true') {
          // Redirect to login with current path as return URL
          router.replace('/admin/login?returnUrl=/admin/profile');
        } else {
          setIsAuthenticated(true);
        }
    } catch (error) {
        console.error("Error accessing sessionStorage for auth:", error);
        router.replace('/admin/login?returnUrl=/admin/profile');
    }
  }, [router]);

  useEffect(() => {
    if (contextAIProfile) {
      console.log("[AdminProfilePage] Context AIProfile updated, setting currentGlobalAIProfile. AvatarURL from context:", contextAIProfile.avatarUrl);
      setCurrentGlobalAIProfile(contextAIProfile);
    } else if (!isLoadingAIProfile) { // Only use default if not loading and context is null
      console.log("[AdminProfilePage] Context AIProfile is null and not loading, using defaultAIProfile for currentGlobalAIProfile.");
      setCurrentGlobalAIProfile(defaultAIProfile);
    }
  }, [contextAIProfile, isLoadingAIProfile]);

  useEffect(() => {
    if (contextAdminStatus) setAdminStatus(contextAdminStatus);
  }, [contextAdminStatus]);

  useEffect(() => {
    if (contextManagedContacts) setManagedContactStatuses(contextManagedContacts);
  }, [contextManagedContacts]);

  useEffect(() => {
    if (contextMediaAssets) setAiMediaAssets(contextMediaAssets);
  }, [contextMediaAssets]);


  const fetchAllNonAnalyticsConfigs = useCallback(async () => {
    if (!supabase) {
      toast({ title: "Hostinger DB Error", description: "Hostinger DB client not available. Cannot load some global configurations.", variant: "destructive" });
      setAdSettings(defaultAdSettings);
      setCurrentGlobalAIProfile(defaultAIProfile);
      return;
    }
    try {
      const { data: adConfigData, error: adConfigError } = await supabase
        .from('app_configurations')
        .select('settings')
        .eq('id', AD_SETTINGS_CONFIG_KEY)
        .single();

      if (adConfigError && adConfigError.code !== 'PGRST116') throw adConfigError;
      const adSettingsData = adConfigData?.settings;

      const mergedAdSettings: AdSettings = {
        ...defaultAdSettings,
        ...(adSettingsData as Partial<AdSettings>),
        // Explicitly default social bar and direct link fields to handle stale Supabase data
        adsterraSocialBarCode: (adSettingsData as AdSettings)?.adsterraSocialBarCode ?? defaultAdSettings.adsterraSocialBarCode,
        adsterraSocialBarEnabled: (adSettingsData as AdSettings)?.adsterraSocialBarEnabled ?? defaultAdSettings.adsterraSocialBarEnabled,
        adsterraDirectLink: (adSettingsData as AdSettings)?.adsterraDirectLink ?? defaultAdSettings.adsterraDirectLink,
        adsterraDirectLinkEnabled: (adSettingsData as AdSettings)?.adsterraDirectLinkEnabled ?? defaultAdSettings.adsterraDirectLinkEnabled,
        monetagSocialBarCode: (adSettingsData as AdSettings)?.monetagSocialBarCode ?? defaultAdSettings.monetagSocialBarCode,
        monetagSocialBarEnabled: (adSettingsData as AdSettings)?.monetagSocialBarEnabled ?? defaultAdSettings.monetagSocialBarEnabled,
        monetagDirectLink: (adSettingsData as AdSettings)?.monetagDirectLink ?? defaultAdSettings.monetagDirectLink,
        monetagDirectLinkEnabled: (adSettingsData as AdSettings)?.monetagDirectLinkEnabled ?? defaultAdSettings.monetagDirectLinkEnabled,
        maxDirectLinkAdsPerDay: Number((adSettingsData as AdSettings)?.maxDirectLinkAdsPerDay) || defaultAdSettings.maxDirectLinkAdsPerDay,
        maxDirectLinkAdsPerSession: Number((adSettingsData as AdSettings)?.maxDirectLinkAdsPerSession) || defaultAdSettings.maxDirectLinkAdsPerSession,
        directLinkMessageInterval: Number((adSettingsData as AdSettings)?.directLinkMessageInterval) || defaultAdSettings.directLinkMessageInterval,
        directLinkInactivityMinutes: Number((adSettingsData as AdSettings)?.directLinkInactivityMinutes) || defaultAdSettings.directLinkInactivityMinutes,
      };
      setAdSettings(mergedAdSettings);

      await fetchAIProfile(); // This will set its own loading state internally
      await fetchGlobalStatuses();
      await fetchMediaAssets();

    } catch (error: any) {
      console.error("Failed to load some global configurations from Hostinger DB:", error);
      toast({ title: "Error Loading Some Global Configs", description: `Could not load some global settings. Using defaults. ${error.message || ''}`, variant: "destructive" });
      setAdSettings(defaultAdSettings);
      setCurrentGlobalAIProfile(defaultAIProfile);
      setAdminStatus(defaultAdminStatusDisplay);
      setManagedContactStatuses(defaultManagedContactStatuses);
      setAiMediaAssets(defaultAIMediaAssetsConfig);
    } finally {
        // Context manages its own loading state
    }
  }, [toast, fetchAIProfile, fetchGlobalStatuses, fetchMediaAssets]);


  useEffect(() => {
    if (isAuthenticated) {
      fetchAllNonAnalyticsConfigs();
    }
  }, [isAuthenticated, fetchAllNonAnalyticsConfigs]);

   useEffect(() => {
    if (!isAuthenticated) return;

    async function fetchRealAnalytics() {
      if (!supabase || typeof supabase.from !== 'function' || !isDatabaseConfigured) {
        setSupabaseError("Hostinger DB client is not configured or environment variables are missing. Real analytics will be unavailable. Please check environment variables and HOSTINGER_MYSQL_SETUP.sql.");
        setAnalyticsLoading(false);
        setRealTotalUserMessages(0);
        setRealTotalAiMessages(0);
        setRealMessagesSentLast7Days([]);
        setDailyActiveUsersData([]);
        setCurrentDAU(0);
        return;
      }
      try {
        setAnalyticsLoading(true);
        setSupabaseError(null);

        const { count: userMsgCount, error: userMsgError } = await supabase
          .from('messages_log')
          .select('*', { count: 'exact', head: true })
          .eq('sender_type', 'user');
        if (userMsgError) throw userMsgError;
        setRealTotalUserMessages(userMsgCount ?? 0);

        const { count: aiMsgCount, error: aiMsgError } = await supabase
          .from('messages_log')
          .select('*', { count: 'exact', head: true })
          .eq('sender_type', 'ai');
        if (aiMsgError) throw aiMsgError;
        setRealTotalAiMessages(aiMsgCount ?? 0);

        const sevenDaysAgo = format(subDays(new Date(), 6), 'yyyy-MM-dd');

        const { data: dailyMsgCountsData, error: dailyMsgCountsError } = await supabase
          .rpc('get_daily_message_counts', { start_date: sevenDaysAgo });
        if (dailyMsgCountsError) throw dailyMsgCountsError;

        const { data: dailyDAUData, error: dailyDAUError } = await supabase
          .rpc('get_daily_active_user_counts', { start_date: sevenDaysAgo });
        if (dailyDAUError) throw dailyDAUError;

        const todayDate = new Date();
        const last7DaysInterval = eachDayOfInterval({ start: subDays(todayDate, 6), end: todayDate });

        const formattedDailyMsgCounts: DailyCount[] = last7DaysInterval.map(day => {
          const dayStr = format(day, 'yyyy-MM-dd');
          const found = dailyMsgCountsData?.find((d: any) => format(new Date(d.date), 'yyyy-MM-dd') === dayStr);
          return { date: format(day, 'EEE'), count: found ? Number(found.messages) : 0 };
        });
        setRealMessagesSentLast7Days(formattedDailyMsgCounts);

        const formattedDAUCounts: DailyCount[] = last7DaysInterval.map(day => {
          const dayStr = format(day, 'yyyy-MM-dd');
          const found = dailyDAUData?.find((d: any) => format(new Date(d.date), 'yyyy-MM-dd') === dayStr);
          return { date: format(day, 'EEE'), count: found ? Number(found.active_users) : 0 };
        });
        setDailyActiveUsersData(formattedDAUCounts);

        const todayFormatted = format(todayDate, 'EEE');
        const todayDAU = formattedDAUCounts.find(d => d.date === todayFormatted);
        setCurrentDAU(todayDAU ? todayDAU.count : 0);

      } catch (err: any) {
        console.error("Error fetching real analytics from Hostinger DB:", err);
        const errorMessage = err.message || "Could not fetch real analytics from Hostinger DB.";
        setSupabaseError(errorMessage);
        toast({ title: "Analytics Error", description: `${errorMessage} Check HOSTINGER_MYSQL_SETUP.sql and ensure SQL functions exist.`, variant: "destructive" });
        setRealTotalUserMessages(0);
        setRealTotalAiMessages(0);
        setRealMessagesSentLast7Days([]);
        setDailyActiveUsersData([]);
        setCurrentDAU(0);
      } finally {
        setAnalyticsLoading(false);
      }
    }

    if (typeof window !== 'undefined' && isAuthenticated) {
      fetchRealAnalytics();
    }
  }, [toast, isAuthenticated]);


  const handleSaveKruthikaCoreProfile = async (updatedCoreProfileData: Partial<AIProfile>) => {
    // Construct the data to update, ensuring empty avatarUrl is treated as undefined
    const profileDataToUpdate: Partial<AIProfile> = {
      name: updatedCoreProfileData.name,
      status: updatedCoreProfileData.status,
      avatarUrl: updatedCoreProfileData.avatarUrl?.trim() === '' ? undefined : updatedCoreProfileData.avatarUrl,
    };
    console.log("[AdminProfilePage] handleSaveKruthikaCoreProfile - profileDataToUpdate before calling context update:", JSON.stringify(profileDataToUpdate, null, 2));
    await updateAIProfile(profileDataToUpdate);
    setIsProfileEditorOpen(false);
  };

  const handleSaveKruthikaStory = async () => {
    const storyDataToUpdate: Partial<AIProfile> = {
        statusStoryText: currentGlobalAIProfile.statusStoryText,
        statusStoryImageUrl: currentGlobalAIProfile.statusStoryImageUrl?.trim() === '' ? undefined : currentGlobalAIProfile.statusStoryImageUrl,
        statusStoryMediaUrl: currentGlobalAIProfile.statusStoryMediaUrl?.trim() === '' ? undefined : currentGlobalAIProfile.statusStoryMediaUrl,
        statusStoryMediaType: currentGlobalAIProfile.statusStoryMediaType,
        statusStoryHasUpdate: currentGlobalAIProfile.statusStoryHasUpdate,
    };
    console.log("[AdminProfilePage] handleSaveKruthikaStory - storyDataToUpdate before calling context update:", JSON.stringify(storyDataToUpdate, null, 2));
    await updateAIProfile(storyDataToUpdate);
  };

  const handleClearKruthikaStoryField = (field: 'statusStoryText' | 'statusStoryImageUrl') => {
    setCurrentGlobalAIProfile(p => ({
      ...p,
      [field]: field === 'statusStoryText' ? "" : undefined,
    }));
  };


  const handleSaveAdminStatus = async () => {
    if (!supabase) {
      toast({ title: "Hostinger DB Error", description: "Hostinger DB client not available.", variant: "destructive" });
      return;
    }
    const statusToSave = {
        ...adminStatus,
        statusImageUrl: adminStatus.statusImageUrl?.trim() === '' ? undefined : adminStatus.statusImageUrl,
    };
    try {
      const { error } = await supabase
        .from('app_configurations')
        .upsert(
          { id: ADMIN_OWN_STATUS_CONFIG_KEY, settings: statusToSave, updated_at: new Date().toISOString() },
          { onConflict: 'id' }
        );
      if (error) throw error;
      await fetchGlobalStatuses();
      toast({ title: "Global 'My Status' Saved!", description: "Your status for the Status Page has been updated universally." });
    } catch (error: any)
      {
      console.error("Failed to save 'My Status' to Hostinger DB:", error);
      toast({ title: "Error Saving 'My Status'", description: `Could not save your status globally. ${error.message || ''}`, variant: "destructive" });
    }
  };

  const handleClearAdminStatusField = (field: 'statusText' | 'statusImageUrl') => {
    setAdminStatus(s => ({
        ...s,
        [field]: field === 'statusText' ? "" : undefined,
    }));
  };


  const handleManagedContactChange = (id: string, field: keyof ManagedContactStatus, value: string | boolean) => {
    setManagedContactStatuses(prev =>
      prev.map(contact => {
        if (contact.id === id) {
          if (field === 'statusImageUrl') {
            return { ...contact, [field]: typeof value === 'string' && value.trim() === '' ? undefined : (value as string) };
          }
          return { ...contact, [field]: value };
        }
        return contact;
      })
    );
  };

  const handleClearManagedContactField = (id: string, field: 'statusText' | 'statusImageUrl') => {
    setManagedContactStatuses(prev =>
      prev.map(contact =>
        contact.id === id
          ? { ...contact, [field]: field === 'statusText' ? "" : undefined }
          : contact
      )
    );
  };

  const handleSaveManagedContactStatuses = async () => {
    if (!supabase) {
      toast({ title: "Hostinger DB Error", description: "Hostinger DB client not available.", variant: "destructive" });
      return;
    }
    try {
      const { error } = await supabase
        .from('app_configurations')
        .upsert(
          { id: MANAGED_DEMO_CONTACTS_CONFIG_KEY, settings: managedContactStatuses, updated_at: new Date().toISOString() },
          { onConflict: 'id' }
        );
      if (error) throw error;
      await fetchGlobalStatuses();
      toast({ title: "Global Demo Contacts Saved!", description: "Status details for demo contacts have been updated universally." });
    } catch (error: any) {
      console.error("Failed to save managed contact statuses to Hostinger DB:", error);
      toast({ title: "Error Saving Demo Contacts", description: `Could not save demo contact statuses globally. ${error.message || ''}`, variant: "destructive" });
    }
  };

  const handleAdSettingChange = (field: keyof AdSettings, value: string | boolean | number | undefined) => {
    if (field === 'maxDirectLinkAdsPerDay' || field === 'maxDirectLinkAdsPerSession') {
        const numValue = Number(value);
        setAdSettings(prev => ({ ...prev, [field]: isNaN(numValue) ? 0 : numValue }));
    } else {
        setAdSettings(prev => ({ ...prev, [field]: value }));
    }
  };

  const handleResetDirectLink = (network: 'adsterra' | 'monetag') => {
    if (network === 'adsterra') {
      setAdSettings(prev => ({ ...prev, adsterraDirectLink: DEFAULT_ADSTERRA_DIRECT_LINK }));
      toast({ title: "Adsterra Link Reset", description: "Adsterra direct link reset to default in form. Click 'Save Ad Settings' to apply." });
    } else if (network === 'monetag') {
      setAdSettings(prev => ({ ...prev, monetagDirectLink: DEFAULT_MONETAG_DIRECT_LINK }));
      toast({ title: "Monetag Link Reset", description: "Monetag direct link reset to default in form. Click 'Save Ad Settings' to apply." });
    }
  };

  const handleSaveAdSettings = async () => {
    if (!supabase) {
      toast({ title: "Hostinger DB Error", description: "Hostinger DB client not available. Cannot save ad settings.", variant: "destructive" });
      return;
    }
    const settingsToSave: AdSettings = {
      ...adSettings,
      adsterraDirectLink: adSettings.adsterraDirectLink?.trim() || DEFAULT_ADSTERRA_DIRECT_LINK,
      monetagDirectLink: adSettings.monetagDirectLink?.trim() || DEFAULT_MONETAG_DIRECT_LINK,
      maxDirectLinkAdsPerDay: Number(adSettings.maxDirectLinkAdsPerDay) || 0,
      maxDirectLinkAdsPerSession: Number(adSettings.maxDirectLinkAdsPerSession) || 0,
    };
    try {
      const { error } = await supabase
        .from('app_configurations')
        .upsert(
          { id: AD_SETTINGS_CONFIG_KEY, settings: settingsToSave, updated_at: new Date().toISOString() },
          { onConflict: 'id' }
        );
      if (error) throw error;
      toast({ title: "Global Ad Settings Saved!", description: "Ad configurations have been saved to Hostinger DB and will apply universally." });
    } catch (error: any) {
      console.error("Failed to save ad settings to Hostinger DB:", error);
      toast({ title: "Error Saving Ad Settings", description: `Could not save global ad settings to Hostinger DB. ${error.message || ''}`, variant: "destructive" });
    }
  };

  const handleAddMediaAsset = (type: 'image' | 'audio') => {
    let urlToAdd = '';
    if (type === 'image') {
      if (!newImageUrl.trim() || !newImageUrl.startsWith('http')) {
        toast({ title: "Invalid Image URL", description: "Please enter a valid, full public URL for the image (starting with http/https).", variant: "destructive" });
        return;
      }
      urlToAdd = newImageUrl.trim();
    } else {
      if (!newAudioPath.trim() || !newAudioPath.startsWith('/media/')) {
        toast({ title: "Invalid Audio Path", description: "Audio path must start with /media/ (e.g., /media/sound.mp3). Ensure file is in public/media/.", variant: "destructive" });
        return;
      }
      urlToAdd = newAudioPath.trim();
    }

    const newAsset: AIMediaAsset = {
      id: `${type}_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      type,
      url: urlToAdd,
    };
    setAiMediaAssets(prev => ({ assets: [...prev.assets, newAsset] }));
    if (type === 'image') setNewImageUrl('');
    else setNewAudioPath('');
  };

  const handleDeleteMediaAsset = async (assetId: string) => {
    const asset = aiMediaAssets.assets.find(a => a.id === assetId);

    if (!asset) {
      toast({ title: "Error", description: "Asset not found", variant: "destructive" });
      return;
    }

    // Confirm deletion
    if (!confirm(`Delete ${asset.description || 'this media file'}? This action cannot be undone.`)) {
      return;
    }

    // If asset has storage metadata, delete from Supabase Storage first
    if (asset.storagePath && asset.storageBucket) {
      try {
        if (!supabase) {
          toast({ title: "Error", description: "Hostinger DB client not available", variant: "destructive" });
          return;
        }

        const { data: { session } } = await supabase.auth.getSession();

        if (!session) {
          toast({ title: "Error", description: "Not authenticated. Please login again.", variant: "destructive" });
          router.replace('/admin/login?returnUrl=/admin/profile');
          return;
        }

        const response = await fetch(`/api/upload?path=${encodeURIComponent(asset.storagePath)}&bucket=${encodeURIComponent(asset.storageBucket)}`, {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
          },
          credentials: 'include',
        });

        if (!response.ok) {
          const error = await response.json();
          toast({ title: "Storage Delete Error", description: `Failed to delete file from storage: ${error.error || 'Unknown error'}`, variant: "destructive" });
          return;
        }
      } catch (error: any) {
        console.error("Error deleting file from storage:", error);
        toast({ title: "Storage Delete Error", description: `Failed to delete file from storage: ${error.message || 'Unknown error'}`, variant: "destructive" });
        return;
      }
    }

    // Remove from local state and auto-save
    const updatedAssets = { assets: aiMediaAssets.assets.filter(a => a.id !== assetId) };
    setAiMediaAssets(updatedAssets);

    // Auto-save to persist deletion
    if (!supabase) {
      toast({ title: "Asset Removed", description: "File removed locally. Hostinger DB unavailable - click 'Save' manually.", variant: "destructive" });
      return;
    }

    try {
      const { error: saveError } = await supabase
        .from('app_configurations')
        .upsert(
          { id: AI_MEDIA_ASSETS_CONFIG_KEY, settings: updatedAssets, updated_at: new Date().toISOString() },
          { onConflict: 'id' }
        );

      if (saveError) throw saveError;

      await fetchMediaAssets(); // Refresh from DB
      toast({ title: "Asset Deleted!", description: `${asset.description || 'Media file'} has been permanently deleted.` });
    } catch (saveError: any) {
      console.error("Error auto-saving after deletion:", saveError);
      toast({ title: "Delete OK, Save Failed", description: "File deleted but changes not saved to database. Click 'Save' manually.", variant: "destructive" });
    }
  };

  const handleFileUpload = async (file: File, type: 'image' | 'audio' | 'video') => {
    if (!file) return;

    setUploadingFile(true);
    setUploadProgress(`Uploading ${file.name}...`);

    try {
      if (!supabase) {
        throw new Error('Hostinger DB client not available');
      }

      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        throw new Error('Not authenticated. Please login again.');
      }

      const formData = new FormData();
      formData.append('file', file);
      formData.append('type', type);

      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
        credentials: 'include',
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Upload failed');
      }

      const result = await response.json();

      // Create new media asset with storage metadata
      const newAsset: AIMediaAsset = {
        id: `${type}_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        type,
        url: result.url,
        storagePath: result.path,
        storageBucket: result.bucket,
        uploadedAt: new Date().toISOString(),
        description: file.name,
      };

      // Update local state
      const updatedAssets = { assets: [...aiMediaAssets.assets, newAsset] };
      setAiMediaAssets(updatedAssets);

      // Auto-save to Supabase to persist immediately
      if (!supabase) {
        toast({ title: "Warning", description: "File uploaded but Hostinger DB unavailable. Click 'Save' manually.", variant: "destructive" });
        setUploadProgress('');
        setUploadingFile(false);
        return;
      }

      try {
        const { error: saveError } = await supabase
          .from('app_configurations')
          .upsert(
            { id: AI_MEDIA_ASSETS_CONFIG_KEY, settings: updatedAssets, updated_at: new Date().toISOString() },
            { onConflict: 'id' }
          );

        if (saveError) throw saveError;

        await fetchMediaAssets(); // Refresh from DB
        toast({ title: "File Uploaded & Saved!", description: `${file.name} uploaded and saved to database successfully.` });
      } catch (saveError: any) {
        console.error("Error auto-saving uploaded file:", saveError);
        toast({ title: "Upload OK, Save Failed", description: `File uploaded but not saved to database. Click 'Save Global AI Media Assets' manually.`, variant: "destructive" });
      }

      setUploadProgress('');
    } catch (error: any) {
      console.error("Upload error:", error);
      toast({ title: "Upload Failed", description: error.message || 'Failed to upload file', variant: "destructive" });
      setUploadProgress('');
    } finally {
      setUploadingFile(false);
    }
  };

  const handleSaveAIMediaAssets = async () => {
    if (!supabase) {
      toast({ title: "Hostinger DB Error", description: "Hostinger DB client not available.", variant: "destructive" });
      return;
    }
    try {
      const { error } = await supabase
        .from('app_configurations')
        .upsert(
          { id: AI_MEDIA_ASSETS_CONFIG_KEY, settings: aiMediaAssets, updated_at: new Date().toISOString() },
          { onConflict: 'id' }
        );
      if (error) throw error;
      await fetchMediaAssets();
      toast({ title: "Global AI Media Assets Saved!", description: "Kruthika's sharable images and audio have been updated universally." });
    } catch (error: any) {
      console.error("Failed to save AI Media Assets to Hostinger DB:", error);
      toast({ title: "Error Saving AI Media", description: `Could not save AI media assets globally. ${error.message || ''}`, variant: "destructive" });
    }
  };

  const handleLogout = () => {
    try {
        sessionStorage.removeItem(ADMIN_AUTH_KEY);
    } catch (error) {
        console.error("Error removing sessionStorage item:", error);
    }
    toast({ title: 'Logged Out', description: 'You have been logged out of the admin panel.' });
    router.replace('/admin/login');
  };

  const handleForceRefreshGlobalData = async () => {
    toast({ title: "Refreshing...", description: "Manually fetching latest global data from Hostinger DB."});
    await fetchAllNonAnalyticsConfigs();
    toast({ title: "Refreshed!", description: "Global data updated."});
  };


  if (!isAuthenticated || combinedIsLoadingHostinger DBData) {
    return <div className="flex justify-center items-center h-screen bg-background text-foreground">Loading admin settings...</div>;
  }

  const scriptPasteInstruction = "Paste the full ad script code provided by the ad network here. Include any <!-- comments --> or <script> tags as provided.";

  let adminPageAvatarUrlToUse = currentGlobalAIProfile.avatarUrl;
  if (!adminPageAvatarUrlToUse || typeof adminPageAvatarUrlToUse !== 'string' || adminPageAvatarUrlToUse.trim() === '' || (!adminPageAvatarUrlToUse.startsWith('http') && !adminPageAvatarUrlToUse.startsWith('data:'))) {
    adminPageAvatarUrlToUse = defaultAIProfile.avatarUrl;
  }
  console.log("[AdminProfilePage] Rendering main avatar. currentGlobalAIProfile.avatarUrl:", currentGlobalAIProfile.avatarUrl, "adminPageAvatarUrlToUse:", adminPageAvatarUrlToUse);


  return (
    <TooltipProvider>
    <div className="container mx-auto p-2 sm:p-4 lg:p-6 bg-background min-h-screen">
      <div className="flex flex-col sm:flex-row justify-between items-center mb-6 gap-4">
        <h1 className="text-2xl sm:text-3xl font-bold text-primary flex items-center">
          <Sparkles className="mr-3 h-7 w-7" /> Kruthika Chat Admin Panel
        </h1>
        <div className="flex gap-2">
          <Button onClick={handleForceRefreshGlobalData} variant="outline" size="sm" title="Force refresh all global data from Hostinger DB">
            <RefreshCcw className="mr-2 h-4 w-4" /> Refresh Data
          </Button>
          <Button onClick={handleLogout} variant="outline" size="sm">
            <LogOut className="mr-2 h-4 w-4" /> Logout
          </Button>
        </div>
      </div>
      <Alert variant="default" className="mb-8 bg-primary/10 border-primary/30">
        <Globe className="h-5 w-5 !text-primary" />
        <AlertTitle className="text-primary font-semibold">Global Settings Notice</AlertTitle>
        <AlertDescription className="text-primary/80 text-sm">
           Settings for Kruthika's Profile, Story, Sharable Media, Ad Settings, "My Status", and "Demo Contacts" are GLOBAL and saved to Supabase. Changes here will affect all users of the app.
        </AlertDescription>
      </Alert>
      <Alert variant="destructive" className="mb-8">
        <ShieldAlert className="h-5 w-5" />
        <AlertTitle>Admin Panel Security</AlertTitle>
        <AlertDescription>
           The current admin login mechanism is **NOT SECURE** for a live application. Please implement proper server-side authentication (e.g., using Supabase Auth with roles) and update Supabase RLS policies before deploying publicly.
        </AlertDescription>
      </Alert>


      <Tabs defaultValue="kruthika" className="w-full">
        <TabsList className="grid w-full grid-cols-2 md:grid-cols-4 mb-8 h-auto py-2">
          <TabsTrigger value="kruthika" className="text-xs sm:text-sm py-2.5"><UserCircle className="mr-1 sm:mr-2 h-4 w-4"/>Kruthika's Settings</TabsTrigger>
          <TabsTrigger value="ads" className="text-xs sm:text-sm py-2.5"><Settings className="mr-1 sm:mr-2 h-4 w-4"/>Ad Settings</TabsTrigger>
          <TabsTrigger value="status_content" className="text-xs sm:text-sm py-2.5"><FileText className="mr-1 sm:mr-2 h-4 w-4"/>Status Page</TabsTrigger>
          <TabsTrigger value="analytics" className="text-xs sm:text-sm py-2.5"><BarChartHorizontalBig className="mr-1 sm:mr-2 h-4 w-4"/>Analytics</TabsTrigger>
        </TabsList>

        <TabsContent value="kruthika">
          <Card className="bg-card text-card-foreground mb-8 shadow-lg">
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center text-xl font-semibold"><Edit3 className="mr-2 h-5 w-5 text-primary"/> Manage Kruthika's Global Profile</CardTitle>
              <CardDescription className="text-sm">
                Modify Kruthika's main identity (name, avatar, status line). These settings are fetched by all users.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5 pt-2">
              <div className="flex flex-col sm:flex-row items-center gap-4 p-3 bg-secondary/20 rounded-md">
                <div
                  className={cn(
                    "relative rounded-full shrink-0",
                    currentGlobalAIProfile.name === "Kruthika" && "border-2 border-primary p-0.5"
                  )}
                  key={`admin-page-avatar-wrapper-${adminPageAvatarUrlToUse || 'default_wrapper_key_admin'}`}
                >
                  <Avatar
                    className="h-24 w-24 shadow-md"
                    key={`admin-page-avatar-comp-${adminPageAvatarUrlToUse || 'default_avatar_comp_key_admin'}`}
                  >
                      <AvatarImage
                        src={adminPageAvatarUrlToUse || undefined}
                        alt={currentGlobalAIProfile.name}
                        data-ai-hint="profile woman"
                        key={`admin-page-avatar-img-${adminPageAvatarUrlToUse || 'default_img_key_admin_final'}`}
                        onError={(e) => console.error(`Admin Page - AvatarImage load error for ${currentGlobalAIProfile.name}. URL: ${adminPageAvatarUrlToUse}`, e)}
                      />
                      <AvatarFallback>{(currentGlobalAIProfile.name || 'K').charAt(0)}</AvatarFallback>
                  </Avatar>
                </div>
                <div className="text-center sm:text-left">
                  <h3 className="text-2xl font-semibold">{currentGlobalAIProfile.name}</h3>
                  <p className="text-md text-muted-foreground italic">&quot;{currentGlobalAIProfile.status}&quot;</p>
                </div>
              </div>

              <div className="space-y-3 p-4 border rounded-md shadow-sm bg-secondary/20">
                <Label className="font-medium text-sm">Kruthika's Avatar</Label>
                <div className="space-y-2">
                  <div className="space-y-1.5">
                    <Label className="text-sm font-medium">Upload Avatar File</Label>
                    <Input
                      type="file"
                      accept="image/*"
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          setUploadingFile(true);
                          setUploadProgress(`Uploading ${file.name}...`);

                          try {
                            const formData = new FormData();
                            formData.append('file', file);
                            formData.append('type', 'image');

                            const response = await fetch('/api/upload', { method: 'POST', body: formData });
                            if (!response.ok) throw new Error((await response.json()).error || 'Upload failed');

                            const result = await response.json();
                            setCurrentGlobalAIProfile(p => ({ ...p, avatarUrl: result.url }));

                            toast({ title: "Avatar Uploaded!", description: `${file.name} uploaded successfully.` });
                          } catch (error: any) {
                            toast({ title: "Upload Failed", description: error.message || 'Failed to upload file', variant: "destructive" });
                          } finally {
                            setUploadingFile(false);
                            setUploadProgress('');
                          }
                        }
                      }}
                      className="text-sm"
                      disabled={uploadingFile}
                    />
                  </div>
                  <div className="relative">
                    <div className="absolute inset-0 flex items-center">
                      <span className="w-full border-t" />
                    </div>
                    <div className="relative flex justify-center text-xs uppercase">
                      <span className="bg-secondary/20 px-2 text-muted-foreground">Or add URL</span>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-sm font-medium">Avatar URL</Label>
                    <Input
                      type="url"
                      value={currentGlobalAIProfile.avatarUrl || ""}
                      onChange={(e) => setCurrentGlobalAIProfile(p => ({ ...p, avatarUrl: e.target.value }))}
                      placeholder="https://example.com/avatar.jpg"
                      className="text-sm"
                    />
                  </div>
                </div>
                {uploadingFile && uploadProgress && (
                  <div className="text-xs text-muted-foreground animate-pulse">{uploadProgress}</div>
                )}
              </div>

               <Button onClick={() => setIsProfileEditorOpen(true)} className="mt-3 w-full sm:w-auto"><Edit className="mr-2 h-4 w-4" />Edit Kruthika's Core Profile (Global)</Button>
               <p className="text-xs text-muted-foreground flex items-center mt-1"><Info size={13} className="mr-1 shrink-0"/>Kruthika's name is primarily defined by her AI persona logic. Editing it here might have limited effect if the AI's core prompt overrides it.</p>
            </CardContent>
            {isProfileEditorOpen && (
              <ProfileEditor
                currentProfile={currentGlobalAIProfile}
                onSave={handleSaveKruthikaCoreProfile}
                onClose={() => setIsProfileEditorOpen(false)}
                isAdminEditor={true}
                isOpen={isProfileEditorOpen}
                onOpenChange={setIsProfileEditorOpen}
              />
            )}
          </Card>

          <Card className="bg-card text-card-foreground mb-8 shadow-lg">
            <CardHeader className="pb-4">
               <CardTitle className="flex items-center text-xl font-semibold"><Palette className="mr-2 h-5 w-5 text-primary"/>Kruthika's Status Story (Global)</CardTitle>
               <CardDescription className="text-sm">Set the ephemeral story (text and media) that appears for Kruthika on the Status page for all users.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5 pt-2">
                <div className="space-y-1.5">
                  <Label htmlFor="kruthikaStoryText" className="font-medium text-sm">Story Text</Label>
                  <Textarea
                    id="kruthikaStoryText"
                    value={currentGlobalAIProfile.statusStoryText || ""}
                    onChange={(e) => setCurrentGlobalAIProfile(p => ({ ...p, statusStoryText: e.target.value }))}
                    placeholder="What's Kruthika up to for her story?"
                    className="min-h-[70px]"
                  />
                </div>

                <div className="space-y-3">
                  <Label className="font-medium text-sm">Story Media (Image, Video, or Audio)</Label>

                  <div className="space-y-2">
                    <div className="space-y-1.5">
                      <Label className="text-sm font-medium">Upload Media File</Label>
                      <div className="flex gap-2">
                        <Input
                          type="file"
                          accept="image/*,video/*,audio/*"
                          onChange={async (e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              let type: 'image' | 'audio' | 'video' = 'image';
                              if (file.type.startsWith('video/')) type = 'video';
                              else if (file.type.startsWith('audio/')) type = 'audio';

                              setUploadingFile(true);
                              setUploadProgress(`Uploading ${file.name}...`);

                              try {
                                if (!supabase) {
                                  throw new Error('Supabase client not available');
                                }

                                const { data: { session } } = await supabase.auth.getSession();

                                if (!session) {
                                  throw new Error('Not authenticated. Please login again.');
                                }

                                const formData = new FormData();
                                formData.append('file', file);
                                formData.append('type', type);

                                const response = await fetch('/api/upload', {
                                  method: 'POST',
                                  body: formData,
                                  headers: {
                                    'Authorization': `Bearer ${session.access_token}`,
                                  },
                                  credentials: 'include',
                                });
                                if (!response.ok) throw new Error((await response.json()).error || 'Upload failed');

                                const result = await response.json();
                                setCurrentGlobalAIProfile(p => ({
                                  ...p,
                                  statusStoryMediaUrl: result.url,
                                  statusStoryMediaType: type,
                                  statusStoryImageUrl: type === 'image' ? result.url : p.statusStoryImageUrl
                                }));

                                toast({ title: "File Uploaded!", description: `${file.name} uploaded successfully for story.` });
                              } catch (error: any) {
                                toast({ title: "Upload Failed", description: error.message || 'Failed to upload file', variant: "destructive" });
                              } finally {
                                setUploadingFile(false);
                                setUploadProgress('');
                              }
                            }
                          }}
                          className="flex-grow text-sm"
                          disabled={uploadingFile}
                        />
                      </div>
                    </div>
                    <div className="relative">
                      <div className="absolute inset-0 flex items-center">
                        <span className="w-full border-t" />
                      </div>
                      <div className="relative flex justify-center text-xs uppercase">
                        <span className="bg-card px-2 text-muted-foreground">Or add URL</span>
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="kruthikaStoryMediaUrl" className="font-medium text-sm">Media URL (Image/Video/Audio)</Label>
                      <Input
                        id="kruthikaStoryMediaUrl"
                        type="url"
                        value={currentGlobalAIProfile.statusStoryMediaUrl || currentGlobalAIProfile.statusStoryImageUrl || ""}
                        onChange={(e) => setCurrentGlobalAIProfile(p => ({
                          ...p,
                          statusStoryMediaUrl: e.target.value,
                          statusStoryImageUrl: e.target.value
                        }))}
                        placeholder="https://example.com/media.jpg or .mp4 or .mp3"
                      />
                    </div>
                  </div>

                  {(currentGlobalAIProfile.statusStoryMediaUrl || currentGlobalAIProfile.statusStoryImageUrl) && (
                    <div className="mt-2">
                      <Label className="text-xs text-muted-foreground mb-2 block">Preview:</Label>
                      {currentGlobalAIProfile.statusStoryMediaType === 'video' ? (
                        <video src={currentGlobalAIProfile.statusStoryMediaUrl || currentGlobalAIProfile.statusStoryImageUrl} controls className="w-40 h-56 border rounded-md shadow object-cover" />
                      ) : currentGlobalAIProfile.statusStoryMediaType === 'audio' ? (
                        <audio src={currentGlobalAIProfile.statusStoryMediaUrl || currentGlobalAIProfile.statusStoryImageUrl} controls className="w-full mt-1" />
                      ) : (
                        <Avatar className="w-24 h-40 border rounded-md shadow">
                          <AvatarImage
                            src={currentGlobalAIProfile.statusStoryMediaUrl || currentGlobalAIProfile.statusStoryImageUrl}
                            alt="Story preview"
                            className="object-contain"
                          />
                          <AvatarFallback>Preview</AvatarFallback>
                        </Avatar>
                      )}
                    </div>
                  )}
                </div>

                <div className="flex items-center space-x-3 pt-2">
                  <Switch
                    id="kruthikaStoryHasUpdate"
                    checked={currentGlobalAIProfile.statusStoryHasUpdate || false}
                    onCheckedChange={(checked) => setCurrentGlobalAIProfile(p => ({ ...p, statusStoryHasUpdate: checked }))}
                  />
                  <Label htmlFor="kruthikaStoryHasUpdate" className="text-sm font-medium">Show as new/unread update (ring on Status Page)</Label>
                </div>
                <div className="flex flex-wrap gap-2 pt-2">
                    <Button onClick={() => handleClearKruthikaStoryField('statusStoryText')} variant="outline" size="sm"><Trash2 className="mr-1 h-3 w-3"/>Clear Story Text</Button>
                    <Button onClick={() => setCurrentGlobalAIProfile(p => ({ ...p, statusStoryMediaUrl: undefined, statusStoryImageUrl: undefined, statusStoryMediaType: undefined }))} variant="outline" size="sm"><Trash2 className="mr-1 h-3 w-3"/>Clear Story Media</Button>
                </div>
            </CardContent>
            <CardFooter className="mt-2">
                <Button onClick={handleSaveKruthikaStory} className="w-full sm:w-auto"><Palette className="mr-2 h-4 w-4" /> Save Kruthika's Story (Global)</Button>
            </CardFooter>
          </Card>

          <Card className="bg-card text-card-foreground mb-6 shadow-lg">
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center text-xl font-semibold"><ImagePlus className="mr-2 h-5 w-5 text-primary"/>Kruthika's Sharable Media (Global)</CardTitle>
              <CardDescription className="text-sm">Add or remove images and audio clips Kruthika can proactively share during chats. These are fetched by all users.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6 pt-2">
              <div className="space-y-4 p-4 border rounded-md shadow-sm bg-secondary/20">
                <h4 className="text-lg font-semibold text-primary flex items-center"><ImagePlus className="mr-2 h-4 w-4"/>Images</h4>
                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <Label className="text-sm font-medium">Upload Image File</Label>
                    <div className="flex gap-2">
                      <Input
                        type="file"
                        accept="image/*"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) handleFileUpload(file, 'image');
                        }}
                        className="flex-grow text-sm"
                        disabled={uploadingFile}
                      />
                    </div>
                  </div>
                  <div className="relative">
                    <div className="absolute inset-0 flex items-center">
                      <span className="w-full border-t" />
                    </div>
                    <div className="relative flex justify-center text-xs uppercase">
                      <span className="bg-secondary/20 px-2 text-muted-foreground">Or add URL</span>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="newImageUrl" className="text-sm font-medium">Image URL (Publicly Accessible)</Label>
                    <div className="flex gap-2">
                      <Input id="newImageUrl" type="url" value={newImageUrl} onChange={(e) => setNewImageUrl(e.target.value)} placeholder="https://example.com/image.png" className="flex-grow text-sm"/>
                      <Button onClick={() => handleAddMediaAsset('image')} variant="outline" size="icon"><PlusCircle className="h-4 w-4" /></Button>
                    </div>
                  </div>
                </div>
                {uploadingFile && uploadProgress && (
                  <div className="text-xs text-muted-foreground animate-pulse">{uploadProgress}</div>
                )}
                {aiMediaAssets.assets.filter(asset => asset.type === 'image').length > 0 ? (
                  <div className="space-y-2 max-h-60 overflow-y-auto custom-scrollbar p-2 bg-background rounded border">
                    {aiMediaAssets.assets.filter(asset => asset.type === 'image').map(asset => (
                      <div key={asset.id} className="flex items-center justify-between p-2 bg-card border rounded-md hover:bg-secondary/30">
                        <div className="flex items-center gap-3 overflow-hidden">
                           <Avatar className="h-10 w-10 rounded border" key={`${asset.id}-thumb-${asset.url}`}><AvatarImage src={asset.url} alt="Thumbnail" data-ai-hint="thumbnail image" onError={(e) => console.error(`Admin Page - AI Media Image thumb load error. URL: ${asset.url}`, e)} /><AvatarFallback><ImagePlus size={16}/></AvatarFallback></Avatar>
                           <span className="text-xs truncate text-muted-foreground">{asset.url}</span>
                        </div>
                        <Button onClick={() => handleDeleteMediaAsset(asset.id)} variant="ghost" size="icon" className="text-destructive hover:bg-destructive/10"><Trash2 className="h-4 w-4" /></Button>
                      </div>
                    ))}
                  </div>
                ) : <p className="text-sm text-muted-foreground p-2">No images added yet. Add public image URLs for Kruthika to share.</p>}
              </div>
              <div className="space-y-4 p-4 border rounded-md shadow-sm bg-secondary/20">
                <h4 className="text-lg font-semibold text-primary flex items-center"><Music2 className="mr-2 h-4 w-4"/>Audio Clips</h4>
                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <Label className="text-sm font-medium">Upload Audio File</Label>
                    <div className="flex gap-2">
                      <Input
                        type="file"
                        accept="audio/*"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) handleFileUpload(file, 'audio');
                        }}
                        className="flex-grow text-sm"
                        disabled={uploadingFile}
                      />
                    </div>
                  </div>
                  <div className="relative">
                    <div className="absolute inset-0 flex items-center">
                      <span className="w-full border-t" />
                    </div>
                    <div className="relative flex justify-center text-xs uppercase">
                      <span className="bg-secondary/20 px-2 text-muted-foreground">Or add path</span>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="newAudioPath" className="text-sm font-medium">Audio File Path (from `public/media/`)</Label>
                    <div className="flex gap-2">
                      <Input id="newAudioPath" type="text" value={newAudioPath} onChange={(e) => setNewAudioPath(e.target.value)} placeholder="/media/sound.mp3" className="flex-grow text-sm"/>
                      <Button onClick={() => handleAddMediaAsset('audio')} variant="outline" size="icon"><PlusCircle className="h-4 w-4" /></Button>
                    </div>
                    <Alert variant="default" className="mt-2 py-2 px-3 text-xs bg-background/70 border-border">
                      <Info size={14} className="mr-1 !text-muted-foreground" />
                      <AlertDescription className="!text-muted-foreground">Audio files must be placed in the `public/media/` folder of your project first. Then, add the path here (e.g., `/media/your_clip.mp3`).</AlertDescription>
                    </Alert>
                  </div>
                </div>
                {uploadingFile && uploadProgress && (
                  <div className="text-xs text-muted-foreground animate-pulse">{uploadProgress}</div>
                )}
                 {aiMediaAssets.assets.filter(asset => asset.type === 'audio').length > 0 ? (
                  <div className="space-y-2 max-h-60 overflow-y-auto custom-scrollbar p-2 bg-background rounded border">
                    {aiMediaAssets.assets.filter(asset => asset.type === 'audio').map(asset => (
                      <div key={asset.id} className="flex items-center justify-between p-2 bg-card border rounded-md hover:bg-secondary/30">
                        <div className="flex items-center gap-3 overflow-hidden">
                            <Music2 className="h-5 w-5 text-muted-foreground shrink-0"/>
                            <span className="text-xs truncate text-muted-foreground">{asset.url}</span>
                        </div>
                        <Button onClick={() => handleDeleteMediaAsset(asset.id)} variant="ghost" size="icon" className="text-destructive hover:bg-destructive/10"><Trash2 className="h-4 w-4" /></Button>
                      </div>
                    ))}
                  </div>
                ) : <p className="text-sm text-muted-foreground p-2">No audio clips added yet. Upload files to `public/media/` and add their paths.</p>}
              </div>
            </CardContent>
            <CardFooter className="mt-2">
              <Button onClick={handleSaveAIMediaAssets} className="w-full sm:w-auto"><ImagePlus className="mr-2 h-4 w-4"/>Save AI Media Assets (Global)</Button>
            </CardFooter>
          </Card>
        </TabsContent>

        <TabsContent value="ads">
           <Card className="bg-card text-card-foreground mb-8 shadow-lg">
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center text-xl font-semibold"><Settings className="mr-2 h-5 w-5 text-primary"/>Manage Global Ad Settings</CardTitle>
              <CardDescription className="text-sm">
                Control global ad visibility, direct links, and various ad types. These settings are fetched by all users.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6 pt-2">
              <div className="flex items-center space-x-3 p-4 bg-secondary/30 rounded-md shadow-inner">
                <Switch id="adsEnabledGlobally" checked={adSettings.adsEnabledGlobally} onCheckedChange={(checked) => handleAdSettingChange('adsEnabledGlobally', checked)}/>
                <Label htmlFor="adsEnabledGlobally" className="text-md font-semibold">Enable All Ads Globally</Label>
              </div>

              <Card className="bg-secondary/10 border-border shadow-sm">
                <CardHeader className="pb-3 pt-4">
                  <CardTitle className="text-lg font-semibold text-primary flex items-center"><TrendingUp className="mr-2 h-5 w-5"/>Direct Link Ad Frequency</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4 px-4 pb-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="maxDirectLinkAdsPerDay" className="font-medium text-sm">Max Direct Link Ads Per User Per Day</Label>
                    <Input
                      id="maxDirectLinkAdsPerDay"
                      type="number"
                      value={adSettings.maxDirectLinkAdsPerDay}
                      onChange={(e) => handleAdSettingChange('maxDirectLinkAdsPerDay', e.target.value)}
                      placeholder="e.g., 6"
                      className="text-sm"
                      disabled={!adSettings.adsEnabledGlobally}
                      min="0"
                    />
                    <p className="text-xs text-muted-foreground">Total direct link pop-ups a user might see in 24 hours.</p>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="maxDirectLinkAdsPerSession" className="font-medium text-sm">Max Direct Link Ads Per User Per Session</Label>
                    <Input
                      id="maxDirectLinkAdsPerSession"
                      type="number"
                      value={adSettings.maxDirectLinkAdsPerSession}
                      onChange={(e) => handleAdSettingChange('maxDirectLinkAdsPerSession', e.target.value)}
                      placeholder="e.g., 3"
                      className="text-sm"
                      disabled={!adSettings.adsEnabledGlobally}
                      min="0"
                    />
                    <p className="text-xs text-muted-foreground">Max direct link pop-ups in a single browser session.</p>
                  </div>
                </CardContent>
              </Card>

              {/* Adsterra Settings Group */}
              <Card className="bg-secondary/10 border-border shadow-sm">
                <CardHeader className="pb-3 pt-4">
                    <CardTitle className="text-lg font-semibold text-primary flex items-center"><ExternalLink className="mr-2 h-5 w-5"/>Adsterra Settings</CardTitle>
                </CardHeader>
                <CardContent className="space-y-5 px-4 pb-4">
                    {/* Adsterra Direct Link */}
                    <div className="border-b border-border/50 pb-4 space-y-2">
                      <div className="flex items-center justify-between">
                        <Label htmlFor="adsterraDirectLink" className="font-medium text-sm">Direct Link URL</Label>
                        <Tooltip><TooltipTrigger asChild><Button variant="ghost" size="icon" onClick={() => handleResetDirectLink('adsterra')} disabled={!adSettings.adsEnabledGlobally} className="h-7 w-7 text-muted-foreground hover:text-primary"><RotateCcw size={16}/></Button></TooltipTrigger><TooltipContent side="top"><p>Reset to Default Link</p></TooltipContent></Tooltip>
                      </div>
                      <Input id="adsterraDirectLink" type="url" value={adSettings.adsterraDirectLink} onChange={(e) => handleAdSettingChange('adsterraDirectLink', e.target.value)} placeholder={DEFAULT_ADSTERRA_DIRECT_LINK} className="text-sm" disabled={!adSettings.adsEnabledGlobally}/>
                      <div className="flex items-center space-x-2 pt-1"><Switch id="adsterraDirectLinkEnabled" checked={adSettings.adsterraDirectLinkEnabled} onCheckedChange={(checked) => handleAdSettingChange('adsterraDirectLinkEnabled', checked)} disabled={!adSettings.adsEnabledGlobally}/><Label htmlFor="adsterraDirectLinkEnabled" className="text-sm font-medium">Enable Adsterra Direct Link</Label></div>
                    </div>
                    {/* Adsterra Banner Ad */}
                    <div className="border-b border-border/50 pb-4 space-y-2">
                      <Label htmlFor="adsterraBannerCode" className="font-medium text-sm">Banner Ad Code</Label>
                      <Textarea id="adsterraBannerCode" value={adSettings.adsterraBannerCode} onChange={(e) => handleAdSettingChange('adsterraBannerCode', e.target.value)} placeholder="<!-- Adsterra Banner Code -->" className="min-h-[100px] font-mono text-xs" disabled={!adSettings.adsEnabledGlobally}/>
                      <p className="text-xs text-muted-foreground mt-1 flex items-center"><Info size={13} className="mr-1 shrink-0"/>{scriptPasteInstruction}</p>
                      <div className="flex items-center space-x-2 pt-1"><Switch id="adsterraBannerEnabled" checked={adSettings.adsterraBannerEnabled} onCheckedChange={(checked) => handleAdSettingChange('adsterraBannerEnabled', checked)} disabled={!adSettings.adsEnabledGlobally}/><Label htmlFor="adsterraBannerEnabled" className="text-sm font-medium">Enable Adsterra Banner Ad</Label></div>
                    </div>
                    {/* Adsterra Social Bar */}
                    <div className="border-b border-border/50 pb-4 space-y-2">
                        <Label htmlFor="adsterraSocialBarCode" className="font-medium text-sm">Social Bar Code</Label>
                        <Textarea id="adsterraSocialBarCode" value={adSettings.adsterraSocialBarCode} onChange={(e) => handleAdSettingChange('adsterraSocialBarCode', e.target.value)} placeholder="<!-- Adsterra Social Bar Code -->" className="min-h-[100px] font-mono text-xs" disabled={!adSettings.adsEnabledGlobally}/>
                        <p className="text-xs text-muted-foreground mt-1 flex items-center"><Info size={13} className="mr-1 shrink-0"/>{scriptPasteInstruction}</p>
                        <div className="flex items-center space-x-2 pt-1"><Switch id="adsterraSocialBarEnabled" checked={adSettings.adsterraSocialBarEnabled} onCheckedChange={(checked) => handleAdSettingChange('adsterraSocialBarEnabled', checked)} disabled={!adSettings.adsEnabledGlobally}/><Label htmlFor="adsterraSocialBarEnabled" className="text-sm font-medium">Enable Adsterra Social Bar</Label></div>
                    </div>
                    {/* Adsterra Native Banner */}
                    <div className="border-b border-border/50 pb-4 space-y-2">
                      <Label htmlFor="adsterraNativeBannerCode" className="font-medium text-sm">Native Banner Code (Blog Pages Only)</Label>
                      <Textarea id="adsterraNativeBannerCode" value={adSettings.adsterraNativeBannerCode} onChange={(e) => handleAdSettingChange('adsterraNativeBannerCode', e.target.value)} placeholder="<!-- Adsterra Native Banner Code -->" className="min-h-[100px] font-mono text-xs" disabled={!adSettings.adsEnabledGlobally}/>
                      <p className="text-xs text-muted-foreground mt-1 flex items-center"><Info size={13} className="mr-1 shrink-0"/>{scriptPasteInstruction}</p>
                      <div className="flex items-center space-x-2 pt-1"><Switch id="adsterraNativeBannerEnabled" checked={adSettings.adsterraNativeBannerEnabled} onCheckedChange={(checked) => handleAdSettingChange('adsterraNativeBannerEnabled', checked)} disabled={!adSettings.adsEnabledGlobally}/><Label htmlFor="adsterraNativeBannerEnabled" className="text-sm font-medium">Enable Adsterra Native Banner</Label></div>
                    </div>
                    {/* Adsterra Pop-under */}
                    <div className="space-y-2">
                      <Label htmlFor="adsterraPopunderCode" className="font-medium text-sm">Pop-under Script Code</Label>
                      <Textarea id="adsterraPopunderCode" value={adSettings.adsterraPopunderCode} onChange={(e) => handleAdSettingChange('adsterraPopunderCode', e.target.value)} placeholder="<!-- Adsterra Pop-under Script -->" className="min-h-[100px] font-mono text-xs" disabled={!adSettings.adsEnabledGlobally}/>
                      <p className="text-xs text-muted-foreground mt-1 flex items-center"><Info size={13} className="mr-1 shrink-0"/>{scriptPasteInstruction}</p>
                      <div className="flex items-center space-x-2 pt-1"><Switch id="adsterraPopunderEnabled" checked={adSettings.adsterraPopunderEnabled} onCheckedChange={(checked) => handleAdSettingChange('adsterraPopunderEnabled', checked)} disabled={!adSettings.adsEnabledGlobally}/><Label htmlFor="adsterraPopunderEnabled" className="text-sm font-medium">Enable Adsterra Pop-under</Label></div>
                    </div>
                </CardContent>
              </Card>

              {/* Monetag Settings Group */}
              <Card className="bg-secondary/10 border-border shadow-sm mt-6">
                <CardHeader className="pb-3 pt-4">
                    <CardTitle className="text-lg font-semibold text-primary flex items-center"><Link className="mr-2 h-5 w-5"/>Monetag Settings</CardTitle>
                </CardHeader>
                <CardContent className="space-y-5 px-4 pb-4">
                    {/* Monetag Direct Link */}
                    <div className="border-b border-border/50 pb-4 space-y-2">
                      <div className="flex items-center justify-between">
                        <Label htmlFor="monetagDirectLink" className="font-medium text-sm">Direct Link URL</Label>
                        <Tooltip><TooltipTrigger asChild><Button variant="ghost" size="icon" onClick={() => handleResetDirectLink('monetag')} disabled={!adSettings.adsEnabledGlobally} className="h-7 w-7 text-muted-foreground hover:text-primary"><RotateCcw size={16}/></Button></TooltipTrigger><TooltipContent side="top"><p>Reset to Default Link</p></TooltipContent></Tooltip>
                      </div>
                      <Input id="monetagDirectLink" type="url" value={adSettings.monetagDirectLink} onChange={(e) => handleAdSettingChange('monetagDirectLink', e.target.value)} placeholder={DEFAULT_MONETAG_DIRECT_LINK} className="text-sm" disabled={!adSettings.adsEnabledGlobally}/>
                      <div className="flex items-center space-x-2 pt-1"><Switch id="monetagDirectLinkEnabled" checked={adSettings.monetagDirectLinkEnabled} onCheckedChange={(checked) => handleAdSettingChange('monetagDirectLinkEnabled', checked)} disabled={!adSettings.adsEnabledGlobally}/><Label htmlFor="monetagDirectLinkEnabled" className="text-sm font-medium">Enable Monetag Direct Link</Label></div>
                    </div>
                    {/* Monetag Banner Ad */}
                    <div className="border-b border-border/50 pb-4 space-y-2">
                      <Label htmlFor="monetagBannerCode" className="font-medium text-sm">Banner Ad Code</Label>
                      <Textarea id="monetagBannerCode" value={adSettings.monetagBannerCode} onChange={(e) => handleAdSettingChange('monetagBannerCode', e.target.value)} placeholder="<!-- Monetag Banner Code -->" className="min-h-[100px] font-mono text-xs" disabled={!adSettings.adsEnabledGlobally}/>
                      <p className="text-xs text-muted-foreground mt-1 flex items-center"><Info size={13} className="mr-1 shrink-0"/>{scriptPasteInstruction}</p>
                      <div className="flex items-center space-x-2 pt-1"><Switch id="monetagBannerEnabled" checked={adSettings.monetagBannerEnabled} onCheckedChange={(checked) => handleAdSettingChange('monetagBannerEnabled', checked)} disabled={!adSettings.adsEnabledGlobally}/><Label htmlFor="monetagBannerEnabled" className="text-sm font-medium">Enable Monetag Banner Ad</Label></div>
                    </div>
                    {/* Monetag Social Bar */}
                    <div className="border-b border-border/50 pb-4 space-y-2">
                        <Label htmlFor="monetagSocialBarCode" className="font-medium text-sm">Social Bar Code</Label>
                        <Textarea id="monetagSocialBarCode" value={adSettings.monetagSocialBarCode} onChange={(e) => handleAdSettingChange('monetagSocialBarCode', e.target.value)} placeholder="<!-- Monetag Social Bar Code -->" className="min-h-[100px] font-mono text-xs" disabled={!adSettings.adsEnabledGlobally}/>
                        <p className="text-xs text-muted-foreground mt-1 flex items-center"><Info size={13} className="mr-1 shrink-0"/>{scriptPasteInstruction}</p>
                        <div className="flex items-center space-x-2 pt-1"><Switch id="monetagSocialBarEnabled" checked={adSettings.monetagSocialBarEnabled} onCheckedChange={(checked) => handleAdSettingChange('monetagSocialBarEnabled', checked)} disabled={!adSettings.adsEnabledGlobally}/><Label htmlFor="monetagSocialBarEnabled" className="text-sm font-medium">Enable Monetag Social Bar</Label></div>
                    </div>
                    {/* Monetag Native Banner */}
                    <div className="border-b border-border/50 pb-4 space-y-2">
                      <Label htmlFor="monetagNativeBannerCode" className="font-medium text-sm">Native Banner Code (Blog Pages Only)</Label>
                      <Textarea id="monetagNativeBannerCode" value={adSettings.monetagNativeBannerCode} onChange={(e) => handleAdSettingChange('monetagNativeBannerCode', e.target.value)} placeholder="<!-- Monetag Native Banner Code -->" className="min-h-[100px] font-mono text-xs" disabled={!adSettings.adsEnabledGlobally}/>
                      <p className="text-xs text-muted-foreground mt-1 flex items-center"><Info size={13} className="mr-1 shrink-0"/>{scriptPasteInstruction}</p>
                      <div className="flex items-center space-x-2 pt-1"><Switch id="monetagNativeBannerEnabled" checked={adSettings.monetagNativeBannerEnabled} onCheckedChange={(checked) => handleAdSettingChange('monetagNativeBannerEnabled', checked)} disabled={!adSettings.adsEnabledGlobally}/><Label htmlFor="monetagNativeBannerEnabled" className="text-sm font-medium">Enable Monetag Native Banner</Label></div>
                    </div>
                    {/* Monetag Pop-under */}
                    <div className="space-y-2">
                      <Label htmlFor="monetagPopunderCode" className="font-medium text-sm">Pop-under Script Code</Label>
                      <Textarea id="monetagPopunderCode" value={adSettings.monetagPopunderCode} onChange={(e) => handleAdSettingChange('monetagPopunderCode', e.target.value)} placeholder="<!-- Monetag Pop-under Script -->" className="min-h-[100px] font-mono text-xs" disabled={!adSettings.adsEnabledGlobally}/>
                       <p className="text-xs text-muted-foreground mt-1 flex items-center"><Info size={13} className="mr-1 shrink-0"/>{scriptPasteInstruction}</p>
                      <div className="flex items-center space-x-2 pt-1"><Switch id="monetagPopunderEnabled" checked={adSettings.monetagPopunderEnabled} onCheckedChange={(checked) => handleAdSettingChange('monetagPopunderEnabled', checked)} disabled={!adSettings.adsEnabledGlobally}/><Label htmlFor="monetagPopunderEnabled" className="text-sm font-medium">Enable Monetag Pop-under</Label></div>
                    </div>
                </CardContent>
              </Card>

            </CardContent>
            <CardFooter className="mt-4">
              <Button onClick={handleSaveAdSettings} className="w-full sm:w-auto text-base py-3 px-6"><Settings className="mr-2 h-5 w-5" /> Save Global Ad Settings</Button>
            </CardFooter>
          </Card>
        </TabsContent>

        <TabsContent value="status_content">
          <Card className="bg-card text-card-foreground mb-8 shadow-lg">
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center text-xl font-semibold"><UserCircle className="mr-2 h-5 w-5 text-primary"/>Admin: Your Display on Status Page (Global)</CardTitle>
              <CardDescription className="text-sm">Set your own entry that appears under "My Status" on the Status page. This is visible to all users.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5 pt-2">
              <div className="space-y-1.5">
                <Label htmlFor="adminStatusName" className="font-medium text-sm">Display Name for "My Status"</Label>
                <Input id="adminStatusName" value={adminStatus.name} onChange={(e) => setAdminStatus(s => ({ ...s, name: e.target.value }))} placeholder="e.g., My Status, John Doe" className="text-sm"/>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="adminStatusAvatarUrl" className="font-medium text-sm">Your Avatar URL (Publicly Accessible)</Label>
                <Input id="adminStatusAvatarUrl" type="url" value={adminStatus.avatarUrl} onChange={(e) => setAdminStatus(s => ({ ...s, avatarUrl: e.target.value }))} placeholder="https://placehold.co/100x100.png" className="text-sm"/>
                 {adminStatus.avatarUrl && adminStatus.avatarUrl.trim() !== '' && (<Avatar className="w-20 h-20 mt-2 border rounded-full shadow" key={`admin-status-avatar-${adminStatus.avatarUrl}`}><AvatarImage src={adminStatus.avatarUrl} alt="Your avatar preview" data-ai-hint="profile self admin" onError={(e) => console.error(`Admin Page - Admin Status Avatar load error. URL: ${adminStatus.avatarUrl}`, e)} /><AvatarFallback>{(adminStatus.name || 'A').charAt(0)}</AvatarFallback></Avatar>)}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="adminStatusText" className="font-medium text-sm">Your Status Text</Label>
                <Textarea id="adminStatusText" value={adminStatus.statusText} onChange={(e) => setAdminStatus(s => ({ ...s, statusText: e.target.value }))} placeholder="What's your current status story?" className="min-h-[70px]"/>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="adminStatusImageUrl" className="font-medium text-sm">Your Story Image URL (Optional, Publicly Accessible)</Label>
                <Input id="adminStatusImageUrl" type="url" value={adminStatus.statusImageUrl || ""} onChange={(e) => setAdminStatus(s => ({ ...s, statusImageUrl: e.target.value }))} placeholder="https://placehold.co/300x500.png" className="text-sm"/>
                 {adminStatus.statusImageUrl && adminStatus.statusImageUrl.trim() !== '' && (
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Preview</Label>
                    <div className="relative w-32 h-32 border rounded-lg overflow-hidden">
                      <Image
                        src={adminStatus.statusImageUrl}
                        alt="Status preview"
                        fill
                        className="object-cover"
                        onError={(e) => {
                          (e.target as HTMLImageElement).src = 'https://placehold.co/300x500/CCCCCC/FFFFFF?text=Error';
                        }}
                      />
                    </div>
                    <div className="text-xs text-muted-foreground break-all">
                      <a href={adminStatus.statusImageUrl} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                        {adminStatus.statusImageUrl}
                      </a>
                    </div>
                  </div>
                )}
              </div>
              <div className="flex items-center space-x-3 pt-2">
                <Switch id="adminStatusHasUpdate" checked={adminStatus.hasUpdate} onCheckedChange={(checked) => setAdminStatus(s => ({ ...s, hasUpdate: checked }))}/>
                <Label htmlFor="adminStatusHasUpdate" className="text-sm font-medium">Show as new/unread update</Label>
              </div>
              <div className="flex flex-wrap gap-2 pt-2">
                <Button onClick={() => handleClearAdminStatusField('statusText')} variant="outline" size="sm"><Trash2 className="mr-1 h-3 w-3"/>Clear Status Text</Button>
                <Button onClick={() => handleClearAdminStatusField('statusImageUrl')} variant="outline" size="sm"><Trash2 className="mr-1 h-3 w-3"/>Clear Story Image</Button>
              </div>
            </CardContent>
            <CardFooter className="mt-2">
              <Button onClick={handleSaveAdminStatus} className="w-full sm:w-auto"><UserCircle className="mr-2 h-4 w-4"/>Save "My Status" Details (Global)</Button>
            </CardFooter>
          </Card>

          <Card className="bg-card text-card-foreground mb-6 shadow-lg">
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center text-xl font-semibold"><Users className="mr-2 h-5 w-5 text-primary"/>Manage Demo Contact Statuses (Global)</CardTitle>
              <CardDescription className="text-sm">Set the ephemeral stories for the demo contacts that appear on the Status page. Visible to all users.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6 pt-2">
              {managedContactStatuses.map((contact) => (
                <div key={contact.id} className="border p-4 rounded-md space-y-3 bg-secondary/20 shadow-sm">
                  <div className="flex items-center gap-3">
                    <Avatar className="h-10 w-10 border" key={`${contact.id}-admin-avatar-${contact.avatarUrl}`}><AvatarImage src={contact.avatarUrl} alt={contact.name} data-ai-hint={contact.dataAiHint || "profile person"} onError={(e) => console.error(`Admin Page - Demo Contact Avatar load error. URL: ${contact.avatarUrl}`, e)} /><AvatarFallback>{contact.name.charAt(0)}</AvatarFallback></Avatar>
                    <h4 className="font-medium text-md text-secondary-foreground">{contact.name} (Demo)</h4>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor={`contactStoryText-${contact.id}`} className="font-medium text-xs">Status Text</Label>
                    <Input id={`contactStoryText-${contact.id}`} value={contact.statusText} onChange={(e) => handleManagedContactChange(contact.id, 'statusText', e.target.value)} placeholder="e.g., At the movies!" className="text-sm"/>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor={`contactStoryImageUrl-${contact.id}`} className="font-medium text-xs">Story Image URL (Optional)</Label>
                    <Input id={`contactStoryImageUrl-${contact.id}`} type="url" value={contact.statusImageUrl || ""} onChange={(e) => handleManagedContactChange(contact.id, 'statusImageUrl', e.target.value)} placeholder="https://placehold.co/300x500.png" className="text-sm"/>
                    {contact.statusImageUrl && contact.statusImageUrl.trim() !== '' && (<Avatar className="w-20 h-32 mt-2 border rounded shadow" key={`${contact.id}-admin-story-image-${contact.statusImageUrl}`}><AvatarImage src={contact.statusImageUrl} alt={`${contact.name} story preview`} data-ai-hint="story image content" className="object-contain" onError={(e) => console.error(`Admin Page - Demo Contact Story Image load error. URL: ${contact.statusImageUrl}`, e)} /><AvatarFallback>Preview</AvatarFallback></Avatar>)}
                  </div>
                  <div className="flex items-center space-x-2 pt-1">
                    <Switch id={`contactHasUpdate-${contact.id}`} checked={contact.hasUpdate} onCheckedChange={(checked) => handleManagedContactChange(contact.id, 'hasUpdate', checked)}/>
                    <Label htmlFor={`contactHasUpdate-${contact.id}`} className="text-xs font-medium">Show as new/unread update</Label>
                  </div>
                   <div className="flex flex-wrap gap-2 pt-1">
                    <Button onClick={() => handleClearManagedContactField(contact.id, 'statusText')} variant="outline" size="sm" className="text-xs px-2 py-1 h-auto"><Trash2 className="mr-1 h-3 w-3"/>Clear Text</Button>
                    <Button onClick={() => handleClearManagedContactField(contact.id, 'statusImageUrl')} variant="outline" size="sm" className="text-xs px-2 py-1 h-auto"><Trash2 className="mr-1 h-3 w-3"/>Clear Image</Button>
                  </div>
                </div>
              ))}
            </CardContent>
            <CardFooter className="mt-2">
              <Button onClick={handleSaveManagedContactStatuses} className="w-full sm:w-auto"><Users className="mr-2 h-4 w-4"/>Save Demo Contact Statuses (Global)</Button>
            </CardFooter>
          </Card>
        </TabsContent>

        <TabsContent value="analytics">
          <Card className="bg-card text-card-foreground shadow-lg">
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center text-xl font-semibold">
                <Database className="mr-2 h-5 w-5 text-primary"/>
                Usage Analytics Dashboard
                <a
                  href="/admin/analytics"
                  className="ml-auto text-sm bg-primary text-primary-foreground px-3 py-1 rounded-md hover:bg-primary/90 transition-colors"
                  aria-label="View full analytics dashboard with detailed metrics and insights"
                >
                  View Full Dashboard →
                </a>
              </CardTitle>
              <Alert variant={supabaseError ? "destructive" : "default"} className={`mt-4 ${supabaseError ? "" : "bg-primary/10 border-primary/30"}`}>
                {supabaseError ? <Terminal className="h-4 w-4 !text-destructive" /> : <Database className="h-4 w-4 !text-primary" />}
                <AlertTitle className={supabaseError ? "text-destructive font-semibold" : "text-primary font-semibold"}>
                  {supabaseError ? "Hostinger DB Connection Issue" : "Analytics Data Source"}
                </AlertTitle>
                <AlertDescription className={`${supabaseError ? "text-destructive/80" : "text-primary/80"} text-sm`}>
                  {supabaseError
                    ? `Error: ${supabaseError}. Realtime analytics might be unavailable or incorrect. Ensure Hostinger DB is configured correctly as per HOSTINGER_MYSQL_SETUP.sql, including all SQL functions and tables.`
                    : "Total User Messages, Total AI Messages, Daily Active Users (DAU), and related charts are fetched from Hostinger DB if configured. DAU is an estimate based on browser-specific pseudo-anonymous identifiers for Kruthika Chat."}
                </AlertDescription>
              </Alert>
            </CardHeader>
            <CardContent className="space-y-6 pt-4">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <Card className="shadow-sm p-4">
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 p-0"><CardTitle className="text-sm font-medium">Total User Messages</CardTitle><MessageSquare className="h-4 w-4 text-muted-foreground" /></CardHeader>
                  <CardContent className="p-0 pt-1">{analyticsLoading ? <p className="text-2xl font-bold">Loading...</p> : <p className="text-2xl font-bold">{realTotalUserMessages ?? 'N/A'}</p>}<p className="text-xs text-muted-foreground">From Supabase (real data)</p></CardContent>
                </Card>
                 <Card className="shadow-sm p-4">
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 p-0"><CardTitle className="text-sm font-medium">Total AI Messages</CardTitle><MessageSquare className="h-4 w-4 text-muted-foreground" /></CardHeader>
                  <CardContent className="p-0 pt-1">{analyticsLoading ? <p className="text-2xl font-bold">Loading...</p> : <p className="text-2xl font-bold">{realTotalAiMessages ?? 'N/A'}</p>}<p className="text-xs text-muted-foreground">From Supabase (real data)</p></CardContent>
                </Card>
                <Card className="shadow-sm p-4">
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 p-0"><CardTitle className="text-sm font-medium">Daily Active Users (DAU)</CardTitle><Users className="h-4 w-4 text-muted-foreground" /></CardHeader>
                  <CardContent className="p-0 pt-1">{analyticsLoading ? <p className="text-2xl font-bold">Loading...</p> : <p className="text-2xl font-bold">{currentDAU ?? 'N/A'}</p>}<p className="text-xs text-muted-foreground">From Supabase (pseudo-anonymous estimate)</p></CardContent>
                </Card>
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card className="shadow-sm">
                  <CardHeader className="pb-2 pt-4"><CardTitle className="text-lg font-medium">Messages Sent (Last 7 Days)</CardTitle><CardDescription className="text-sm">Total user and AI messages per day. From Supabase.</CardDescription></CardHeader>
                  <CardContent className="h-[300px] w-full pt-2">
                    {analyticsLoading && !realMessagesSentLast7Days.length ? (
                        <div className="flex items-center justify-center h-full text-muted-foreground">Loading chart data...</div>
                    ) : supabaseError && !realMessagesSentLast7Days.some(d => d.count > 0) ? (
                         <div className="flex items-center justify-center h-full text-destructive text-center p-4 text-sm">Error loading chart data. Ensure Supabase is correctly set up as per SUPABASE_SETUP.md.</div>
                    ) : (
                    <ChartContainer config={messagesChartConfig} className="w-full h-full">
                      <RechartsBarChart accessibilityLayer data={realMessagesSentLast7Days} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
                        <CartesianGrid vertical={false} strokeDasharray="3 3" />
                        <XAxis dataKey="date" tickLine={false} tickMargin={10} axisLine={false} />
                        <YAxis dataKey="count" allowDecimals={false} tickLine={false} axisLine={false} tickMargin={10} />
                        <ChartTooltip content={<ChartTooltipContent indicator="dot" hideLabel />} />
                        <ChartLegend content={<ChartLegendContent />} />
                        <Bar dataKey="count" name="messages" fill="var(--color-messages)" radius={4} />
                      </RechartsBarChart>
                    </ChartContainer>
                    )}
                  </CardContent>
                </Card>
                <Card className="shadow-sm">
                  <CardHeader className="pb-2 pt-4"><CardTitle className="text-lg font-medium">Daily Active Users (Last 7 Days)</CardTitle><CardDescription className="text-sm">Pseudo-anonymous users per day. From Supabase.</CardDescription></CardHeader>
                  <CardContent className="h-[300px] w-full pt-2">
                    {analyticsLoading && !dailyActiveUsersData.length ? (
                        <div className="flex items-center justify-center h-full text-muted-foreground">Loading chart data...</div>
                    ) : supabaseError && !dailyActiveUsersData.some(d => d.count > 0) ? (
                         <div className="flex items-center justify-center h-full text-destructive text-center p-4 text-sm">Error loading chart data. Ensure Supabase is correctly set up.</div>
                    ) : (
                    <ChartContainer config={dauChartConfig} className="w-full h-full">
                       <RechartsBarChart accessibilityLayer data={dailyActiveUsersData} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
                        <CartesianGrid vertical={false} strokeDasharray="3 3" />
                        <XAxis dataKey="date" tickLine={false} tickMargin={10} axisLine={false} />
                        <YAxis dataKey="count" allowDecimals={false} tickLine={false} axisLine={false} tickMargin={10} />
                        <ChartTooltip content={<ChartTooltipContent indicator="dot" hideLabel />} />
                        <ChartLegend content={<ChartLegendContent />} />
                        <Bar dataKey="count" name="active_users" fill="var(--color-active_users)" radius={4} />
                      </RechartsBarChart>
                    </ChartContainer>
                    )}
                  </CardContent>
                </Card>
              </div>
              <p className="text-xs text-muted-foreground text-center pt-4">
                Analytics data is fetched from Supabase. Ensure your Supabase project is correctly configured and the necessary SQL functions are in place.
              </p>
            </CardContent>
             <CardFooter className="border-t pt-6 flex-wrap gap-3">
                <Button onClick={() => router.push('/maya-chat')} variant="outline">
                    <MessageSquare className="mr-2 h-4 w-4"/>View Kruthika's Chat
                </Button>
                <Button onClick={() => router.push('/')} variant="outline">
                    <Users className="mr-2 h-4 w-4"/>Back to Chat List
                </Button>
            </CardFooter>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
    </TooltipProvider>
  );
};

export default AdminProfilePage;
