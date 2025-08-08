import { useCallback, useState } from "react";

interface DragAnimationState {
  isDragging: boolean;
  dragPosition: { x: number; y: number };
  isDragOver: boolean;
}

export function useDragAnimation() {
  const [dragState, setDragState] = useState<DragAnimationState>({
    isDragging: false,
    dragPosition: { x: 0, y: 0 },
    isDragOver: false,
  });

  const handleDragStart = useCallback((e: React.DragEvent) => {
    setDragState({
      isDragging: true,
      dragPosition: { x: e.clientX, y: e.clientY },
      isDragOver: false,
    });

    // Add visual feedback class to body
    document.body.classList.add("dragging-active");

    // Create ripple effect at drag start position
    const ripple = document.createElement("div");
    ripple.className = "drag-ripple";
    ripple.style.left = `${e.clientX}px`;
    ripple.style.top = `${e.clientY}px`;
    document.body.appendChild(ripple);

    setTimeout(() => {
      ripple.remove();
    }, 600);
  }, []);

  const handleDragEnd = useCallback(() => {
    setDragState({
      isDragging: false,
      dragPosition: { x: 0, y: 0 },
      isDragOver: false,
    });

    // Remove visual feedback class from body
    document.body.classList.remove("dragging-active");
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragState((prev) => ({
      ...prev,
      isDragOver: true,
      dragPosition: { x: e.clientX, y: e.clientY },
    }));
  }, []);

  const handleDragLeave = useCallback(() => {
    setDragState((prev) => ({
      ...prev,
      isDragOver: false,
    }));
  }, []);

  return {
    dragState,
    handleDragStart,
    handleDragEnd,
    handleDragOver,
    handleDragLeave,
  };
}
