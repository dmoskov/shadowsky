/**
 * Types for Collaborative Lists feature
 *
 * Collaborative lists allow multiple users to curate content together.
 * Lists can contain accounts, posts, or topics and support both
 * public and private visibility with role-based permissions.
 */

export type ListVisibility = "public" | "private";

export type CollaboratorRole = "owner" | "admin" | "editor" | "viewer";

export type ListItemType = "account" | "post" | "topic";

/**
 * Represents a collaborative list with ownership and permissions
 */
export interface CollaborativeList {
  id: string;
  name: string;
  description?: string;
  avatar?: string;
  visibility: ListVisibility;
  ownerDid: string;
  createdAt: string;
  updatedAt: string;
  itemCount: number;
  followerCount: number;
  collaboratorCount: number;
  itemType: ListItemType;
  tags?: string[];
}

/**
 * Extended list data for detailed views
 */
export interface CollaborativeListDetails extends CollaborativeList {
  collaborators: ListCollaborator[];
  items: ListItem[];
  followers: ListFollower[];
  recentActivity: ListActivity[];
}

/**
 * Collaborator on a list with their role and permissions
 */
export interface ListCollaborator {
  did: string;
  handle: string;
  displayName?: string;
  avatar?: string;
  role: CollaboratorRole;
  addedAt: string;
  addedBy: string;
  lastActive?: string;
}

/**
 * Individual item in a collaborative list
 */
export interface ListItem {
  id: string;
  listId: string;
  type: ListItemType;
  targetUri: string;
  addedAt: string;
  addedBy: string;
  note?: string;
  // For account items
  accountDid?: string;
  accountHandle?: string;
  accountDisplayName?: string;
  accountAvatar?: string;
  // For post items
  postUri?: string;
  postText?: string;
  postAuthorHandle?: string;
  // For topic items
  topicName?: string;
  topicHashtag?: string;
}

/**
 * User following a list
 */
export interface ListFollower {
  did: string;
  handle: string;
  displayName?: string;
  avatar?: string;
  followedAt: string;
}

/**
 * Activity log entry for a list
 */
export interface ListActivity {
  id: string;
  listId: string;
  type: ListActivityType;
  actorDid: string;
  actorHandle: string;
  actorDisplayName?: string;
  timestamp: string;
  details?: Record<string, unknown>;
}

export type ListActivityType =
  | "item_added"
  | "item_removed"
  | "collaborator_added"
  | "collaborator_removed"
  | "role_changed"
  | "list_updated"
  | "list_created";

/**
 * Invitation to join a collaborative list
 */
export interface ListInvitation {
  id: string;
  listId: string;
  listName: string;
  inviterDid: string;
  inviterHandle: string;
  inviteeDid: string;
  role: CollaboratorRole;
  createdAt: string;
  expiresAt?: string;
  status: "pending" | "accepted" | "declined" | "expired";
}

/**
 * Discovery/search result for collaborative lists
 */
export interface DiscoverableList {
  id: string;
  name: string;
  description?: string;
  avatar?: string;
  ownerHandle: string;
  ownerDisplayName?: string;
  itemCount: number;
  followerCount: number;
  collaboratorCount: number;
  tags?: string[];
  itemType: ListItemType;
  isFollowing?: boolean;
}

/**
 * Create list request payload
 */
export interface CreateCollaborativeListRequest {
  name: string;
  description?: string;
  visibility: ListVisibility;
  itemType: ListItemType;
  tags?: string[];
}

/**
 * Update list request payload
 */
export interface UpdateCollaborativeListRequest {
  name?: string;
  description?: string;
  visibility?: ListVisibility;
  tags?: string[];
}

/**
 * Add collaborator request payload
 */
export interface AddCollaboratorRequest {
  listId: string;
  userDid: string;
  role: CollaboratorRole;
}

/**
 * Add item request payload
 */
export interface AddListItemRequest {
  listId: string;
  type: ListItemType;
  targetUri: string;
  note?: string;
}

/**
 * Role permission definitions
 */
export const ROLE_PERMISSIONS: Record<
  CollaboratorRole,
  {
    canAddItems: boolean;
    canRemoveItems: boolean;
    canInviteCollaborators: boolean;
    canRemoveCollaborators: boolean;
    canEditListDetails: boolean;
    canDeleteList: boolean;
    canChangeRoles: boolean;
  }
> = {
  owner: {
    canAddItems: true,
    canRemoveItems: true,
    canInviteCollaborators: true,
    canRemoveCollaborators: true,
    canEditListDetails: true,
    canDeleteList: true,
    canChangeRoles: true,
  },
  admin: {
    canAddItems: true,
    canRemoveItems: true,
    canInviteCollaborators: true,
    canRemoveCollaborators: true,
    canEditListDetails: true,
    canDeleteList: false,
    canChangeRoles: true,
  },
  editor: {
    canAddItems: true,
    canRemoveItems: true,
    canInviteCollaborators: false,
    canRemoveCollaborators: false,
    canEditListDetails: false,
    canDeleteList: false,
    canChangeRoles: false,
  },
  viewer: {
    canAddItems: false,
    canRemoveItems: false,
    canInviteCollaborators: false,
    canRemoveCollaborators: false,
    canEditListDetails: false,
    canDeleteList: false,
    canChangeRoles: false,
  },
};

/**
 * Check if a role has a specific permission
 */
export function hasPermission(
  role: CollaboratorRole,
  permission: keyof (typeof ROLE_PERMISSIONS)[CollaboratorRole],
): boolean {
  return ROLE_PERMISSIONS[role][permission];
}

/**
 * Get display name for a role
 */
export function getRoleDisplayName(role: CollaboratorRole): string {
  switch (role) {
    case "owner":
      return "Owner";
    case "admin":
      return "Admin";
    case "editor":
      return "Editor";
    case "viewer":
      return "Viewer";
  }
}

/**
 * Get display name for list item type
 */
export function getItemTypeDisplayName(type: ListItemType): string {
  switch (type) {
    case "account":
      return "Accounts";
    case "post":
      return "Posts";
    case "topic":
      return "Topics";
  }
}
