# TSF 2026/2027 application receiver

`apply.html` posts every application to a small Google Apps Script web app. The script
runs inside a response spreadsheet and does five things for each application:

1. Validates it again on the server.
2. Saves the CV and recommendation letter to a private Drive folder.
3. Adds one row to the **Applications** tab of the response sheet.
4. Emails the full application to **engage@thehudgroupglobal.org** (reply goes to the applicant).
5. Emails a confirmation, with a reference number such as `TSF27-007`, to the applicant.

There is no server to host and nothing to pay for. It takes about 5 minutes to switch on.

## Everything lives under engage@thehudgroupglobal.org

The sheet, the Drive folder and the outgoing emails all belong to whichever Google account
sets the script up. For The HuD Group that must be **engage@thehudgroupglobal.org**, so the
data stays in one place the organisation controls and does not depend on one person's account.

The script enforces this: `setupCheck` stops with a "Wrong account" error if it is run by
any other account.

## One-time setup

1. **Sign in as engage@thehudgroupglobal.org.** Use a separate Chrome profile or a private
   window so your personal account is not mixed in. Confirm by clicking your profile picture
   at the top right of any Google page.
2. Open the response sheet that engage@ owns (or create a new blank Google Sheet in that account).
   Click **Share** and check that you are listed as **Owner**. Set General access to **Restricted**,
   not "Anyone with the link", because the sheet will hold personal and spiritual information.
3. In that sheet choose **Extensions > Apps Script**.
4. Delete the sample code, paste in the whole of `Code.gs` from this folder, and save.
5. In the function dropdown choose **setupCheck** and press **Run**.
   Google asks for permission (spreadsheets, Drive, send email). Approve it.
   This creates the Drive folder, writes the header row, and sends a test email to
   engage@thehudgroupglobal.org. If it says **Wrong account**, you are signed in as someone else.
6. Choose **Deploy > New deployment**. Click the gear icon and pick **Web app**.
   - Execute as: **Me**
   - Who has access: **Anyone**
7. Click **Deploy** and copy the **Web app URL** (it ends in `/exec`).
8. Open `apply.html`, find `CONFIG` near the bottom, and paste the URL:

   ```js
   endpoint: 'https://script.google.com/macros/s/XXXXXXXX/exec',
   ```

9. Open the page, submit a test application with your own email, and check that the row,
   both emails, and the two files in Drive all appear. Delete the test row and files afterwards.
10. Share the sheet and the Drive folder **TSF 2026-2027 Application Files** only with the
    selection team. Both are private to engage@ until you do.

### Optional: keep the files in a Shared Drive or a folder you choose

If the organisation has a Shared Drive, create a folder there as engage@, open it, and copy the
long code at the end of its address. Paste it into `FOLDER_ID` in `CONFIG` at the top of `Code.gs`
and redeploy a new version. Leave it empty to use the default folder in engage@'s My Drive.

### Why "Anyone"?

The website has to be able to post to the script without signing in. "Anyone" only lets
people send an application in. They cannot read the sheet, the Drive folder, or anything
else. Everything is still validated on the server.

### The old Google Form

The original Google Form and its response sheet belong to a personal account and are no longer
needed once the website form is live. To avoid applications arriving in two places, turn off
**Accepting responses** on the Google Form after the first test application succeeds.

## Changing the script later

Edit the code, then use **Deploy > Manage deployments > pencil icon > Version: New version > Deploy**.
The URL stays the same, so `apply.html` needs no change. A brand new deployment creates a new URL.

## What the applicant and the team see

| Who | What |
| --- | --- |
| Applicant | Success screen with a reference number, plus an email with the next steps |
| Team inbox | One email per application with every answer and links to both files. Replying writes to the applicant |
| Sheet | One row per application, 43 columns, frozen header, plain text format so nothing can run as a formula |

Repeat submissions from the same email are accepted (people fix mistakes) and marked
`Yes` in the **Repeat submission** column and `[repeat]` in the email subject.

## Settings

Everything adjustable is in `CONFIG` at the top of `Code.gs`: the notification address, the
required owner account, the folder name or ID, the tab name, the reference prefix, the file
size limit (5 MB), the word limit (200), and the age range (17 to 39). If you change the age
range or file limit, change the same values in `apply.html` so the form and the server agree.

## Changing the deadline or closing early

In `apply.html`, `CONFIG.deadline` (UTC) controls the countdown and automatically
replaces the form with an "Applications have closed" notice after that moment.
To close early, set it to a past date. To reopen, set a future one.

## Limits to know about

- Email sent by a script is capped: about 100 a day on a free Gmail account, 1,500 on Google
  Workspace. Each application sends 2.
- Uploads are limited to 5 MB per file. Larger files are refused with a clear message.
- The Drive folder counts against the owning account's storage.

## Troubleshooting

| Problem | Fix |
| --- | --- |
| `setupCheck` says "Wrong account" | You are signed in as a different Google account. Switch to engage@thehudgroupglobal.org and repeat the setup there |
| Form says "Online submission is not switched on yet" | `CONFIG.endpoint` in `apply.html` is still empty |
| "We could not reach the server" | The URL is wrong, or the deployment is not set to **Anyone**. Open the `/exec` URL in a browser. You should see `{"ok":true,...}` |
| Row appears but no emails | Run `setupCheck` again and approve the email permission. Check the Apps Script **Executions** page for errors |
| Applicants say the confirmation is missing | Ask them to check spam. The reference number is also shown on the success screen |
| Changed the code but nothing changed | Publish a **New version** of the existing deployment (see above) |

## Privacy

Applications contain personal and spiritual information, recommendation letters and CVs.
Keep the response sheet and Drive folder shared only with the selection team, and do not
publish names or answers of applicants who were not selected.
