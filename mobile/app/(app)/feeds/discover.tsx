import {Stack} from 'expo-router';
import {FeedDiscoveryScreen} from '../../../src/screens/feeds/FeedDiscoveryScreen';

export default function FeedDiscoveryRoute() {
  return (
    <>
      <Stack.Screen
        options={{
          title: 'Discover Feeds',
          headerShown: true,
        }}
      />
      <FeedDiscoveryScreen />
    </>
  );
}
