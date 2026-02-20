#!/usr/bin/env node
/**
 * App Store Screenshot Generator for Asphodel (BSKY)
 *
 * Generates properly-sized screenshots for App Store submission by rendering
 * HTML mockups of the app's key screens using Playwright.
 *
 * Required sizes:
 * - 6.7" iPhone 15 Pro Max: 1290x2796
 * - 6.5" iPhone 14 Plus: 1284x2778
 * - 12.9" iPad Pro: 2048x2732
 *
 * Usage: PLAYWRIGHT_BROWSERS_PATH=/tmp/pw-browsers node scripts/generate-appstore-screenshots.mjs
 */

import { chromium } from "playwright";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.join(__dirname, "..");

// Device configurations for App Store
const DEVICES = {
  "iphone-6.7": {
    name: "iPhone 15 Pro Max (6.7\")",
    width: 1290,
    height: 2796,
    folder: "6.7-inch",
    scale: 3,
    // Logical pixels for rendering
    logicalWidth: 430,
    logicalHeight: 932,
    safeAreaTop: 59,
    safeAreaBottom: 34,
    cornerRadius: 55,
    dynamicIsland: true,
    homeIndicator: true,
  },
  "iphone-6.5": {
    name: "iPhone 14 Plus (6.5\")",
    width: 1284,
    height: 2778,
    folder: "6.5-inch",
    scale: 3,
    logicalWidth: 428,
    logicalHeight: 926,
    safeAreaTop: 59,
    safeAreaBottom: 34,
    cornerRadius: 55,
    dynamicIsland: true,
    homeIndicator: true,
  },
  "ipad-12.9": {
    name: "iPad Pro 12.9\"",
    width: 2048,
    height: 2732,
    folder: "12.9-inch",
    scale: 2,
    logicalWidth: 1024,
    logicalHeight: 1366,
    safeAreaTop: 24,
    safeAreaBottom: 20,
    cornerRadius: 18,
    dynamicIsland: false,
    homeIndicator: true,
  },
};

// The butterfly icon SVG (embedded to avoid file path issues)
const BUTTERFLY_SVG = `<svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="wingGradientL" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#ff8fb5"/>
      <stop offset="50%" stop-color="#ff6b9d"/>
      <stop offset="100%" stop-color="#a855f7"/>
    </linearGradient>
    <linearGradient id="wingGradientR" x1="100%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#ff8fb5"/>
      <stop offset="50%" stop-color="#ff6b9d"/>
      <stop offset="100%" stop-color="#a855f7"/>
    </linearGradient>
    <linearGradient id="lowerWingL" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#ff6b9d"/>
      <stop offset="60%" stop-color="#9333ea"/>
      <stop offset="100%" stop-color="#7c3aed"/>
    </linearGradient>
    <linearGradient id="lowerWingR" x1="100%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#ff6b9d"/>
      <stop offset="60%" stop-color="#9333ea"/>
      <stop offset="100%" stop-color="#7c3aed"/>
    </linearGradient>
    <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur in="SourceAlpha" stdDeviation="3" result="blur"/>
      <feFlood flood-color="#ff6b9d" flood-opacity="0.3"/>
      <feComposite in2="blur" operator="in"/>
      <feMerge><feMergeNode/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
    <radialGradient id="shimmerL" cx="40%" cy="40%" r="50%">
      <stop offset="0%" stop-color="#ffffff" stop-opacity="0.35"/>
      <stop offset="100%" stop-color="#ffffff" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="shimmerR" cx="60%" cy="40%" r="50%">
      <stop offset="0%" stop-color="#ffffff" stop-opacity="0.35"/>
      <stop offset="100%" stop-color="#ffffff" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <path d="M 97 88 C 85 60, 65 25, 38 18 C 22 14, 12 22, 14 38 C 16 58, 28 82, 50 96 C 62 103, 80 100, 97 93 Z" fill="url(#wingGradientL)" filter="url(#glow)"/>
  <path d="M 103 88 C 115 60, 135 25, 162 18 C 178 14, 188 22, 186 38 C 184 58, 172 82, 150 96 C 138 103, 120 100, 103 93 Z" fill="url(#wingGradientR)" filter="url(#glow)"/>
  <path d="M 97 97 C 80 105, 50 118, 35 145 C 26 162, 30 175, 45 178 C 62 180, 82 168, 93 148 C 97 138, 97 115, 97 102 Z" fill="url(#lowerWingL)"/>
  <path d="M 103 97 C 120 105, 150 118, 165 145 C 174 162, 170 175, 155 178 C 138 180, 118 168, 107 148 C 103 138, 103 115, 103 102 Z" fill="url(#lowerWingR)"/>
  <path d="M 97 88 C 85 60, 65 25, 38 18 C 22 14, 12 22, 14 38 C 16 58, 28 82, 50 96 C 62 103, 80 100, 97 93 Z" fill="url(#shimmerL)"/>
  <path d="M 103 88 C 115 60, 135 25, 162 18 C 178 14, 188 22, 186 38 C 184 58, 172 82, 150 96 C 138 103, 120 100, 103 93 Z" fill="url(#shimmerR)"/>
  <ellipse cx="100" cy="100" rx="5" ry="28" fill="#2d1b4e"/>
  <ellipse cx="100" cy="100" rx="3.5" ry="26" fill="#3b1f6b"/>
  <circle cx="100" cy="70" r="6" fill="#2d1b4e"/>
  <circle cx="100" cy="70" r="4.5" fill="#3b1f6b"/>
  <circle cx="97.5" cy="69" r="1.2" fill="#ff6b9d"/>
  <circle cx="102.5" cy="69" r="1.2" fill="#ff6b9d"/>
  <path d="M 97 65 C 90 50, 82 42, 75 35" stroke="#3b1f6b" stroke-width="1.8" fill="none" stroke-linecap="round"/>
  <path d="M 103 65 C 110 50, 118 42, 125 35" stroke="#3b1f6b" stroke-width="1.8" fill="none" stroke-linecap="round"/>
  <circle cx="75" cy="35" r="3" fill="#ff6b9d"/>
  <circle cx="125" cy="35" r="3" fill="#ff6b9d"/>
  <circle cx="75" cy="35" r="1.5" fill="#ff8fb5"/>
  <circle cx="125" cy="35" r="1.5" fill="#ff8fb5"/>
</svg>`;

