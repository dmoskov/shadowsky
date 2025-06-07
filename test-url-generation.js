import { atUriToWebUrl } from './src/utils/url-helpers.js';

// Test cases
const testCases = [
  {
    uri: 'at://did:plc:z72i7hdynmk6r22z27h6tvur/app.bsky.feed.post/3jt2wqzwlhk2x',
    handle: 'alice.bsky.social',
    expected: 'https://bsky.app/profile/alice.bsky.social/post/3jt2wqzwlhk2x'
  },
  {
    uri: 'at://did:plc:abc123/app.bsky.feed.post/xyz789',
    handle: 'test.user',
    expected: 'https://bsky.app/profile/test.user/post/xyz789'
  },
  {
    uri: 'at://did:plc:def456/app.bsky.actor.profile/self',
    handle: 'another.user',
    expected: 'https://bsky.app/profile/another.user'
  }
];

console.log('Testing AT URI to Web URL conversion:\n');

testCases.forEach(({ uri, handle, expected }) => {
  const result = atUriToWebUrl(uri, handle);
  const passed = result === expected;
  
  console.log(`URI: ${uri}`);
  console.log(`Handle: ${handle}`);
  console.log(`Expected: ${expected}`);
  console.log(`Got: ${result}`);
  console.log(`Status: ${passed ? '✅ PASS' : '❌ FAIL'}\n`);
});