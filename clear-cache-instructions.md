# How to Clear Analytics Cache

If you're still seeing your own stats instead of @chancethelawyer.bsky.social:

## Option 1: Browser DevTools

1. Open DevTools (F12 or right-click → Inspect)
2. Go to the Application/Storage tab
3. Clear Site Data or just IndexedDB/LocalStorage

## Option 2: Console Commands

Open the browser console and run:

```javascript
// Clear all localStorage
localStorage.clear();

// Clear IndexedDB (if used)
indexedDB.databases().then((dbs) => {
  dbs.forEach((db) => indexedDB.deleteDatabase(db.name));
});

// Force reload
location.reload();
```

## Option 3: Use Incognito/Private Window

Open the app in an incognito/private browsing window - this will have no cached data.

The cache breaker has been added to the code, so a simple page refresh should now show @chancethelawyer.bsky.social's stats.

## Important Note:

The "Activity Timeline" chart that shows received notifications (likes, reposts, follows, etc.) will STILL show YOUR notifications, not @chancethelawyer.bsky.social's. This is because the AT Protocol API only allows fetching notifications for the authenticated user.

What HAS changed:

- "Your Activity" section - shows @chancethelawyer.bsky.social's posts and profile stats
- "Users You Engage With Most" (when set to "Sent") - shows who @chancethelawyer.bsky.social interacts with
- Post counts, follower counts, etc. - all show @chancethelawyer.bsky.social's data

What HASN'T changed:

- "Activity Timeline" (Received) - still shows YOUR notifications
- "Top Users Engaging With You" - still shows who engages with YOU
