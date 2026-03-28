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
  ).then(r => r.status === 200);

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

export async function listFiles(email: string, password: string, path = "/"): Promise<unknown[]> {
  const client = ncClient(email, password);
  const resp = await client.request({
    method: "PROPFIND",
    url: `/remote.php/dav/files/${encodeURIComponent(email)}${path}`,
    headers: {
      "Content-Type": "application/xml",
      Depth: "1",
    },
    data: `<?xml version="1.0"?>
<d:propfind xmlns:d="DAV:" xmlns:oc="http://owncloud.org/ns" xmlns:nc="http://nextcloud.org/ns">
  <d:prop>
    <d:getlastmodified/>
    <d:getetag/>
    <d:getcontenttype/>
    <d:resourcetype/>
    <oc:fileid/>
    <oc:size/>
    <nc:has-preview/>
  </d:prop>
</d:propfind>`,
  });
  return resp.data;
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
    { headers: { "Content-Type": contentType } }
  );
}