// Icon SVGs for tab bar and UI elements
const ICONS = {
  home: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>`,
  search: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>`,
  compose: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>`,
  bell: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>`,
  user: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>`,
  mail: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>`,
  heart: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>`,
  heartEmpty: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>`,
  repeat: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/></svg>`,
  reply: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 17 4 12 9 7"/><path d="M20 18v-2a4 4 0 0 0-4-4H4"/></svg>`,
  share: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/></svg>`,
  image: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>`,
  send: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>`,
  back: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>`,
  moreH: `<svg viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="12" r="1.5"/><circle cx="19" cy="12" r="1.5"/><circle cx="5" cy="12" r="1.5"/></svg>`,
  bookmark: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>`,
  settings: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>`,
};

// Sample data for realistic content
const SAMPLE_POSTS = [
  {
    author: "Sarah Chen",
    handle: "@sarahchen.bsky.social",
    avatar: "#7c3aed",
    initials: "SC",
    text: "Just discovered Asphodel and it's completely changed how I use Bluesky. The threading view is incredible for following conversations!",
    time: "2m",
    likes: 42,
    reposts: 8,
    replies: 5,
    liked: true,
  },
  {
    author: "Marcus Rivera",
    handle: "@marcus.bsky.social",
    avatar: "#2563eb",
    initials: "MR",
    text: "The new analytics dashboard is perfect for understanding your reach. Finally a client that gives you real insights into your posts.",
    time: "15m",
    likes: 127,
    reposts: 23,
    replies: 12,
    liked: false,
    hasImage: true,
    imageColor: "#1e3a5f",
  },
  {
    author: "Aria Patel",
    handle: "@ariap.bsky.social",
    avatar: "#dc2626",
    initials: "AP",
    text: "Love the DM experience in Asphodel. Clean, fast, and actually works well with threads. Great work by the team!",
    time: "32m",
    likes: 89,
    reposts: 14,
    replies: 7,
    liked: false,
  },
  {
    author: "Dev Nakamura",
    handle: "@devnaka.bsky.social",
    avatar: "#059669",
    initials: "DN",
    text: "Asphodel's search is miles ahead. Filtering by date, sorting by engagement... this is what power users need.",
    time: "1h",
    likes: 56,
    reposts: 11,
    replies: 3,
    liked: true,
  },
  {
    author: "Luna Torres",
    handle: "@luna.bsky.social",
    avatar: "#d97706",
    initials: "LT",
    text: "The bookmarking feature saved me. I was losing great posts before, now everything is organized and searchable.",
    time: "2h",
    likes: 203,
    reposts: 45,
    replies: 18,
    liked: false,
  },
];

const SAMPLE_THREAD = {
  parent: {
    author: "Alex Kim",
    handle: "@alexkim.bsky.social",
    avatar: "#7c3aed",
    initials: "AK",
    text: "Hot take: the future of social media is open protocols. BlueSky's AT Protocol is showing what's possible when you give users real control over their data and experience.",
    time: "3h",
    likes: 534,
    reposts: 127,
    replies: 89,
    liked: true,
  },
  replies: [
    {
      author: "Jordan Lee",
      handle: "@jordanl.bsky.social",
      avatar: "#2563eb",
      initials: "JL",
      text: "Completely agree. The ability to choose your own algorithm is a game changer.",
      time: "2h",
      likes: 45,
      reposts: 3,
      replies: 2,
      liked: false,
    },
    {
      author: "Sam Okafor",
      handle: "@samokafor.bsky.social",
      avatar: "#059669",
      initials: "SO",
      text: "What excites me most is custom feeds. Anyone can build their own algorithmic timeline. That's real innovation.",
      time: "1h",
      likes: 78,
      reposts: 12,
      replies: 5,
      liked: true,
    },
    {
      author: "Mia Zhang",
      handle: "@miazhang.bsky.social",
      avatar: "#dc2626",
      initials: "MZ",
      text: "The decentralization aspect is what sold me. No single company can shut you down.",
      time: "45m",
      likes: 112,
      reposts: 28,
      replies: 8,
      liked: false,
    },
  ],
};

const SAMPLE_PROFILE = {
  name: "Alex Kim",
  handle: "@alexkim.bsky.social",
  avatar: "#7c3aed",
  initials: "AK",
  bio: "Tech writer & open protocol advocate. Exploring the decentralized social web. Building tools for the Bluesky community.",
  followers: "12.4K",
  following: "847",
  posts: "3,291",
  bannerGradient: "linear-gradient(135deg, #7c3aed 0%, #ff6b9d 50%, #2563eb 100%)",
};

