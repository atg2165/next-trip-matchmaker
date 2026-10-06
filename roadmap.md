# Roadmap

- [x] Move Home City into bottom Travel Settings section
- [x] Support custom destination names with editable neutral defaults
- [x] Expand and validate the built-in catalog to 200 cities
- [x] Verify custom-city behavior, Home City recalculation rules, page order, and production build
- [x] Share links: state encoded in `?s=` param, URL stays in sync, Share button copies link
- [x] Lovable Cloud: email/password + Google sign-in, trips table with owner-only access
- [x] Save trip (with sign-in gate) and My Trips page (open / rename / delete)
- [x] Sign-in page, reset-password page, session-aware header, verified build + preview
- [ ] Optional: end-to-end test of save/open flow with a real signed-in account (needs a live sign-up)
- [x] Group matchmaking: invite link (name only, anonymous sign-in), shared shortlist, per-person sliders + home city, combined ranking (Average / Least misery / Most pleasure) with who loves / compromises, live via Supabase Realtime
- [ ] Apply `drizzle/migrations/0001_create_groups.sql` and enable anonymous sign-ins in Lovable Cloud, then run an end-to-end two-browser test of a group
