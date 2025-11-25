import {
  Crown,
  Edit3,
  Eye,
  Shield,
  UserMinus,
  UserPlus,
  X,
} from "lucide-react";
import React, { useEffect, useState } from "react";
import { useAuth } from "../../contexts/AuthContext";
import { collaborativeListService } from "../../services/collaborative-list-service";
import {
  CollaborativeList,
  CollaboratorRole,
  getRoleDisplayName,
  hasPermission,
  ListCollaborator,
} from "../../types/collaborative-list";

interface ManageCollaboratorsModalProps {
  list: CollaborativeList;
  onClose: () => void;
  onUpdate: () => void;
}

const ROLE_ICONS: Record<CollaboratorRole, React.ReactNode> = {
  owner: <Crown className="h-4 w-4" />,
  admin: <Shield className="h-4 w-4" />,
  editor: <Edit3 className="h-4 w-4" />,
  viewer: <Eye className="h-4 w-4" />,
};

const ROLE_COLORS: Record<CollaboratorRole, string> = {
  owner:
    "text-yellow-600 bg-yellow-100 dark:text-yellow-400 dark:bg-yellow-900/30",
  admin:
    "text-purple-600 bg-purple-100 dark:text-purple-400 dark:bg-purple-900/30",
  editor: "text-blue-600 bg-blue-100 dark:text-blue-400 dark:bg-blue-900/30",
  viewer: "text-gray-600 bg-gray-100 dark:text-gray-400 dark:bg-gray-700",
};

export const ManageCollaboratorsModal: React.FC<
  ManageCollaboratorsModalProps