const SAMPLE_MESSAGES = [
  {
    name: "Jordan Lee",
    handle: "@jordanl",
    avatar: "#2563eb",
    initials: "JL",
    lastMessage: "That thread about open protocols was really insightful!",
    time: "5m",
    unread: true,
  },
  {
    name: "Mia Zhang",
    handle: "@miazhang",
    avatar: "#dc2626",
    initials: "MZ",
    lastMessage: "Thanks for the follow! Love your content about AT Protocol",
    time: "1h",
    unread: true,
  },
  {
    name: "Sam Okafor",
    handle: "@samokafor",
    avatar: "#059669",
    initials: "SO",
    lastMessage: "Would you be interested in collaborating on a custom feed?",
    time: "3h",
    unread: false,
  },
  {
    name: "Luna Torres",
    handle: "@luna",
    avatar: "#d97706",
    initials: "LT",
    lastMessage: "Just shared your post with my followers - great stuff!",
    time: "1d",
    unread: false,
  },
  {
    name: "Dev Nakamura",
    handle: "@devnaka",
    avatar: "#059669",
    initials: "DN",
    lastMessage: "The API documentation is really well done",
    time: "2d",
    unread: false,
  },
];

const SAMPLE_NOTIFICATIONS = [
  { type: "like", user: "Sarah Chen", initials: "SC", color: "#7c3aed", text: "liked your post", time: "2m" },
  { type: "repost", user: "Marcus Rivera", initials: "MR", color: "#2563eb", text: "reposted your post", time: "15m" },
  { type: "follow", user: "Aria Patel", initials: "AP", color: "#dc2626", text: "followed you", time: "32m" },
  { type: "reply", user: "Dev Nakamura", initials: "DN", color: "#059669", text: "replied to your post", time: "1h" },
  { type: "like", user: "Luna Torres", initials: "LT", color: "#d97706", text: "liked your post", time: "2h" },
  { type: "mention", user: "Jordan Lee", initials: "JL", color: "#2563eb", text: "mentioned you", time: "3h" },
  { type: "follow", user: "Mia Zhang", initials: "MZ", color: "#dc2626", text: "followed you", time: "5h" },
  { type: "repost", user: "Sam Okafor", initials: "SO", color: "#059669", text: "reposted your post", time: "8h" },
];

// Shared CSS for all screens
function getBaseCSS(device) {
  const isIPad = device.logicalWidth > 500;
  return `
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif;
      background: #0a0a0f;
      color: #fafafa;
      width: ${device.logicalWidth}px;
      height: ${device.logicalHeight}px;
      overflow: hidden;
      -webkit-font-smoothing: antialiased;
    }
    .screen {
      width: 100%;
      height: 100%;
      display: flex;
      flex-direction: column;
      background: #0a0a0f;
    }
    .status-bar {
      height: ${device.safeAreaTop}px;
      display: flex;
      align-items: flex-end;
      justify-content: space-between;
      padding: 0 ${isIPad ? 24 : 20}px 8px;
      font-size: ${isIPad ? 14 : 12}px;
      font-weight: 600;
      color: #fafafa;
      flex-shrink: 0;
    }
    .status-bar-left { flex: 1; }
    .status-bar-center { flex: 1; text-align: center; }
    .status-bar-right { flex: 1; text-align: right; display: flex; align-items: center; justify-content: flex-end; gap: 5px; }
    .tab-bar {
      height: ${50 + device.safeAreaBottom}px;
      background: #13131a;
      border-top: 1px solid #27272a;
      display: flex;
      align-items: flex-start;
      justify-content: space-around;
      padding-top: 8px;
      padding-bottom: ${device.safeAreaBottom}px;
      flex-shrink: 0;
    }
    .tab-item {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 2px;
      color: #71717a;
      font-size: 10px;
      font-weight: 500;
    }
    .tab-item.active { color: #ff6b9d; }
    .tab-item svg { width: 22px; height: 22px; }
    .tab-badge {
      position: absolute;
      top: -4px;
      right: -8px;
      background: #ff1744;
      color: white;
      font-size: 9px;
      font-weight: 700;
      min-width: 16px;
      height: 16px;
      border-radius: 8px;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 0 4px;
    }
    .tab-icon-wrap { position: relative; }
    .header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 8px ${isIPad ? 24 : 16}px;
      background: #0a0a0f;
      border-bottom: 1px solid #27272a;
      flex-shrink: 0;
    }
    .header-title {
      font-size: ${isIPad ? 20 : 17}px;
      font-weight: 700;
      color: #fafafa;
    }
    .avatar {
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: 700;
      color: white;
      flex-shrink: 0;
    }
    .avatar-sm { width: 32px; height: 32px; font-size: 13px; }
    .avatar-md { width: 44px; height: 44px; font-size: 16px; }
    .avatar-lg { width: 72px; height: 72px; font-size: 24px; }
    .avatar-xl { width: 88px; height: 88px; font-size: 32px; }
    .post-card {
      padding: ${isIPad ? 16 : 12}px ${isIPad ? 24 : 16}px;
      border-bottom: 1px solid #1c1c26;
    }
    .post-header {
      display: flex;
      align-items: center;
      gap: 10px;
      margin-bottom: 8px;
    }
    .post-author { font-weight: 700; font-size: ${isIPad ? 16 : 14}px; color: #fafafa; }
    .post-handle { font-size: ${isIPad ? 14 : 12}px; color: #71717a; }
    .post-time { font-size: ${isIPad ? 14 : 12}px; color: #71717a; margin-left: auto; }
    .post-text {
      font-size: ${isIPad ? 16 : 15}px;
      line-height: 1.45;
      color: #e4e4e7;
      margin-bottom: 10px;
      padding-left: ${isIPad ? 0 : 54}px;
    }
    .post-actions {
      display: flex;
      align-items: center;
      gap: ${isIPad ? 48 : 32}px;
      padding-left: ${isIPad ? 0 : 54}px;
    }
    .post-action {
      display: flex;
      align-items: center;
      gap: 6px;
      color: #71717a;
      font-size: 13px;
    }
    .post-action svg { width: 18px; height: 18px; }
    .post-action.liked { color: #ff4081; }
    .post-action.liked svg { fill: #ff4081; }
    .post-action.reposted { color: #00e676; }
    .feed-tabs {
      display: flex;
      border-bottom: 1px solid #27272a;
      background: #0a0a0f;
      flex-shrink: 0;
    }
    .feed-tab {
      flex: 1;
      text-align: center;
      padding: 12px 0;
      font-size: ${isIPad ? 15 : 13}px;
      font-weight: 600;
      color: #71717a;
      border-bottom: 2px solid transparent;
    }
    .feed-tab.active {
      color: #ff6b9d;
      border-bottom-color: #ff6b9d;
    }
    .content { flex: 1; overflow: hidden; }
    .icon-btn {
      width: 32px;
      height: 32px;
      display: flex;
      align-items: center;
      justify-content: center;
      color: #d4d4d8;
    }
    .icon-btn svg { width: 22px; height: 22px; }
    .post-image {
      margin-bottom: 10px;
      margin-left: ${isIPad ? 0 : 54}px;
      border-radius: 12px;
      height: ${isIPad ? 200 : 160}px;
      background: var(--img-bg, #1e3a5f);
      display: flex;
      align-items: center;
      justify-content: center;
      overflow: hidden;
    }
    .post-image svg { width: 48px; height: 48px; color: rgba(255,255,255,0.3); }
  `;
}

