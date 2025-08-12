import { queryClient } from "@bsky/shared";
import { useQuery } from "@tanstack/react-query";
import { Camera, Upload } from "lucide-react";
import React, { useEffect, useRef, useState } from "react";
import { useAuth } from "../../contexts/AuthContext";
import { proxifyBskyImage } from "../../utils/image-proxy";

export const AccountSettings: React.FC = () => {
  const { session, agent } = useAuth();
  const [displayName, setDisplayName] = useState("");
  const [description, setDescription] = useState("");
  const [avatar, setAvatar] = useState<string | undefined>();
  const [banner, setBanner] = useState<string | undefined>();
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [bannerFile, setBannerFile] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  const avatarInputRef = useRef<HTMLInputElement>(null);
  const bannerInputRef = useRef<HTMLInputElement>(null);

  // Fetch current profile
  const { data: profile } = useQuery({
    queryKey: ["profile", session?.did],
    queryFn: async () => {
      if (!agent || !session?.did) return null;
      const { data } = await agent.getProfile({ actor: session.did });
      return data;
    },
    enabled: !!agent && !!session?.did,
  });

  // Update local state when profile loads
  useEffect(() => {
    if (profile) {
      setDisplayName(profile.displayName || "");
      setDescription(profile.description || "");
      setAvatar(profile.avatar);
      setBanner(profile.banner);
    }
  }, [profile]);

  const handleImageChange = (type: "avatar" | "banner", file: File) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      if (type === "avatar") {
        setAvatar(reader.result as string);
        setAvatarFile(file);
      } else {
        setBanner(reader.result as string);
        setBannerFile(file);
      }
    };
    reader.readAsDataURL(file);
  };

  const uploadImage = async (file: File): Promise<{ blob: any }> => {
    if (!agent) throw new Error("No agent available");

    const imageBytes = await file.arrayBuffer();
    const response = await agent.uploadBlob(new Uint8Array(imageBytes), {
      encoding: file.type,
    });

    return response.data;
  };

  const handleSave = async () => {
    if (!agent) return;

    setIsLoading(true);
    setMessage(null);

    try {
      let avatarBlob;
      let bannerBlob;

      // Upload new avatar if changed
      if (avatarFile) {
        avatarBlob = await uploadImage(avatarFile);
      }

      // Upload new banner if changed
      if (bannerFile) {
        bannerBlob = await uploadImage(bannerFile);
      }

      await agent.upsertProfile((existing) => {
        const updates: any = {
          ...existing,
          displayName: displayName.trim() || undefined,
          description: description.trim() || undefined,
        };

        if (avatarBlob) {
          updates.avatar = avatarBlob.blob;
        }

        if (bannerBlob) {
          updates.banner = bannerBlob.blob;
        }

        return updates;
      });

      setMessage({ type: "success", text: "Profile updated successfully!" });
      setAvatarFile(null);
      setBannerFile(null);

      // Refresh the profile query
      await queryClient.invalidateQueries({
        queryKey: ["profile", session?.did],
      });
    } catch (error) {
      console.error("Failed to update profile:", error);
      setMessage({
        type: "error",
        text: "Failed to update profile. Please try again.",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const hasChanges = () => {
    return (
      displayName !== (profile?.displayName || "") ||
      description !== (profile?.description || "") ||
      avatarFile !== null ||
      bannerFile !== null
    );
  };

  return (
    <div className="space-y-6">
      <div>
        <h2
          className="text-xl font-semibold"
          style={{ color: "var(--bsky-text-primary)" }}
        >
          Account Settings
        </h2>
        <p
          className="mt-1 text-sm"
          style={{ color: "var(--bsky-text-secondary)" }}
        >
          Manage your account information and preferences
        </p>
      </div>

      {/* Profile Images Section */}
      <div className="space-y-4">
        <div>
          <label
            className="mb-2 block text-sm font-medium"
            style={{ color: "var(--bsky-text-primary)" }}
          >
            Profile Pictures
          </label>

          {/* Banner */}
          <div className="relative mb-4 h-32 overflow-hidden rounded-lg bg-gradient-to-b from-blue-200 to-blue-300 dark:from-blue-800 dark:to-blue-900">
            {banner && (
              <img
                src={
                  banner.startsWith("data:") ? banner : proxifyBskyImage(banner)
                }
                alt="Profile banner"
                className="h-full w-full object-cover"
              />
            )}
            <input
              ref={bannerInputRef}
              type="file"
              accept="image/*"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleImageChange("banner", file);
              }}
              className="hidden"
            />
            <button
              onClick={() => bannerInputRef.current?.click()}
              className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-0 transition-all hover:bg-opacity-50"
            >
              <div className="flex items-center gap-2 rounded-lg bg-black bg-opacity-75 px-3 py-2 text-sm text-white opacity-0 transition-all hover:opacity-100">
                <Upload size={16} />
                Change Banner
              </div>
            </button>
          </div>

          {/* Avatar */}
          <div className="flex items-end gap-4">
            <div className="relative">
              <img
                src={
                  avatar
                    ? avatar.startsWith("data:")
                      ? avatar
                      : proxifyBskyImage(avatar)
                    : "/default-avatar.svg"
                }
                alt="Profile avatar"
                className="h-24 w-24 rounded-full border-4 border-white dark:border-gray-900"
              />
              <input
                ref={avatarInputRef}
                type="file"
                accept="image/*"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleImageChange("avatar", file);
                }}
                className="hidden"
              />
              <button
                onClick={() => avatarInputRef.current?.click()}
                className="absolute bottom-0 right-0 rounded-full bg-blue-500 p-2 text-white shadow-lg transition-all hover:bg-blue-600"
              >
                <Camera size={16} />
              </button>
            </div>
            <div
              className="text-sm"
              style={{ color: "var(--bsky-text-secondary)" }}
            >
              <p>Click to upload a new profile picture</p>
              <p
                className="text-xs"
                style={{ color: "var(--bsky-text-tertiary)" }}
              >
                Recommended: 400x400px or larger
              </p>
            </div>
          </div>
        </div>
      </div>

      <div>
        <label
          className="mb-2 block text-sm font-medium"
          style={{ color: "var(--bsky-text-primary)" }}
        >
          Handle
        </label>
        <input
          type="text"
          value={`@${session?.handle}`}
          disabled
          className="w-full rounded-lg px-4 py-2 text-sm"
          style={{
            backgroundColor: "var(--bsky-bg-tertiary)",
            color: "var(--bsky-text-tertiary)",
            border: "1px solid var(--bsky-border-primary)",
          }}
        />
        <p
          className="mt-1 text-xs"
          style={{ color: "var(--bsky-text-tertiary)" }}
        >
          Your handle cannot be changed
        </p>
      </div>

      <div>
        <label
          className="mb-2 block text-sm font-medium"
          style={{ color: "var(--bsky-text-primary)" }}
        >
          Display Name
        </label>
        <input
          type="text"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          placeholder="Enter your display name"
          className="w-full rounded-lg px-4 py-2 text-sm"
          style={{
            backgroundColor: "var(--bsky-bg-secondary)",
            color: "var(--bsky-text-primary)",
            border: "1px solid var(--bsky-border-primary)",
          }}
        />
      </div>

      <div>
        <label
          className="mb-2 block text-sm font-medium"
          style={{ color: "var(--bsky-text-primary)" }}
        >
          Bio
        </label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Tell us about yourself"
          rows={4}
          className="w-full rounded-lg px-4 py-2 text-sm"
          style={{
            backgroundColor: "var(--bsky-bg-secondary)",
            color: "var(--bsky-text-primary)",
            border: "1px solid var(--bsky-border-primary)",
          }}
        />
      </div>

      {message && (
        <div
          className="rounded-lg p-3 text-sm"
          style={{
            backgroundColor:
              message.type === "success"
                ? "rgba(34, 197, 94, 0.1)"
                : "rgba(239, 68, 68, 0.1)",
            color: message.type === "success" ? "#22c55e" : "#ef4444",
            border: `1px solid ${message.type === "success" ? "rgba(34, 197, 94, 0.3)" : "rgba(239, 68, 68, 0.3)"}`,
          }}
        >
          {message.text}
        </div>
      )}

      <div className="flex justify-end gap-3">
        <button
          onClick={() => {
            setDisplayName(profile?.displayName || "");
            setDescription(profile?.description || "");
            setAvatar(profile?.avatar);
            setBanner(profile?.banner);
            setAvatarFile(null);
            setBannerFile(null);
            setMessage(null);
          }}
          disabled={!hasChanges() || isLoading}
          className="rounded-lg px-4 py-2 text-sm font-medium transition-colors disabled:opacity-50"
          style={{
            backgroundColor: "var(--bsky-bg-tertiary)",
            color: "var(--bsky-text-primary)",
            border: "1px solid var(--bsky-border-primary)",
          }}
        >
          Cancel
        </button>
        <button
          onClick={handleSave}
          disabled={!hasChanges() || isLoading}
          className="rounded-lg px-4 py-2 text-sm font-medium text-white transition-colors disabled:opacity-50"
          style={{
            backgroundColor: "var(--bsky-primary)",
          }}
        >
          {isLoading ? "Saving..." : "Save Changes"}
        </button>
      </div>
    </div>
  );
};
