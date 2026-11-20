# The Shadrach Fellowship Portal: setup

The portal page lives at `/portal` on the website (`portal.html`, `assets/portal.js`, `assets/portal.css`).
Everything it shows and saves goes through `Code.gs`, a Google Apps Script web app that runs under
**engage@thehudgroupglobal.org**. The data lives in one Google Sheet, uploaded files in one Drive folder,
and every email goes out from engage@, so the whole fellowship stays in the organisation's own account.

Setup takes about ten minutes, once.

## 1. Create the sheet and paste the code (signed in as engage@thehudgroupglobal.org)

1. In Google Drive, create a new blank Google Sheet and name it **TSF Portal**.
2. In the sheet: **Extensions > Apps Script**.
3. Delete what is in `Code.gs` and paste in the whole of `backend/tsf-portal/Code.gs`.
4. Click the gear icon (**Project Settings**), tick **Show "appsscript.json" manifest file in editor**, then open
   `appsscript.json` in the editor and replace it with `backend/tsf-portal/appsscript.json`
   (this sets the time zone to Africa/Accra so reminders go out at the right hour).
5. Save.

## 2. Run setup

1. In the function list at the top, choose **setup** and click **Run**.
2. Google asks for permission (Sheets, Drive, email, triggers). Choose the engage@ account and allow it.
3. When it finishes, the sheet has one tab per table, the starter 2027 roadmap, the year's assignments,
   the resource library, and engage@ as the first admin. A **TSF Portal Files** folder appears in Drive.
4. Choose **setupTriggers** and click **Run**. This schedules the reminder emails:
   - **Thursday 10:00**: each active fellow is reminded about Friday's session and its passage.
   - **Saturday 10:00**: fellows who have not written their reflection for Friday's session get a gentle nudge.
   - **Monday 08:00**: engage@ gets a cohort health check (who needs a call, what is waiting for review).

`setup` refuses to run under any account other than engage@, and running it again never duplicates anything.

## 3. Deploy as a web app

1. **Deploy > New deployment > Web app**.
2. Execute as: **Me (engage@thehudgroupglobal.org)**. Who has access: **Anyone**.
   ("Anyone" only means the address can be reached. Every request still needs a sign-in code sent to an
   email on the roster, and fellows can only ever see their own records.)
3. Copy the **Web app URL** (it ends in `/exec`).
4. Paste it into `assets/portal.js`, in `CONFIG.endpoint` near the top, then publish the website.

When you change `Code.gs` later: **Deploy > Manage deployments > Edit > Version: New version > Deploy**.
The URL stays the same.

## 4. Add people

Open `/portal`, sign in with engage@thehudgroupglobal.org (a code arrives by email), then go to **Fellows**:

- **Add a person** for one at a time, or **Add many** and paste one line per person:
  `Full name, email, country` (city and phone can follow).
- Make facilitators and coordinators **Admin**. Admins see everything and can open any fellow's portal
  (read only). Fellows see only their own portal.
- **Send welcome emails** to tell everyone the portal is ready and how to sign in.

Please add people through the portal rather than typing into the People tab, so each person gets an ID.
To remove someone's access, use **Remove access**: they are signed out at once and their history stays.

## 5. Check the roadmap and settings

- **Roadmap**: the 2027 sessions were carried over from the 2025/2026 roadmap, with this year's change
  (four weeks of Making Ends Meet by Compass Financial Ministry after MLM, before the Discovery Bible Community review).
  Because that adds two Fridays, the last two sessions fall in early January 2028. Add, edit or delete sessions,
  and use **Move sessions** to push a stretch of the year later or earlier.
- **Content and Settings**: the meeting link, cohort WhatsApp group, session time, the Bible plan start date
  and the welcome note. Add Drive links to the resources (share each file with the fellows first).
  Set "Reminder emails" to `no` to pause all reminders.

## 6. Before the cohort starts (induction is 26 December 2026)

Work through this in order. The fellows' first impression is the welcome email, so send it last.

1. **Add the admins first.** Add each facilitator and coordinator with the role **Admin**, using the email
   they will actually sign in with. Have each of them sign in once to check the code email arrives.
2. **Test it as a fellow.** Add yourself as a fellow with a second email address, sign in, write a reflection,
   tick a Bible day and open a report. Then remove that test person with **Remove access**.