function renderStatusBar(device) {
  return `
    <div class="status-bar">
      <div class="status-bar-left">9:41</div>
      <div class="status-bar-center">${device.dynamicIsland ? '' : ''}</div>
      <div class="status-bar-right">
        <span style="font-size:10px">●●●●○</span>
        <span style="font-size:10px">WiFi</span>
        <span style="font-size:11px">🔋</span>
      </div>
    </div>
  `;
}

function renderTabBar(activeTab, device) {
  const tabs = [
    { id: 'home', label: 'Home', icon: ICONS.home },
    { id: 'search', label: 'Search', icon: ICONS.search },
    { id: 'compose', label: '', icon: ICONS.compose, isCompose: true },
    { id: 'notifications', label: 'Activity', icon: ICONS.bell, badge: 3 },
    { id: 'profile', label: 'Profile', icon: ICONS.user },
  ];

  return `
    <div class="tab-bar">
      ${tabs.map(tab => `
        <div class="tab-item ${activeTab === tab.id ? 'active' : ''}">
          <div class="tab-icon-wrap">
            ${tab.isCompose ?
              `<div style="width:36px;height:36px;background:linear-gradient(135deg,#ff6b9d,#a855f7);border-radius:50%;display:flex;align-items:center;justify-content:center;margin-top:-8px;">
                <span style="color:white;width:20px;height:20px;">${tab.icon}</span>
              </div>` :
              tab.icon
            }
            ${tab.badge ? `<div class="tab-badge">${tab.badge}</div>` : ''}
          </div>
          ${tab.label ? `<span>${tab.label}</span>` : ''}
        </div>
      `).join('')}
    </div>
  `;
}

function renderPost(post, device, showImage = false) {
  const isIPad = device.logicalWidth > 500;
  return `
    <div class="post-card">
      <div class="post-header">
        <div class="avatar avatar-md" style="background:${post.avatar}">${post.initials}</div>
        <div>
          <span class="post-author">${post.author}</span>
          <div class="post-handle">${post.handle}</div>
        </div>
        <span class="post-time">${post.time}</span>
      </div>
      <div class="post-text">${post.text}</div>
      ${(showImage || post.hasImage) ? `
        <div class="post-image" style="--img-bg:${post.imageColor || '#1a2744'}">
          <div style="text-align:center;color:rgba(255,255,255,0.4);">
            <div style="width:64px;height:64px;margin:0 auto 8px;opacity:0.3;">${ICONS.image}</div>
          </div>
        </div>
      ` : ''}
      <div class="post-actions">
        <div class="post-action">
          <span>${ICONS.reply}</span>
          <span>${post.replies}</span>
        </div>
        <div class="post-action ${post.liked ? '' : ''}">
          <span>${ICONS.repeat}</span>
          <span>${post.reposts}</span>
        </div>
        <div class="post-action ${post.liked ? 'liked' : ''}">
          <span>${post.liked ? ICONS.heart : ICONS.heartEmpty}</span>
          <span>${post.likes}</span>
        </div>
        <div class="post-action">
          <span>${ICONS.share}</span>
        </div>
      </div>
    </div>
  `;
}

