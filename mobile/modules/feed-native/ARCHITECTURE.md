# Feed Native Module Architecture

## Overview

This module provides a bridge between React Native and native SwiftUI views, specifically designed for high-performance feed rendering in the Shadowsky mobile app.

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                     React Native Layer                       │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  FeedNativeView (TypeScript)                           │ │
│  │  - Props interface                                     │ │
│  │  - Type definitions                                    │ │
│  └───────────────────┬────────────────────────────────────┘ │
└────────────────────────┼────────────────────────────────────┘
                         │
                         │ requireNativeViewManager
                         │ (Expo Modules API)
                         │
┌────────────────────────▼────────────────────────────────────┐
│                    Native iOS Layer                          │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  FeedNativeModule (Swift)                              │ │
│  │  - Expo Module Definition                              │ │
│  │  - Props registration                                  │ │
│  └───────────────────┬────────────────────────────────────┘ │
│                      │                                       │
│  ┌───────────────────▼────────────────────────────────────┐ │
│  │  FeedNativeView (Swift + UIKit)                        │ │
│  │  - ExpoView subclass                                   │ │
│  │  - UIHostingController management                      │ │
│  └───────────────────┬────────────────────────────────────┘ │
│                      │                                       │
│  ┌───────────────────▼────────────────────────────────────┐ │
│  │  FeedSwiftUIView (SwiftUI)                             │ │
│  │  - Pure SwiftUI view                                   │ │
│  │  - Native rendering                                    │ │
│  └────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

## Component Responsibilities

### TypeScript Layer (`src/`)

**FeedNativeView.tsx**
- Wraps the native view manager
- Provides React component interface
- Accepts props and forwards to native side

**FeedNativeView.types.ts**
- TypeScript type definitions
- Props interface with documentation
- Ensures type safety across the bridge

**index.ts**
- Main export file
- Public API surface

### Native iOS Layer (`ios/`)

**FeedNativeModule.swift**
- Expo Module definition
- Registers the view with Expo
- Maps props from JS to Swift
- Entry point for the native module

**FeedNativeView.swift**
- Extends ExpoView (UIView subclass)
- Bridges UIKit and SwiftUI
- Manages UIHostingController lifecycle
- Handles prop updates
- Layout management

**FeedSwiftUIView (struct)**
- Pure SwiftUI view implementation
- Declarative UI definition
- State management (future)
- Native iOS animations and interactions

## Data Flow

### Props Update Flow

```
User changes prop in React
        ↓
FeedNativeView.tsx receives new prop
        ↓
requireNativeViewManager forwards to native
        ↓
FeedNativeModule.swift receives update
        ↓
FeedNativeView.message setter is called
        ↓
updateHostingController() is invoked
        ↓
UIHostingController updates its rootView
        ↓
SwiftUI re-renders FeedSwiftUIView
```

## Key Design Decisions

### 1. UIHostingController Pattern

**Why**: UIHostingController is the official bridge between UIKit and SwiftUI. Since Expo Modules API uses UIView (UIKit), we need this bridge.

**Benefit**:
- Native SwiftUI performance
- Access to SwiftUI declarative syntax
- Seamless integration with Expo

### 2. ExpoView Subclass

**Why**: ExpoView is the base class for all Expo module views. It provides lifecycle management and integration with React Native's view hierarchy.

**Benefit**:
- Automatic prop bridging
- Memory management
- React Native lifecycle integration

### 3. Separation of Concerns

**Why**: We separate the SwiftUI view (FeedSwiftUIView) from the UIKit bridge (FeedNativeView).

**Benefit**:
- SwiftUI view is testable in Xcode Previews
- Easy to iterate on UI without touching bridge code
- Clear ownership of responsibilities

### 4. Local Expo Module

**Why**: We use a local module instead of a separate npm package.

**Benefit**:
- Faster iteration during development
- No publishing required
- Easy to version with the app
- Simpler dependency management

## Performance Considerations

### Memory Management

- UIHostingController is retained as a property
- View hierarchy is properly constrained using Auto Layout
- No retain cycles (all references are owned, not weak/unowned)

### Rendering

- SwiftUI view updates are driven by prop changes
- UIHostingController efficiently diffs the SwiftUI view tree
- Native 60fps rendering

### Future Optimizations

- [ ] Implement view recycling for list rendering
- [ ] Add loading states and skeleton views
- [ ] Implement pull-to-refresh natively
- [ ] Optimize image loading with native cache
- [ ] Add virtualization for large lists

## Extension Points

### Adding New Props

1. Add prop to `FeedNativeViewProps` in `FeedNativeView.types.ts`
2. Add prop mapping in `FeedNativeModule.swift`
3. Add property and didSet handler in `FeedNativeView.swift`
4. Use the prop in `FeedSwiftUIView`

### Adding Events

```swift
// In FeedNativeModule.swift
Events("onItemPress")

// In FeedNativeView.swift
self.onItemPress?(["itemId": itemId])
```

### Adding Methods

```swift
// In FeedNativeModule.swift
AsyncFunction("refresh") { (view: FeedNativeView) in
  view.refresh()
}
```

## Testing Strategy

### Unit Tests
- Swift tests for FeedNativeView logic
- TypeScript tests for component interface

### Integration Tests
- End-to-end tests with Detox
- Verify prop updates work correctly
- Test navigation to/from native views

### Visual Tests
- SwiftUI Previews for rapid UI iteration
- Snapshot tests for consistency

## Future Enhancements

1. **Feed Data Integration**
   - Connect to AT Protocol feed fetching
   - Implement infinite scroll
   - Add skeleton loading states

2. **Gestures**
   - Native swipe actions
   - Pull to refresh
   - Long press menus

3. **Animations**
   - Native shared element transitions
   - List item animations
   - Loading state transitions

4. **Accessibility**
   - VoiceOver support
   - Dynamic Type support
   - Accessibility labels

5. **Theming**
   - Bridge theme from React Native
   - Support light/dark mode
   - Custom color schemes
