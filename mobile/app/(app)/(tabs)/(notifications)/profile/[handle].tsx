import { useRequiredParam } from "../../../../../src/hooks/useRequiredParam";
import { ProfileScreen } from "../../../../../src/screens/profile/ProfileScreen";
import { ErrorState } from "../../../../../src/components/ErrorState";

export default function ProfileRoute() {
  const { value: handle, isValid } = useRequiredParam("handle");

  if (!isValid || !handle) {
    return <ErrorState message="Missing profile handle" />;
  }

  return <ProfileScreen handle={handle} />;
}
