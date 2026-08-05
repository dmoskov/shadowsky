/**
 * Tests for the mobile post-edit service wrapper.
 *
 * The AT Protocol mechanics live in @bsky/core and are tested there. What is
 * mobile's own responsibility, and therefore what is tested here: delegating to
 * the shared primitive with the singleton agent, recomputing facets against the
 * new text, and routing the write through the RECORD rate limiter.
 */

const mockRateLimited = jest.fn(
  (fn: () => unknown, _type: unknown) => (fn as () => unknown)(),
);
const mockEditPostText = jest.fn();
const mockAgent = { session: { did: 'did:plc:me' } };

jest.mock('../../rate-limiter', () => ({
  rateLimited: (fn: () => unknown, type: unknown) => mockRateLimited(fn, type),
  ATProtoEndpointType: { RECORD: 'record', FEED: 'feed' },
}));

jest.mock('../client', () => ({
  getAtProtoClient: () => ({ getAgent: () => mockAgent }),
}));

jest.mock('@bsky/core', () => ({
  postEdit: {
    editPostText: (...args: unknown[]) => mockEditPostText(...args),
    canEditPost: jest.fn(),
    describeEditCost: jest.fn(),
    getEditedAt: jest.fn(),
    isEdited: jest.fn(),
    EDIT_WINDOW_MS: 15 * 60 * 1000,
  },
}));

import { editPostText, EDIT_WINDOW_MS } from '../post-edit';

describe('editPostText', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRateLimited.mockImplementation((fn: () => unknown) =>
      (fn as () => unknown)(),
    );
    mockEditPostText.mockResolvedValue({
      uri: 'at://did:plc:me/app.bsky.feed.post/abc',
      cid: 'bafynew',
      editedAt: '2025-01-01T00:00:00.000Z',
    });
  });

  it('delegates to the shared primitive with the singleton agent', async () => {
    await editPostText({
      uri: 'at://did:plc:me/app.bsky.feed.post/abc',
      text: 'fixed typo',
    });

    expect(mockEditPostText).toHaveBeenCalledTimes(1);
    const [agent, params] = mockEditPostText.mock.calls[0];
    expect(agent).toBe(mockAgent);
    expect(params.uri).toBe('at://did:plc:me/app.bsky.feed.post/abc');
    expect(params.text).toBe('fixed typo');
  });

  it('throttles the write as a RECORD-class endpoint', async () => {
    await editPostText({ uri: 'at://did:plc:me/app.bsky.feed.post/abc', text: 'x' });

    expect(mockRateLimited).toHaveBeenCalledTimes(1);
    expect(mockRateLimited.mock.calls[0][1]).toBe('record');
  });

  it('recomputes facets from the new text when none are supplied', async () => {
    // The old byte offsets cannot survive a text change, so something must
    // re-detect them; the wrapper does it because detection needs the agent.
    await editPostText({
      uri: 'at://did:plc:me/app.bsky.feed.post/abc',
      text: 'see https://example.com now',
    });

    const [, params] = mockEditPostText.mock.calls[0];
    expect(params.facets).toHaveLength(1);
    expect(params.facets[0].features[0].$type).toBe(
      'app.bsky.richtext.facet#link',
    );
    // Offsets are byte-based and must point at the link within the new text.
    const { byteStart, byteEnd } = params.facets[0].index;
    expect('see https://example.com now'.slice(byteStart, byteEnd)).toBe(
      'https://example.com',
    );
  });

  it('passes through explicitly supplied facets without re-detecting', async () => {
    const facets = [
      {
        index: { byteStart: 0, byteEnd: 4 },
        features: [{ $type: 'app.bsky.richtext.facet#tag', tag: 'hi' }],
      },
    ];

    await editPostText({
      uri: 'at://did:plc:me/app.bsky.feed.post/abc',
      text: 'plain text with no detectable entities',
      facets: facets as never,
    });

    const [, params] = mockEditPostText.mock.calls[0];
    expect(params.facets).toBe(facets);
  });

  it('leaves facets undefined when the new text has no entities', async () => {
    await editPostText({
      uri: 'at://did:plc:me/app.bsky.feed.post/abc',
      text: 'just words',
    });

    const [, params] = mockEditPostText.mock.calls[0];
    expect(params.facets).toBeUndefined();
  });

  it('surfaces failures rather than swallowing them', async () => {
    mockEditPostText.mockRejectedValue(new Error('swapRecord mismatch'));

    await expect(
      editPostText({ uri: 'at://did:plc:me/app.bsky.feed.post/abc', text: 'x' }),
    ).rejects.toThrow('swapRecord mismatch');
  });
});

describe('re-exports', () => {
  it('exposes the shared edit window so callers agree on its length', () => {
    expect(EDIT_WINDOW_MS).toBe(15 * 60 * 1000);
  });
});
