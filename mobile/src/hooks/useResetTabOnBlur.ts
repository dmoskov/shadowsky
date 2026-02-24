import { useEffect } from "react";
import { useNavigation } from "@react-navigation/native";
import { StackActions } from "@react-navigation/native";

/**
 * Resets a tab's stack navigator to its root screen when the user
 * switches away from the tab. This prevents stale deep navigation
 * states from persisting across tab switches.
 */
export function useResetTabOnBlur() {
  const navigation = useNavigation();

  useEffect(() => {
    const parent = navigation.getParent();
    if (!parent) return;

    const unsubscribe = parent.addListener("blur", () => {
      if (navigation.canGoBack()) {
        navigation.dispatch(StackActions.popToTop());
      }
    });
    return unsubscribe;
  }, [navigation]);
}
