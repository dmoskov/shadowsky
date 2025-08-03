import React from 'react';
import { NotificationsFeed } from './NotificationsFeed';

export const Notifications: React.FC = () => {
  return (
    <div className="h-full overflow-y-auto p-4">
      <div className="max-w-3xl mx-auto">
        <div className="bsky-glass rounded-xl overflow-hidden">
          <NotificationsFeed />
        </div>
      </div>
    </div>
  );
};