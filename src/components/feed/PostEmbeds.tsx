import React from 'react';
import { motion } from 'framer-motion';
import { Link } from 'lucide-react';
import type { Post } from '../../types/atproto';
import { hasQuoteEmbed, hasImageEmbed, hasExternalEmbed, getExternalEmbed, getImageEmbed, getQuoteEmbed } from '../../utils/post-helpers';

interface PostEmbedsProps {
  post: Post;
  onViewThread?: (uri: string) => void;
}

export const PostEmbeds: React.FC<PostEmbedsProps> = ({ post, onViewThread }) => {
  // Quoted Post
  if (hasQuoteEmbed(post)) {
    const quote = getQuoteEmbed(post);
    if (!quote) return null;

    const quotedAuthor = quote.author;
    const quotedText = quote.value?.text || '';

    return (
      <motion.div 
        className="quoted-post"
        onClick={(e) => {
          e.stopPropagation();
          if (quote.uri && onViewThread) {
            onViewThread(quote.uri);
          }
        }}
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
      >
        <div className="quoted-post-header">
          <img 
            src={quotedAuthor?.avatar || '/default-avatar.png'} 
            alt={quotedAuthor?.handle || 'User'}
            className="quoted-post-avatar"
          />
          <div className="quoted-post-author">
            <span className="author-name text-sm">
              {quotedAuthor?.displayName || quotedAuthor?.handle || 'Unknown User'}
            </span>
            <span className="text-secondary text-caption">
              @{quotedAuthor?.handle || 'unknown'}
            </span>
          </div>
        </div>
        <p className="quoted-post-text text-sm">{quotedText}</p>
      </motion.div>
    );
  }

  // Images
  if (hasImageEmbed(post)) {
    const images = getImageEmbed(post);
    if (!images) return null;

    return (
      <div className={`post-images post-images-${images.length}`}>
        {images.map((img, index) => (
          <motion.img
            key={index}
            src={img.thumb}
            alt={img.alt || `Image ${index + 1}`}
            className="post-image"
            loading="lazy"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={(e) => {
              e.stopPropagation();
              // TODO: Open lightbox with fullsize image
            }}
          />
        ))}
      </div>
    );
  }

  // External Links
  if (hasExternalEmbed(post)) {
    const external = getExternalEmbed(post);
    if (!external) return null;

    return (
      <motion.a
        href={external.uri}
        target="_blank"
        rel="noopener noreferrer"
        className="external-link-card"
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
      >
        {external.thumb && (
          <img
            src={external.thumb}
            alt=""
            className="link-thumbnail"
          />
        )}
        <div className="link-content">
          <h4 className="link-title">{external.title}</h4>
          <p className="link-description text-secondary">
            {external.description}
          </p>
          <span className="link-url text-tertiary">
            <Link size={12} />
            {new URL(external.uri).hostname}
          </span>
        </div>
      </motion.a>
    );
  }

  return null;
};