// Screen generators
function generateFeedScreen(device) {
  const isIPad = device.logicalWidth > 500;
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>${getBaseCSS(device)}</style></head><body>
    <div class="screen">
      ${renderStatusBar(device)}
      <div class="header">
        <div style="display:flex;align-items:center;gap:10px;">
          <div style="width:28px;height:28px;">${BUTTERFLY_SVG}</div>
          <span class="header-title">Asphodel</span>
        </div>
        <div style="display:flex;gap:12px;">
          <div class="icon-btn">${ICONS.settings}</div>
        </div>
      </div>
      <div class="feed-tabs">
        <div class="feed-tab active">Following</div>
        <div class="feed-tab">Discover</div>
        <div class="feed-tab">What's Hot</div>
      </div>
      <div class="content">
        ${SAMPLE_POSTS.map((p, i) => renderPost(p, device)).join('')}
      </div>
      ${renderTabBar('home', device)}
    </div>
  </body></html>`;
}

function generateThreadScreen(device) {
  const isIPad = device.logicalWidth > 500;
  const p = SAMPLE_THREAD.parent;
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>${getBaseCSS(device)}
    .thread-parent {
      padding: ${isIPad ? 20 : 16}px;
      border-bottom: 1px solid #27272a;
    }
    .thread-parent .post-text {
      font-size: ${isIPad ? 19 : 17}px;
      line-height: 1.5;
      padding-left: 0;
      margin-top: 12px;
    }
    .thread-stats {
      display: flex;
      gap: 20px;
      padding: 12px 0;
      border-top: 1px solid #1c1c26;
      margin-top: 12px;
      font-size: 14px;
      color: #71717a;
    }
    .thread-stats strong { color: #fafafa; font-weight: 700; }
    .thread-actions {
      display: flex;
      justify-content: space-around;
      padding: 12px 0;
      border-top: 1px solid #1c1c26;
      border-bottom: 1px solid #1c1c26;
    }
    .thread-action { color: #71717a; display:flex; align-items:center; gap:4px; }
    .thread-action svg { width: 22px; height: 22px; }
    .thread-action.liked { color: #ff4081; }
    .reply-divider {
      padding: 12px ${isIPad ? 20 : 16}px;
      font-size: 14px;
      font-weight: 600;
      color: #71717a;
      border-bottom: 1px solid #1c1c26;
    }
    .reply-card {
      padding: ${isIPad ? 14 : 12}px ${isIPad ? 20 : 16}px;
      border-bottom: 1px solid #1c1c26;
      display: flex;
      gap: 10px;
    }
    .reply-content { flex: 1; }
    .reply-text { font-size: ${isIPad ? 15 : 14}px; line-height: 1.4; color: #e4e4e7; margin: 6px 0 8px; }
    .reply-actions { display: flex; gap: 24px; font-size: 12px; color: #71717a; }
    .reply-actions > div { display: flex; align-items: center; gap: 4px; }
    .reply-actions svg { width: 16px; height: 16px; }
  </style></head><body>
    <div class="screen">
      ${renderStatusBar(device)}
      <div class="header">
        <div class="icon-btn">${ICONS.back}</div>
        <span class="header-title">Thread</span>
        <div class="icon-btn">${ICONS.moreH}</div>
      </div>
      <div class="content">
        <div class="thread-parent">
          <div class="post-header">
            <div class="avatar avatar-md" style="background:${p.avatar}">${p.initials}</div>
            <div>
              <span class="post-author">${p.author}</span>
              <div class="post-handle">${p.handle}</div>
            </div>
          </div>
          <div class="post-text">${p.text}</div>
          <div class="thread-stats">
            <span><strong>${p.replies}</strong> replies</span>
            <span><strong>${p.reposts}</strong> reposts</span>
            <span><strong>${p.likes}</strong> likes</span>
          </div>
          <div class="thread-actions">
            <div class="thread-action">${ICONS.reply}</div>
            <div class="thread-action">${ICONS.repeat}</div>
            <div class="thread-action liked">${ICONS.heart}</div>
            <div class="thread-action">${ICONS.share}</div>
            <div class="thread-action">${ICONS.bookmark}</div>
          </div>
        </div>
        <div class="reply-divider">Replies</div>
        ${SAMPLE_THREAD.replies.map(r => `
          <div class="reply-card">
            <div class="avatar avatar-sm" style="background:${r.avatar}">${r.initials}</div>
            <div class="reply-content">
              <div style="display:flex;align-items:center;gap:6px;">
                <span style="font-weight:700;font-size:14px;">${r.author}</span>
                <span style="font-size:12px;color:#71717a;">${r.handle} · ${r.time}</span>
              </div>
              <div class="reply-text">${r.text}</div>
              <div class="reply-actions">
                <div>${ICONS.reply} <span>${r.replies}</span></div>
                <div>${ICONS.repeat} <span>${r.reposts}</span></div>
                <div ${r.liked ? 'style="color:#ff4081"' : ''}>${r.liked ? ICONS.heart : ICONS.heartEmpty} <span>${r.likes}</span></div>
              </div>
            </div>
          </div>
        `).join('')}
      </div>
      ${renderTabBar('home', device)}
    </div>
  </body></html>`;
}

