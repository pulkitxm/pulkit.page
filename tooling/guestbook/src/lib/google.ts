import { createHash } from "node:crypto";
import { type GuestbookEntry, guestbookEntry } from "@pulkit/shared/guestbook";
import { isValid } from "date-fns";
import { fromZonedTime } from "date-fns-tz";
import { GoogleAuth } from "google-auth-library";
import { z } from "zod";
import type { Request } from "./github.ts";

const sheetValues = z.array(z.array(z.union([z.string(), z.number(), z.boolean()])));
const credentialsSchema = z.object({ client_email: z.email(), private_key: z.string().min(1) });

export function googleEntries(
  values: z.infer<typeof sheetValues>,
  sheetId: string,
  timeZone: string,
): GuestbookEntry[] {
  const [header, ...rows] = values;
  if (header?.[1] !== "Name" || header[2] !== "Message" || header[3] !== "GitHub username") {
    throw new Error(
      "Google Sheet must contain Timestamp, Name, Message, GitHub username in columns A:D",
    );
  }
  const entries: GuestbookEntry[] = [];
  for (const [index, row] of rows.entries()) {
    if (row.every((value) => value === "")) {
      continue;
    }
    const [timestamp, name, message, username = ""] = row;
    if (
      typeof timestamp !== "number" ||
      !Number.isFinite(timestamp) ||
      timestamp < 1 ||
      timestamp > 100000 ||
      typeof name !== "string" ||
      typeof message !== "string" ||
      typeof username !== "string"
    ) {
      console.warn(`Skipped invalid Google Form row ${index + 2}.`);
      continue;
    }
    const localDate = new Date(Math.round((timestamp - 25569) * 86400000))
      .toISOString()
      .slice(0, -1);
    const instant = fromZonedTime(localDate, timeZone);
    if (!isValid(instant)) {
      throw new Error("Invalid Google Sheet time zone");
    }
    const createdAt = instant.toISOString();
    const hash = createHash("sha256")
      .update(JSON.stringify([sheetId, timestamp, name, message, username]))
      .digest("hex")
      .slice(0, 24);
    const parsed = guestbookEntry.safeParse({
      id: `google-${hash}`,
      name: name.trim().replaceAll("\u2014", ","),
      message: message.trim().replaceAll("\r\n", "\n").replaceAll("\u2014", ","),
      createdAt,
      github: username.trim().replace(/^@/, "") || null,
      avatar: null,
    });
    if (parsed.success) {
      entries.push(parsed.data);
    } else {
      console.warn(`Skipped invalid Google Form row ${index + 2}.`);
    }
  }
  return entries;
}

export async function googleSubmissions(
  sheetId: string,
  credentialsJson: string,
  tab = "Form Responses 1",
  request: Request = fetch,
): Promise<GuestbookEntry[]> {
  const credentials = credentialsSchema.parse(JSON.parse(credentialsJson));
  const auth = new GoogleAuth({
    credentials,
    scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
  });
  let token: string | null | undefined;
  try {
    token = await auth.getAccessToken();
  } catch (cause) {
    throw new Error("Google Sheets authentication failed", { cause });
  }
  if (!token) {
    throw new Error("Google Sheets authentication returned no token");
  }
  const base = `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(sheetId)}`;
  const range = encodeURIComponent(`'${tab.replaceAll("'", "''")}'!A:D`);
  const responses = await Promise.all([
    request(`${base}?fields=properties(timeZone)`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(20000),
    }),
    request(
      `${base}/values/${range}?valueRenderOption=UNFORMATTED_VALUE&dateTimeRenderOption=SERIAL_NUMBER`,
      { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(20000) },
    ),
  ]);
  for (const response of responses) {
    if (!response.ok) {
      throw new Error(`Google Sheets request failed: HTTP ${response.status}`);
    }
  }
  const [metadata, data] = await Promise.all(responses.map((response) => response.json()));
  const { properties } = z
    .object({ properties: z.object({ timeZone: z.string() }) })
    .parse(metadata);
  const { values } = z.object({ values: sheetValues.default([]) }).parse(data);
  return googleEntries(values, sheetId, properties.timeZone);
}
