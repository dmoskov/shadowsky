import { useLocalSearchParams } from "expo-router";
import { SearchScreen } from "../../../../src/screens/search/SearchScreen";

export default function SearchRoute() {
  const { q } = useLocalSearchParams<{ q?: string }>();
  return <SearchScreen query={q} />;
}
