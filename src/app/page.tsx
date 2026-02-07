"use client";

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import AppHeader from '@/components/AppHeader';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import type { AIProfile } from '@/types';
import { defaultAIProfile } from '@/config/ai';
import { MessageSquarePlus, Camera, Search, MoreVertical, Share2, Settings, Info, Star, Zap } from 'lucide-react';
import { useAIProfile } from '@/contexts/AIProfileContext';
import { useAdSettings } from '@/contexts/AdSettingsContext';
import { cn } from '@/lib/utils';

const BannerAdDisplay = dynamic(() => import('@/components/chat/BannerAdDisplay'), {
  ssr: false,
  loading: () => <div className="h-24" />
});

const ChatListItem: React.FC<{ profile: AIProfile; lastMessage?: string; timestamp?: string; unreadCount?: number; }> = ({
  profile,
  lastMessage,
  timestamp = "",
  unreadCount,
}) => {
  const displayLastMessage = lastMessage || `Click to chat with ${profile.name}!`;

  let avatarUrlToUse = profile.avatarUrl;
  if (!avatarUrlToUse || typeof avatarUrlToUse !== 'string' || avatarUrlToUse.trim() === '' || (!avatarUrlToUse.startsWith('http') && !avatarUrlToUse.startsWith('data:'))) {
    avatarUrlToUse = defaultAIProfile.avatarUrl;
  }

  // if (profile.name === "Kruthika") {
    // console.log(`ChatListItem - Kruthika's final avatarUrlToUse: ${avatarUrlToUse}`);
  // }

  const handleAvatarError = (e: React.SyntheticEvent<HTMLImageElement, Event>) => {
    console.error(`ChatListItem - AvatarImage load error for ${profile.name}. URL: ${avatarUrlToUse}`, e);
  };

  return (
    <div className="flex items-center p-3 sm:p-4 bg-transparent hover:bg-secondary/50 cursor-pointer transition-colors">
      <div
        className={cn(
          "relative rounded-full mr-4 shrink-0",
          profile.name === "Kruthika" && "border-2 border-[#25d366] p-0.5"
        )}
         key={`avatar-wrapper-${profile.name}-${avatarUrlToUse || 'default_wrapper_key_cli'}`}
      >
        <Avatar
          className="h-12 w-12 sm:h-14 sm:w-14"
          key={`avatar-comp-${profile.name}-${avatarUrlToUse || 'default_avatar_comp_key_cli'}`}
          style={{ width: '48px', height: '48px', minWidth: '48px', minHeight: '48px', aspectRatio: '1/1', contain: 'strict' }}
        >
          <AvatarImage
            src={avatarUrlToUse || undefined}
            alt={`${profile.name} avatar`}
            key={`chat-list-item-avatar-img-${profile.name}-${avatarUrlToUse || 'no_avatar_fallback_img_cli'}`}
            onError={handleAvatarError}
            width={48}
            height={48}
            loading="eager"
            fetchPriority="high"
            decoding="sync"
            style={{ width: '48px', height: '48px', aspectRatio: '1/1' }}
          />
          <AvatarFallback>{(profile.name || "K").charAt(0).toUpperCase()}</AvatarFallback>
        </Avatar>
      </div>
      <div className="flex-grow overflow-hidden min-w-0">
        <h2 className="font-semibold text-base sm:text-md truncate text-foreground">{profile.name}</h2>
        <p className="text-sm sm:text-base text-muted-foreground truncate">{displayLastMessage}</p>
        <div className="flex items-center mt-1">
          <div className="w-2 h-2 bg-green-500 rounded-full mr-2"></div>
          <span className="text-xs sm:text-sm text-green-700 font-medium">Online</span>
        </div>
      </div>
      <div className="flex flex-col items-end justify-between text-xs ml-2 shrink-0 min-w-[60px] h-full py-1">
        <span className="text-muted-foreground text-xs sm:text-sm">{timestamp}</span>
        {unreadCount && unreadCount > 0 && (
          <div className="w-5 h-5 bg-[#25d366] rounded-full flex items-center justify-center mt-auto">
            <span className="text-xs font-bold text-white leading-none">{unreadCount}</span>
          </div>
        )}
      </div>
    </div>
  );
};


const PullToRefresh = dynamic(() => import('@/components/PullToRefresh'), { 
  ssr: false,
  loading: () => null 
});

