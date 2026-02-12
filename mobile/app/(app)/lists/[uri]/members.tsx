import {useLocalSearchParams} from 'expo-router';
import {ListDetailScreen} from '../../../../src/screens/lists/ListDetailScreen';

export default function ListMembersRoute() {
  const {uri} = useLocalSearchParams<{uri: string}>();

  if (!uri) {
    return null;
  }

  // Decode the URI since it was encoded when passed
  const decodedUri = decodeURIComponent(uri);

  return <ListDetailScreen listUri={decodedUri} />;
}
