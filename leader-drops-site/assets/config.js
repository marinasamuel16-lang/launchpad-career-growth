// LaunchPad EIC — Leader Drops configuration.
// The key below is the public "anon" key: it is safe in the browser.
// Every read/write is locked down by database rules (see supabase/leader_drops.sql).
window.LD_CONFIG = {
  SUPABASE_URL: "https://yvebvsgixedduxicjisv.supabase.co",
  // Direct storage host — recommended by Supabase for large resumable uploads.
  STORAGE_URL: "https://yvebvsgixedduxicjisv.storage.supabase.co",
  SUPABASE_ANON_KEY:
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl2ZWJ2c2dpeGVkZHV4aWNqaXN2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTI5NzEyMDYsImV4cCI6MjEwODU0NzIwNn0.H4ryPMJIOyHMlRscS8Sfah5TZlrNmnvKbsH6Fw3BD_A",
  BUCKET: "leader-drops",

  MAX_SECONDS: 120,                  // 2-minute cap per answer
  MAX_VIDEO_MB: 50,                  // per video file (the most Supabase's free plan accepts)
  MAX_HEADSHOT_MB: 15,
  RECORD_BITRATE: 2_500_000,         // ~38 MB for a full 2-minute browser recording

  CONTACT_EMAIL: "launchpadeic@gmail.com",
  LINKS: {
    youtube: "https://www.youtube.com/@LaunchPadEIC",
    // TODO: swap in the LaunchPad EIC LinkedIn page URL
    linkedin: "https://www.linkedin.com/search/results/all/?keywords=LaunchPad%20EIC",
    site: "https://launchpadeic.com",
  },
};
