/**
 * Moderation History Service
 *
 * MMKV-backed storage for tracking moderation actions (blocks, mutes, reports)
 * with timestamps. Mirrors the web app's ModerationHistoryDB data model but
 * uses MMKV for synchronous React Native performance.
 */

import {MMKV} from 'react-native-mmkv';
import {createLogger} from '../utils/logger';

const logger = createLogger('ModerationHistory');

const STORAGE_KEY_BLOCKS = 'moderation_history_blocks';
const STORAGE_KEY_MUTES = 'moderation_history_mutes';
const STORAGE_KEY_REPORTS = 'moderation_history_reports';

const MAX_BLOCKS = 1000;
const MAX_MUTES = 1000;
const MAX_REPORTS = 500;
const MAX_AGE_MS = 365 * 24 * 60 * 60 * 1000; // 1 year

export type ModerationActionType = 'block' | 'mute' | 'report';

export type ReportReasonType =
  | 'spam'
  | 'violation'
  | 'misleading'
  | 'sexual'
  | 'rude'
  | 'other';

export interface BlockHistoryEntry {
  id: string; // block URI or generated ID
  subjectDid: string;
  subjectHandle?: string;
  subjectDisplayName?: string;
  createdAt: number;
  unblockedAt?: number;
  isActive: boolean;
}

export interface MuteHistoryEntry {
  id: string; // generated: subjectDid_timestamp
  subjectDid: string;
  subjectHandle?: string;
  subjectDisplayName?: string;
  createdAt: number;
  unmutedAt?: number;
  isActive: boolean;
}

export interface ReportHistoryEntry {
  id: string; // generated: subjectUri_timestamp
  subjectUri: string;
  subjectType: 'post' | 'account';
  subjectDid?: string;
  subjectHandle?: string;
  subjectDisplayName?: string;
  reason: string;
  reasonText?: string;
  createdAt: number;
  status: 'pending' | 'resolved' | 'unknown';
}

export interface ModerationHistoryStats {
  totalBlocks: number;
  activeBlocks: number;
  totalMutes: number;
  activeMutes: number;
  totalReports: number;
  pendingReports: number;
}

let _mmkv: InstanceType<typeof MMKV> | null = null;
function getStorage() {
  if (!_mmkv) {
    _mmkv = new MMKV({id: 'shadowsky-moderation-history'});
  }
  return _mmkv;
}

function readEntries<T>(key: string): T[] {
  try {
    const raw = getStorage().getString(key);
    if (!raw) return [];
    return JSON.parse(raw) as T[];
  } catch (e) {
    logger.error('Failed to read moderation history:', e);
    return [];
  }
}

function writeEntries<T>(key: string, entries: T[]): void {
  try {
    getStorage().set(key, JSON.stringify(entries));
  } catch (e) {
    logger.error('Failed to write moderation history:', e);
  }
}

// ==================== Block Operations ====================

export function recordBlock(entry: {
  id: string;
  subjectDid: string;
  subjectHandle?: string;
  subjectDisplayName?: string;
}): void {
  const blocks = readEntries<BlockHistoryEntry>(STORAGE_KEY_BLOCKS);
  const newEntry: BlockHistoryEntry = {
    ...entry,
    createdAt: Date.now(),
    isActive: true,
  };

  // Replace existing entry for same subject or add new
  const existingIdx = blocks.findIndex(
    (b) => b.subjectDid === entry.subjectDid && b.isActive,
  );
  if (existingIdx >= 0) {
    blocks[existingIdx] = newEntry;
  } else {
    blocks.unshift(newEntry);
  }

  // Enforce size limit
  const trimmed = blocks.slice(0, MAX_BLOCKS);
  writeEntries(STORAGE_KEY_BLOCKS, trimmed);
}

export function recordUnblock(subjectDid: string): void {
  const blocks = readEntries<BlockHistoryEntry>(STORAGE_KEY_BLOCKS);
  let changed = false;
  for (const block of blocks) {
    if (block.subjectDid === subjectDid && block.isActive) {
      block.isActive = false;
      block.unblockedAt = Date.now();
      changed = true;
    }
  }
  if (changed) {
    writeEntries(STORAGE_KEY_BLOCKS, blocks);
  }
}

export function getBlocks(activeOnly = false): BlockHistoryEntry[] {
  const blocks = readEntries<BlockHistoryEntry>(STORAGE_KEY_BLOCKS);
  if (activeOnly) {
    return blocks.filter((b) => b.isActive);
  }
  return blocks;
}

// ==================== Mute Operations ====================

