# Island Party Rentals — online booking site

A static web app you can host free on **GitHub Pages**, with:

- Product catalog with prices, categories, and photos
- Cart + checkout with rental **date and delivery time slot**
- **Live inventory by date** — if 3 of 4 tents are booked on July 25, customers see "Only 1 left"
- **50% deposit** collected at checkout via **bank transfer, CIBC 1st Pay, or BimPay** (instructions + order reference shown to the customer)
- **Invoice emails** to the customer and to admin staff on every order
- **Back office login** (`admin.html`) to add/edit products and manage orders

Because GitHub Pages can't run a server, the database, staff login, and inventory live in
**Firebase** (Google's free backend service), and invoice emails are sent through **EmailJS**
(free tier: 200 emails/month). Both plug straight into this static site.

---

## Try it right now (demo mode)

Open `index.html` in a browser (or push to GitHub Pages as-is). Until you connect Firebase,
the site runs in **demo mode** with sample products so you can click through everything.
Back office demo login: `admin@demo.com` / `demo1234`. Demo orders aren't saved.

---

## 1. Put it on GitHub Pages

1. Create a repository on github.com (e.g. `island-party-rentals`).
2. Upload all the files in this folder (keep the folder structure).
3. In the repo: **Settings → Pages → Source: Deploy from a branch → main → / (root) → Save**.
4. Your site goes live at `https://YOURUSERNAME.github.io/island-party-rentals/` within a minute or two.

> Note: files in a public repo are visible to anyone. The Firebase "apiKey" in `js/config.js`
> is designed to be public — real protection comes from the Firestore rules in step 2.6.

## 2. Connect Firebase (database + staff login) — ~15 minutes

1. Go to [console.firebase.google.com](https://console.firebase.google.com) → **Add project**
   (any name, Analytics optional).
2. In the project, click the **web icon `</>`** to register a web app. Firebase shows you a
   `firebaseConfig` object — copy those values into `FIREBASE_CONFIG` in **`js/config.js`**.
3. **Build → Firestore Database → Create database** → Start in *production mode* → pick a
   region (e.g. `us-east1`).
4. **Build → Authentication → Get started → Email/Password → Enable.**
5. Still in Authentication → **Users → Add user**: create your staff login(s)
   (e.g. `you@yourbusiness.com` + a strong password). These are the accounts that can
   sign in at `admin.html`.
6. Back in **Firestore Database → Rules**: replace the contents with the rules in
   **`firestore.rules`** (in this folder) and click **Publish**. This locks editing to
   signed-in staff while letting customers browse and place orders.
7. Push the updated `js/config.js` to GitHub. Reload your site — the demo banner disappears.
8. Sign in at `admin.html` and add your real products (name, category, price/day,
   **quantity owned**, photo URL, description).

**Product photos:** create an `images/` folder in your repo, upload photos there, and use the
link (`https://YOURUSERNAME.github.io/island-party-rentals/images/tent.jpg`) as the Image URL.

## 3. Fill in your business + payment details

Open **`js/config.js`** and edit the `BUSINESS` and `PAYMENT_METHODS` sections:

- Phone, WhatsApp number, email, admin notification email
- Bank transfer details (bank, account name/number, branch)
- Your CIBC 1st Pay recipient info
- Your BimPay handle/phone

These appear on the checkout confirmation screen and in the invoice emails, together with the
customer's unique order reference (e.g. `IPR-K7M2QX`) so you can match payments to bookings.

You can also change the delivery `TIME_SLOTS` and the `depositPercent` there.

## 4. Invoice emails (EmailJS) — ~15 minutes

1. Create a free account at [emailjs.com](https://www.emailjs.com).
2. **Email Services → Add New Service** → connect the mailbox you send from (e.g. Gmail).
   Note the **Service ID**.
3. **Email Templates → Create New Template** twice:

   **Template 1 — customer invoice** (ID: `template_customer_invoice`)
   - *To email:* `{{customer_email}}`
   - *Subject:* `Your {{business_name}} booking {{order_ref}} — deposit due`
   - *Body:*
     ```
     Hi {{customer_name}},

     Thanks for booking with {{business_name}}!

     Order reference: {{order_ref}}
     Rental date: {{rental_date}}, {{time_slot}}
     Delivery to: {{delivery_address}}

     Items:
     {{item_lines}}

     Total: {{subtotal}}
     Deposit due now (50%): {{deposit}}
     Balance on delivery: {{balance}}

     How to pay your deposit ({{payment_method}}):
     {{payment_instructions}}

     Please quote {{order_ref}} with your payment. Your booking is
     confirmed once the deposit is received.

     Questions? Call {{business_phone}} or reply to this email.
     ```

   **Template 2 — admin alert** (ID: `template_admin_alert`)
   - *To email:* `{{admin_email}}`
   - *Subject:* `New order {{order_ref}} — {{rental_date}}`
   - *Body:*
     ```
     New order placed.

     Ref: {{order_ref}}
     Date: {{rental_date}}, {{time_slot}}
     Customer: {{customer_name}} — {{customer_phone}} — {{customer_email}}
     Address: {{delivery_address}}

     Items:
     {{item_lines}}

     Total: {{subtotal}} | Deposit due: {{deposit}} via {{payment_method}}

     Mark the deposit as paid in the back office once received.
     ```
4. **Account → General**: copy your **Public Key**.
5. Put the Public Key, Service ID, and the two Template IDs into the `EMAILJS` section of
   `js/config.js`, then push to GitHub.

## 5. Daily workflow for staff

1. Customer books → order appears in **admin.html → Orders** as *Awaiting deposit*, and both
   emails go out automatically.
2. Deposit arrives in your bank / 1st Pay / BimPay → find the order by its reference →
   set status to **Deposit paid**.
3. After the event, set it to **Completed**. If a customer cancels, set **Cancelled** —
   the items instantly become available again for that date.
4. Add or edit products any time in the **Products** tab; changing *Quantity owned* updates
   availability everywhere.

## How availability works

Each product stores the total quantity you own. When a customer picks a date, the site adds up
all non-cancelled orders for that date and shows `owned − reserved` per item. Availability is
re-checked at the moment an order is placed, so two customers can't book the last unit at once.

## Files

```
index.html        Customer storefront
admin.html        Staff back office (login required)
css/styles.css    Shared design system
js/config.js      ← the only file you edit (Firebase, business, payments, EmailJS)
js/db.js          Data layer (Firestore + demo mode)
js/store.js       Storefront logic
js/admin.js       Back office logic
firestore.rules   Security rules to paste into Firebase
```

## Later upgrades to consider

- Multi-day rentals (date range instead of single date)
- Online card payments if you add a processor that serves Barbados (e.g. WiPay, First Atlantic Commerce)
- A custom domain (GitHub Pages supports this free under Settings → Pages)
