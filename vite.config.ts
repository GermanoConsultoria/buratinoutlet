// cliente
//  import { defineConfig } from "@lovable.dev/vite-tanstack-config";

//  export default defineConfig({
//   tanstackStart: {
//     server: { entry: "server" },
//   },
//   vite: {
//     define: {
//       "import.meta.env.VITE_SUPABASE_URL": JSON.stringify("https://rhoztlwuleftdcjmwwfy.supabase.co"),
//       "import.meta.env.VITE_SUPABASE_ANON_KEY": JSON.stringify("eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJob3p0bHd1bGVmdGRjam13d2Z5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAyODAzMjIsImV4cCI6MjA5NTg1NjMyMn0.VJyskob7_zszg1N8dPdBGkw82f6TiA7jkfJ6EIlNknA"),
//     },
//   },
//  });


// DEV
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

export default defineConfig({
 tanstackStart: {
   server: { entry: "server" },
 },
 vite: {
   define: {
     "import.meta.env.VITE_SUPABASE_URL": JSON.stringify("https://krzabgooslpxsmdsevvo.supabase.co"),
      "import.meta.env.VITE_SUPABASE_ANON_KEY": JSON.stringify("eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtyemFiZ29vc2xweHNtZHNldnZvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQ1MzY3MjcsImV4cCI6MjEwMDExMjcyN30.pEGENW8CKBRhzvFCtH-EVPm54R2y_rKFPAe-u2mt08A"),
   },
 },
});