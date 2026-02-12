import {Stack, useLocalSearchParams, useRouter} from 'expo-router';
import {FollowersScreen} from '../../../../../src/screens/profile/FollowersScreen';
import {ErrorState} from '../../../../../src/components/ErrorState';

export default function FollowersRoute() {
  const {actor} = useLocalSearchParams<{actor: string}>();
  const router = useRouter();

  if (!actor) {
    return <ErrorState message="Missing actor parameter" />;
  }

  const handleNavigateToProfile = (handle: string) => {
    router.push(`/(app)/(tabs)/(profile)/user/${handle}`);
  };

  return (
    <>
      <Stack.Screen
        options={{
          title: 'Followers',
          headerShown: true,
        }}
      />
      <FollowersScreen actor={actor} onNavigateToProfile={handleNavigateToProfile} />
    </>
  );
}
