# Connect Fest Friend to your Google Sheet

Two-minute setup. After this, every email entered in the app writes a row to your sheet, and every chat message writes a row to a **Queries** tab.

## Step 1 — Prepare the sheet

You already created **Fest Friend sign up**. Open it and:

1. On the first (signup) tab, make sure Row 1 has these headers (exact spelling, order matters):

   | A | B | C | D |
   |---|---|---|---|
   | Timestamp | Email | User Agent | IP |

2. Add a second tab named exactly **`Queries`** with these headers in Row 1:

   | A | B | C |
   |---|---|---|
   | Timestamp | Query | Response |

   (The Apps Script below will auto-create this tab if it doesn't exist, but creating it yourself keeps the headers clean.)

## Step 2 — Paste the Apps Script

1. In that Sheet, click **Extensions → Apps Script**. A new tab opens.
2. Delete any placeholder code in `Code.gs`.
3. Paste this in:

```js
// Fest Friend — receiver for both email signups and chat queries.
// Routes by the `type` field: "query" → Queries tab, else first tab (signups).
function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents || "{}");
    const ss = SpreadsheetApp.getActiveSpreadsheet();

    if (data.type === "query") {
      let sheet = ss.getSheetByName("Queries");
      if (!sheet) {
        sheet = ss.insertSheet("Queries");
        sheet.appendRow(["Timestamp", "Query", "Response"]);
      }
      sheet.appendRow([
        data.timestamp || new Date().toISOString(),
        data.query || "",
        data.response || "",
      ]);
    } else {
      // Email signup — first tab (keeps existing behavior).
      const sheet = ss.getSheets()[0];
      sheet.appendRow([
        data.timestamp || new Date().toISOString(),
        data.email || "",
        data.user_agent || "",
        data.ip || "",
      ]);
    }

    return ContentService
      .createTextOutput(JSON.stringify({ ok: true }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService
      .createTextOutput(JSON.stringify({ ok: false, error: String(err) }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

// Handy sanity check — open the deployment URL in a browser, you should
// see {"ok":true,"hint":"..."}. If you see a login wall, the deployment
// access setting is wrong.
function doGet() {
  return ContentService
    .createTextOutput(JSON.stringify({ ok: true, hint: "POST JSON with { email } or { type: 'query', query, response }." }))
    .setMimeType(ContentService.MimeType.JSON);
}
```

4. Click the floppy-disk **Save** icon. Name the project anything (e.g. "Fest Friend Signup Receiver").

## Step 3 — Deploy as a web app

1. Top right → **Deploy → New deployment**
2. Next to "Select type", click the gear → **Web app**
3. Configure:
   - **Description:** `Fest Friend signup` (optional)
   - **Execute as:** **Me** (your Google account)
   - **Who has access:** **Anyone** ← important. Without this your Next.js app can't POST to it.
4. Click **Deploy**.
5. First time only: Google will ask you to authorize. Click **Authorize access** → choose your account → **Advanced → Go to [project] (unsafe)** → **Allow**. ("Unsafe" is standard for your own scripts; it just means Google hasn't reviewed it.)
6. Copy the **Web app URL** — it looks like `https://script.google.com/macros/s/AKfycb.../exec`.

## Step 4 — Plug the URL into your app

Open `.env.local` in VS Code (the same file where Stripe used to be) and replace its contents with:

```
GOOGLE_SHEETS_WEBHOOK_URL=https://script.google.com/macros/s/AKfycb.../exec
```

Save. In your terminal running `npm run dev`, press **Ctrl+C** to stop, then run `npm run dev` again so it picks up the new env var.

## Step 5 — Test it

1. Open http://localhost:3000 (in the browser window where you cleared site data earlier — that unlocked state is gone, so you'll see the email screen).
2. Enter a test email like `test+1@yourdomain.com`.
3. Click **Get started**.
4. Open your Google Sheet — a new row should appear within a couple seconds.
5. The chat screen should load. Refresh the page — the chat should stay open (localStorage remembers the unlock).

## If something doesn't work

| Symptom | Cause | Fix |
|---|---|---|
| Button says "One sec…" forever | Webhook URL wrong or Apps Script not deployed | Re-copy the URL; verify deployment access is "Anyone" |
| Row never appears in sheet | Apps Script deployment permissions | Redeploy: **Deploy → Manage deployments** → pencil icon → bump Version → Deploy |
| Dev console shows `(no GOOGLE_SHEETS_WEBHOOK_URL set — dev fallback)` | `.env.local` not loaded | Make sure the file is named `.env.local` exactly (not `env.local`) and you restarted the dev server |
| Signup succeeds but chat doesn't unlock | `localStorage` disabled in browser | Use a non-private window |

## When you change the Apps Script

If you edit the Apps Script code later (e.g. to write to a different sheet), you **must redeploy** for changes to take effect:

- **Deploy → Manage deployments** → pencil icon next to your deployment → change Version to "New version" → **Deploy**
- The URL stays the same. No need to update `.env.local`.
