import net from "net";
import { Domain } from "../models/User.js";
import { getUserByEmail } from "./authService.js";

export function startPostfixTcpMap(port = 10023): void {
  const server = net.createServer(socket => {
    let buf = "";
    socket.on("data", chunk => {
      buf += chunk.toString();
      const lines = buf.split("\n");
      buf = lines.pop() ?? "";
      for (const raw of lines) {
        const line = raw.trim();
        if (!line.startsWith("get ")) continue;
        const key = line.slice(4).trim().toLowerCase();
        handleLookup(key).then(reply => {
          socket.write(reply + "\n");
        }).catch(() => {
          socket.write("500 internal error\n");
        });
      }
    });
    socket.on("error", () => socket.destroy());
  });

  server.listen(port, "0.0.0.0", () => {
    console.log(`Postfix TCP map server listening on port ${port}`);
  });
}

async function handleLookup(key: string): Promise<string> {
  if (key.includes("@")) {
    // Mailbox lookup: john@citizenjaivik.com
    const [local, domain] = key.split("@");
    const user = await getUserByEmail(key);
    if (!user || !user.active) return "500 not found";
    const maildir = `${domain}/${local}/`;
    return `200 ${maildir}`;
  } else {
    // Domain lookup: citizenjaivik.com
    const domain = await Domain.findOne({ name: key, active: true });
    if (!domain) return "500 not found";
    return "200 OK";
  }
}
