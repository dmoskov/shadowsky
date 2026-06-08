import { ChevronDown, ChevronRight } from "lucide-react";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useMemo,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import { usePrefersReducedMotion } from "../../contexts/AccessibilityContext";

/**
 * DisclosurePanel - A unified expand/collapse component
 *
 * Replaces various disclosure patterns in the codebase with a standardized component
 * that supports proper ARIA attributes, keyboard navigation, and smooth animations.
 *
 * Variants:
 * - collapsible: Standard expand/collapse (default)
 * - accordion: For use within AccordionGroup - only one panel open at a time
 * - details: Mimics HTML <details> element behavior
 *
 * @example
 * // Basic usage with composition pattern
 * <DisclosurePanel>
 *   <DisclosureTrigger>Click to expand</DisclosureTrigger>
 *   <DisclosureContent>Hidden content here</DisclosureContent>
 * </DisclosurePanel>
 *
 * @example
 * // With custom trigger
 * <DisclosurePanel defaultOpen={true}>
 *   <DisclosureTrigger className="custom-class">
 *     {({ isOpen }) => (
 *       <span>{isOpen ? 'Close' : 'Open'} section</span>
 *     )}
 *   </DisclosureTrigger>
 *   <DisclosureContent>Content</DisclosureContent>
 * </DisclosurePanel>
 *
 * @example
 * // Accordion group - only one open at a time
 * <AccordionGroup>
 *   <DisclosurePanel variant="accordion" id="panel-1">
 *     <DisclosureTrigger>Panel 1</DisclosureTrigger>
 *     <DisclosureContent>Content 1</DisclosureContent>
 *   </DisclosurePanel>
 *   <DisclosurePanel variant="accordion" id="panel-2">
 *     <DisclosureTrigger>Panel 2</DisclosureTrigger>
 *     <DisclosureContent>Content 2</DisclosureContent>
 *   </DisclosurePanel>
 * </AccordionGroup>
 */

// ============================================================================
// Types
// ============================================================================

type DisclosureVariant = "collapsible" | "accordion" | "details";

interface DisclosurePanelContextValue {
  isOpen: boolean;
  toggle: () => void;
  open: () => void;
  close: () => void;
  triggerId: string;
  contentId: string;
  variant: DisclosureVariant;
  disabled: boolean;
}

interface AccordionGroupContextValue {
  openPanelId: string | null;
  setOpenPanelId: (id: string | null) => void;
  registerPanel: (id: string) => void;
  unregisterPanel: (id: string) => void;
}

// ============================================================================
// Contexts
// ============================================================================

const DisclosurePanelContext =
  createContext<DisclosurePanelContextValue | null>(null);

const AccordionGroupContext = createContext<AccordionGroupContextValue | null>(
  null,
);

// ============================================================================
// Hooks
// ============================================================================

export function useDisclosurePanel() {
  const context = useContext(DisclosurePanelContext);
  if (!context) {
    throw new Error(
      "useDisclosurePanel must be used within a DisclosurePanel component",
    );
  }
  return context;
}

function useAccordionGroup() {
  return useContext(AccordionGroupContext);
}

// ============================================================================
// AccordionGroup Component
// ============================================================================

interface AccordionGroupProps {
  children: ReactNode;
  defaultOpenId?: string;
  allowAllClosed?: boolean;
  className?: string;
}

export function AccordionGroup({
  children,
  defaultOpenId,
  allowAllClosed = true,
  className = "",
}: AccordionGroupProps) {
  const [openPanelId, setOpenPanelId] = useState<string | null>(
    defaultOpenId || null,
  );
  const [registeredPanels] = useState<Set<string>>(() => new Set());

  const registerPanel = useCallback(
    (id: string) => {
      registeredPanels.add(id);
    },
    [registeredPanels],
  );

  const unregisterPanel = useCallback(
    (id: string) => {
      registeredPanels.delete(id);
    },
    [registeredPanels],
  );

  const handleSetOpenPanelId = useCallback(
    (id: string | null) => {
      if (id === null && !allowAllClosed && registeredPanels.size > 0) {
        return;
      }
      setOpenPanelId(id);
    },
    [allowAllClosed, registeredPanels],
  );

  const value = useMemo(
    () => ({
      openPanelId,
      setOpenPanelId: handleSetOpenPanelId,
      registerPanel,
      unregisterPanel,
    }),
    [openPanelId, handleSetOpenPanelId, registerPanel, unregisterPanel],
  );

  return (
    <AccordionGroupContext.Provider value={value}>
      <div className={className} role="group">
        {children}
      </div>
    </AccordionGroupContext.Provider>
  );
}

