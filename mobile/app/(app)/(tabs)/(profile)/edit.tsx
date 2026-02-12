import { useRouter } from "expo-router";
import { EditProfileScreen } from "../../../../src/screens/profile/EditProfileScreen";

export default function EditProfileRoute() {
  const router = useRouter();

  const handleSave = () => {
    router.back();
  };

  const handleCancel = () => {
    router.back();
  };

  return <EditProfileScreen onSave={handleSave} onCancel={handleCancel} />;
}
