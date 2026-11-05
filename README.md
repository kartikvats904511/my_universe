# A Little Universe Called Us — No-SQL local edition

This version stores diary entries, wishes, memories and other records in a local `data.json` file. You do **not** need PostgreSQL, pgAdmin, SQLite, or any SQL commands.

## Run on Windows

1. Install Node.js 20 or newer.
2. Extract this ZIP.
3. Open the project folder in File Explorer.
4. Click the folder address bar, type `cmd`, and press Enter.
5. Run `npm install`
6. Copy `.env.example` to a new file named `.env`.
7. Set ``, `ADMIN_PASSWORD`, and a long random `SESSION_SECRET` in `.env`.
8. Run `npm start`
9. Open http://localhost:3000

Your content is saved in `data.json` in the project folder. Back up that file regularly.

## Important limitations

- This file-storage edition is intended for a simple local, single-server setup.
- Express's default in-memory session store is used; restarting the server signs users out.
- For public hosting, multiple visitors editing at once, and reliable persistent storage, use a hosted database and persistent file storage. A Render deployment with an ephemeral filesystem can lose `data.json` on redeploy/restart.
- Photo uploads still require Cloudinary credentials. The browser-side photo enhancer does not need them.
- Do not commit `.env` or `data.json` to a public repository.
