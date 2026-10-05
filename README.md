# Little Chef by Pista House — Website

Live at **https://www.littlechefs.in** (GitHub Pages, repo `mohddis/little-chef`).

## Files

```
index.html          Public website (journey, games, Instagram, booking form)
planner.html        Team Visit Planner: requests, confirmations, schedule, staff notice (PIN protected)
confirmation.html   The page a school opens from its confirmation link
assets/config.js    ALL settings: planner connection, Instagram, YouTube, phone
assets/             Logos, mascot, illustrations
apps-script/Code.gs Backend that saves requests in Google Sheets and sends confirmation emails
CNAME               Connects the site to www.littlechefs.in
```

---

## 1. Visit Planner setup (about 10 minutes, once)

The planner keeps every request in a Google Sheet that only your team can see.

1. Go to **sheets.google.com** and create a blank sheet named **Little Chef Visits**.
2. In the sheet: **Extensions → Apps Script**. Delete the sample code, paste everything from
   `apps-script/Code.gs`, and click **Save**.
3. Click the **gear icon (Project Settings)** on the left. Scroll to **Script Properties → Add script property**:
   - `TEAM_PIN` → a PIN your team will use to open the planner (6–8 digits)
   - `TEAM_EMAIL` → the email that should get an alert for every new request (optional)

   Click **Save script properties**. Keep the PIN only here, never in GitHub.
4. Back in the editor (`< >` icon), choose **setup** in the function dropdown at the top and click **Run**.
   Allow the permissions Google asks for (it needs your sheet, and Gmail to send confirmations).
5. *(Optional)* Choose **importOctoberSchedule** and click **Run** to load the October 2026 school visits.
6. Click **Deploy → New deployment**. Gear icon → **Web app**.
   - Execute as: **Me**
   - Who has access: **Anyone**

   Click **Deploy** and copy the **Web app URL** (it ends in `/exec`).
7. On GitHub, open `assets/config.js` → pencil ✏️ → paste the URL between the quotes of `API_URL: ""` → **Commit changes**.

Open **https://www.littlechefs.in/planner.html** and enter the team PIN.

> After editing `Code.gs` later: **Deploy → Manage deployments → ✏️ → Version: New version → Deploy**.
> The URL stays the same.

### How the planner works

1. A school fills in the booking form → it appears under **Requests** (and the team gets an email alert).
2. Tap **Confirm visit** → set date, batch time, students, teachers, staff reporting time.
3. The school automatically gets a **confirmation email** (if they gave an email).
4. Tap **Send WhatsApp confirmation** → WhatsApp opens with the full message and their confirmation link.
5. The school opens the link and taps **"Yes, we confirm our visit"** → the planner shows **School confirmed**.
6. **Staff notice** prints the internal factory notice. **Schedule** shows the month table with totals.
7. After the visit tap **Mark done**. Phone bookings can be added with **Add visit**.

---

## 2. Live Instagram feed on the website

Instagram doesn't let websites read posts directly, so the site uses **Behold** (behold.so), which has a free plan.

1. Make sure `@littlechefbypistahouse` is a **Professional** account (Instagram → Settings → Account type → Business or Creator).
2. Sign up at **behold.so**, add a feed and connect the Instagram account.
3. Choose the **JSON** feed option and copy the feed URL (looks like `https://feeds.behold.so/XXXXXXXX`).
4. Paste it into `assets/config.js` → `INSTAGRAM_FEED_URL: ""` → **Commit changes**.

The "Fresh from our Instagram" section then shows your latest 8 posts and reels automatically.
Until then it shows Little Chef illustrations with a Follow button.

## 3. YouTube

When the channel is ready, paste its link into `YOUTUBE_URL` in `assets/config.js`. The YouTube button
appears in the footer automatically.

## 4. Domain

`CNAME` points the site to `www.littlechefs.in`. GoDaddy DNS: four **A @** records
(185.199.108.153 / .109.153 / .110.153 / .111.153) and **CNAME www → mohddis.github.io**.
Tick **Enforce HTTPS** in Settings → Pages once it becomes available.
