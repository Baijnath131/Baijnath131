# Om Sai Medical Store — Full-Stack Pharmacy Application

Complete full-stack pharmacy application source for Om Sai Medical Store, Desiand, Basti, Uttar Pradesh, India.

## Features
- Customer storefront, catalog, search/filter, cart and checkout
- Customer registration/login/profile and order history
- Prescription upload with pharmacist/admin review
- Admin dashboard for products, inventory, prescriptions and orders
- Role-based authorization
- SQLite database with schema and seed data
- Password hashing, JWT authentication, Helmet, rate limiting and upload validation
- Responsive frontend served by Express

## Local setup
1. Install Node.js 20+.
2. Copy .env.example to .env.
3. Run npm install.
4. Run npm run dev.
5. Open http://localhost:3000.

Seed admin defaults are configured by environment variables. Change them before real use.

Production integrations such as payment gateway, email/SMS/WhatsApp, cloud file storage, HTTPS/domain and regulatory/compliance review must be configured before production use.
