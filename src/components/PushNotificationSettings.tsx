/**
 * Push Notification Settings Component
 *
 * Allows users to manage their push notification preferences including
 * notification types, quiet hours, and sound/vibration settings.
 */

import {
  Bell,
  BellOff,
  Heart,
  Loader2,
  MessageCircle,
  Moon,
  Quote,
  Repeat2,
  Smartphone,
  UserPlus,
  Volume2,
} from "lucide-react";
import React, { useState } from "react";
import { usePushNotifications } from "../hooks/usePushNotifications";
import type { PushNotificationSettings as Settings } from "../types/push-notifications";

interface ToggleProps {
  enabled: boolean;
  onChange: (enabled: boolean) => void;
  disabled?: boolean;
  label: string;
  description?: string;
  icon?: React.ReactNode;
}

const Toggle: React.FC<ToggleProps> = ({
  enabled,
  onChange,
  disabled,
  label,
  description,
  icon,
}) => (
  <div className="flex items-center justify-between py-3">
    <div className="flex items-center gap-3">
      {icon && (
        <span
          className="flex-shrink-0"
          style={{ color: "var(--bsky-text-secondary)" }}
        >
          {icon}
        </span>
      )}
      <div>
        <p
          className="text-sm font-medium"
          style={{ color: "var(--bsky-text-primary)" }}
        >
          {label}
        </p>
        {description && (
          <p
            className="text-xs"
            style={{ color: "var(--bsky-text-secondary)" }}
          >
            {description}
          </p>
        )}
      </div>
    </div>
    <button
      role="switch"
      aria-checked={enabled}
      onClick={() => onChange(!enabled)}
      disabled={disabled}
      className={`relative h-6 w-11 rounded-full transition-colors ${
        disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer"
      }`}
      style={{
        background: enabled ? "var(--bsky-primary)" : "var(--bsky-bg-tertiary)",
      }}
    >
      <span
        className={`absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-transform ${
          enabled ? "translate-x-5" : "translate-x-0"
        }`}
      />
    </button>
  </div>
);

interface TimeInputProps {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  label: string;
}

const TimeInput: React.FC<TimeInputProps> = ({
  value,
  onChange,
  disabled,
  label,
}) => (
  <div className="flex items-center gap-2">
    <label className="text-sm" style={{ color: "var(--bsky-text-secondary)" }}>
      {label}
    </label>
    <input
      type="time"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
      className="rounded border px-2 py-1 text-sm"
      style={{
        background: "var(--bsky-bg-primary)",
        borderColor: "var(--bsky-border)",
        color: "var(--bsky-text-primary)",
      }}
    />
  </div>
);