const ChatListPage: React.FC = () => {
  const { aiProfile: globalAIProfile, isLoadingAIProfile } = useAIProfile();
  const { adSettings } = useAdSettings();
  const [lastMessageTime, setLastMessageTime] = useState<string>("");
  const [showDropdown, setShowDropdown] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const unreadCount = 1;

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    // Prevent hydration errors by only running on client
    if (typeof window === 'undefined') return;

    const updateLastMessageTime = () => {
      try {
        const lastInteraction = localStorage.getItem('messages_kruthika');
        if (lastInteraction) {
          const messagesArray = JSON.parse(lastInteraction);
          const lastMsg = messagesArray[messagesArray.length - 1];
          if (lastMsg?.timestamp) {
            const date = new Date(lastMsg.timestamp);
            const today = new Date();
            const yesterday = new Date(today);
            yesterday.setDate(yesterday.getDate() - 1);

            if (date.toDateString() === today.toDateString()) {
              setLastMessageTime(date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true }));
            } else if (date.toDateString() === yesterday.toDateString()) {
              setLastMessageTime("Yesterday");
            } else {
              setLastMessageTime(date.toLocaleDateString([], { month: 'short', day: 'numeric' }));
            }
            return;
          }
        }
        const now = new Date();
        setLastMessageTime(now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true }));
      } catch (e) {
        const now = new Date();
        setLastMessageTime(now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true }));
      }
    };

    updateLastMessageTime();
    const interval = setInterval(updateLastMessageTime, 30000); // Reduced frequency to 30s
    return () => clearInterval(interval);
  }, []);

  const effectiveAIProfile = globalAIProfile || defaultAIProfile;

  // if (globalAIProfile) {
    // console.log("[ChatListPage] Using AIProfile from context:", JSON.stringify(globalAIProfile, null, 2));
  // } else if (!isLoadingAIProfile) {
    // console.log("[ChatListPage] AIProfile from context is null (and not loading), using defaultAIProfile:", JSON.stringify(defaultAIProfile, null, 2));
  // }


  if (isLoadingAIProfile) {
    return (
      <div className="flex flex-col h-screen max-w-3xl mx-auto bg-background shadow-2xl">
        <AppHeader title="Chats" />
        <div className="flex-grow flex items-center justify-center text-muted-foreground">
          Loading Kruthika's profile...
        </div>
      </div>
    );
  }

  return (
    <>
      <a href="#main-content" className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:bg-[#25d366] focus:text-white focus:px-4 focus:py-2 focus:rounded">
        Skip to main content
      </a>
      <PullToRefresh />
      <div className="flex flex-col h-screen h-[100dvh] w-full max-w-3xl mx-auto bg-background md:shadow-2xl overflow-hidden">
      {/* WhatsApp-style Header */}
      <header className="bg-[#25d366] shadow-sm sticky top-0 z-10 flex-shrink-0">
        <div className="px-4 py-3 sm:px-6 flex items-center justify-between">
          <h1 className="text-xl font-semibold text-white">Chats</h1>
          <nav className="flex items-center space-x-3" aria-label="Main navigation">
            <button 
              className="hover:bg-[#1faa55] rounded-full p-2 transition-colors min-w-[48px] min-h-[48px] flex items-center justify-center" 
              aria-label="Open camera"
            >
              <Camera size={20} className="text-white" />
            </button>
            <button className="hover:bg-[#1faa55] rounded-full p-2 transition-colors min-w-[48px] min-h-[48px] flex items-center justify-center" aria-label="Search chats">
              <Search size={20} className="text-white" />
            </button>
            <div className="relative">
              <button
                className="hover:bg-[#1faa55] rounded-full p-2 transition-colors min-w-[48px] min-h-[48px] flex items-center justify-center"
                onClick={() => {
                  setShowDropdown(!showDropdown);
                }}
                aria-label="Open menu"
                aria-expanded={showDropdown}
                aria-haspopup="true"
              >
                <MoreVertical size={20} className="text-white" />
              </button>

              {showDropdown && (
                <div className="absolute right-0 top-full mt-2 w-56 bg-white rounded-lg shadow-lg border border-gray-200 py-2 z-50" role="menu">
                  <button className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-3 min-h-[48px]" role="menuitem">
                    <Info size={16} />
                    New group
                  </button>
                  <button className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-3 min-h-[48px]" role="menuitem">
                    <Star size={16} />
                    Starred messages
                  </button>
                  <button className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-3 min-h-[48px]" role="menuitem">
                    <Settings size={16} />
                    Settings
                  </button>
                  <Link href="/blog" className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-3 min-h-[48px]">
                    <Zap size={16} />
                    Blog
                  </Link>
                  <div className="px-4 py-2 text-xs text-gray-400 text-center border-t border-gray-100 mt-1">
                    <span>Enhanced conversations</span>
                  </div>
                </div>
              )}
            </div>
          </nav>
        </div>

        {/* Navigation Tabs */}
        <div className="flex bg-[#25d366]">
          <div className="flex-1">
            <button className="w-full py-3 px-4 text-center font-medium border-b-[3px] border-white text-white min-h-[48px]" aria-label="View chats" aria-current="page">
              CHATS
            </button>
          </div>
          <div className="flex-1">
            <Link href="/status" className="block w-full">
              <button className="w-full py-3 px-4 text-center font-medium border-b-[3px] border-[#25d366] hover:border-white/50 text-white opacity-90 hover:opacity-100 min-h-[48px]" aria-label="View status updates">
                STATUS
              </button>
            </Link>
          </div>
        </div>
      </header>

      <main id="main-content" className="flex-1 overflow-y-auto custom-scrollbar bg-gray-50" style={{ minHeight: 0, contain: 'layout style paint' }}>
        {/* Chat Item showing AI profile */}
        <div className="bg-white" style={{ contain: 'layout paint' }}>
          <Link href="/maya-chat" className="block" aria-label={`Chat with ${effectiveAIProfile.name}`}>
            <ChatListItem
              profile={effectiveAIProfile}
              lastMessage={effectiveAIProfile.status || `Let's chat! 😊`}
              timestamp={lastMessageTime || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true })}
              unreadCount={1}
            />
          </Link>
        </div>

        {/* Welcome Section - LCP Optimized */}
        <div className="flex flex-col items-center justify-center px-8 py-12 text-center bg-white mt-4 mx-4 rounded-lg shadow-sm" style={{ minHeight: '280px', contain: 'layout' }}>
          <div className="mb-6">
            <h2 className="text-xl font-semibold text-gray-800 mb-3" style={{ contain: 'layout paint' }}>
              Chat with Kruthika
            </h2>
            <p className="text-xs text-gray-500" style={{ contain: 'layout paint' }}>
              Smart conversations
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col space-y-3 w-full max-w-sm">
            <Link href="/maya-chat">
              <button className="w-full bg-[#25d366] hover:bg-[#1faa55] text-white font-medium py-3 px-6 rounded-lg transition-colors flex items-center justify-center space-x-2 min-h-[48px]" aria-label="Start chatting with Kruthika">
                <MessageSquarePlus size={20} />
                <span>Start Chatting</span>
              </button>
            </Link>

            <div className="flex space-x-3">
              <Link href="/status" className="flex-1">
                <button className="w-full bg-gradient-to-r from-teal-500 to-cyan-500 hover:from-teal-600 hover:to-cyan-600 text-white font-bold py-3 px-6 rounded-lg transition-all shadow-md hover:shadow-lg flex items-center justify-center space-x-2 min-h-[48px]" aria-label="View status updates">
                  <span>👁️</span>
                  <span>View Status</span>
                </button>
              </Link>
              <button className="bg-blue-500 hover:bg-blue-600 text-white font-medium py-3 px-4 rounded-lg transition-colors flex items-center justify-center min-w-[48px] min-h-[48px]" aria-label="Share with friends">
                <Share2 size={20} />
              </button>
            </div>
          </div>

        </div>

        </main>

      {/* Fixed Banner Ad - Bottom of viewport */}
      <div className="fixed bottom-0 left-0 right-0 z-10 bg-white border-t border-border/30 max-w-3xl mx-auto">
        <BannerAdDisplay placementKey="homepage-footer" className="py-2" />
      </div>

      {/* Floating Action Button */}
      <Link
        href="/maya-chat"
        aria-label={`New chat with ${effectiveAIProfile.name}`}
        className="fixed bottom-6 right-6 sm:bottom-8 sm:right-8 lg:bottom-10 lg:right-10 z-10 bg-[#25d366] hover:bg-[#1faa55] text-white p-4 rounded-full shadow-lg transition-colors focus:outline-none focus:ring-2 focus:ring-[#25d366] focus:ring-offset-2 min-w-[56px] min-h-[56px] flex items-center justify-center"
      >
        <span>
          <MessageSquarePlus size={24} />
        </span>
      </Link>
      </div>
    </>
  );
};

export default ChatListPage;
