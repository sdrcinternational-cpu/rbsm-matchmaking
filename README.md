# RBSM Connect

Matchmaking and meeting booking for India SME Forum's Reverse Buyer–Seller Meets (RBSM).

International buyers and sellers from the host state register for an event. Each side browses the other's profiles by
sector, sends a meeting request, and the other side accepts it into a free slot. The organiser sets up events and
approves sellers. Everything else runs without manual work.

## What it does

- **Events**: the organiser creates an event per location with its sectors, days, meeting hours, meeting length and number of tables.
- **Sign in by email code**: no passwords. A 6-digit code is emailed and expires in 10 minutes.
- **Buyers** register and can start browsing straight away.
- **Sellers** must give a Udyam number registered in the event's state (e.g. `UDYAM-AP-…` for Andhra Pradesh) and a 10-character IEC code. They wait for the organiser's approval before they can meet buyers. Changing either number sends the profile for approval again.
- **Matchmaking**: profiles are ranked by shared sectors and can be filtered by sector.
- **Slot booking**: on accepting a request, the person picks from the slots where both are free and a table is available, with the earliest one picked by default. Booking runs in a serializable transaction, so two people can't get the same table or double-book.
- **Emails**: login codes, new meeting requests, confirmations (to both sides), cancellations, seller approval or rejection, and a note to organisers when a seller registers.
- **Organiser view**: seller approvals, full meeting schedule with CSV download, participants, counts by sector, and event settings.

## Running locally

Needs Node 20+ and Postgres.

```bash
cp .env.example .env        # then edit the values
npm install
npx prisma migrate dev      # creates the tables
npm run db:seed             # adds Tirupati RBSM 2026
npm run dev
```

Without `RESEND_API_KEY`, emails (including sign-in codes) are printed in the terminal. Sign in with an email listed in
`ADMIN_EMAILS` to get the Organiser menu.

`npm test` runs the unit tests for the slot and Udyam/IEC rules. `npm run typecheck` checks types.

## Deploying on Vercel

1. In Vercel, **Add New → Project** and import this GitHub repository. The defaults are fine; the build command in `package.json` runs the database migrations.
2. In the project, open **Storage → Create Database → Neon (Postgres)** and connect it. This sets `DATABASE_URL` and `DATABASE_URL_UNPOOLED` for you.
3. Add the other environment variables from `.env.example`:
   - `SESSION_SECRET`: a long random string (`openssl rand -base64 32`).
   - `ADMIN_EMAILS`: organiser emails, comma separated.
   - `APP_URL`: the site address, e.g. `https://rbsm.indiasmeforum.org`.
   - `RESEND_API_KEY` and `EMAIL_FROM`: create a free account at resend.com, verify the `indiasmeforum.org` domain, and create an API key.
4. Deploy. The first deploy creates the tables and the Tirupati RBSM 2026 event. Sign in with an organiser email to manage it.
5. To use `rbsm.indiasmeforum.org`, add it under **Settings → Domains** and create the CNAME record Vercel shows at your DNS provider.
