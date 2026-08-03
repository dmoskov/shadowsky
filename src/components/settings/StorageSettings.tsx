import React from "react";
import { MediaCacheSettings } from "./MediaCacheSettings";
import { StorageManagementSettings } from "./StorageManagementSettings";

/**
 * One page for everything about space on this device.
 *
 * Storage Management and Media Cache used to be separate settings sections, but
 * both answer the same question ("what is using space, and how do I clear it?"),
 * so they read as one page with two sections. Where your data *syncs* is a
 * different concern and lives in Data & Sync (DataSettings).
 */
export const StorageSettings: React.FC = () => (
  <div className="space-y-10">
    <StorageManagementSettings />
    <MediaCacheSettings />
  </div>
);
