/**
 * BlurOverlay - Reusable blur backdrop for modals and sheets.
 *
 * Renders an expo-blur BlurView that fills its parent absolutely,
 * providing a frosted-glass overlay behind modal content.
 * Automatically adapts tint to the current color scheme.
 */

import { BlurView } from "expo-blur";
import React from "react";
import { StyleSheet, useColorScheme } from "react-native";

interface BlurOverlayProps {
  /** Blur intensity (0–100). Default 30 for modal backdrops. */
  intensity?: number;
  /** Override automatic tint selection. */
  tint?: "light" | "dark";
}

export function BlurOverlay({ intensity = 30, tint }: BlurOverlayProps) {
  const colorScheme = useColorScheme();
  const resolvedTint = tint ?? (colorScheme === "dark" ? "dark" : "light");

  return (
    <BlurView
      intensity={intensity}
      tint={resolvedTint}
      style={StyleSheet.absoluteFill}
    />
  );
}
