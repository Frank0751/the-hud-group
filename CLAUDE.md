# The HuD Group Global Website — Claude Code Instructions

## Project Overview

This is the upgraded website for **The HuD Group Global** (thehudgroupglobal.org).
It is a complete 9-page static HTML website built to be handed over to a WordPress developer.
The design upgrades the original site while preserving its identity, colors, and structure exactly.

---

## Folder Structure

```
the-hud-group/
  index.html          ← Homepage (main landing page)
  charity.html        ← HuD Charity division
  corporate.html      ← HuD Consult (corporate division)
  countries.html      ← 30 countries across 6 regions
  community.html      ← The Shadrach Fellowship (TSF)
  content.html        ← Training library, reports, blog, videos
  contact.html        ← Contact form, leadership team
  contribute.html     ← Giving / donate page
  apply.html          ← TSF 2026/2027 application form (6-step form, posts to Google Apps Script)
  backend/
    tsf-applications/ ← Code.gs (Apps Script receiver) + README.md (5-minute setup)
  reports/            ← Downloadable PDFs (2025 Global Annual Report)
  images/             ← All site images (local, no CDN)
    hud-group-home-bg.jpg           ← Hero background image
    the-hud-group-hi-res-logo.png   ← HuD Group logo
    cropped-the-hud-group-favicon-32x32.png ← Favicon
    TSF_APP_2026.png
    TSF_2025__1_.png
    THE_SHADRACH_FELLOWS_2026__1_.png
    TSFx_2026_.png
    TSF_Facilitators_2026_.png
    The_HuD_Group_FOunders.jpg
    award-1.png through award-7.png
    001-voluntary-*.png   ← 6P People icon
    016-charity-*.png     ← 6P Programs icon
    020-love-*.png        ← 6P Products icon
    021-charity-*.png     ← 6P Projects icon
    022-map-location-*.png ← 6P Places icon
  CLAUDE.md           ← This file
```

---

## Brand Identity (NEVER CHANGE THESE)

```css
--purple:       #541854;  /* sampled directly from the logo mark */
--purple-dark:  #320c32;
--purple-mid:   #7a297a;
--purple-light: #b668b6;
--purple-pale:  #fbf4fb;
--peach:        #ffb866;
--peach-dark:   #df6e0c;
--peach-pale:   #fff3e5;
--orange:       #fc9018;  /* sampled directly from the logo mark */
--text:         #1a1420;
--text-light:   #6b5a68;
--font-h:       'Playfair Display', serif;  /* all headings, a distinctive serif */
--font-body:    'Satoshi', sans-serif;      /* body text, loaded via Fontshare CDN */
--font-accent:  'Satoshi', sans-serif;      /* labels, badges */
```

The purple and orange are sampled pixel-for-pixel from `images/the-hud-group-hi-res-logo.png`
(a deep magenta-purple and a vivid warm orange, HSL hue ~300° and ~32°). Every other
purple/peach shade is derived from those two anchors by adjusting lightness/saturation only,
so the whole palette stays one coherent hue family instead of the old, unrelated blue-indigo.
Satoshi is loaded from `https://api.fontshare.com/v2/css?f[]=satoshi@700,500,400,300` and
Playfair Display from Google Fonts — both linked in the `<head>` of every page.

**Logo:** `images/the-hud-group-hi-res-logo.png`
**Tagline:** "To inspire...totally"
**Email:** engage@thehudgroupglobal.org
**Phone:** +233 206 634 459
**Global CEO:** Dr. Yaw Perbi — yawperbi@gmail.com — +1 (514) 699-0182

---

## CRITICAL RULES — Read Before Any Edit

