import { Bell, Home, Search, User } from "lucide-react";
import React from "react";
import { NavLink } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";

export const MobileTabBar: React.FC = () => {
  const { session } = useAuth();

  const tabs = [
    { path: "/", label: "Home", icon: Home },
    { path: "/search", label: "Search", icon: Search },
    { path: "/notifications", label: "Notifications", icon: Bell },
    { path: `/profile/${session?.handle || ""}`, label: "Profile", icon: User },
  ];

  return (
    <nav
      className="bsky-glass fixed bottom-0 left-0 right-0 z-40 lg:hidden"
      style={{
        borderTop: "1px solid var(--bsky-border-primary)",
        paddingBottom: "env(safe-area-inset-bottom)",
      }}
    >
      <div className="flex h-12 items-center justify-around">
        {tabs.map((tab) => (
          <NavLink
            key={tab.path}
            to={tab.path}
            className={({ isActive }) =>
              `flex flex-col items-center gap-0.5 px-3 py-1.5 transition-all ${
                isActive ? "scale-105" : "opacity-70 hover:opacity-100"
              }`
            }
            style={({ isActive }) => ({
              color: isActive
                ? "var(--bsky-primary)"
                : "var(--bsky-text-secondary)",
            })}
          >
            <tab.icon size={20} />
            <span className="text-[10px] font-medium">{tab.label}</span>
          </NavLink>
        ))}
      </div>
    </nav>
  );
};
