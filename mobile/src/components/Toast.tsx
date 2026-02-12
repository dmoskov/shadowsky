import { useEffect, useRef, useState } from "react";
import {
  Animated,
  Dimensions,
  PanResponder,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import type { ToastData, ToastType } from "../contexts/ToastContext";

interface ToastProps {
  toasts: ToastData[];
  onDismiss: (id: string) => void;
}

const TOAST_COLORS: Record<
  ToastType,
  { bg: string; border: string; text: string }
> = {
  success: {
    bg: "#10B981",
    border: "#059669",
    text: "#FFFFFF",
  },
  error: {
    bg: "#EF4444",
    border: "#DC2626",
    text: "#FFFFFF",
  },
  warning: {
    bg: "#F59E0B",
    border: "#D97706",
    text: "#FFFFFF",
  },
  info: {
    bg: "#3B82F6",
    border: "#2563EB",
    text: "#FFFFFF",
  },
};

function ToastItem({
  toast,
  onDismiss,
  index,
}: {
  toast: ToastData;
  onDismiss: (id: string) => void;
  index: number;
}) {
  const translateY = useRef(new Animated.Value(100)).current;
  const translateX = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const [timeLeft, setTimeLeft] = useState(toast.duration);

  const colors = TOAST_COLORS[toast.type];

  useEffect(() => {
    // Entrance animation
    Animated.parallel([
      Animated.spring(translateY, {
        toValue: 0,
        useNativeDriver: true,
        tension: 65,
        friction: 8,
      }),
      Animated.timing(opacity, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start();

    // Auto-dismiss timer
    let intervalId: ReturnType<typeof setInterval> | undefined;
    if (toast.duration > 0) {
      const startTime = Date.now();
      intervalId = setInterval(() => {
        const elapsed = Date.now() - startTime;
        const remaining = Math.max(0, toast.duration - elapsed);
        setTimeLeft(remaining);

        if (remaining === 0) {
          clearInterval(intervalId);
          if (toast.onExpire) {
            toast.onExpire();
          }
          handleDismiss();
        }
      }, 50);
    }

    return () => {
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, []);

  const handleDismiss = () => {
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: 100,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start(() => {
      onDismiss(toast.id);
    });
  };

  const handleAction = () => {
    if (toast.action) {
      toast.action.onClick();
      handleDismiss();
    }
  };

  // Swipe to dismiss
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => toast.dismissible,
      onMoveShouldSetPanResponder: (_, gestureState) =>
        toast.dismissible && Math.abs(gestureState.dx) > 10,
      onPanResponderMove: (_, gestureState) => {
        if (toast.dismissible) {
          translateX.setValue(gestureState.dx);
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        if (toast.dismissible) {
          const screenWidth = Dimensions.get("window").width;
          if (Math.abs(gestureState.dx) > screenWidth * 0.3) {
            // Swipe threshold reached, dismiss
            Animated.parallel([
              Animated.timing(translateX, {
                toValue: gestureState.dx > 0 ? screenWidth : -screenWidth,
                duration: 200,
                useNativeDriver: true,
              }),
              Animated.timing(opacity, {
                toValue: 0,
                duration: 200,
                useNativeDriver: true,
              }),
            ]).start(() => {
              onDismiss(toast.id);
            });
          } else {
            // Return to original position
            Animated.spring(translateX, {
              toValue: 0,
              useNativeDriver: true,
              tension: 65,
              friction: 8,
            }).start();
          }
        }
      },
    }),
  ).current;

  const progress = toast.showCountdown ? timeLeft / toast.duration : 0;

  return (
    <Animated.View
      style={[
        styles.toastContainer,
        {
          transform: [{ translateY }, { translateX }],
          opacity,
          bottom: 80 + index * 70, // Stack toasts with spacing
        },
      ]}
      {...panResponder.panHandlers}
    >
      <View
        style={[
          styles.toast,
          {
            backgroundColor: colors.bg,
            borderColor: colors.border,
          },
        ]}
      >
        <View style={styles.toastContent}>
          <Text style={[styles.toastText, { color: colors.text }]}>
            {toast.message}
          </Text>
          {toast.action && (
            <TouchableOpacity
              style={styles.actionButton}
              onPress={handleAction}
            >
              <Text style={[styles.actionText, { color: colors.text }]}>
                {toast.action.label}
              </Text>
            </TouchableOpacity>
          )}
        </View>
        {toast.showCountdown && (
          <View style={styles.progressBar}>
            <View
              style={[
                styles.progressFill,
                {
                  width: `${progress * 100}%`,
                  backgroundColor: colors.border,
                },
              ]}
            />
          </View>
        )}
      </View>
    </Animated.View>
  );
}

export default function Toast({ toasts, onDismiss }: ToastProps) {
  return (
    <>
      {toasts.map((toast, index) => (
        <ToastItem
          key={toast.id}
          toast={toast}
          onDismiss={onDismiss}
          index={index}
        />
      ))}
    </>
  );
}

const styles = StyleSheet.create({
  toastContainer: {
    position: "absolute",
    left: 16,
    right: 16,
    zIndex: 9999,
  },
  toast: {
    borderRadius: 12,
    borderWidth: 1,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  toastContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  toastText: {
    fontSize: 14,
    fontWeight: "500",
    flex: 1,
    marginRight: 8,
  },
  actionButton: {
    paddingVertical: 4,
    paddingHorizontal: 12,
    borderRadius: 6,
    backgroundColor: "rgba(255, 255, 255, 0.2)",
  },
  actionText: {
    fontSize: 14,
    fontWeight: "600",
  },
  progressBar: {
    height: 3,
    backgroundColor: "rgba(0, 0, 0, 0.1)",
  },
  progressFill: {
    height: "100%",
  },
});