// ============================================================================
// DisclosurePanel Component
// ============================================================================

interface DisclosurePanelProps {
  children: ReactNode;
  defaultOpen?: boolean;
  isOpen?: boolean;
  onToggle?: (isOpen: boolean) => void;
  variant?: DisclosureVariant;
  id?: string;
  disabled?: boolean;
  className?: string;
}

export function DisclosurePanel({
  children,
  defaultOpen = false,
  isOpen: controlledIsOpen,
  onToggle,
  variant = "collapsible",
  id,
  disabled = false,
  className = "",
}: DisclosurePanelProps) {
  const generatedId = useId();
  const panelId = id || generatedId;
  const triggerId = `disclosure-trigger-${panelId}`;
  const contentId = `disclosure-content-${panelId}`;

  const accordionGroup = useAccordionGroup();
  const isAccordion = variant === "accordion" && accordionGroup;

  const [internalOpen, setInternalOpen] = useState(defaultOpen);

  const isControlled = controlledIsOpen !== undefined;
  const isOpen = isAccordion
    ? accordionGroup.openPanelId === panelId
    : isControlled
      ? controlledIsOpen
      : internalOpen;

  useEffect(() => {
    if (isAccordion) {
      accordionGroup.registerPanel(panelId);
      return () => accordionGroup.unregisterPanel(panelId);
    }
  }, [isAccordion, accordionGroup, panelId]);

  const toggle = useCallback(() => {
    if (disabled) return;

    const newState = !isOpen;

    if (isAccordion) {
      accordionGroup.setOpenPanelId(newState ? panelId : null);
    } else if (!isControlled) {
      setInternalOpen(newState);
    }

    onToggle?.(newState);
  }, [
    disabled,
    isOpen,
    isAccordion,
    accordionGroup,
    panelId,
    isControlled,
    onToggle,
  ]);

  const open = useCallback(() => {
    if (disabled || isOpen) return;

    if (isAccordion) {
      accordionGroup.setOpenPanelId(panelId);
    } else if (!isControlled) {
      setInternalOpen(true);
    }

    onToggle?.(true);
  }, [
    disabled,
    isOpen,
    isAccordion,
    accordionGroup,
    panelId,
    isControlled,
    onToggle,
  ]);

  const close = useCallback(() => {
    if (disabled || !isOpen) return;

    if (isAccordion) {
      accordionGroup.setOpenPanelId(null);
    } else if (!isControlled) {
      setInternalOpen(false);
    }

    onToggle?.(false);
  }, [disabled, isOpen, isAccordion, accordionGroup, isControlled, onToggle]);

  const contextValue = useMemo<DisclosurePanelContextValue>(
    () => ({
      isOpen,
      toggle,
      open,
      close,
      triggerId,
      contentId,
      variant,
      disabled,
    }),
    [isOpen, toggle, open, close, triggerId, contentId, variant, disabled],
  );

  return (
    <DisclosurePanelContext.Provider value={contextValue}>
      <div
        className={className}
        data-disclosure-state={isOpen ? "open" : "closed"}
      >
        {children}
      </div>
    </DisclosurePanelContext.Provider>
  );
}

// ============================================================================
// DisclosureTrigger Component
// ============================================================================

type TriggerRenderProp = (state: {
  isOpen: boolean;
  disabled: boolean;
}) => ReactNode;

interface DisclosureTriggerProps {
  children: ReactNode | TriggerRenderProp;
  className?: string;
  showIcon?: boolean;
  iconPosition?: "left" | "right";
  as?: "button" | "div";
}