function generateProfileScreen(device) {
  const isIPad = device.logicalWidth > 500;
  const p = SAMPLE_PROFILE;
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>${getBaseCSS(device)}
    .profile-banner {
      height: ${isIPad ? 200 : 150}px;
      background: ${p.bannerGradient};
      position: relative;
      flex-shrink: 0;
    }
    .profile-avatar-wrap {
      position: absolute;
      bottom: -${isIPad ? 44 : 36}px;
      left: ${isIPad ? 24 : 16}px;
    }
    .profile-avatar-border {
      border: 4px solid #0a0a0f;
      border-radius: 50%;
      display: inline-block;
    }
    .profile-info {
      padding: ${isIPad ? '52px 24px 16px' : '44px 16px 12px'};
      flex-shrink: 0;
    }
    .profile-name { font-size: ${isIPad ? 24 : 20}px; font-weight: 800; }
    .profile-handle { font-size: ${isIPad ? 16 : 14}px; color: #71717a; margin-top: 2px; }
    .profile-bio { font-size: ${isIPad ? 16 : 14}px; color: #e4e4e7; margin-top: 8px; line-height: 1.4; }
    .profile-stats {
      display: flex;
      gap: 20px;
      margin-top: 12px;
      font-size: ${isIPad ? 15 : 13}px;
      color: #71717a;
    }
    .profile-stats strong { color: #fafafa; font-weight: 700; }
    .profile-actions {
      display: flex;
      gap: 10px;
      position: absolute;
      top: ${isIPad ? 216 : 166}px;
      right: ${isIPad ? 24 : 16}px;
    }
    .follow-btn {
      background: linear-gradient(135deg, #ff6b9d, #a855f7);
      color: white;
      border: none;
      border-radius: 20px;
      padding: 8px 24px;
      font-weight: 700;
      font-size: 14px;
    }
    .profile-tabs {
      display: flex;
      border-bottom: 1px solid #27272a;
      border-top: 1px solid #27272a;
      flex-shrink: 0;
    }
    .profile-tab {
      flex: 1;
      text-align: center;
      padding: 12px 0;
      font-size: 14px;
      font-weight: 600;
      color: #71717a;
      border-bottom: 2px solid transparent;
    }
    .profile-tab.active {
      color: #ff6b9d;
      border-bottom-color: #ff6b9d;
    }
  </style></head><body>
    <div class="screen" style="position:relative;">
      ${renderStatusBar(device)}
      <div class="header" style="position:absolute;top:${device.safeAreaTop}px;left:0;right:0;z-index:10;background:transparent;border:none;">
        <div class="icon-btn" style="background:rgba(0,0,0,0.5);border-radius:50%;width:36px;height:36px;">${ICONS.back}</div>
        <div class="icon-btn" style="background:rgba(0,0,0,0.5);border-radius:50%;width:36px;height:36px;">${ICONS.moreH}</div>
      </div>
      <div class="content" style="margin-top:0;">
        <div class="profile-banner">
          <div class="profile-avatar-wrap">
            <div class="profile-avatar-border">
              <div class="avatar ${isIPad ? 'avatar-xl' : 'avatar-lg'}" style="background:${p.avatar}">${p.initials}</div>
            </div>
          </div>
        </div>
        <div class="profile-actions">
          <div class="follow-btn">Follow</div>
        </div>
        <div class="profile-info">
          <div class="profile-name">${p.name}</div>
          <div class="profile-handle">${p.handle}</div>
          <div class="profile-bio">${p.bio}</div>
          <div class="profile-stats">
            <span><strong>${p.followers}</strong> followers</span>
            <span><strong>${p.following}</strong> following</span>
            <span><strong>${p.posts}</strong> posts</span>
          </div>
        </div>
        <div class="profile-tabs">
          <div class="profile-tab active">Posts</div>
          <div class="profile-tab">Replies</div>
          <div class="profile-tab">Media</div>
          <div class="profile-tab">Likes</div>
        </div>
        ${SAMPLE_POSTS.slice(0, 3).map(p => renderPost(p, device)).join('')}
      </div>
      ${renderTabBar('profile', device)}
    </div>
  </body></html>`;
}

function generateSearchScreen(device) {
  const isIPad = device.logicalWidth > 500;
  const trendingTopics = [
    { topic: "AT Protocol", posts: "2.4K posts", color: "#7c3aed" },
    { topic: "Decentralized Social", posts: "1.8K posts", color: "#2563eb" },
    { topic: "Custom Feeds", posts: "952 posts", color: "#059669" },
    { topic: "Open Source", posts: "3.1K posts", color: "#d97706" },
    { topic: "BlueSky Tips", posts: "1.2K posts", color: "#dc2626" },
  ];
  const suggestedUsers = [
    { name: "Protocol Labs", handle: "@protocollabs", initials: "PL", color: "#2563eb", desc: "Building the future of the internet" },
    { name: "Feed Creator", handle: "@feedcreator", initials: "FC", color: "#059669", desc: "Custom feed algorithms for everyone" },
    { name: "Sky Dev", handle: "@skydev", initials: "SD", color: "#7c3aed", desc: "Bluesky development tools & resources" },
  ];

  return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>${getBaseCSS(device)}
    .search-bar {
      margin: ${isIPad ? 12 : 8}px ${isIPad ? 24 : 16}px;
      background: #1c1c26;
      border-radius: 12px;
      padding: 12px 16px;
      display: flex;
      align-items: center;
      gap: 10px;
      flex-shrink: 0;
    }
    .search-bar svg { width: 18px; height: 18px; color: #71717a; }
    .search-placeholder { color: #71717a; font-size: ${isIPad ? 16 : 14}px; }
    .section-title {
      font-size: ${isIPad ? 18 : 16}px;
      font-weight: 700;
      padding: 16px ${isIPad ? 24 : 16}px 8px;
      color: #fafafa;
    }
    .trending-item {
      padding: 12px ${isIPad ? 24 : 16}px;
      display: flex;
      align-items: center;
      gap: 12px;
      border-bottom: 1px solid #1c1c26;
    }
    .trending-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
    }
    .trending-topic { font-weight: 600; font-size: ${isIPad ? 16 : 14}px; }
    .trending-posts { font-size: ${isIPad ? 13 : 12}px; color: #71717a; margin-top: 2px; }
    .suggested-user {
      padding: 12px ${isIPad ? 24 : 16}px;
      display: flex;
      align-items: center;
      gap: 12px;
      border-bottom: 1px solid #1c1c26;
    }
    .suggested-follow {
      margin-left: auto;
      background: transparent;
      border: 1.5px solid #ff6b9d;
      color: #ff6b9d;
      border-radius: 16px;
      padding: 6px 16px;
      font-weight: 600;
      font-size: 13px;
    }
    .search-tabs {
      display: flex;
      border-bottom: 1px solid #27272a;
      flex-shrink: 0;
    }
    .search-tab {
      flex: 1;
      text-align: center;
      padding: 12px 0;
      font-size: 13px;
      font-weight: 600;
      color: #71717a;
      border-bottom: 2px solid transparent;
    }
    .search-tab.active {
      color: #ff6b9d;
      border-bottom-color: #ff6b9d;
    }
  </style></head><body>
    <div class="screen">
      ${renderStatusBar(device)}
      <div class="header">
        <span class="header-title">Discover</span>
      </div>
      <div class="search-bar">
        <span>${ICONS.search}</span>
        <span class="search-placeholder">Search posts, users, or feeds...</span>
      </div>
      <div class="search-tabs">
        <div class="search-tab active">Trending</div>
        <div class="search-tab">For You</div>
        <div class="search-tab">Feeds</div>
      </div>
      <div class="content">
        <div class="section-title">Trending Topics</div>
        ${trendingTopics.map(t => `
          <div class="trending-item">
            <div class="trending-dot" style="background:${t.color}"></div>
            <div>
              <div class="trending-topic">${t.topic}</div>
              <div class="trending-posts">${t.posts}</div>
            </div>
          </div>
        `).join('')}
        <div class="section-title" style="margin-top:8px;">Suggested for You</div>
        ${suggestedUsers.map(u => `
          <div class="suggested-user">
            <div class="avatar avatar-md" style="background:${u.color}">${u.initials}</div>
            <div>
              <div style="font-weight:700;font-size:14px;">${u.name}</div>
              <div style="font-size:12px;color:#71717a;">${u.handle}</div>
              <div style="font-size:12px;color:#a1a1aa;margin-top:2px;">${u.desc}</div>
            </div>
            <div class="suggested-follow">Follow</div>
          </div>
        `).join('')}
      </div>
      ${renderTabBar('search', device)}
    </div>
  </body></html>`;
}

function generateComposeScreen(device) {
  const isIPad = device.logicalWidth > 500;
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>${getBaseCSS(device)}
    .compose-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 8px ${isIPad ? 24 : 16}px;
      border-bottom: 1px solid #27272a;
      flex-shrink: 0;
    }
    .compose-cancel { color: #71717a; font-size: 16px; font-weight: 500; }
    .compose-post-btn {
      background: linear-gradient(135deg, #ff6b9d, #a855f7);
      color: white;
      border: none;
      border-radius: 20px;
      padding: 8px 20px;
      font-weight: 700;
      font-size: 14px;
    }
    .compose-body {
      padding: ${isIPad ? 20 : 16}px;
      display: flex;
      gap: 12px;
      flex: 1;
    }
    .compose-input {
      flex: 1;
    }
    .compose-placeholder {
      font-size: ${isIPad ? 18 : 16}px;
      color: #71717a;
      line-height: 1.5;
    }
    .compose-text {
      font-size: ${isIPad ? 18 : 16}px;
      color: #fafafa;
      line-height: 1.5;
    }
    .compose-toolbar {
      display: flex;
      align-items: center;
      gap: ${isIPad ? 20 : 16}px;
      padding: 12px ${isIPad ? 24 : 16}px;
      border-top: 1px solid #27272a;
      flex-shrink: 0;
    }
    .compose-tool { color: #ff6b9d; width: 24px; height: 24px; }
    .compose-tool svg { width: 24px; height: 24px; }
    .char-count {
      margin-left: auto;
      font-size: 13px;
      color: #71717a;
    }
    .char-ring {
      width: 24px;
      height: 24px;
      border: 2px solid #27272a;
      border-radius: 50%;
      margin-left: auto;
      position: relative;
    }
    .char-ring::after {
      content: '';
      position: absolute;
      top: -2px;
      left: -2px;
      width: 24px;
      height: 24px;
      border: 2px solid #ff6b9d;
      border-radius: 50%;
      clip-path: polygon(0 0, 100% 0, 100% 42%, 0 42%);
    }
  </style></head><body>
    <div class="screen">
      ${renderStatusBar(device)}
      <div class="compose-header">
        <span class="compose-cancel">Cancel</span>
        <div style="display:flex;align-items:center;gap:12px;">
          <span style="font-size:12px;color:#71717a;">Draft</span>
          <div class="compose-post-btn">Post</div>
        </div>
      </div>
      <div class="compose-body">
        <div class="avatar avatar-md" style="background:#7c3aed">AK</div>
        <div class="compose-input">
          <div class="compose-text">The open social web is growing every day. With tools like Asphodel making it easier than ever to engage with the Bluesky community, we're seeing what's possible when protocols are open and users have real choice.</div>
          <div style="margin-top:16px;display:flex;gap:4px;">
            <div style="font-size:12px;color:#71717a;background:#1c1c26;padding:4px 10px;border-radius:12px;">🌐 English</div>
          </div>
        </div>
      </div>
      <div class="compose-toolbar">
        <div class="compose-tool">${ICONS.image}</div>
        <div class="compose-tool">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="2" width="20" height="20" rx="2.18" ry="2.18"/><line x1="7" y1="2" x2="7" y2="22"/><line x1="17" y1="2" x2="17" y2="22"/><line x1="2" y1="12" x2="22" y2="12"/><line x1="2" y1="7" x2="7" y2="7"/><line x1="2" y1="17" x2="7" y2="17"/><line x1="17" y1="7" x2="22" y2="7"/><line x1="17" y1="17" x2="22" y2="17"/></svg>
        </div>
        <div class="compose-tool">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="4 7 4 4 20 4 20 7"/><line x1="9" y1="20" x2="15" y2="20"/><line x1="12" y1="4" x2="12" y2="20"/></svg>
        </div>
        <span class="char-count">156 / 300</span>
        <div class="char-ring"></div>
      </div>
      ${renderTabBar('compose', device)}
    </div>
  </body></html>`;
}

function generateMessagesScreen(device) {
  const isIPad = device.logicalWidth > 500;
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>${getBaseCSS(device)}
    .message-item {
      padding: ${isIPad ? 16 : 12}px ${isIPad ? 24 : 16}px;
      display: flex;
      align-items: center;
      gap: 12px;
      border-bottom: 1px solid #1c1c26;
    }
    .message-content { flex: 1; min-width: 0; }
    .message-name-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    .message-name { font-weight: 700; font-size: ${isIPad ? 16 : 14}px; }
    .message-time { font-size: ${isIPad ? 13 : 12}px; color: #71717a; }
    .message-preview {
      font-size: ${isIPad ? 14 : 13}px;
      color: #71717a;
      margin-top: 4px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .message-preview.unread { color: #e4e4e7; font-weight: 500; }
    .unread-dot {
      width: 10px;
      height: 10px;
      background: #ff6b9d;
      border-radius: 50%;
      flex-shrink: 0;
    }
    .new-message-btn {
      position: absolute;
      bottom: ${60 + device.safeAreaBottom}px;
      right: ${isIPad ? 24 : 16}px;
      width: 56px;
      height: 56px;
      background: linear-gradient(135deg, #ff6b9d, #a855f7);
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 4px 16px rgba(255,107,157,0.4);
    }
    .new-message-btn svg { width: 24px; height: 24px; color: white; }
  </style></head><body>
    <div class="screen" style="position:relative;">
      ${renderStatusBar(device)}
      <div class="header">
        <span class="header-title">Messages</span>
        <div class="icon-btn">${ICONS.settings}</div>
      </div>
      <div class="search-bar" style="margin:8px ${isIPad ? 24 : 16}px;background:#1c1c26;border-radius:12px;padding:10px 16px;display:flex;align-items:center;gap:10px;">
        <span style="color:#71717a;width:18px;height:18px;">${ICONS.search}</span>
        <span style="color:#71717a;font-size:14px;">Search conversations...</span>
      </div>
      <div class="content">
        ${SAMPLE_MESSAGES.map(m => `
          <div class="message-item">
            <div class="avatar avatar-md" style="background:${m.avatar}">${m.initials}</div>
            <div class="message-content">
              <div class="message-name-row">
                <span class="message-name">${m.name}</span>
                <span class="message-time">${m.time}</span>
              </div>
              <div class="message-preview ${m.unread ? 'unread' : ''}">${m.lastMessage}</div>
            </div>
            ${m.unread ? '<div class="unread-dot"></div>' : ''}
          </div>
        `).join('')}
      </div>
      <div class="new-message-btn">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
      </div>
      ${renderTabBar('notifications', device)}
    </div>
  </body></html>`;
}

// Screen definitions for each screenshot
const SCREENS = [
  {
    id: "01-feed",
    title: "Feed / Home",
    generate: generateFeedScreen,
  },
  {
    id: "02-thread",
    title: "Thread / Post Detail",
    generate: generateThreadScreen,
  },
  {
    id: "03-profile",
    title: "Profile",
    generate: generateProfileScreen,
  },
  {
    id: "04-search",
    title: "Search / Discover",
    generate: generateSearchScreen,
  },
  {
    id: "05-compose",
    title: "Compose",
    generate: generateComposeScreen,
  },
  {
    id: "06-messages",
    title: "Messages / DMs",
    generate: generateMessagesScreen,
  },
];

async function captureScreenshots() {
  const outputBase = path.join(projectRoot, "docs", "screenshots");

  // Ensure output directories exist
  for (const device of Object.values(DEVICES)) {
    const dir = path.join(outputBase, device.folder);
    fs.mkdirSync(dir, { recursive: true });
  }

  console.log("Launching browser...");
  const browser = await chromium.launch({
    headless: true,
  });

  let totalScreenshots = 0;

  for (const [deviceKey, device] of Object.entries(DEVICES)) {
    console.log(`\n=== ${device.name} (${device.width}x${device.height}) ===`);

    const context = await browser.newContext({
      viewport: {
        width: device.logicalWidth,
        height: device.logicalHeight,
      },
      deviceScaleFactor: device.scale,
    });

    const page = await context.newPage();

    for (const screen of SCREENS) {
      const html = screen.generate(device);
      const filename = `${screen.id}.png`;
      const filepath = path.join(outputBase, device.folder, filename);

      // Load the HTML content
      await page.setContent(html, { waitUntil: "networkidle" });
      await page.waitForTimeout(200); // Let fonts settle

      // Take screenshot at exact device resolution
      await page.screenshot({
        path: filepath,
        type: "png",
      });

      // Verify dimensions
      const stats = fs.statSync(filepath);
      console.log(`  ✓ ${filename} (${(stats.size / 1024).toFixed(1)} KB)`);
      totalScreenshots++;
    }

    await context.close();
  }

  await browser.close();

  console.log(`\n✓ Generated ${totalScreenshots} screenshots across ${Object.keys(DEVICES).length} device sizes`);
  console.log(`  Output: ${outputBase}/`);

  // Print summary
  console.log("\nDirectory structure:");
  for (const device of Object.values(DEVICES)) {
    const dir = path.join(outputBase, device.folder);
    const files = fs.readdirSync(dir).filter(f => f.endsWith(".png"));
    console.log(`  ${device.folder}/ (${device.width}x${device.height}) - ${files.length} screenshots`);
    files.forEach(f => console.log(`    ${f}`));
  }
}

captureScreenshots().catch(err => {
  console.error("Failed to generate screenshots:", err);
  process.exit(1);
});
