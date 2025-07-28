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

export const PostContentTailwind: React.FC<PostContentProps> = ({ 
  item, 
  post, 
  showParentPost = false,
  onViewThread 
}) => {
  const postText = getPostText(post);
  
  return (
    <div className="twmb-2">
      {/* Reply context - TODO: implement ReplyContext component */}
      {item.reply && !showParentPost && (
        <div className="twtext-gray-500 twtext-sm twmb-2">
          <span>↳ Reply</span>
        </div>
      )}
      
      {/* Text content */}
      <p className="twtext-sm twleading-relaxed twtext-text-primary twwhitespace-pre-wrap twbreak-words twmb-2">
        {postText}
      </p>
      
      {/* Embeds (images, quotes, links) */}
      <PostEmbeds post={post} onViewThread={onViewThread} />
    </div>
  );
};