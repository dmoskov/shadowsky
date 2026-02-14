/**
 * Scheduled Posts Service
 * Manages queued posts stored in AsyncStorage
 */

import AsyncStorage from '@react-native-async-storage/async-storage';


import { createLogger } from '../utils/logger';

const logger = createLogger('ScheduledPosts');
const SCHEDULED_POSTS_KEY = '@shadowsky/scheduled_posts';

export interface ScheduledPost {
  id: string;
  text: string;
  scheduledTime: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface ScheduledPostInput {
  text: string;
  scheduledTime: Date;
}

/**
 * Get all scheduled posts
 */
export async function getScheduledPosts(): Promise<ScheduledPost[]> {
  try {
    const data = await AsyncStorage.getItem(SCHEDULED_POSTS_KEY);
    if (!data) {
      return [];
    }

    const posts = JSON.parse(data) as ScheduledPost[];

    // Convert date strings back to Date objects
    return posts.map(post => ({
      ...post,
      scheduledTime: new Date(post.scheduledTime),
      createdAt: new Date(post.createdAt),
      updatedAt: new Date(post.updatedAt),
    }));
  } catch (error) {
    logger.error('Failed to load scheduled posts:', error);
    return [];
  }
}

/**
 * Add a new scheduled post
 */
export async function addScheduledPost(input: ScheduledPostInput): Promise<ScheduledPost> {
  const posts = await getScheduledPosts();

  const newPost: ScheduledPost = {
    id: `scheduled_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    text: input.text,
    scheduledTime: input.scheduledTime,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  posts.push(newPost);
  await AsyncStorage.setItem(SCHEDULED_POSTS_KEY, JSON.stringify(posts));

  return newPost;
}

/**
 * Update an existing scheduled post
 */
export async function updateScheduledPost(
  id: string,
  updates: Partial<Pick<ScheduledPost, 'text' | 'scheduledTime'>>
): Promise<ScheduledPost | null> {
  const posts = await getScheduledPosts();
  const index = posts.findIndex(post => post.id === id);

  if (index === -1) {
    return null;
  }

  const updatedPost = {
    ...posts[index],
    ...updates,
    updatedAt: new Date(),
  };

  posts[index] = updatedPost;
  await AsyncStorage.setItem(SCHEDULED_POSTS_KEY, JSON.stringify(posts));

  return updatedPost;
}

/**
 * Delete a scheduled post
 */
export async function deleteScheduledPost(id: string): Promise<boolean> {
  const posts = await getScheduledPosts();
  const filteredPosts = posts.filter(post => post.id !== id);

  if (filteredPosts.length === posts.length) {
    return false; // Post not found
  }

  await AsyncStorage.setItem(SCHEDULED_POSTS_KEY, JSON.stringify(filteredPosts));
  return true;
}

/**
 * Clear all scheduled posts
 */
export async function clearScheduledPosts(): Promise<void> {
  await AsyncStorage.removeItem(SCHEDULED_POSTS_KEY);
}
