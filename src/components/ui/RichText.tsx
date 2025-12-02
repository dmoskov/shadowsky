import React from "react";
import { Link } from "react-router";
import { isValidUrl } from "../../utils/security";

interface Facet {
  index: {
    byteStart: number;
    byteEnd: number;
  };
  features: Array<{
    $type: string;
    did?: string;
    uri?: string;
    tag?: string;
  }>;
}

interface RichTextProps {
  text: string;
  facets?: Facet[];
  className?: string;
  style?: React.CSSProperties;
}

// Convert byte offset to JavaScript string index for proper slicing
// This handles UTF-8 multi-byte characters (emoji, CJK, etc.) correctly.
// Returns the string index (compatible with String.slice()) not codepoint count.
// Exported for testing purposes
export function byteToCharOffset(text: string, byteOffset: number): number {
  const encoder = new TextEncoder();
  let byteCount = 0;
  let stringIndex = 0;

  // Iterate by codepoint (handles surrogate pairs as single units)
  for (const codepoint of text) {
    if (byteCount >= byteOffset) break;
    byteCount += encoder.encode(codepoint).length;
    // codepoint.length gives the actual JS string length (1 for BMP, 2 for surrogate pairs)
    stringIndex += codepoint.length;
  }

  return stringIndex;
}

export const RichText: React.FC<RichTextProps> = ({
  text,
  facets,
  className,
  style,
}) => {
  if (!text) return null;

  // If no facets, return plain text
  if (!facets || facets.length === 0) {
    return (
      <span className={className} style={style}>
        {text}
      </span>
    );
  }

  // Sort facets by start position
  const sortedFacets = [...facets].sort(
    (a, b) => a.index.byteStart - b.index.byteStart,
  );

  const elements: React.ReactNode[] = [];
  let lastCharIndex = 0;

  for (let i = 0; i < sortedFacets.length; i++) {
    const facet = sortedFacets[i];
    const charStart = byteToCharOffset(text, facet.index.byteStart);
    const charEnd = byteToCharOffset(text, facet.index.byteEnd);

    // Add text before this facet
    if (charStart > lastCharIndex) {
      elements.push(
        <span key={`text-${i}`}>{text.slice(lastCharIndex, charStart)}</span>,
      );
    }

    // Get the facet text
    const facetText = text.slice(charStart, charEnd);

    // Determine facet type and render appropriately
    const feature = facet.features[0];
    if (!feature) {
      elements.push(<span key={`facet-${i}`}>{facetText}</span>);
    } else if (
      feature.$type === "app.bsky.richtext.facet#mention" &&
      feature.did
    ) {
      // Mention - link to profile
      elements.push(
        <Link
          key={`facet-${i}`}
          to={`/profile/${feature.did}`}
          className="text-blue-500 hover:underline"
          onClick={(e) => e.stopPropagation()}
        >
          {facetText}
        </Link>,
      );
    } else if (
      feature.$type === "app.bsky.richtext.facet#link" &&
      feature.uri
    ) {
      // Link - external URL (validate to prevent XSS via javascript: protocol)
      if (isValidUrl(feature.uri)) {
        elements.push(
          <a
            key={`facet-${i}`}
            href={feature.uri}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-500 hover:underline"
            onClick={(e) => e.stopPropagation()}
          >
            {facetText}
          </a>,
        );
      } else {
        // Invalid URL - render as plain text to prevent XSS
        elements.push(<span key={`facet-${i}`}>{facetText}</span>);
      }
    } else if (feature.$type === "app.bsky.richtext.facet#tag" && feature.tag) {
      // Hashtag - link to search
      elements.push(
        <Link
          key={`facet-${i}`}
          to={`/search?q=%23${encodeURIComponent(feature.tag)}`}
          className="text-blue-500 hover:underline"
          onClick={(e) => e.stopPropagation()}
        >
          {facetText}
        </Link>,
      );
    } else {
      elements.push(<span key={`facet-${i}`}>{facetText}</span>);
    }

    lastCharIndex = charEnd;
  }

  // Add any remaining text after the last facet
  if (lastCharIndex < text.length) {
    elements.push(<span key="text-end">{text.slice(lastCharIndex)}</span>);
  }

  return (
    <span className={className} style={style}>
      {elements}
    </span>
  );
};
