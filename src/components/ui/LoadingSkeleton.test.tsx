import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import {
  LoadingSkeleton,
  type LoadingSkeletonVariant,
} from "./LoadingSkeleton";

const VARIANTS: LoadingSkeletonVariant[] = [
  "feed",
  "profile",
  "notifications",
  "search",
  "thread",
  "conversations",
  "userList",
];

describe("LoadingSkeleton", () => {
  it.each(VARIANTS)("renders the %s variant without crashing", (variant) => {
    const { container } = render(<LoadingSkeleton variant={variant} />);
    expect(container.firstChild).not.toBeNull();
  });

  it("forwards an explicit row count to list variants", () => {
    // FeedSkeleton renders `count` PostSkeleton rows; a higher count should
    // produce more DOM than a smaller one.
    const small = render(<LoadingSkeleton variant="feed" count={1} />);
    const large = render(<LoadingSkeleton variant="feed" count={6} />);
    expect(large.container.innerHTML.length).toBeGreaterThan(
      small.container.innerHTML.length,
    );
  });

  it("applies a custom aria-label", () => {
    const { getByLabelText } = render(
      <LoadingSkeleton variant="feed" aria-label="Loading your feed" />,
    );
    expect(getByLabelText("Loading your feed")).toBeInTheDocument();
  });
});
