import axios from "axios";
import { config } from "../config/index.js";

/**
 * Create or sync a user in Nextcloud via the OCS Provisioning API.
 * Called at user-creation time and on admin password reset.
 * Errors are swallowed by the caller (fire-and-forget).
 */
export async function provisionUser(email: string, password: string): Promise<void> {
  const ncBase    = config.NEXTCLOUD_URL;
  const ncAdmin   = config.NEXTCLOUD_ADMIN_USER;
  const ncAdminPw = config.NEXTCLOUD_ADMIN_PASSWORD;
  const ocsHeaders = { "OCS-APIRequest": "true", "Content-Type": "application/x-www-form-urlencoded" };

  const userExists = await axios.get(
    `${ncBase}/ocs/v1.php/cloud/users/${encodeURIComponent(email)}?format=json`,
    { auth: { username: ncAdmin, password: ncAdminPw }, headers: { "OCS-APIRequest": "true" }, validateStatus: () => true }
  ).then(r => r.data?.ocs?.meta?.statuscode === 100);

  if (!userExists) {
    await axios.post(
      `${ncBase}/ocs/v1.php/cloud/users?format=json`,
      `userid=${encodeURIComponent(email)}&password=${encodeURIComponent(password)}&email=${encodeURIComponent(email)}`,
      { auth: { username: ncAdmin, password: ncAdminPw }, headers: ocsHeaders, validateStatus: () => true }
    );
  } else {
    await axios.put(
      `${ncBase}/ocs/v1.php/cloud/users/${encodeURIComponent(email)}?format=json`,
      `key=password&value=${encodeURIComponent(password)}`,
      { auth: { username: ncAdmin, password: ncAdminPw }, headers: ocsHeaders, validateStatus: () => true }
    );
  }
}

function ncClient(email: string, password: string) {
  return axios.create({
    baseURL: config.NEXTCLOUD_URL,
    auth: { username: email, password },
    headers: { "OCS-APIRequest": "true" },
  });
}

export async function getContacts(email: string, password: string): Promise<unknown[]> {
  const client = ncClient(email, password);
  const resp = await client.request({
    method: "REPORT",
    url: `/remote.php/dav/addressbooks/users/${encodeURIComponent(email)}/contacts/`,
    headers: {
      "Content-Type": "application/xml",
      Depth: "1",
    },
    data: `<?xml version="1.0" encoding="utf-8"?>
<c:addressbook-query xmlns:d="DAV:" xmlns:c="urn:ietf:params:xml:ns:carddav">
  <d:prop>
    <d:getetag/>
    <c:address-data/>
  </d:prop>
</c:addressbook-query>`,
  });
  return resp.data;
}

export async function getEvents(
  email: string,
  password: string,
  start: string,
  end: string
): Promise<unknown[]> {
  const client = ncClient(email, password);
  const resp = await client.request({
    method: "REPORT",
    url: `/remote.php/dav/calendars/${encodeURIComponent(email)}/personal/`,
    headers: {
      "Content-Type": "application/xml",
      Depth: "1",
    },
    data: `<?xml version="1.0" encoding="utf-8"?>
<c:calendar-query xmlns:d="DAV:" xmlns:c="urn:ietf:params:xml:ns:caldav">
  <d:prop>
    <d:getetag/>
    <c:calendar-data/>
  </d:prop>
  <c:filter>
    <c:comp-filter name="VCALENDAR">
      <c:comp-filter name="VEVENT">
        <c:time-range start="${start}" end="${end}"/>
      </c:comp-filter>
    </c:comp-filter>
  </c:filter>
</c:calendar-query>`,
  });
  return resp.data;
}

interface FileEntry {
  name: string;
  isDirectory: boolean;
  contentType: string;
  size: number;
}

function parseWebDAV(xml: string, davBasePath: string): FileEntry[] {
  const files: FileEntry[] = [];
  const responses = xml.match(/<d:response[\s\S]*?<\/d:response>/g) ?? [];

  for (const block of responses) {
    const hrefMatch = block.match(/<d:href>([\s\S]*?)<\/d:href>/);
    if (!hrefMatch) continue;

    const href = decodeURIComponent(hrefMatch[1].trim());

    // Skip the directory itself (href ends with the requested path)
    const normalized = href.replace(/\/$/, "");
    const base       = davBasePath.replace(/\/$/, "");
    if (normalized === base) continue;

    const name = href.split("/").filter(Boolean).pop() ?? "";
    if (!name) continue;

    const isDirectory = block.includes("<d:collection");
    const ctMatch     = block.match(/<d:getcontenttype>([\s\S]*?)<\/d:getcontenttype>/);
    const sizeMatch   = block.match(/<oc:size>([\s\S]*?)<\/oc:size>/);

    files.push({
      name,
      isDirectory,
      contentType: ctMatch ? ctMatch[1].trim() : "",
      size: sizeMatch ? parseInt(sizeMatch[1].trim(), 10) : 0,
    });
  }
  return files;
}

export async function listFiles(email: string, password: string, path = "/"): Promise<FileEntry[]> {
  const client = ncClient(email, password);
  const davPath = `/remote.php/dav/files/${encodeURIComponent(email)}${path}`;
  const resp = await client.request({
    method: "PROPFIND",
    url: davPath,
    headers: { "Content-Type": "application/xml", Depth: "1" },
    data: `<?xml version="1.0"?>
<d:propfind xmlns:d="DAV:" xmlns:oc="http://owncloud.org/ns" xmlns:nc="http://nextcloud.org/ns">
  <d:prop>
    <d:getlastmodified/>
    <d:getcontenttype/>
    <d:resourcetype/>
    <oc:size/>
  </d:prop>
</d:propfind>`,
    responseType: "text",
    validateStatus: s => s < 500,
  });

  if (resp.status === 404) return [];
  return parseWebDAV(resp.data as string, davPath);
}

export async function uploadFile(
  email: string,
  password: string,
  path: string,
  content: Buffer,
  contentType: string
): Promise<void> {
  const client = ncClient(email, password);
  await client.put(
    `/remote.php/dav/files/${encodeURIComponent(email)}${path}`,
    content,
    { headers: { "Content-Type": contentType }, responseType: "text" }
  );
}