export function recordMute(entry: {
  subjectDid: string;
  subjectHandle?: string;
  subjectDisplayName?: string;
}): void {
  const mutes = readEntries<MuteHistoryEntry>(STORAGE_KEY_MUTES);

  // Mark previous active mutes for this user as inactive
  for (const mute of mutes) {
    if (mute.subjectDid === entry.subjectDid && mute.isActive) {
      mute.isActive = false;
      mute.unmutedAt = Date.now();
    }
  }

  const now = Date.now();
  const newEntry: MuteHistoryEntry = {
    ...entry,
    id: `${entry.subjectDid}_${now}`,
    createdAt: now,
    isActive: true,
  };

  mutes.unshift(newEntry);

  // Enforce size limit
  const trimmed = mutes.slice(0, MAX_MUTES);
  writeEntries(STORAGE_KEY_MUTES, trimmed);
}

export function recordUnmute(subjectDid: string): void {
  const mutes = readEntries<MuteHistoryEntry>(STORAGE_KEY_MUTES);
  let changed = false;
  for (const mute of mutes) {
    if (mute.subjectDid === subjectDid && mute.isActive) {
      mute.isActive = false;
      mute.unmutedAt = Date.now();
      changed = true;
    }
  }
  if (changed) {
    writeEntries(STORAGE_KEY_MUTES, mutes);
  }
}

export function getMutes(activeOnly = false): MuteHistoryEntry[] {
  const mutes = readEntries<MuteHistoryEntry>(STORAGE_KEY_MUTES);
  if (activeOnly) {
    return mutes.filter((m) => m.isActive);
  }
  return mutes;
}

// ==================== Report Operations ====================

export function recordReport(entry: {
  subjectUri: string;
  subjectType: 'post' | 'account';
  subjectDid?: string;
  subjectHandle?: string;
  subjectDisplayName?: string;
  reason: string;
  reasonText?: string;
}): void {
  const reports = readEntries<ReportHistoryEntry>(STORAGE_KEY_REPORTS);
  const now = Date.now();
  const newEntry: ReportHistoryEntry = {
    ...entry,
    id: `${entry.subjectUri}_${now}`,
    createdAt: now,
    status: 'pending',
  };

  reports.unshift(newEntry);

  // Enforce size limit
  const trimmed = reports.slice(0, MAX_REPORTS);
  writeEntries(STORAGE_KEY_REPORTS, trimmed);
}

export function getReports(): ReportHistoryEntry[] {
  return readEntries<ReportHistoryEntry>(STORAGE_KEY_REPORTS);
}

// ==================== Stats ====================

export function getStats(): ModerationHistoryStats {
  const blocks = readEntries<BlockHistoryEntry>(STORAGE_KEY_BLOCKS);
  const mutes = readEntries<MuteHistoryEntry>(STORAGE_KEY_MUTES);
  const reports = readEntries<ReportHistoryEntry>(STORAGE_KEY_REPORTS);

  return {
    totalBlocks: blocks.length,
    activeBlocks: blocks.filter((b) => b.isActive).length,
    totalMutes: mutes.length,
    activeMutes: mutes.filter((m) => m.isActive).length,
    totalReports: reports.length,
    pendingReports: reports.filter((r) => r.status === 'pending').length,
  };
}

// ==================== Combined Query ====================

export type ModerationHistoryEntry =
  | (BlockHistoryEntry & {type: 'block'})
  | (MuteHistoryEntry & {type: 'mute'})
  | (ReportHistoryEntry & {type: 'report'});

export function getAllEntries(
  filter?: ModerationActionType,
): ModerationHistoryEntry[] {
  const entries: ModerationHistoryEntry[] = [];

  if (!filter || filter === 'block') {
    for (const b of getBlocks()) {
      entries.push({...b, type: 'block'});
    }
  }
  if (!filter || filter === 'mute') {
    for (const m of getMutes()) {
      entries.push({...m, type: 'mute'});
    }
  }
  if (!filter || filter === 'report') {
    for (const r of getReports()) {
      entries.push({...r, type: 'report'});
    }
  }

  // Sort by createdAt descending (most recent first)
  entries.sort((a, b) => b.createdAt - a.createdAt);
  return entries;
}

// ==================== API Sync ====================

