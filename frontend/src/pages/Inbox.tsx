import { useEffect } from "react";
import { useParams } from "react-router-dom";
import InboxList   from "../components/Mail/InboxList.tsx";
import MessageView from "../components/Mail/MessageView.tsx";
import { useMailStore } from "../store/index.ts";
import { slugToFolder } from "../lib/mailFolders.ts";

export default function InboxPage() {
  const { folder } = useParams<{ folder: string }>();
  const setFolder = useMailStore(s => s.setFolder);

  useEffect(() => {
    setFolder(slugToFolder(folder));
  }, [folder, setFolder]);

  return (
    <div className="flex h-full overflow-hidden">
      <InboxList />
      <MessageView />
    </div>
  );
}
