import { expect, test } from "bun:test";
import { googleEntries } from "./google.ts";

const header = ["Timestamp", "Name", "Message", "GitHub username"];
const timestamp = Date.parse("2026-10-06T12:00:00Z") / 86400000 + 25569;

test("Google responses support visitors without accounts and preserve the sheet's time zone", () => {
  const entries = googleEntries(
    [
      header,
      [timestamp, "Sample Visitor", "Hello!", ""],
      [timestamp + 1, "Another Visitor", "Nice work!", "@sample-visitor"],
    ],
    "sample-sheet",
    "Asia/Kolkata",
  );
  expect(entries).toHaveLength(2);
  expect(entries[0]?.createdAt).toBe("2026-10-06T06:30:00.000Z");
  expect(entries[0]?.github).toBeNull();
  expect(entries[1]?.github).toBe("sample-visitor");
  expect(
    googleEntries(
      [header, [timestamp, "Sample Visitor", "Hello!", ""]],
      "sample-sheet",
      "Asia/Kolkata",
    )[0]?.id,
  ).toBe(entries[0]?.id);
});

test("malformed rows are skipped and collecting extra fields fails before anything is imported", () => {
  expect(
    googleEntries(
      [
        header,
        [timestamp, "Guest", "x".repeat(1001), ""],
        [timestamp, "Guest", "Hello", "../user"],
      ],
      "sample-sheet",
      "UTC",
    ),
  ).toEqual([]);
  expect(() =>
    googleEntries([["Timestamp", "Email Address", "Name", "Message"]], "sample-sheet", "UTC"),
  ).toThrow("columns A:D");
});