export function DisclosureTrigger({
  children,
  className = "",
  showIcon = true,
  iconPosition = "right",
  as = "button",
}: DisclosureTriggerProps) {
  const { isOpen, toggle, triggerId, contentId, disabled } =
    useDisclosurePanel();

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLButtonElement | HTMLDivElement>) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        toggle();
      }
    },
    [toggle],
  );

  const handleClick = useCallback(() => {
    toggle();
  }, [toggle]);

  const Icon = isOpen ? ChevronDown : ChevronRight;

  const content =
    typeof children === "function" ? children({ isOpen, disabled }) : children;

  const iconElement = showIcon && (
    <Icon
      size={16}
      className="flex-shrink-0 transition-transform duration-200"
      aria-hidden="true"
    />
  );

  const commonProps = {
    id: triggerId,
    "aria-expanded": isOpen,
    "aria-controls": contentId,
    "aria-disabled": disabled,
    onClick: disabled ? undefined : handleClick,
    onKeyDown: disabled ? undefined : handleKeyDown,
    className: `touch-target flex items-center gap-2 ${disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"} ${className}`,
    style: { color: "var(--asph-text-primary)" } as React.CSSProperties,
    "data-disclosure-trigger": true,
  };

  if (as === "div") {
    return (
      <div {...commonProps} role="button" tabIndex={disabled ? -1 : 0}>
        {iconPosition === "left" && iconElement}
        {content}
        {iconPosition === "right" && iconElement}
      </div>
    );
  }

  return (
    <button type="button" disabled={disabled} {...commonProps}>
      {iconPosition === "left" && iconElement}
      {content}
      {iconPosition === "right" && iconElement}
    </button>
  );
}

// ============================================================================
// DisclosureContent Component
// ============================================================================

interface DisclosureContentProps {
  children: ReactNode;
  className?: string;
  animate?: boolean;
  unmountOnClose?: boolean;
}

export function DisclosureContent({
  children,
  className = "",
  animate = true,
  unmountOnClose = false,
}: DisclosureContentProps) {
  const { isOpen, triggerId, contentId, variant } = useDisclosurePanel();
  const [shouldRender, setShouldRender] = useState(isOpen);
  const prefersReducedMotion = usePrefersReducedMotion();

  // Disable animation when user prefers reduced motion
  const shouldAnimate = animate && !prefersReducedMotion;

  useEffect(() => {
    if (isOpen) {
      setShouldRender(true);
    } else if (!shouldAnimate && unmountOnClose) {
      // No transition fires when animation is disabled, so unmount directly.
      setShouldRender(false);
    }
  }, [isOpen, shouldAnimate, unmountOnClose]);

  const handleTransitionEnd = useCallback(() => {
    if (!isOpen && unmountOnClose) {
      setShouldRender(false);
    }
  }, [isOpen, unmountOnClose]);

  if (unmountOnClose && !shouldRender) {
    return null;
  }

  // Expand/collapse by animating grid-template-rows from 0fr to 1fr. Unlike
  // animating `height`, this needs no JS measurement of scrollHeight (which
  // forces a synchronous reflow on every open/close) — the grid resolves the
  // content's natural height itself.
  const animationStyles: CSSProperties = {
    display: "grid",
    gridTemplateRows: isOpen ? "1fr" : "0fr",
    ...(shouldAnimate
      ? { transition: "grid-template-rows 200ms ease-in-out" }
      : {}),
  };

  return (
    <div
      id={contentId}
      role={variant === "details" ? undefined : "region"}
      aria-labelledby={triggerId}
      aria-hidden={!isOpen}
      style={animationStyles}
      className={className}
      onTransitionEnd={handleTransitionEnd}
      data-disclosure-content
      data-state={isOpen ? "open" : "closed"}
    >
      <div
        style={{
          overflow: "hidden",
          minHeight: 0,
          visibility: isOpen ? "visible" : "hidden",
        }}
      >
        {children}
      </div>
    </div>
  );
}

// ============================================================================
// Compound Export
// ============================================================================

export const Disclosure = {
  Panel: DisclosurePanel,
  Trigger: DisclosureTrigger,
  Content: DisclosureContent,
  Group: AccordionGroup,
};

export default DisclosurePanel;