1. **NO EM DASHES anywhere** — use commas, colons, or rewrite the sentence instead
2. **Hero section must be full viewport height** (min-height: 100vh) with the background image `images/hud-group-home-bg.jpg`
3. **The hero background image must cover the full screen** — use `background-size: cover; background-position: center center;`
4. **Never remove the original content** — Who We Are, Vision, Mission, Divisions must always be present on the homepage
5. **The organisation is 23 years old, founded in 2003** — never show "15 years" or any other number
6. **Active countries is 30** — never use 24 or any other number
7. **No external CDN dependencies for images** — all images must reference the local `images/` folder
8. **Kwiverr Formation Konstant section must be green** (background: #2d5a2d) not purple

---

## Homepage (index.html) — Required Sections in Order

### 1. HERO SECTION (Full Viewport Height)
- **Background:** `images/hud-group-home-bg.jpg` covering full screen
- **Overlay:** dark purple gradient `rgba(45,40,96,0.92)` so text is readable
- **Min-height:** 100vh
- **Left column content:**
  - Badge: "23 Years of Transformational Leadership"
  - H1: "Equipping Leaders. Transforming Nations."
  - Italic tagline: "To inspire...totally"
  - Description paragraph
  - Two CTA buttons: "Explore Our Work" (peach) and "The Shadrach Fellowship" (outline white)
  - Stats row: 30 Countries / 23 Years (est. 2003) / 6 Global Regions / 12 TSF 2026 Fellows
- **Right column:** floating card with TSF info and mini-cards for key facts

### 2. WHO WE ARE (white background)
The exact original text must appear:
- **Who We Are:** "The HuD Group (The Human Development Group) is a dynamic, international, Christian not-for-profit network and movement focused on the development of holistic Emerging and Established Leaders."
- **Our Vision:** "In every sphere, movements of inspired, informed and invested people of godly influence, accelerating God's purposes on earth."
- **Our Mission:** "To engage hearts, enlighten heads and empower hands of emerging and established leaders as we inspire, equip and connect them to discover, develop and deploy their God-given identity, purpose and resources to reach their full potential as holistic persons with maximum impact in every sphere as effectual missional communities."
- **Our Divisions:** "The group operates through two specialised arms: Charity and Corporate."
- Two buttons: CHARITY (links to charity.html) and CORPORATE (links to corporate.html)

### 3. FOUNDERS SECTION (purple-dark background)
- Founders photo: `images/The_HuD_Group_FOunders.jpg`
- "Founded in 2003 by Dr. Yaw Perbi and 7 co-founders"
- Four milestone cards: 2003 / 2010 / 2021 / 2025

### 4. 9P STRATEGY (off-white background)
Updated from the original 6P Strategy to match the 2026-2030 "Dreaming and Visioning" strategic
plan, which expanded the framework to nine pillars. The HuD Group logo
(`images/the-hud-group-hi-res-logo.png`) is used as a watermark/background element.
Nine cards using the local icon images from the images/ folder:
- 01 PREVAILING — **Prayer** — icon: cartoon-hand-drawn-red-prayer image
- 02 INSPIRATIONAL — **People** — icon: 001-voluntary image
- 03 EMPOWERING — **Programs** — icon: 016-charity image
- 04 PARADIGM-SHIFTING — **Products** — icon: 020-love image
- 05 TRANSFORMATIONAL — **Places** — icon: 022-map-location image
- 06 IMPACTFUL — **Projects** — icon: 021-charity image
- 07 COLLABORATIVE — **Partnerships** — icon: partnerships-icon.svg
- 08 FAITHFUL — **Pennies** — icon: pennies-icon.svg
- 09 ACCOUNTABLE — **Policies** — icon: policies-icon.svg

### 5. DIVISIONS (white background)
Two side-by-side cards: HuD Charity and HuD Consult

### 6. REGIONAL REACH (purple-dark background)
Six region cards with the 6 Regional CEOs:
- Africa: Timothee Ouattara
- North America: Lindsay Oaks
- Latin America: Claudia
- Europe: Silvana Koenig
- Asia: Ramesh Bhusal
- Oceania: Stephen Scott

### 7. TSF CALLOUT (peach/orange gradient)
Shadrach Fellowship stats and app image: `images/TSF_APP_2026.png`

### 8. PARTNERS (off-white background)
Four partner cards: Compass Financial Ministry, EQUIP Leadership, A2R, Disciple Ship

### 9. IMPACT NUMBERS (white background)
Stats band: 30 Countries / 23 Years / 21 TSF Fellows / 52 Weekly Sessions / 6 Continents
Two testimonial cards from TSF 2025 fellows

### 10. BOOKS (purple-dark background)
Three book cards: A2R, Disciple Ship, Other Publications

---

## Community Page (community.html) — Key Rules

- **Kwiverr Formation Konstant section background must be GREEN (#2d5a2d)**
- The section reflects the Kwiverr brand which uses green (matching the K diagram)
- The diagram itself is the original graphic `images/kwiverr-formation-konstant.png`
  (© 2022 Yaw Perbi) displayed as-is, not a CSS recreation — keep it original
- **Applications are OPEN until 20 November 2026** (2026/2027 cohort, ages 17 to 39, free).
  The badge, hero button and Apply section all point to `apply.html`. After the deadline the
  form on `apply.html` closes itself automatically (`CONFIG.deadline`), but the community page
  copy must then be updated by hand to say applications are closed
- TSF 2026 has exactly 12 core fellows
- TSF 2025 has exactly 9 graduates (Cohort 1)
- TSFx 2026 has exactly 4 mentees
- The facilitators image to use: `images/TSF_Facilitators_2026_.png`
  showing Dr. Yaw Perbi (Main Facilitator), Frank Koomson (Coordinator), Prince "Dela" Kpendo (Associate)
- JavaScript functions must be properly escaped — apostrophes in bio strings must use \\' not raw '

---

## Countries Page (countries.html) — Key Rules

Six regions only (not 12):
1. Africa (16 countries)
2. North America (2 countries)
3. Latin America (2 countries)
4. Europe (5 countries)
5. Asia (4 countries)
6. Oceania (1 country)

Key country CEOs (exact from official document):
- Ghana: Karis Senanu-Adzosii — karissenanuadzosi@gmail.com — +233 24 911 0618
- Sierra Leone: Amadu Dajan Kallon — amadudajankallon@gmail.com — +232 79 587139
- Liberia: Albert Philip Bundoo — albund2007@gmail.com — +231 777 339 156
- Cameroon: Dieudonne Lobuin Ngwa — ngwadieudonnelobuin@gmail.com — +237 679 245 713
- Uganda: Hirwa G. Israel — hirwagisrael@gmail.com — +256 756 155527
- Cote d'Ivoire: Timothee Ouattara — timotheeouattara31@gmail.com — +225 09 00 01 88
- Switzerland: Silvana Koenig — Koenig.silvana3@gmail.com — +41 78 707 60 16
- Netherlands: Nana Addae-Mensah — +31 6 11153615
- Egypt: Maged Milad Megally — maged.milad.megally@gmail.com — +20 122 372 2005
- Australia: Stephen Scott — steve.scott@ismc.ca

---

## Contact Page (contact.html) — Key Rules

Section order (STRICT):
1. Contact form + office info
2. **Global Board and Advisory Council FIRST** (15 placeholder cards)
3. Senior Leadership (Dr. Yaw Perbi + Jillian Chong only — NOT Frank Koomson)
4. Regional CEOs (table format with all 6 regions)
5. Global Operations Team (Frank Koomson, Carol Palacios, Nathan Akoamah, Diborah, Prince Kpendo)

Dr. Yaw Perbi contact: yawperbi@gmail.com / +1 (514) 699-0182

---

## Content Page (content.html) — Key Rules

The Training Library uses accordion-style expandable categories.
Categories must reflect exactly what is in the Google Drive TRAINING folder:
21 Irrefutable Laws, DeepLEAD, DISC, Emotional Intelligence/EHS,
Goal-Setting, How to Run a HuDdle, HuD Orientation, LEADERSHIP HuDdles,
Life Long Learning, M28 Global, Maxwell Leadership, Operation Purpose,
Preparing a Personal Vision, Raising Friends and Partners, Weekly Planning,
WWTD Part 2, YOUTHPOWER!

---

## Developer Placeholder Comments

All sections marked with `<!-- DEVELOPER: -->` in the HTML need real content:
- Headshot photos for all team members (replace initials divs with img tags)
- PDF links for reports (replace href="#" with actual PDF paths)
- YouTube video IDs (replace in video card thumbnails)
- Contact form backend (connect to Formspree: action="https://formspree.io/f/YOUR_ID")
- **apply.html: paste the Apps Script web app URL into `CONFIG.endpoint`** (steps in
  `backend/tsf-applications/README.md`). Until then the form shows a polite "not switched on yet" message
- Board member names and photos (15 placeholders on contact.html)
- Street addresses for Montreal and Accra offices
- Social media handles (update all social links with real URLs)
- Mamfe retreat photos (4 placeholder slots in community.html retreat section)

---

## How to Run Locally

```bash
# Option 1: VS Code Live Server
# Right-click index.html -> "Open with Live Server"

# Option 2: Node.js serve
npx serve .

# Option 3: Python
python -m http.server 8000
```

---

## Common Tasks for Claude Code

### Fix a broken link
```
Update the href for [page name] link in the nav of [file].html
```

### Add a new team member photo
```
In contact.html, replace the initials div for [name] with an img tag
pointing to images/[filename].jpg
```

### Update a country CEO
```
In countries.html, update the Country CEO name and contact for [country]
```

### Fix the hero to be full viewport height
```
In index.html, ensure the .hero section has:
  min-height: 100vh;
  background-image: url('images/hud-group-home-bg.jpg');
  background-size: cover;
  background-position: center center;
  background-attachment: fixed;
```

### Add a new report PDF
```
In content.html, find the reports-grid section and update the
href="#" on the [report name] card to href="reports/filename.pdf"
```

---

## WordPress Handover Notes

When converting to WordPress:
1. Each `.html` file becomes a WordPress page template (`.php`)
2. The `<style>` blocks go into `style.css` (child theme)
3. The `<script>` blocks go into `functions.js` (enqueued in `functions.php`)
4. The `images/` folder contents go into `/wp-content/uploads/`
5. All `images/` paths become `<?php echo get_template_directory_uri(); ?>/images/`
6. The nav and footer HTML become `header.php` and `footer.php` partials
7. Replace the contact form with WPForms or Contact Form 7
8. The training library accordion becomes an ACF repeater field

---

## Notes on File Sizes

After local image extraction (no base64 embedding):
- index.html: ~61KB
- community.html: ~268KB (largest due to full TSF content)
- All others: 20 to 80KB each
- images/ folder: ~2.9MB total

Total project: ~4.5MB uncompressed — well within normal site limits.

---

## TSF Application Form (apply.html)

- Mirrors the Google Form "THE SHADRACH FELLOWSHIP 2026/2027 Application Form" question for
  question (10 Google sections grouped into 6 steps). The commitment rating and consent box are
  required on the website.
- Submissions go to a Google Apps Script web app bound to a response sheet that is created and owned by
  **engage@thehudgroupglobal.org**, so the sheet, Drive folder and emails all stay under the organisation's
  own account (`setupCheck` refuses any other account). It saves a row, stores the CV and recommendation letter in a private Drive folder, emails
  engage@thehudgroupglobal.org and emails the applicant a reference number (TSF27-001 and so on).
- The question list lives in two places that must stay in step: the form fields and the `F` registry
  in `apply.html`, and `validate_` and `columns_` in `backend/tsf-applications/Code.gs`.
  The age range (17 to 39), 200 word limit and 5 MB file limit are enforced in both.
- Drafts are kept in the visitor's browser (localStorage), never the uploaded files or the consent box.
- **Typography on apply.html (pilot for a sitewide refresh):** headings use **Gambetta** (Fontshare serif,
  weights 500/600) and everything else uses **Satoshi**, loaded in one Fontshare request. Nav, buttons,
  numbers and labels are Satoshi with lining figures. The other pages still use Playfair Display until the
  refresh is rolled out.
- **apply.html photos** live in `images/apply/` (local web-sized JPGs, converted from the Cloudinary originals):
  tsf-table-discipleship (hero), tsf-teaching-mission, tsf-life-story-map, tsf-prayer, tsf-hybrid-session,
  tsf-disciples-shirt, tsf-cohort-group, tsf-community-meal, tsf-reflection, tsf-joy-selfie.
- Do not publish applicant names or answers anywhere on the site. Applicant data is private.
