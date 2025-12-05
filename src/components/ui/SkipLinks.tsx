import React from "react";

interface SkipLink {
  href: string;
  label: string;
}

interface SkipLinksProps {
  links?: SkipLink[];
}

const defaultLinks: SkipLink[] = [
  { href: "#main-content", label: "Skip to main content" },
  { href: "#main-navigation", label: "Skip to navigation" },
];

/**
 * SkipLinks component provides accessible skip navigation links
 * that appear when focused via keyboard navigation.
 *
 * These links allow keyboard users to bypass repetitive content
 * and navigate directly to main content areas.
 *
 * WCAG 2.1 Success Criterion 2.4.1: Bypass Blocks
 */
export const SkipLinks: React.FC<SkipLinksProps> = ({
  links = defaultLinks,
}) => {
  return (
    <div className="skip-links-container">
      {links.map((link) => (
        <a key={link.href} href={link.href} className="skip-link">
          {link.label}
        </a>
      ))}
    </div>
  );
};
