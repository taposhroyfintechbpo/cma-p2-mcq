# CMA Part 2 — MCQ Practice App

A clean, professional web app to practice **CMA Part 2 (Strategic Financial Management)** multiple-choice questions on any device. It works offline, saves your progress, and can be installed like a real app on your phone or computer.

- **1,756 questions** across all 15 Study Units (Volume 1 and Volume 2)
- **400 data tables and charts** shown exactly as images, so the math questions stay clear
- **Mock tests**: section, study-unit, custom builder, and a full 100-question exam
  - Countdown timer, pause, auto-submit, and a question navigator grid
  - Saved results with score, verdict, per-unit breakdown, and full answer review
- **Practice modes**: instant feedback or exam mode
- **Progress tracking**: answered, correct, accuracy, per topic
- **Weak-area analysis** to focus on your lowest-scoring topics
- **Search** across all questions, plus **personal notes** on any question
- **Study streak + activity calendar** and **achievement badges**
- **Flag questions**, redo incorrect ones, quick mixed sets, confidence rating
- **Dark mode**, adjustable text size, optional answer shuffling
- **Mobile and desktop layouts**, installable (PWA), fully offline
- **Move progress between devices** with export and import

---

## 1) Put it on GitHub (one time)

1. Create a new repository on GitHub, for example `cma-p2-mcq`.
2. Upload **everything inside this folder** (keep the folder structure):

   ```
   index.html
   styles.css
   app.js
   manifest.webmanifest
   sw.js
   .nojekyll
   data/questions.js
   images/            (400 png files)
   icons/             (app icons)
   ```

   The easiest way: on your repo page click **Add file → Upload files**, then drag the whole set in. You can drag the `data`, `images` and `icons` folders too.

3. Commit the upload.

## 2) Turn on GitHub Pages

1. In your repo go to **Settings → Pages**.
2. Under **Build and deployment**, set **Source** to **Deploy from a branch**.
3. Choose branch **main** and folder **/ (root)**, then **Save**.
4. Wait about a minute. GitHub will show your live link, like:

   ```
   https://YOUR-USERNAME.github.io/cma-p2-mcq/
   ```

Open that link on any device. That is your app.

## 3) Install it as an app (optional but nice)

- **iPhone / iPad (Safari):** open the link, tap the **Share** button, then **Add to Home Screen**.
- **Android (Chrome):** open the link, tap the **⋮** menu, then **Install app** or **Add to Home screen**.
- **Windows / Mac (Chrome or Edge):** open the link, click the **install icon** in the address bar, or menu **→ Install**.

Once installed it opens full screen and works offline.

---

## Using the app

- **Home** shows your progress, day streak, last test, and a Resume button.
- **Browse** lists every Study Unit and Subunit with its own progress bar.
- Pick a Subunit, then **Start practice**. Choose an answer to see the correct one and the explanation.
- **Tests** is where you run mock exams:
  - **Section test** — pick any subunit and set a timer.
  - **Study-unit test** — a timed test across a whole unit.
  - **Custom test** — choose which units to include, how many questions, and the time limit.
  - **Full mock exam** — 100 questions in 2.5 hours, like the real exam.
  - During a test: use the **Navigator** to jump around, flag questions, pause, or submit. Blank answers count as incorrect, just like the real exam.
  - After submitting: see your **score, verdict, per-unit breakdown**, and a full **answer review**.
- **Review** focuses on flagged, incorrect, unanswered, or noted questions, and shows your **weakest topics**.
- **Stats** shows accuracy, streak, an **activity calendar**, **achievements**, and a per-unit breakdown.
- **Search (⌕)** finds any question by keyword.
- **Settings (⚙)** — feedback mode, theme, text size, answer shuffle, default test pace, and export/import.

### Keyboard shortcuts (desktop)

| Key | Action |
|-----|--------|
| A–D | choose an option |
| ← / → | previous / next |
| Enter | next question |
| F | flag for review |
| N | add a note (in practice) |

---

## Moving progress to another device

Your progress is stored in the browser on each device, so it does not sync automatically. To copy it across:

1. On the device that has your progress: **Settings → Export progress**. Save the file.
2. On the other device: **Settings → Import progress**. Pick that file.

That is it. Your answers, flags, and stats carry over.

---

## Notes

- A small number of questions have no answer in the original source. The app clearly shows **"Answer not provided in source"** rather than guessing.
- Everything runs on your device. There is no server, no account, and no tracking.
- Content is from the Gleim CMA Part 2 MCQ Test Bank, for personal study use.
