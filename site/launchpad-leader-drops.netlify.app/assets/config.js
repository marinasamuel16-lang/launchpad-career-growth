// LaunchPad EIC — Leader Drops configuration.
// The key below is the public "anon" key: it is safe in the browser.
// Every read/write is locked down by database rules (see supabase/leader_drops.sql).
window.LD_CONFIG = {
  SUPABASE_URL: "https://whqllgoqtztzbdegrnby.supabase.co",
  // Direct storage host — recommended by Supabase for large resumable uploads.
  STORAGE_URL: "https://whqllgoqtztzbdegrnby.storage.supabase.co",
  SUPABASE_ANON_KEY:
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndocWxsZ29xdHp0emJkZWdybmJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk4NTI0NTAsImV4cCI6MjA5NTQyODQ1MH0.9ccbSs6FfjU6nD2lrXfMfXdvpS7aP_B0XsZIj_6SLrg",
  BUCKET: "leader-drops",

  MAX_SECONDS: 120,                  // 2-minute cap per answer
  MAX_VIDEO_MB: 500,                 // per video file
  MAX_HEADSHOT_MB: 15,
  RECORD_BITRATE: 2_500_000,         // ~38 MB for a full 2-minute browser recording

  CONTACT_EMAIL: "launchpadeic@gmail.com",
  LINKS: {
    youtube: "https://www.youtube.com/@LaunchPadEIC",
    // TODO: swap in the LaunchPad EIC LinkedIn page URL
    linkedin: "https://www.linkedin.com/search/results/all/?keywords=LaunchPad%20EIC",
    site: "https://launchpad-career-growth.lovable.app",
  },
};
