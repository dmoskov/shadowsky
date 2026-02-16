---
description: Audit SwiftUI layout patterns for known dangerous patterns that cause visual bugs
allowed-tools: Grep, Glob, Read, TodoWrite
---

# SwiftUI Layout Pattern Audit

Scan all native iOS Swift files for layout patterns known to cause visual bugs. Report findings with file:line references and suggested fixes.

## Patterns to Check

### 1. CRITICAL: `.fixedSize` inside scrollable containers

`.fixedSize(horizontal: false, vertical: true)` in a ScrollView/LazyVStack tells SwiftUI to use the view's "ideal" (unwrapped) width, which can exceed screen width and cause content clipping.

**Search:** Grep for `fixedSize` in all Swift files under `mobile/modules/`.

**Safe uses:** `.fixedSize` is safe on views with bounded intrinsic size (e.g., `Image`, short `Text`). It's dangerous on `UIViewRepresentable` views or multi-line `Text` views inside scrollable containers.

**Fix:** Replace with `.frame(maxWidth: .infinity, alignment: .leading)`.

### 2. CRITICAL: `UIScreen.main.bounds` for layout width

Hardcoding width from `UIScreen.main.bounds` ignores parent padding and safe areas, causing overflow.

**Search:** Grep for `UIScreen.main.bounds` in all Swift files under `mobile/modules/`.

**Fix:** Use `GeometryReader` to get the actual available width from the parent container.

### 3. HIGH: UIViewRepresentable missing compression resistance

`UITextView` and other UIKit views wrapped in `UIViewRepresentable` can report unbounded intrinsic content width. Without setting compression resistance priority, the parent SwiftUI layout will expand to accommodate it.

**Search:** Find all `UIViewRepresentable` conformances, then check if `makeUIView` sets `setContentCompressionResistancePriority(.defaultLow, for: .horizontal)`.

**Fix:** Add `textView.setContentCompressionResistancePriority(.defaultLow, for: .horizontal)` in `makeUIView`.

### 4. MEDIUM: Missing `public` access on shared types

Expo native module types that are referenced across module boundaries need `public` access modifiers on structs, properties, and initializers. Missing `public` causes silent compilation issues or runtime crashes.

**Search:** Check structs in `ExpoSwiftUIFeed` module — `ImageEmbedData`, `VideoEmbedData`, `ExternalLinkEmbedData`, `QuoteEmbedData`, `PostEmbedData`, `EmbedType` — for `public` access.

### 5. LOW: Duplicate utility functions

Multiple files may define identical helper functions (e.g., `relativeTime`, `formatCount`, `formatTimestamp`). These should ideally be extracted to a shared utility.

**Search:** Grep for `func relativeTime\|func formatTimestamp\|func formatCount\|func relativeTimeString` in Swift files.

## Report Format

For each finding, report:
```
[SEVERITY] file_path:line_number
  Pattern: <what was found>
  Risk: <what could go wrong>
  Fix: <suggested fix>
```

Severity levels:
- **CRITICAL**: Will cause visible bugs (clipping, overflow, crashes)
- **HIGH**: Likely to cause bugs under certain conditions
- **MEDIUM**: Code quality issue that may cause future bugs
- **LOW**: Maintenance concern, not a bug risk