3. **Bring in the selected fellows only.** In **Fellows > Add many**, paste one line per person in this order:
   `Full name, email, country, city, phone`
   The Applications sheet stores "City, country" together in one column, so swap them round when you copy
   (for example `Ama Mensah, ama@example.com, Ghana, Accra, +233 24 000 0000`). Applicants who were not
   selected are never added, so they cannot sign in and nothing about them reaches the portal.
4. **Check the roadmap, meeting link, WhatsApp group link and resource links** under Roadmap and
   Content and Settings, and post a first announcement on the home page.
5. **Send the welcome emails** from Fellows. Ask everyone to add engage@thehudgroupglobal.org to their contacts
   and to check their spam or promotions folder if the sign-in code does not arrive within a minute.
6. **At induction**, give the fellows two minutes to sign in together on their phones. Show them how to add the
   portal to their home screen (browser menu, then "Add to Home screen"), so it opens like an app every week.

**Email limits:** Google Workspace accounts can send about 1,500 emails a day, which is plenty. If engage@ were
ever moved to a free Gmail account, the limit drops to about 100 a day, so send welcome emails in small batches.

## 7. Updating the backend after a change

When `Code.gs` changes (for example when new features are added), update the live script in three steps,
signed in as engage@thehudgroupglobal.org:

1. In the TSF Portal sheet, **Extensions > Apps Script**. Select everything in `Code.gs`, paste in the new
   version and save.
2. Choose **upgradePortal** in the function list and click **Run**. It adds any new columns and tabs without
   touching existing data. While nobody has attendance or reflections yet, it also rebuilds the starter roadmap.
   The log says what it did.
3. **Deploy > Manage deployments**, click the pencil (Edit), set **Version** to **New version** and click
   **Deploy**. The web app URL stays the same.

Only then publish the matching website files, so the portal never calls something the backend does not know yet.

## What lives where in the sheet

| Tab | What it holds |
| --- | --- |
| People | Fellows and admins (role, status, contact details, their private Drive folder) |
| Sessions | The roadmap: one row per Friday |
| Attendance | One row per fellow per session (Present, Late, Absent with excuse, Absent without excuse, Dropped off) |
| Reflections | Weekly review, questions, "I will" statement, Scripture, who they will share with, facilitator reply |
| Tasks / Progress | The year's assignments and each fellow's progress, results, uploads and reviews |
| Bible | Bible in One Year: 365 ticks per fellow |
| Mentees / Hi5 | Each fellow's disciples (stage of growth and a log of every update) and Hi 5 prayer group (members, prayer log and updates) |
| Formation | Purpose, mission and family mission statements, core values, and the days each fellow prayed through their prayer calendar |
| Prayers | Prayer calendar: each person a fellow prays for, their day of the month (1 to 31), request and whether it was answered |
| Goals | Each fellow's goals with area, target date, progress and dated updates |
| Reports | Quarterly self reports and facilitator evaluations |
| Concerns | Concerns, complaints, questions, suggestions and prayer requests, with replies |
| Announcements / Resources / Settings | Home page notices, the library, cohort settings |
| Shares | Report share links (each opens one report, read only, for 30 days, and can be withdrawn) |
| Auth / Log | Sign-in sessions (stored only as fingerprints, never the real token) and an activity log |
| Attendance Grid | Read-only view laid out like the old attendance sheet (fellows down, weeks across) |
| DBS Action Points | Read-only view laid out like the old DBS sheet (one row per reflection) |

The two view tabs rebuild themselves whenever attendance or reflections change. Do not edit them by hand.

## Privacy and security

- Sign in is by one-time code to an email on the roster. Codes expire after 10 minutes, work once and are
  blocked after 5 wrong tries; each email can ask for 5 codes an hour. Sessions last 30 days.
- The server takes the person from the sign-in, never from the request, so a fellow cannot read or change
  anyone else's records, files or reports.
- Anonymous concerns reach admins without a name. Replies still reach the fellow.
- A facilitator's evaluation stays hidden from the fellow until it is released.
- Report PDFs are also saved in the fellow's private folder in **TSF Portal Files**.
- Text that looks like a spreadsheet formula is always stored as plain text.
