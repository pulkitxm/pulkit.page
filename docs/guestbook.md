# Guestbook

The portfolio's `/guestbook/` page reads `apps/page/data/guestbook.json` at build
time. The initial import contains the 28 visible messages from the previous
guestbook. Their Google profile photos are stored locally as 64-by-64 WebP images.
Account emails, authentication data, and remote Google photo URLs are not stored.

## Submission paths

The GitHub button opens `.github/ISSUE_TEMPLATE/guestbook.yml`. Visitors only fill
in a message and submit the issue. GitHub supplies their account identity; the
worker reads their public display name and avatar. A signed-in GitHub account is
required, but a fork, clone, and pull request are unnecessary.

The optional Google Form link is for visitors without GitHub accounts. Set
`googleFormUrl` in `apps/page/data/guestbook-settings.json` to the public responder
URL. Until it is configured, the page shows only the GitHub button.

## Create the Google Form

Use the title **Sign my guestbook** and this description:

> Your name, message, and optional GitHub profile will be published in my public
> guestbook and GitHub repository.

Add these questions in this exact order, with these exact titles:

1. **Name**: short answer, required, maximum 100 characters.
2. **Message**: paragraph, required, maximum 1,000 characters.
3. **GitHub username**: short answer, optional. Description: "Used for your profile
   link and photo. Leave blank if you don't have GitHub."

Turn off email collection, "Limit to 1 response", and any sign-in restriction.
Avoid file-upload questions, which require a Google account. Publish the form
with responder access for anyone with the link, and verify it in a signed-out
browser.

Under **Responses**, link the form to a Google Sheet. Leave its response columns
as **Timestamp**, **Name**, **Message**, **GitHub username**, in columns A:D. Keep
the spreadsheet private. The importer checks the question headers before reading
entries and respects the spreadsheet's time zone. Keep the response sheet intact;
editing a previously imported response creates a new submission identity.

## Connect the private response Sheet

1. Create or select a project in Google Cloud and enable the **Google Sheets API**.
2. Create a service account. It needs no project-level roles.
3. Create a JSON key for that service account.
4. Share only the response spreadsheet with the key's `client_email`, as **Viewer**.
5. In this repository's **Settings > Secrets and variables > Actions**, add an
   Actions secret named `GUESTBOOK_GOOGLE_CREDENTIALS`, containing the JSON key.
6. Add an Actions variable named `GUESTBOOK_GOOGLE_SHEET_ID`, containing the ID
   between `/d/` and `/edit` in the spreadsheet URL.
7. If the response tab is not named `Form Responses 1`, add the Actions variable
   `GUESTBOOK_GOOGLE_SHEET_TAB` with its exact tab name.
8. Set the public form URL in `apps/page/data/guestbook-settings.json`.

Both the Sheet ID and credential must be configured together. Without either,
the worker runs GitHub-only. The worker uses read-only Sheets access and reads
only columns A:D. It does not make the Sheet public or publish credentials.

Google Forms does not expose a submitter's Google profile photo. A provided
GitHub username supplies a GitHub avatar; otherwise the page displays an initial.
Google Form usernames are self-reported, unlike authenticated GitHub issue authors.

## Enable publishing

Create a fine-grained GitHub personal access token for `pulkitxm/pulkit.page`
with **Contents: Read and write**, and store it as the Actions secret
`GUESTBOOK_PUBLISH_TOKEN`. The token owner needs write access to the repository.
It is used only by the Pukbot publishing step. Reads use the workflow's automatic
GitHub token. A personal token lets the resulting commit trigger the existing CI
and deployment workflow.

The scheduled workflow becomes available after `.github/workflows/guestbook.yml`
lands on `main`. Run **Sync guestbook** manually once to verify the configuration.
It then runs every hour at minute 17 UTC; GitHub can delay scheduled jobs.

## Import behavior

The worker scans every page of open and closed issues. It only accepts human-authored
issues titled **Guestbook message** with the issue form's **Message** field. Pull
requests, unrelated issues, empty messages, and oversized entries are ignored.

GitHub issue numbers and stable Google response hashes prevent duplicate imports.
The store only appends new entries and orders them newest first. It does not
overwrite or delete published messages when an issue or response changes.

New avatars are downloaded from GitHub's avatar host and converted to 64-by-64
WebP, with metadata removed. Downloads have time, byte, and decoded-pixel limits.
Existing files are reused. Profile URLs and messages render as escaped text.

Each scheduled run stages only the JSON and guestbook avatar assets, verifies the
repository, and commits through Pukbot when there are changes. A run without new
messages makes no commit. CI then rebuilds and deploys the portfolio.

For a local run, supply the same environment variables and run:

```sh
bun run --cwd tooling/guestbook sync
```

The one-time legacy importer accepts a local JSON export with `id`, `name`,
`content`, `createdAt`, and `image` fields:

```sh
bun run --cwd tooling/guestbook import:legacy /private/path/to/export.json
```

Only nondeleted messages from nonblocked accounts belong in that export. The
database connection is not needed for ongoing operation. Repository text rules
normalize the em dash character to a comma on import.
