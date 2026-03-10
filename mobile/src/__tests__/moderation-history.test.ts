import {
  recordBlock,
  recordUnblock,
  getBlocks,
  recordMute,
  recordUnmute,
  getMutes,
  recordReport,
  getReports,
  getAllEntries,
  getStats,
  clearAll,
  syncBlocksFromApi,
  syncMutesFromApi,
} from '../services/moderation-history';

// The MMKV mock in jest.setup.js uses a shared Map per MMKV instance.
// Because the service lazily creates a single MMKV instance, all tests
// share the same backing store. We clear between tests via clearAll().

beforeEach(() => {
  clearAll();
});

describe('moderation-history service', () => {
  // ==================== Block Operations ====================

  describe('blocks', () => {
    it('records and retrieves a block', () => {
      recordBlock({
        id: 'at://did:plc:abc/app.bsky.graph.block/123',
        subjectDid: 'did:plc:target1',
        subjectHandle: 'user1.bsky.social',
        subjectDisplayName: 'User One',
      });

      const blocks = getBlocks();
      expect(blocks).toHaveLength(1);
      expect(blocks[0].subjectDid).toBe('did:plc:target1');
      expect(blocks[0].subjectHandle).toBe('user1.bsky.social');
      expect(blocks[0].isActive).toBe(true);
      expect(blocks[0].createdAt).toBeGreaterThan(0);
    });

    it('replaces an existing active block for the same DID', () => {
      recordBlock({
        id: 'block-uri-1',
        subjectDid: 'did:plc:target1',
        subjectHandle: 'old-handle.bsky.social',
      });

      recordBlock({
        id: 'block-uri-2',
        subjectDid: 'did:plc:target1',
        subjectHandle: 'new-handle.bsky.social',
      });

      const blocks = getBlocks();
      // Should replace, not duplicate
      const activeForTarget = blocks.filter(
        (b) => b.subjectDid === 'did:plc:target1' && b.isActive,
      );
      expect(activeForTarget).toHaveLength(1);
      expect(activeForTarget[0].subjectHandle).toBe('new-handle.bsky.social');
    });

    it('records unblock', () => {
      recordBlock({
        id: 'block-uri-1',
        subjectDid: 'did:plc:target1',
      });

      recordUnblock('did:plc:target1');

      const blocks = getBlocks();
      expect(blocks[0].isActive).toBe(false);
      expect(blocks[0].unblockedAt).toBeGreaterThan(0);
    });

    it('filters active-only blocks', () => {
      recordBlock({id: 'b1', subjectDid: 'did:plc:a'});
      recordBlock({id: 'b2', subjectDid: 'did:plc:b'});
      recordUnblock('did:plc:a');

      expect(getBlocks(true)).toHaveLength(1);
      expect(getBlocks(true)[0].subjectDid).toBe('did:plc:b');
      expect(getBlocks(false)).toHaveLength(2);
    });
  });

  // ==================== Mute Operations ====================

  describe('mutes', () => {
    it('records and retrieves a mute', () => {
      recordMute({
        subjectDid: 'did:plc:muted1',
        subjectHandle: 'muted.bsky.social',
      });

      const mutes = getMutes();
      expect(mutes).toHaveLength(1);
      expect(mutes[0].subjectDid).toBe('did:plc:muted1');
      expect(mutes[0].isActive).toBe(true);
      expect(mutes[0].id).toContain('did:plc:muted1');
    });

    it('deactivates previous mute when re-muting same user', () => {
      recordMute({subjectDid: 'did:plc:muted1'});
      recordMute({subjectDid: 'did:plc:muted1'});

      const mutes = getMutes();
      const active = mutes.filter(
        (m) => m.subjectDid === 'did:plc:muted1' && m.isActive,
      );
      expect(active).toHaveLength(1);
    });

    it('records unmute', () => {
      recordMute({subjectDid: 'did:plc:muted1'});
      recordUnmute('did:plc:muted1');

      const mutes = getMutes();
      expect(mutes[0].isActive).toBe(false);
      expect(mutes[0].unmutedAt).toBeGreaterThan(0);
    });

    it('filters active-only mutes', () => {
      recordMute({subjectDid: 'did:plc:a'});
      recordMute({subjectDid: 'did:plc:b'});
      recordUnmute('did:plc:a');

      expect(getMutes(true)).toHaveLength(1);
      expect(getMutes(true)[0].subjectDid).toBe('did:plc:b');
    });
  });

  // ==================== Report Operations ====================

  describe('reports', () => {
    it('records and retrieves a report', () => {
      recordReport({
        subjectUri: 'at://did:plc:abc/app.bsky.feed.post/xyz',
        subjectType: 'post',
        subjectDid: 'did:plc:abc',
        reason: 'spam',
        reasonText: 'Obvious spam post',
      });

      const reports = getReports();
      expect(reports).toHaveLength(1);
      expect(reports[0].reason).toBe('spam');
      expect(reports[0].status).toBe('pending');
      expect(reports[0].subjectType).toBe('post');
    });

    it('records multiple reports', () => {
      recordReport({
        subjectUri: 'at://did:plc:abc/app.bsky.feed.post/1',
        subjectType: 'post',
        reason: 'spam',
      });
      recordReport({
        subjectUri: 'at://did:plc:def/app.bsky.feed.post/2',
        subjectType: 'account',
        subjectDid: 'did:plc:def',
        reason: 'violation',
      });

      expect(getReports()).toHaveLength(2);
    });
  });

  // ==================== Combined Query ====================

  describe('getAllEntries', () => {
    beforeEach(() => {
      recordBlock({id: 'b1', subjectDid: 'did:plc:blocked'});
      recordMute({subjectDid: 'did:plc:muted'});
      recordReport({
        subjectUri: 'at://did:plc:x/post/1',
        subjectType: 'post',
        reason: 'spam',
      });
    });

    it('returns all entries when no filter', () => {
      const all = getAllEntries();
      expect(all).toHaveLength(3);
    });

    it('filters by type', () => {
      expect(getAllEntries('block')).toHaveLength(1);
      expect(getAllEntries('mute')).toHaveLength(1);
      expect(getAllEntries('report')).toHaveLength(1);
    });

    it('entries are sorted by createdAt descending', () => {
      const all = getAllEntries();
      for (let i = 1; i < all.length; i++) {
        expect(all[i - 1].createdAt).toBeGreaterThanOrEqual(all[i].createdAt);
      }
    });

    it('entries have correct type tag', () => {
      const all = getAllEntries();
      const types = all.map((e) => e.type).sort();
      expect(types).toEqual(['block', 'mute', 'report']);
    });
  });

  // ==================== Stats ====================

  describe('getStats', () => {
    it('returns correct stats', () => {
      recordBlock({id: 'b1', subjectDid: 'did:plc:a'});
      recordBlock({id: 'b2', subjectDid: 'did:plc:b'});
      recordUnblock('did:plc:a');
      recordMute({subjectDid: 'did:plc:c'});
      recordReport({
        subjectUri: 'at://x/post/1',
        subjectType: 'post',
        reason: 'spam',
      });

      const stats = getStats();
      expect(stats.totalBlocks).toBe(2);
      expect(stats.activeBlocks).toBe(1);
      expect(stats.totalMutes).toBe(1);
      expect(stats.activeMutes).toBe(1);
      expect(stats.totalReports).toBe(1);
      expect(stats.pendingReports).toBe(1);
    });

    it('returns zeros when empty', () => {
      const stats = getStats();
      expect(stats.totalBlocks).toBe(0);
      expect(stats.activeBlocks).toBe(0);
      expect(stats.totalMutes).toBe(0);
      expect(stats.activeMutes).toBe(0);
      expect(stats.totalReports).toBe(0);
      expect(stats.pendingReports).toBe(0);
    });
  });

  // ==================== API Sync ====================

  describe('syncBlocksFromApi', () => {
    it('adds new blocks from API', () => {
      syncBlocksFromApi([
        {did: 'did:plc:a', handle: 'a.bsky.social', displayName: 'A', blockUri: 'uri1'},
        {did: 'did:plc:b', handle: 'b.bsky.social', displayName: 'B', blockUri: 'uri2'},
      ]);

      const blocks = getBlocks();
      expect(blocks).toHaveLength(2);
      expect(blocks.every((b) => b.isActive)).toBe(true);
    });

    it('marks removed blocks as inactive', () => {
      recordBlock({id: 'uri1', subjectDid: 'did:plc:a'});
      recordBlock({id: 'uri2', subjectDid: 'did:plc:b'});

      // API only has 'a' — 'b' was unblocked elsewhere
      syncBlocksFromApi([
        {did: 'did:plc:a', blockUri: 'uri1'},
      ]);

      const blocks = getBlocks();
      const active = blocks.filter((b) => b.isActive);
      const inactive = blocks.filter((b) => !b.isActive);
      expect(active).toHaveLength(1);
      expect(active[0].subjectDid).toBe('did:plc:a');
      expect(inactive).toHaveLength(1);
      expect(inactive[0].subjectDid).toBe('did:plc:b');
    });

    it('updates profile info on existing blocks', () => {
      recordBlock({
        id: 'uri1',
        subjectDid: 'did:plc:a',
        subjectHandle: 'old.bsky.social',
      });

      syncBlocksFromApi([
        {did: 'did:plc:a', handle: 'new.bsky.social', displayName: 'New Name', blockUri: 'uri1'},
      ]);

      const blocks = getBlocks();
      expect(blocks[0].subjectHandle).toBe('new.bsky.social');
      expect(blocks[0].subjectDisplayName).toBe('New Name');
    });
  });

  describe('syncMutesFromApi', () => {
    it('adds new mutes from API', () => {
      syncMutesFromApi([
        {did: 'did:plc:a', handle: 'a.bsky.social'},
        {did: 'did:plc:b', handle: 'b.bsky.social'},
      ]);

      const mutes = getMutes();
      expect(mutes).toHaveLength(2);
      expect(mutes.every((m) => m.isActive)).toBe(true);
    });

    it('marks removed mutes as inactive', () => {
      recordMute({subjectDid: 'did:plc:a'});
      recordMute({subjectDid: 'did:plc:b'});

      syncMutesFromApi([{did: 'did:plc:a'}]);

      const active = getMutes(true);
      expect(active).toHaveLength(1);
      expect(active[0].subjectDid).toBe('did:plc:a');
    });
  });

  // ==================== Cleanup ====================

  describe('clearAll', () => {
    it('removes all entries', () => {
      recordBlock({id: 'b1', subjectDid: 'did:plc:a'});
      recordMute({subjectDid: 'did:plc:b'});
      recordReport({
        subjectUri: 'at://x/post/1',
        subjectType: 'post',
        reason: 'spam',
      });

      clearAll();

      expect(getBlocks()).toHaveLength(0);
      expect(getMutes()).toHaveLength(0);
      expect(getReports()).toHaveLength(0);
      expect(getAllEntries()).toHaveLength(0);
    });
  });
});
