import { useRouter } from "expo-router";
import { DataExportScreen } from "../../../src/screens/settings/DataExportScreen";

export default function DataExportRoute() {
  const router = useRouter();

  return (
    <DataExportScreen
      navigation={{
        goBack: () => router.back(),
      }}
    />
  );
}
