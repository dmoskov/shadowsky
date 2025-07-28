import React from 'react';
import { PostEmbeds } from './PostEmbeds';
import type { FeedItem, Post } from '@bsky/shared';
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
      {/* Reply context - TODO: implement ReplyContext component */}
      {item.reply && !showParentPost && (
        <div className="reply-context">
          <span>↳ Reply</span>
        </div>
      )}
      
      {/* Text content */}
      <p className="post-text">{postText}</p>
      
      {/* Embeds (images, quotes, links) */}
      <PostEmbeds post={post} onViewThread={onViewThread} />
    </div>
  );
};