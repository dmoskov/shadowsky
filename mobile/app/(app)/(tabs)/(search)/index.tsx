import { useLocalSearchParams } from "expo-router";
import { SearchScreen } from "../../../../src/screens/search/SearchScreen";

export default function SearchRoute() {
  const { query } = useLocalSearchParams<{ query?: string }>();
  return <SearchScreen query={query} />;
}
