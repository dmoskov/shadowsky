import React from 'react';
import { ReplyContext } from '../ui/ReplyContext';
import { PostEmbeds } from './PostEmbeds';
import type { FeedItem, Post } from '@bsky/shared/types/atproto';
import { getPostText } from '../../utils/post-helpers';

interface PostContentProps {
  item: FeedItem;
  post: Post;
  showParentPost?: boolean;
  onViewThread?: (uri: string) => void;
}

export const PostContent: React.FC<PostContentProps> = ({ 
  item, 
  post, 
  showParentPost = false,
  onViewThread 
}) => {
  const postText = getPostText(post);
  
  return (
    <div className="post-content">
      {/* Reply context */}
      {item.reply && !showParentPost && (
        <ReplyContext reply={item.reply} post={post} />
      )}
      
      {/* Text content */}
      <p className="post-text">{postText}</p>
      
      {/* Embeds (images, quotes, links) */}
      <PostEmbeds post={post} onViewThread={onViewThread} />
    </div>
  );
};