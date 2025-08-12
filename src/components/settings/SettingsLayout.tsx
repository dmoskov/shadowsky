import { Bell, Bookmark, Database, Palette, Shield, User } from "lucide-react";
import React from "react";
import { NavLink } from "react-router-dom";

interface SettingsLayoutProps {
  children: React.ReactNode;
  activeSection: string;
}

export const SettingsLayout: React.FC<SettingsLayoutProps> = ({
  children,
  activeSection,
}) => {
  const sections = [
    { id: "account", label: "Account", icon: User, path: "/settings/account" },
    {
      id: "appearance",
      label: "Appearance",
      icon: Palette,
      path: "/settings/appearance",
    },
    {
      id: "notifications",
      label: "Notifications",
      icon: Bell,
      path: "/settings/notifications",
    },
    {
      id: "privacy",
      label: "Privacy & Safety",
      icon: Shield,
      path: "/settings/privacy",
    },
    {
      id: "bookmarks",
      label: "Bookmarks",
      icon: Bookmark,
      path: "/settings/bookmarks",
    },
    {
      id: "data",
      label: "Data & Storage",
      icon: Database,
      path: "/settings/data",
    },
  ];

  return (
    <div className="mx-auto max-w-4xl p-4">
      <h1
        className="mb-6 text-2xl font-bold"
        style={{ color: "var(--bsky-text-primary)" }}
      >
        Settings
      </h1>

      <div className="flex flex-col gap-4 md:flex-row">
        {/* Sidebar Navigation */}
        <nav className="w-full md:w-64">
          <div
            className="bsky-glass overflow-hidden rounded-lg"
            style={{ border: "1px solid var(--bsky-border-primary)" }}
          >
            {sections.map((section) => (
              <NavLink
                key={section.id}
                to={section.path}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-4 py-3 transition-colors ${
                    isActive
                      ? "bg-blue-500 bg-opacity-10"
                      : "hover:bg-white hover:bg-opacity-5"
                  }`
                }
                style={({ isActive }) => ({
                  color: isActive
                    ? "var(--bsky-primary)"
                    : "var(--bsky-text-secondary)",
                  borderLeft: isActive
                    ? "3px solid var(--bsky-primary)"
                    : "3px solid transparent",
                })}
              >
                <section.icon size={20} />
                <span className="font-medium">{section.label}</span>
              </NavLink>
            ))}
          </div>
        </nav>

        {/* Settings Content */}
        <div className="flex-1">
          <div
            className="bsky-glass rounded-lg p-6"
            style={{ border: "1px solid var(--bsky-border-primary)" }}
          >
            {children}
          </div>
        </div>
      </div>
    </div>
  );
};
