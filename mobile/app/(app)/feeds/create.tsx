import {Stack} from 'expo-router';
import {FeedCreationScreen} from '../../../src/screens/feeds/FeedCreationScreen';

export default function FeedCreationRoute() {
  return (
    <>
      <Stack.Screen
        options={{
          title: 'Create Feed',
          headerShown: true,
        }}
      />
      <FeedCreationScreen />
    </>
  );
}
