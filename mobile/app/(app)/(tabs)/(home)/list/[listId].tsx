import { useRequiredParam } from "../../../../../src/hooks/useRequiredParam";
import { ListTimelineScreen } from "../../../../../src/screens/lists/ListTimelineScreen";
import { ErrorState } from "../../../../../src/components/ErrorState";

export default function ListRoute() {
  const { value: listId, isValid } = useRequiredParam("listId");

  if (!isValid || !listId) {
    return <ErrorState message="Missing list ID" />;
  }

  return <ListTimelineScreen listId={listId} />;
}