> = ({ list, onClose, onUpdate }) => {
  const { agent } = useAuth();
  const [collaborators, setCollaborators] = useState<ListCollaborator[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [inviteHandle, setInviteHandle] = useState("");
  const [inviteRole, setInviteRole] = useState<CollaboratorRole>("editor");
  const [isInviting, setIsInviting] = useState(false);
  const [currentUserRole, setCurrentUserRole] =
    useState<CollaboratorRole | null>(null);

  useEffect(() => {
    loadCollaborators();
  }, [list.id]);

  const loadCollaborators = async () => {
    if (!agent) return;

    try {
      setIsLoading(true);
      await collaborativeListService.initialize(agent);

      const [collabs, role] = await Promise.all([
        collaborativeListService.getCollaborators(list.id),
        collaborativeListService.getUserRole(list.id),
      ]);

      setCollaborators(collabs);
      setCurrentUserRole(role);
    } catch (err) {
      setError("Failed to load collaborators");
    } finally {
      setIsLoading(false);
    }
  };

  const handleInvite = async () => {
    if (!agent || !inviteHandle.trim()) return;

    try {
      setIsInviting(true);
      setError(null);

      // Resolve handle to DID
      const profile = await agent.getProfile({ actor: inviteHandle.trim() });
      if (!profile.data) {
        throw new Error("User not found");
      }

      await collaborativeListService.addCollaborator({
        listId: list.id,
        userDid: profile.data.did,
        role: inviteRole,
      });

      setInviteHandle("");
      await loadCollaborators();
      onUpdate();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to invite collaborator",
      );
    } finally {
      setIsInviting(false);
    }
  };

  const handleRemove = async (userDid: string) => {
    if (!agent) return;

    try {
      setError(null);
      await collaborativeListService.removeCollaborator(list.id, userDid);
      await loadCollaborators();
      onUpdate();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to remove collaborator",
      );
    }
  };

  const handleRoleChange = async (
    userDid: string,
    newRole: CollaboratorRole,
  ) => {
    if (!agent) return;

    try {
      setError(null);
      await collaborativeListService.updateCollaboratorRole(
        list.id,
        userDid,
        newRole,
      );
      await loadCollaborators();
      onUpdate();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update role");
    }
  };

  const canManageCollaborators =
    currentUserRole && hasPermission(currentUserRole, "canInviteCollaborators");
  const canChangeRoles =
    currentUserRole && hasPermission(currentUserRole, "canChangeRoles");

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4"
      onClick={onClose}
    >
      <div
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl bg-bsky-bg-primary shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-bsky-border-primary p-6">
          <div>
            <h3 className="m-0 text-lg font-semibold text-bsky-text-primary">
              Manage Collaborators
            </h3>
            <p className="mt-1 text-sm text-bsky-text-secondary">{list.name}</p>
          </div>
          <button
            onClick={onClose}
            className="cursor-pointer rounded-md border-none bg-transparent p-2 text-bsky-text-secondary transition-all duration-200 hover:bg-bsky-bg-secondary"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-6">
          {/* Invite Section */}
          {canManageCollaborators && (
            <div className="mb-6">
              <h4 className="mb-3 text-sm font-medium text-bsky-text-primary">
                Invite Collaborator
              </h4>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={inviteHandle}
                  onChange={(e) => setInviteHandle(e.target.value)}
                  placeholder="@username.bsky.social"
                  className="flex-1 rounded-lg border border-bsky-border-primary bg-bsky-bg-secondary px-3 py-2 text-bsky-text-primary focus:border-bsky-primary focus:outline-none"
                />
                <select
                  value={inviteRole}
                  onChange={(e) =>
                    setInviteRole(e.target.value as CollaboratorRole)
                  }
                  className="rounded-lg border border-bsky-border-primary bg-bsky-bg-secondary px-3 py-2 text-bsky-text-primary focus:border-bsky-primary focus:outline-none"
                >
                  <option value="admin">Admin</option>
                  <option value="editor">Editor</option>
                  <option value="viewer">Viewer</option>
                </select>
                <button
                  onClick={handleInvite}
                  disabled={isInviting || !inviteHandle.trim()}
                  className="flex cursor-pointer items-center gap-2 rounded-lg border-none bg-bsky-primary px-4 py-2 text-sm font-medium text-white transition-all duration-200 hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <UserPlus className="h-4 w-4" />
                  {isInviting ? "..." : "Invite"}
                </button>
              </div>
              <p className="mt-2 text-xs text-bsky-text-tertiary">
                Editors can add and remove items. Admins can also manage
                collaborators.
              </p>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-600 dark:bg-red-900/30 dark:text-red-400">
              {error}
            </div>
          )}

          {/* Collaborators List */}
          <div>
            <h4 className="mb-3 text-sm font-medium text-bsky-text-primary">
              Collaborators ({collaborators.length})
            </h4>

            {isLoading ? (
              <div className="flex justify-center py-8">
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-bsky-border-primary border-t-bsky-primary" />
              </div>
            ) : collaborators.length === 0 ? (
              <p className="py-4 text-center text-sm text-bsky-text-secondary">
                No collaborators yet
              </p>
            ) : (
              <div className="space-y-2">
                {collaborators.map((collaborator) => (
                  <div
                    key={collaborator.did}
                    className="flex items-center justify-between rounded-lg border border-bsky-border-primary bg-bsky-bg-secondary p-3"
                  >
                    <div className="flex items-center gap-3">
                      {collaborator.avatar ? (
                        <img
                          src={collaborator.avatar}
                          alt=""
                          className="h-10 w-10 rounded-full"
                        />
                      ) : (
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-bsky-bg-tertiary text-bsky-text-secondary">
                          {(collaborator.displayName ||
                            collaborator.handle ||
                            "?")[0].toUpperCase()}
                        </div>
                      )}
                      <div>
                        <div className="font-medium text-bsky-text-primary">
                          {collaborator.displayName ||
                            collaborator.handle ||
                            collaborator.did.slice(0, 20)}
                        </div>
                        <div className="text-sm text-bsky-text-secondary">
                          @
                          {collaborator.handle || collaborator.did.slice(0, 20)}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {canChangeRoles && collaborator.role !== "owner" ? (
                        <select
                          value={collaborator.role}
                          onChange={(e) =>
                            handleRoleChange(
                              collaborator.did,
                              e.target.value as CollaboratorRole,
                            )
                          }
                          className="rounded-lg border border-bsky-border-primary bg-bsky-bg-primary px-2 py-1 text-sm text-bsky-text-primary focus:border-bsky-primary focus:outline-none"
                        >
                          <option value="admin">Admin</option>
                          <option value="editor">Editor</option>
                          <option value="viewer">Viewer</option>
                        </select>
                      ) : (
                        <span
                          className={`flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium ${ROLE_COLORS[collaborator.role]}`}
                        >
                          {ROLE_ICONS[collaborator.role]}
                          {getRoleDisplayName(collaborator.role)}
                        </span>
                      )}

                      {canManageCollaborators &&
                        collaborator.role !== "owner" && (
                          <button
                            onClick={() => handleRemove(collaborator.did)}
                            className="cursor-pointer rounded-md border-none bg-transparent p-2 text-red-500 transition-all duration-200 hover:bg-red-50 dark:hover:bg-red-900/30"
                            title="Remove collaborator"
                          >
                            <UserMinus className="h-4 w-4" />
                          </button>
                        )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Role Descriptions */}
          <div className="mt-6 rounded-lg bg-bsky-bg-secondary p-4">
            <h5 className="mb-2 text-sm font-medium text-bsky-text-primary">
              Role Permissions
            </h5>
            <div className="space-y-1 text-xs text-bsky-text-secondary">
              <div className="flex items-center gap-2">
                <Crown className="h-3 w-3 text-yellow-500" />
                <span>
                  <strong>Owner:</strong> Full control, can delete list
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Shield className="h-3 w-3 text-purple-500" />
                <span>
                  <strong>Admin:</strong> Manage collaborators and content
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Edit3 className="h-3 w-3 text-blue-500" />
                <span>
                  <strong>Editor:</strong> Add and remove items
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Eye className="h-3 w-3 text-gray-500" />
                <span>
                  <strong>Viewer:</strong> View only
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="border-t border-bsky-border-primary p-6">
          <button
            onClick={onClose}
            className="w-full cursor-pointer rounded-lg border border-bsky-border-primary bg-transparent px-4 py-2 text-sm font-medium text-bsky-text-primary transition-all duration-200 hover:bg-bsky-bg-secondary"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