export function syncBlocksFromApi(
  apiBlocks: Array<{
    did: string;
    handle?: string;
    displayName?: string;
    blockUri: string;
  }>,
): void {
  const existing = readEntries<BlockHistoryEntry>(STORAGE_KEY_BLOCKS);
  const existingByDid = new Map(existing.map((b) => [b.subjectDid, b]));
  const apiDidSet = new Set(apiBlocks.map((b) => b.did));

  let changed = false;

  for (const apiBlock of apiBlocks) {
    const entry = existingByDid.get(apiBlock.did);
    if (!entry) {
      // New block not in local store — add it
      existing.unshift({
        id: apiBlock.blockUri || `block_${apiBlock.did}_${Date.now()}`,
        subjectDid: apiBlock.did,
        subjectHandle: apiBlock.handle,
        subjectDisplayName: apiBlock.displayName,
        createdAt: Date.now(),
        isActive: true,
      });
      changed = true;
    } else {
      // Entry exists — ensure it's marked active and profile info is current
      if (!entry.isActive) {
        entry.isActive = true;
        entry.unblockedAt = undefined;
        changed = true;
      }
      if (apiBlock.handle && entry.subjectHandle !== apiBlock.handle) {
        entry.subjectHandle = apiBlock.handle;
        changed = true;
      }
      if (
        apiBlock.displayName &&
        entry.subjectDisplayName !== apiBlock.displayName
      ) {
        entry.subjectDisplayName = apiBlock.displayName;
        changed = true;
      }
    }
  }

  // Mark local blocks not found in API as inactive (unblocked elsewhere)
  for (const entry of existing) {
    if (entry.isActive && !apiDidSet.has(entry.subjectDid)) {
      entry.isActive = false;
      entry.unblockedAt = Date.now();
      changed = true;
    }
  }

  if (changed) {
    writeEntries(STORAGE_KEY_BLOCKS, existing.slice(0, MAX_BLOCKS));
  }
}

export function syncMutesFromApi(
  apiMutes: Array<{
    did: string;
    handle?: string;
    displayName?: string;
  }>,
): void {
  const existing = readEntries<MuteHistoryEntry>(STORAGE_KEY_MUTES);
  const existingActiveDids = new Set(
    existing.filter((m) => m.isActive).map((m) => m.subjectDid),
  );
  const apiDidSet = new Set(apiMutes.map((m) => m.did));

  let changed = false;

  for (const apiMute of apiMutes) {
    if (!existingActiveDids.has(apiMute.did)) {
      // New mute not in local store — add it
      const now = Date.now();
      existing.unshift({
        id: `${apiMute.did}_${now}`,
        subjectDid: apiMute.did,
        subjectHandle: apiMute.handle,
        subjectDisplayName: apiMute.displayName,
        createdAt: now,
        isActive: true,
      });
      changed = true;
    } else {
      // Update profile info on existing active entries
      for (const entry of existing) {
        if (entry.subjectDid === apiMute.did && entry.isActive) {
          if (apiMute.handle && entry.subjectHandle !== apiMute.handle) {
            entry.subjectHandle = apiMute.handle;
            changed = true;
          }
          if (
            apiMute.displayName &&
            entry.subjectDisplayName !== apiMute.displayName
          ) {
            entry.subjectDisplayName = apiMute.displayName;
            changed = true;
          }
          break;
        }
      }
    }
  }

  // Mark local mutes not found in API as inactive (unmuted elsewhere)
  for (const entry of existing) {
    if (entry.isActive && !apiDidSet.has(entry.subjectDid)) {
      entry.isActive = false;
      entry.unmutedAt = Date.now();
      changed = true;
    }
  }

  if (changed) {
    writeEntries(STORAGE_KEY_MUTES, existing.slice(0, MAX_MUTES));
  }
}

// ==================== Cleanup ====================

export function evictOldEntries(): void {
  const cutoff = Date.now() - MAX_AGE_MS;

  const blocks = readEntries<BlockHistoryEntry>(STORAGE_KEY_BLOCKS).filter(
    (b) => b.createdAt >= cutoff,
  );
  const mutes = readEntries<MuteHistoryEntry>(STORAGE_KEY_MUTES).filter(
    (m) => m.createdAt >= cutoff,
  );
  const reports = readEntries<ReportHistoryEntry>(STORAGE_KEY_REPORTS).filter(
    (r) => r.createdAt >= cutoff,
  );

  writeEntries(STORAGE_KEY_BLOCKS, blocks);
  writeEntries(STORAGE_KEY_MUTES, mutes);
  writeEntries(STORAGE_KEY_REPORTS, reports);
}

export function clearAll(): void {
  getStorage().delete(STORAGE_KEY_BLOCKS);
  getStorage().delete(STORAGE_KEY_MUTES);
  getStorage().delete(STORAGE_KEY_REPORTS);
}
