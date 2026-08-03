import {
  Accessibility,
  Activity,
  Bell,
  Database,
  HardDrive,
  HelpCircle,
  History,
  Palette,
  PenTool,
  Search,
  Shield,
  ShieldCheck,
  User,
  Users,
  type LucideIcon,
} from "lucide-react";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { NavLink, useLocation } from "react-router";
import { AccountManager } from "../../services/account-manager";
import {
  DisclosureContent,
  DisclosurePanel,
  DisclosureTrigger,
} from "../ui/DisclosurePanel";

interface SettingsLayoutProps {
  children: React.ReactNode;
  activeSection: string;
}

interface SettingItem {
  id: string;
  label: string;
  icon: LucideIcon;
  path: string;
}

interface SettingsGroup {
  id: string;
  label: string;
  items: SettingItem[];
  defaultOpen?: boolean;
}

const STORAGE_KEY = "settings-open-sections";

function getStoredOpenSections(): string[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch {
    // Ignore parse errors
  }
  return ["account-security"]; // Default to Account & Security open
}

function setStoredOpenSections(sections: string[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(sections));
  } catch {
    // Ignore storage errors
  }
}

export const SettingsLayout: React.FC<SettingsLayoutProps> = ({
  children,
  activeSection: _activeSection,
}) => {
  const location = useLocation();
  const hasMultipleAccounts = AccountManager.hasMultipleAccounts();
  const [searchQuery, setSearchQuery] = useState("");
  const [openSections, setOpenSections] = useState<string[]>(
    getStoredOpenSections,
  );

  // Define grouped sections
  const settingsGroups: SettingsGroup[] = useMemo(
    () => [
      {
        id: "account-security",
        label: "Account & Security",
        defaultOpen: true,
        items: [
          {
            id: "account",
            label: "Account",
            icon: User,
            path: "/settings/account",
          },
          {
            id: "accounts",
            label: hasMultipleAccounts
              ? "Manage Accounts"
              : "Sign into another account",
            icon: Users,
            path: "/settings/accounts",
          },
          {
            id: "privacy",
            label: "Privacy & Safety",
            icon: Shield,
            path: "/settings/privacy",
          },
        ],
      },
      {
        id: "appearance-accessibility",
        label: "Appearance & Accessibility",
        items: [
          {
            id: "appearance",
            label: "Appearance",
            icon: Palette,
            path: "/settings/appearance",
          },
          {
            id: "accessibility",
            label: "Accessibility",
            icon: Accessibility,
            path: "/settings/accessibility",
          },
        ],
      },
      {
        id: "features",
        label: "Features",
        items: [
          {
            id: "composer",
            label: "Composer & AI",
            icon: PenTool,
            path: "/settings/composer",
          },
          {
            id: "notifications",
            label: "Notifications",
            icon: Bell,
            path: "/settings/notifications",
          },
        ],
      },
      {
        id: "moderation",
        label: "Moderation",
        items: [
          {
            id: "moderation",
            label: "Content Moderation",
            icon: ShieldCheck,
            path: "/settings/moderation",
          },
          {
            id: "labelers",
            label: "Labeler Subscriptions",
            icon: Shield,
            path: "/settings/labelers",
          },
          {
            id: "moderation-history",
            label: "Moderation History",
            icon: History,
            path: "/settings/moderation-history",
          },
        ],
      },
      {
        id: "data",
        label: "Data & Storage",
        items: [
          {
            id: "data",
            label: "Data & Sync",
            icon: Database,
            path: "/settings/data",
          },
          {
            id: "storage",
            label: "Storage",
            icon: HardDrive,
            path: "/settings/storage",
          },
          {
            id: "performance",
            label: "Performance",
            icon: Activity,
            path: "/settings/performance",
          },
        ],
      },
      {
        id: "support",
        label: "Support",
        items: [
          {
            id: "help",
            label: "Help & Documentation",
            icon: HelpCircle,
            path: "/settings/help",
          },
        ],
      },
    ],
    [hasMultipleAccounts],
  );

  // Auto-expand section containing active route
  useEffect(() => {
    const currentPath = location.pathname;
    for (const group of settingsGroups) {
      const hasActiveItem = group.items.some(
        (item) => item.path === currentPath,
      );
      if (hasActiveItem && !openSections.includes(group.id)) {
        setOpenSections((prev) => [...prev, group.id]);
      }
    }
  }, [location.pathname, settingsGroups, openSections]);

  // Persist open sections
  useEffect(() => {
    setStoredOpenSections(openSections);
  }, [openSections]);

  const handleToggleSection = useCallback(
    (groupId: string, isOpen: boolean) => {
      setOpenSections((prev) => {
        if (isOpen) {
          return prev.includes(groupId) ? prev : [...prev, groupId];
        }
        return prev.filter((id) => id !== groupId);
      });
    },
    [],
  );

  // Filter items based on search
  const filteredGroups = useMemo(() => {
    if (!searchQuery.trim()) {
      return settingsGroups;
    }
    const query = searchQuery.toLowerCase();
    return settingsGroups
      .map((group) => ({
        ...group,
        items: group.items.filter(
          (item) =>
            item.label.toLowerCase().includes(query) ||
            item.id.toLowerCase().includes(query),
        ),
      }))
      .filter((group) => group.items.length > 0);
  }, [settingsGroups, searchQuery]);

  // When searching, show all filtered results without grouping
  const isSearching = searchQuery.trim().length > 0;

  const renderNavItem = (item: SettingItem, isNested: boolean = false) => (
    <NavLink
      key={item.id}
      to={item.path}
      className={({ isActive }) =>
        `flex items-center gap-3 px-4 py-2.5 transition-colors ${
          isNested ? "pl-8" : ""
        } ${
          isActive
            ? "bg-blue-500 bg-opacity-10"
            : "hover:bg-white hover:bg-opacity-5"
        }`
      }
      style={({ isActive }) => ({
        color: isActive ? "var(--asph-primary)" : "var(--asph-text-secondary)",
        borderLeft: isActive
          ? "3px solid var(--asph-primary)"
          : "3px solid transparent",
      })}
    >
      <item.icon size={18} />
      <span className="text-sm font-medium">{item.label}</span>
    </NavLink>
  );

  return (
    <div className="mx-auto max-w-4xl p-4">
      <h1
        className="mb-6 text-2xl font-bold"
        style={{ color: "var(--asph-text-primary)" }}
      >
        Settings
      </h1>

      <div className="flex flex-col gap-4 md:flex-row">
        {/* Sidebar Navigation */}
        <nav className="w-full md:w-64">
          <div
            className="asph-glass overflow-hidden rounded-lg"
            style={{ border: "1px solid var(--asph-border-primary)" }}
          >
            {/* Search Input */}
            <div
              className="border-b p-2"
              style={{ borderColor: "var(--asph-border-primary)" }}
            >
              <div className="relative">
                <Search
                  size={16}
                  className="absolute left-3 top-1/2 -translate-y-1/2"
                  style={{ color: "var(--asph-text-tertiary)" }}
                />
                <input
                  type="text"
                  placeholder="Search settings..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full rounded-md bg-transparent py-2 pl-9 pr-3 text-sm outline-none"
                  style={{
                    color: "var(--asph-text-primary)",
                    border: "1px solid var(--asph-border-secondary)",
                  }}
                />
              </div>
            </div>

            {/* Navigation Items */}
            <div className="py-1">
              {isSearching ? (
                // Flat list when searching
                filteredGroups.length > 0 ? (
                  filteredGroups.flatMap((group) =>
                    group.items.map((item) => renderNavItem(item, false)),
                  )
                ) : (
                  <div
                    className="px-4 py-3 text-sm"
                    style={{ color: "var(--asph-text-tertiary)" }}
                  >
                    No settings found
                  </div>
                )
              ) : (
                // Grouped disclosure panels
                filteredGroups.map((group) => (
                  <DisclosurePanel
                    key={group.id}
                    isOpen={openSections.includes(group.id)}
                    onToggle={(isOpen) => handleToggleSection(group.id, isOpen)}
                  >
                    <DisclosureTrigger
                      className="w-full px-4 py-3 text-sm font-semibold uppercase tracking-wide hover:bg-white hover:bg-opacity-5"
                      iconPosition="left"
                      showIcon={true}
                    >
                      <span style={{ color: "var(--asph-text-tertiary)" }}>
                        {group.label}
                      </span>
                    </DisclosureTrigger>
                    <DisclosureContent animate={true}>
                      {group.items.map((item) => renderNavItem(item, true))}
                    </DisclosureContent>
                  </DisclosurePanel>
                ))
              )}
            </div>
          </div>
        </nav>

        {/* Settings Content */}
        <div className="flex-1">
          <div
            className="asph-glass rounded-lg p-6"
            style={{ border: "1px solid var(--asph-border-primary)" }}
          >
            {children}
          </div>
        </div>
      </div>
    </div>
  );
};
