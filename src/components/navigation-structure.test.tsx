import { render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SettingsLayout } from "./settings/SettingsLayout";
import { Sidebar } from "./Sidebar";

// These assert the *shape* of navigation, which is easy to regress by adding
// "just one more" primary nav item or settings section.

vi.mock("../contexts/AuthContext", () => ({
  useAuth: () => ({ session: { handle: "someone.bsky.social" } }),
}));

vi.mock("../hooks/useNotifications", () => ({
  useUnreadNotificationCount: () => ({ data: 0 }),
}));

vi.mock("../hooks/useRoutePrefetch", () => ({
  useRoutePrefetch: () => ({
    getRoutePrefetchHandlers: () => ({}),
    getProfilePrefetchHandlers: () => ({}),
  }),
}));

vi.mock("../services/account-manager", () => ({
  AccountManager: { hasMultipleAccounts: () => false },
}));

describe("primary sidebar navigation", () => {
  beforeEach(() => {
    render(
      <MemoryRouter>
        <Sidebar isOpen={true} onClose={() => {}} />
      </MemoryRouter>,
    );
  });

  it("shows the nine primary destinations", () => {
    const nav = screen.getByRole("navigation", { name: /main navigation/i });
    for (const label of [
      "Home",
      "Search",
      "Discover",
      "Notifications",
      "Timeline",
      "Direct Messages",
      "Bookmarks",
      "Lists",
      "Profile",
    ]) {
      expect(within(nav).getByText(label)).toBeInTheDocument();
    }
  });

  it("keeps compose and analytics out of primary nav", () => {
    const nav = screen.getByRole("navigation", { name: /main navigation/i });
    expect(within(nav).queryByText("Compose")).not.toBeInTheDocument();
    expect(within(nav).queryByText("Analytics")).not.toBeInTheDocument();
  });
});

describe("settings navigation", () => {
  beforeEach(() => {
    render(
      <MemoryRouter>
        <SettingsLayout activeSection="account">
          <div />
        </SettingsLayout>
      </MemoryRouter>,
    );
  });

  it("gives moderation its own group instead of filing it under data", () => {
    expect(screen.getByText("Moderation")).toBeInTheDocument();
  });

  it("does not nest a section under a group of the same name", () => {
    // The old tree had a "Data & Storage" item inside a "Data & Storage" group.
    expect(screen.getAllByText("Data & Storage")).toHaveLength(1);
    expect(screen.getByText("Data & Sync")).toBeInTheDocument();
  });

  it("exposes a single Storage section rather than three overlapping ones", () => {
    expect(screen.getByText("Storage")).toBeInTheDocument();
    expect(screen.queryByText("Media Cache")).not.toBeInTheDocument();
    expect(screen.queryByText("Storage Management")).not.toBeInTheDocument();
  });
});
