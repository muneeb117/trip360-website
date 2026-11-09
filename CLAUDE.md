# Trip360 website

Plain HTML, CSS and JavaScript for trip360.site and admin.trip360.site. There is
no build step: open `index.html` in a browser to preview.

What merges into `main` goes live on trip360.site within about a minute, and
`main` takes changes only through a pull request the owner has approved. Work on
a branch and open a pull request.

Rules for working here:

- Do not change `privacy.html` or `terms.html`. They are legal text, and only the
  owner changes them.
- Leave `vercel.json`, `.vercelignore` and `.well-known/` as they are unless the
  owner asks. They hold the hosting rules, what is published, and the links that
  open the iPhone app.
- `admin/` (except `admin/marketing.html`) is the live admin panel at
  admin.trip360.site, and `studio/` is the live Clipper Studio with creator
  logins. Change them only when the owner asks, and say so in the pull request.
- `studio-next/` is the newer Studio, not yet connected to the database.
  `admin/marketing.html` and its scripts are not published (see `.vercelignore`)
  until the page has a login.
- `invite.html` is opened from friend links in the app: keep its links working.
- Never add keys, passwords or tokens to any file. Only the publishable keys
  already in `admin/config.js` and `studio/config.js` belong in the browser.
