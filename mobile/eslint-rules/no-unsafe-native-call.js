/**
 * ESLint rule to detect native module calls that aren't wrapped in try/catch
 *
 * Native modules (expo-*, react-native) can throw at runtime when the native
 * bridge is unavailable (e.g., running in Expo Go, web, or when a module
 * isn't linked). Calls to these APIs should be guarded with try/catch.
 *
 * Examples:
 *   BAD:  Notifications.setNotificationHandler(...)
 *   GOOD: try { Notifications.setNotificationHandler(...) } catch (e) { ... }
 *
 *   BAD:  await ImagePicker.launchImageLibraryAsync(...)
 *   GOOD: try { await ImagePicker.launchImageLibraryAsync(...) } catch (e) { ... }
 */

// Known native module namespaces whose method calls should be guarded
const NATIVE_MODULES = new Set([
  'Notifications',
  'ImagePicker',
  'Camera',
  'MediaLibrary',
  'FileSystem',
  'Haptics',
  'Sharing',
  'LocalAuthentication',
  'Device',
  'Crypto',
  'SecureStore',
  'DocumentPicker',
  'ImageManipulator',
  'VideoThumbnails',
  'BackgroundFetch',
  'TaskManager',
  'Updates',
  'WebBrowser',
  'Linking',
  'Clipboard',
  'BarCodeScanner',
  'Audio',
  'Video',
]);

// Methods that are safe to call without try/catch (pure configuration, no native bridge calls)
const SAFE_METHODS = new Set([
  'addEventListener',
  'removeEventListener',
  'addListener',
  'removeListener',
  'removeSubscription',
]);

module.exports = {
  meta: {
    type: 'suggestion',
    docs: {
      description:
        'Require try/catch around native module method calls that may throw',
      category: 'Best Practices',
      recommended: true,
    },
    schema: [
      {
        type: 'object',
        properties: {
          additionalModules: {
            type: 'array',
            items: { type: 'string' },
          },
        },
        additionalProperties: false,
      },
    ],
    messages: {
      unsafeNativeCall:
        'Native module call "{{callee}}" should be wrapped in a try/catch block. Native APIs can throw when the native bridge is unavailable.',
    },
  },

  create(context) {
    const options = context.options[0] || {};
    const additionalModules = new Set(options.additionalModules || []);
    const allModules = new Set([...NATIVE_MODULES, ...additionalModules]);

    /**
     * Check whether a node is inside a try block (not catch/finally)
     */
    function isInsideTryBlock(node) {
      let current = node.parent;
      while (current) {
        if (current.type === 'TryStatement') {
          // Make sure we're in the `block` part, not catch/finally
          if (current.block && isDescendant(node, current.block)) {
            return true;
          }
        }
        // Also safe if inside a catch clause (we're already handling errors)
        if (current.type === 'CatchClause') {
          return true;
        }
        current = current.parent;
      }
      return false;
    }

    /**
     * Check if `node` is a descendant of `ancestor`
     */
    function isDescendant(node, ancestor) {
      let current = node.parent;
      while (current) {
        if (current === ancestor) return true;
        current = current.parent;
      }
      return false;
    }

    /**
     * Get the full callee text for reporting (e.g., "Notifications.setNotificationHandler")
     */
    function getCalleeText(node) {
      if (
        node.callee.type === 'MemberExpression' &&
        node.callee.object.type === 'Identifier' &&
        node.callee.property.type === 'Identifier'
      ) {
        return `${node.callee.object.name}.${node.callee.property.name}`;
      }
      return context.getSourceCode().getText(node.callee);
    }

    return {
      CallExpression(node) {
        // Only check Module.method() patterns
        if (
          node.callee.type !== 'MemberExpression' ||
          node.callee.object.type !== 'Identifier' ||
          node.callee.property.type !== 'Identifier'
        ) {
          return;
        }

        const moduleName = node.callee.object.name;
        const methodName = node.callee.property.name;

        // Skip if not a known native module
        if (!allModules.has(moduleName)) return;

        // Skip safe methods (event listeners, etc.)
        if (SAFE_METHODS.has(methodName)) return;

        // Check if already inside try/catch
        if (isInsideTryBlock(node)) return;

        context.report({
          node,
          messageId: 'unsafeNativeCall',
          data: {
            callee: getCalleeText(node),
          },
        });
      },
    };
  },
};
