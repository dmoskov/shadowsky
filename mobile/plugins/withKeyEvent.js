const { withAppDelegate } = require('@expo/config-plugins');

/**
 * Config plugin to add react-native-keyevent support to iOS
 * This is needed because react-native-keyevent requires native code modifications
 */
const withKeyEvent = (config) => {
  return withAppDelegate(config, async (config) => {
    const { modResults } = config;
    const { contents } = modResults;

    // Add import for RNKeyEvent
    if (!contents.includes('#import "RNKeyEvent.h"')) {
      modResults.contents = contents.replace(
        /#import "AppDelegate.h"/,
        `#import "AppDelegate.h"\n#import "RNKeyEvent.h"`
      );
    }

    return config;
  });
};

module.exports = withKeyEvent;
