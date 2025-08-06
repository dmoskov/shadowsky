/**
 * Shared type definitions
 */


export type { Session } from './client'

export interface Notification {
  id?: string
  uri: string
  cid: string
  author: {
    did: string
    handle: string
    displayName?: string
    avatar?: string
  }
  reason: string
  reasonSubject?: string
  record?: any
  isRead: boolean
  indexedAt: string
  labels?: Label[]
}

export interface Label {
  src: string
  uri: string
  val: string
  cts: string
}

export interface Post {
  uri: string
  cid: string
  author: {
    did: string
    handle: string
    displayName?: string
    avatar?: string
  }
  record: {
    text: string
    createdAt: string
    [key: string]: any
  }
  replyCount?: number
  repostCount?: number
  likeCount?: number
  indexedAt: string
  viewer?: {
    repost?: string
    like?: string
  }
}

export interface Thread {
  post: Post
  parent?: Thread | { uri: string; notFound: true }
  replies?: Thread[]
}

export interface FeedViewPost {
  post: Post
  reply?: {
    root: Post
    parent: Post
  }
  reason?: {
    $type: string
    by: {
      did: string
      handle: string
    }
    indexedAt: string
  }
}