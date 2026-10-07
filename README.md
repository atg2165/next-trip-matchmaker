# Welcome to your Lovable project

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Open your project in the [Lovable editor](https://lovable.dev) and keep building.

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: connect the project to GitHub and every change made in Lovable is committed straight to your repository.
- **Full ownership**: this code is yours. Push to your repository and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```

## Built with

- TanStack Start
- TypeScript
- React
- Tailwind CSS

## Group matchmaking

"Plan with friends" turns a comparison into a group. Friends open the invite link, add a
name (no account — they get an anonymous Supabase session), and set their own priority
sliders and home city against one shared shortlist. The group page shows a combined
ranking (Average, Least misery or Most pleasure) and who loves or compromises on each pick,
updating live via Supabase Realtime.

Setup needed on the backend: apply `drizzle/migrations/0001_create_groups.sql` and
`0002_group_rpcs.sql` (creating and joining run as database functions, so no service-role
key is needed) and enable anonymous sign-ins. Scoring lives in `src/lib/group.ts`; server functions in
`src/lib/groups.functions.ts`.
