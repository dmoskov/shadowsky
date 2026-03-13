import {Stack, useLocalSearchParams, useRouter} from 'expo-router';
import {LikesScreen} from '../../../../src/screens/shared/LikesScreen';
import {ErrorState} from '../../../../src/components/ErrorState';

export default function PostLikesRoute() {
  const {uri} = useLocalSearchParams<{uri: string}>();
  const router = useRouter();

  if (!uri) {
    return <ErrorState message="Missing post URI parameter" />;
  }

  // Decode the URI since it comes URL-encoded from the router
  const decodedUri = decodeURIComponent(uri);

  const handleNavigateToProfile = (handle: string) => {
    router.push(`/(app)/post/profile/${handle}`);
  };

  return (
    <>
      <Stack.Screen
        options={{
          title: 'Liked By',
          headerShown: true,
        }}
      />
      <LikesScreen postUri={decodedUri} onNavigateToProfile={handleNavigateToProfile} />
    </>
  );
}
