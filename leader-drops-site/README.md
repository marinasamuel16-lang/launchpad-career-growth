# Leader Drops site

The files served at https://launchpad-leader-drops.netlify.app. Plain HTML/CSS/JS,
no build step. Two kinds of guest invitation, both made from the admin
(`/admin` → Create Invite):

- **Leader Drop** — `/drop/<code>`: the leader records answers to three questions
  on their own time (`index.html`, `assets/app.js`).
- **Live interview** — `/live/<code>`: one page with the date and time (Eastern,
  plus the guest's own time zone), Apple / Google calendar buttons, their three
  questions, and a short bio / title / company / headshot form (`live.html`,
  `assets/live.js`). Add `-preview` to the code to look without marking it opened.
  A live invite opened through a `/drop/` link moves to its `/live/` page.

Admin (`/admin`): Live tab (guest leads → either kind of invite), Create Invite,
Invitations (Edit a live interview to reschedule or add the meeting link).

Database settings are in `assets/config.js` (the Career Hub's Supabase project,
launchpad-career-hub). The Apple Calendar file comes from that project's
`launchpad-ics` function.

To publish a change: drag this whole folder onto the site's Deploys page in
Netlify (Deploys → "drag and drop your project folder").
