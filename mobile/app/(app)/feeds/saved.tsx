import {Stack} from 'expo-router';
import {SavedFeedsScreen} from '../../../src/screens/feeds/SavedFeedsScreen';

export default function SavedFeedsRoute() {
  return (
    <>
      <Stack.Screen
        options={{
          title: 'My Feeds',
          headerShown: true,
        }}
      />
      <SavedFeedsScreen />
    </>
  );
}
