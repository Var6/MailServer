import InboxList   from "../components/Mail/InboxList.tsx";
import MessageView from "../components/Mail/MessageView.tsx";

export default function InboxPage() {
  return (
    <div className="flex h-full overflow-hidden">
      <InboxList />
      <MessageView />
    </div>
  );
}