export const PushNotificationSettings: React.FC = () => {
  const {
    status,
    settings,
    isLoading,
    error,
    subscribe,
    unsubscribe,
    updateSettings,
    showTestNotification,
  } = usePushNotifications();

  const [isSaving, setIsSaving] = useState(false);
  const [testSent, setTestSent] = useState(false);

  const handleToggle = async (
    key: keyof Settings,
    value: boolean,
  ): Promise<void> => {
    setIsSaving(true);
    try {
      await updateSettings({ [key]: value });
    } finally {
      setIsSaving(false);
    }
  };

  const handleTimeChange = async (
    key: "quietHoursStart" | "quietHoursEnd",
    value: string,
  ): Promise<void> => {
    await updateSettings({ [key]: value });
  };

  const handleEnableNotifications = async (): Promise<void> => {
    await subscribe();
  };

  const handleDisableNotifications = async (): Promise<void> => {
    await unsubscribe();
  };

  const handleTestNotification = async (): Promise<void> => {
    try {
      await showTestNotification();
      setTestSent(true);
      setTimeout(() => setTestSent(false), 3000);
    } catch {
      // Error is handled by the hook
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2
          className="h-6 w-6 animate-spin"
          style={{ color: "var(--bsky-text-secondary)" }}
        />
      </div>
    );
  }

  if (!status.isSupported) {
    return (
      <div
        className="rounded-lg border p-4"
        style={{
          background: "var(--bsky-bg-secondary)",
          borderColor: "var(--bsky-border)",
        }}
      >
        <div className="flex items-center gap-3">
          <BellOff
            className="h-5 w-5"
            style={{ color: "var(--bsky-text-secondary)" }}
          />
          <div>
            <p
              className="font-medium"
              style={{ color: "var(--bsky-text-primary)" }}
            >
              Push Notifications Not Supported
            </p>
            <p
              className="text-sm"
              style={{ color: "var(--bsky-text-secondary)" }}
            >
              Your browser doesn't support push notifications. Try using a
              modern browser like Chrome, Firefox, or Safari.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Error Display */}
      {error && (
        <div
          className="rounded-lg border p-3"
          style={{
            background: "var(--bsky-error-bg)",
            borderColor: "var(--bsky-error)",
          }}
        >
          <p className="text-sm" style={{ color: "var(--bsky-error)" }}>
            {error}
          </p>
        </div>
      )}

      {/* Main Toggle */}
      <div
        className="rounded-lg border p-4"
        style={{
          background: "var(--bsky-bg-secondary)",
          borderColor: "var(--bsky-border)",
        }}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div
              className="rounded-full p-2"
              style={{
                background: settings.enabled
                  ? "var(--bsky-primary)"
                  : "var(--bsky-bg-tertiary)",
                color: settings.enabled
                  ? "white"
                  : "var(--bsky-text-secondary)",
              }}
            >
              {settings.enabled ? (
                <Bell className="h-5 w-5" />
              ) : (
                <BellOff className="h-5 w-5" />
              )}
            </div>
            <div>
              <p
                className="font-medium"
                style={{ color: "var(--bsky-text-primary)" }}
              >
                Push Notifications
              </p>
              <p
                className="text-sm"
                style={{ color: "var(--bsky-text-secondary)" }}
              >
                {status.permission === "denied"
                  ? "Blocked in browser settings"
                  : settings.enabled
                    ? "Enabled - you'll receive notifications"
                    : "Disabled - you won't receive notifications"}
              </p>
            </div>
          </div>
          {status.permission !== "denied" && (
            <button
              onClick={
                settings.enabled
                  ? handleDisableNotifications
                  : handleEnableNotifications
              }
              className="rounded px-4 py-2 text-sm font-medium transition-colors hover:opacity-90"
              style={{
                background: settings.enabled
                  ? "var(--bsky-bg-tertiary)"
                  : "var(--bsky-primary)",
                color: settings.enabled
                  ? "var(--bsky-text-secondary)"
                  : "white",
              }}
            >
              {settings.enabled ? "Disable" : "Enable"}
            </button>
          )}
        </div>

        {/* Test Notification Button */}
        {settings.enabled && status.permission === "granted" && (
          <div
            className="mt-4 border-t pt-4"
            style={{ borderColor: "var(--bsky-border)" }}
          >
            <button
              onClick={handleTestNotification}
              disabled={testSent}
              className="flex items-center gap-2 rounded px-3 py-2 text-sm font-medium transition-colors hover:opacity-90 disabled:opacity-50"
              style={{
                background: "var(--bsky-bg-tertiary)",
                color: "var(--bsky-text-primary)",
              }}
            >
              <Smartphone className="h-4 w-4" />
              {testSent ? "Test Sent!" : "Send Test Notification"}
            </button>
          </div>
        )}
      </div>

      {/* Notification Types */}
      {settings.enabled && (
        <div
          className="rounded-lg border p-4"
          style={{
            background: "var(--bsky-bg-secondary)",
            borderColor: "var(--bsky-border)",
          }}
        >
          <h3
            className="mb-2 font-medium"
            style={{ color: "var(--bsky-text-primary)" }}
          >
            Notification Types
          </h3>
          <p
            className="mb-4 text-sm"
            style={{ color: "var(--bsky-text-secondary)" }}
          >
            Choose which types of notifications you want to receive
          </p>

          <div
            className="divide-y"
            style={{ borderColor: "var(--bsky-border)" }}
          >
            <Toggle
              label="Likes"
              description="When someone likes your post"
              icon={<Heart className="h-4 w-4" />}
              enabled={settings.likes}
              onChange={(v) => handleToggle("likes", v)}
              disabled={isSaving}
            />
            <Toggle
              label="Reposts"
              description="When someone reposts your post"
              icon={<Repeat2 className="h-4 w-4" />}
              enabled={settings.reposts}
              onChange={(v) => handleToggle("reposts", v)}
              disabled={isSaving}
            />
            <Toggle
              label="Follows"
              description="When someone follows you"
              icon={<UserPlus className="h-4 w-4" />}
              enabled={settings.follows}
              onChange={(v) => handleToggle("follows", v)}
              disabled={isSaving}
            />
            <Toggle
              label="Mentions"
              description="When someone mentions you"
              icon={<span className="text-sm font-bold">@</span>}
              enabled={settings.mentions}
              onChange={(v) => handleToggle("mentions", v)}
              disabled={isSaving}
            />
            <Toggle
              label="Replies"
              description="When someone replies to your post"
              icon={<MessageCircle className="h-4 w-4" />}
              enabled={settings.replies}
              onChange={(v) => handleToggle("replies", v)}
              disabled={isSaving}
            />
            <Toggle
              label="Quotes"
              description="When someone quotes your post"
              icon={<Quote className="h-4 w-4" />}
              enabled={settings.quotes}
              onChange={(v) => handleToggle("quotes", v)}
              disabled={isSaving}
            />
          </div>
        </div>
      )}

      {/* Quiet Hours */}
      {settings.enabled && (
        <div
          className="rounded-lg border p-4"
          style={{
            background: "var(--bsky-bg-secondary)",
            borderColor: "var(--bsky-border)",
          }}
        >
          <Toggle
            label="Quiet Hours"
            description="Pause notifications during specific hours"
            icon={<Moon className="h-4 w-4" />}
            enabled={settings.quietHoursEnabled}
            onChange={(v) => handleToggle("quietHoursEnabled", v)}
            disabled={isSaving}
          />

          {settings.quietHoursEnabled && (
            <div className="mt-4 flex flex-wrap items-center gap-4 pl-7">
              <TimeInput
                label="From"
                value={settings.quietHoursStart}
                onChange={(v) => handleTimeChange("quietHoursStart", v)}
                disabled={isSaving}
              />
              <TimeInput
                label="To"
                value={settings.quietHoursEnd}
                onChange={(v) => handleTimeChange("quietHoursEnd", v)}
                disabled={isSaving}
              />
            </div>
          )}
        </div>
      )}

      {/* Sound & Vibration */}
      {settings.enabled && (
        <div
          className="rounded-lg border p-4"
          style={{
            background: "var(--bsky-bg-secondary)",
            borderColor: "var(--bsky-border)",
          }}
        >
          <h3
            className="mb-2 font-medium"
            style={{ color: "var(--bsky-text-primary)" }}
          >
            Sound & Vibration
          </h3>

          <div
            className="divide-y"
            style={{ borderColor: "var(--bsky-border)" }}
          >
            <Toggle
              label="Sound"
              description="Play a sound for notifications"
              icon={<Volume2 className="h-4 w-4" />}
              enabled={settings.soundEnabled}
              onChange={(v) => handleToggle("soundEnabled", v)}
              disabled={isSaving}
            />
            <Toggle
              label="Vibration"
              description="Vibrate for notifications (mobile)"
              icon={<Smartphone className="h-4 w-4" />}
              enabled={settings.vibrationEnabled}
              onChange={(v) => handleToggle("vibrationEnabled", v)}
              disabled={isSaving}
            />
            <Toggle
              label="Group Notifications"
              description="Combine similar notifications together"
              icon={<Bell className="h-4 w-4" />}
              enabled={settings.groupNotifications}
              onChange={(v) => handleToggle("groupNotifications", v)}
              disabled={isSaving}
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default PushNotificationSettings;
