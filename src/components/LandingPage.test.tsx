import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { LandingPage } from "./LandingPage";

// OAuth can only initialize against a public HTTPS origin, so the OAuth-first
// sign-in path can't be exercised in a browser locally. These tests cover it by
// mocking the auth context instead.
const mockUseAuth = vi.fn();

vi.mock("../contexts/AuthContext", () => ({
  useAuth: () => mockUseAuth(),
}));

function withOAuth(isOAuthAvailable: boolean) {
  mockUseAuth.mockReturnValue({
    login: vi.fn(),
    loginWithOAuth: vi.fn(),
    isOAuthAvailable,
  });
}

describe("LandingPage sign-in", () => {
  beforeEach(() => {
    mockUseAuth.mockReset();
  });

  it("leads with OAuth and offers app passwords as an escape hatch", () => {
    withOAuth(true);
    render(<LandingPage />);

    // OAuth is the default path, not a peer choice in a segmented control.
    expect(
      screen.getByRole("button", { name: /sign in with bluesky/i }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /^app password$/i }),
    ).not.toBeInTheDocument();

    const escapeHatch = screen.getByRole("button", {
      name: /trouble signing in\? use an app password/i,
    });

    fireEvent.click(escapeHatch);

    // Switching reveals the app-password form and a way back.
    expect(screen.getByLabelText(/app password/i)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /back to signing in with bluesky/i }),
    ).toBeInTheDocument();
  });

  it("hides the switch entirely when OAuth is unavailable", () => {
    withOAuth(false);
    render(<LandingPage />);

    expect(screen.getByLabelText(/app password/i)).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /use an app password/i }),
    ).not.toBeInTheDocument();
  });

  it("describes Asphodel as a Bluesky client rather than a notifications tool", () => {
    withOAuth(true);
    render(<LandingPage />);

    expect(
      screen.getByText(/bluesky, in as many columns as you like/i),
    ).toBeInTheDocument();
    expect(
      screen.queryByText(/free bluesky analytics/i),
    ).not.toBeInTheDocument();
  });
});
