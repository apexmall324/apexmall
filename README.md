# ApexMall — Static JSON-driven Marketplace

This is a simple, fast, and responsive static site for ApexMall that loads products and services from JSON data files.

Quick start (local)
1. Clone the repo and put these files at the site root.
2. Run a local static server:
   - Python: `python -m http.server 8000` (in the folder)
   - Node: `npx http-server -p 8080` or `npx serve`
3. Open `http://localhost:8000` in your browser.

How it works
- products.json and services.json hold all displayed data.
- script.js fetches those files and renders HTML on the client.
- Products with `external_url` will direct users to that URL (e.g., your mydukeshop checkout).
- Products without external_url open WhatsApp with a prefilled message (set `whatsapp` with your number in international format, no plus sign).

Customization
- Replace images with your hosted images (Cloudinary, S3, or direct URLs).
- Edit prices, descriptions, and add/remove items in the JSON files.
- Update the global contact number in `script.js` (DEFAULT_WA_NUMBER) and contact links.

Deployment
- GitHub Pages: push to `gh-pages` or to `main` with appropriate settings.
- Vercel / Netlify: connect the repo and deploy (automatic).

Accessibility & security notes
- No user data is stored — site simply offers contact links and external redirects.
- If you ever add forms or payment flows, use HTTPS and trusted payment providers.

Next steps (suggested)
- Add product categories and filter UI.
- Add search and pagination for large catalogs.
- Add an admin page to edit JSON data or switch to a small CMS (Netlify CMS, Forest, or a simple admin app).
- Integrate image uploads to Cloudinary or S3 for admin product image management.

If you want, I can:
- Scaffold a separate admin app for editing JSON (in the repo).
- Convert this static site into a Next.js app with server-side rendering and a Prisma + MySQL backend you are familiar with.
- Add a small CSV import to populate products.json.

Tell me which next step you want and I’ll prepare the files or GitHub issues for it.







ApexMall/
│
├── index.html
├── style.css
├── script.js
└── data/
    └── products.json
