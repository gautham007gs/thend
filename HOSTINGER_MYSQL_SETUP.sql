-- Hostinger MySQL setup for Kruthika Chat
-- Run this once in your Hostinger MySQL database.

CREATE TABLE IF NOT EXISTS app_configurations (
  id VARCHAR(255) PRIMARY KEY,
  settings JSON NOT NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS messages_log (
  message_id VARCHAR(255) PRIMARY KEY,
  sender_type VARCHAR(32),
  chat_id VARCHAR(255),
  text_content TEXT,
  has_image BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS daily_activity_log (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  user_pseudo_id VARCHAR(255) NOT NULL,
  activity_date DATE NOT NULL,
  chat_id VARCHAR(255),
  UNIQUE KEY uniq_daily_activity (user_pseudo_id, activity_date, chat_id)
);

CREATE TABLE IF NOT EXISTS user_sessions (
  session_id VARCHAR(255) PRIMARY KEY,
  user_pseudo_id VARCHAR(255),
  device_type VARCHAR(64),
  browser VARCHAR(128),
  country_code VARCHAR(16),
  timezone VARCHAR(128),
  referrer TEXT,
  messages_sent INT DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  ended_at TIMESTAMP NULL,
  duration_seconds INT DEFAULT 0
);

CREATE TABLE IF NOT EXISTS user_analytics (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  session_id VARCHAR(255),
  user_pseudo_id VARCHAR(255),
  country_code VARCHAR(16),
  country_name VARCHAR(128),
  timezone VARCHAR(128),
  device_type VARCHAR(64),
  browser VARCHAR(128),
  os VARCHAR(128),
  screen_resolution VARCHAR(64),
  language VARCHAR(16),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_user_analytics (session_id)
);

CREATE TABLE IF NOT EXISTS daily_analytics (
  date DATE PRIMARY KEY,
  dau INT DEFAULT 0,
  message_count INT DEFAULT 0,
  error_count INT DEFAULT 0,
  response_time INT DEFAULT 0,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS page_views (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  session_id VARCHAR(255),
  page_path TEXT,
  page_title TEXT,
  referrer TEXT,
  viewed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS ad_interactions (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  session_id VARCHAR(255),
  ad_type VARCHAR(128),
  ad_network VARCHAR(128),
  action_type VARCHAR(32),
  page_path TEXT,
  user_country VARCHAR(64),
  device_type VARCHAR(64),
  timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS ad_revenue_log (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  date DATE NOT NULL,
  ad_network VARCHAR(128),
  ad_type VARCHAR(128),
  impressions INT DEFAULT 0,
  clicks INT DEFAULT 0,
  estimated_revenue DECIMAL(10, 4) DEFAULT 0,
  cpm DECIMAL(10, 4) DEFAULT 0,
  UNIQUE KEY uniq_ad_revenue (date, ad_network, ad_type)
);

CREATE TABLE IF NOT EXISTS user_journey_steps (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  session_id VARCHAR(255),
  step_name VARCHAR(128),
  step_order INT DEFAULT 0,
  page_path TEXT,
  completed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS cookie_consents (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  session_id VARCHAR(255),
  necessary BOOLEAN DEFAULT TRUE,
  analytics BOOLEAN DEFAULT FALSE,
  advertising BOOLEAN DEFAULT FALSE,
  personalization BOOLEAN DEFAULT FALSE,
  ai_learning BOOLEAN DEFAULT FALSE,
  intimacy_level BOOLEAN DEFAULT FALSE,
  timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Seed example configurations
INSERT INTO app_configurations (id, settings) VALUES (
  'ad_settings_kruthika_chat_v1',
  JSON_OBJECT(
    'adsEnabledGlobally', true,
    'adsterraDirectLink', 'https://www.profitablecpmnetwork.com/g8nhym4yg?key=2b71bf819cb8c5c7f8e011b7b75ea097',
    'adsterraDirectLinkEnabled', true,
    'adsterraBannerCode', '<!-- Adsterra Banner Code Placeholder -->',
    'adsterraBannerEnabled', false,
    'adsterraNativeBannerCode', '<!-- Adsterra Native Banner Code Placeholder -->',
    'adsterraNativeBannerEnabled', false,
    'adsterraSocialBarCode', '<!-- Adsterra Social Bar Code Placeholder -->',
    'adsterraSocialBarEnabled', true,
    'adsterraPopunderCode', '<!-- Adsterra Popunder Code Placeholder -->',
    'adsterraPopunderEnabled', false,
    'maxDirectLinkAdsPerDay', 8,
    'maxDirectLinkAdsPerSession', 2,
    'messagesPerAdTrigger', 7,
    'inactivityAdTimeoutMs', 45000,
    'inactivityAdChance', 0.25,
    'userMediaInterstitialChance', 0.15
  )
) ON DUPLICATE KEY UPDATE settings = VALUES(settings);

INSERT INTO app_configurations (id, settings) VALUES (
  'ai_profile_global_v1',
  JSON_OBJECT(
    'name', 'Kruthika',
    'avatarUrl', 'https://placehold.co/100x100.png/E91E63/FFFFFF?text=K',
    'status', '🌸 Living my best life! Lets chat! 🌸',
    'statusStoryText', 'Ask me anything! 💬',
    'statusStoryHasUpdate', true
  )
) ON DUPLICATE KEY UPDATE settings = VALUES(settings);
