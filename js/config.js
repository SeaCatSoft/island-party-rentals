/* ============================================================
   Island Party Rentals — SITE CONFIGURATION
   This is the only file you need to edit to go live.
   Follow README.md for step-by-step setup.
   ============================================================ */

// ---- 1. FIREBASE (database + admin login) -------------------
// Paste the config object from your Firebase project settings.
// While these placeholders are unchanged, the site runs in
// DEMO MODE with sample products so you can preview everything.
const FIREBASE_CONFIG = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID"
};

// ---- 2. BUSINESS DETAILS ------------------------------------
const BUSINESS = {
  name: "Island Party Rentals",
  tagline: "Tents, tables, bouncers & more — delivered across Barbados",
  phone: "(246) 832-0540",           // <-- your phone
  whatsapp: "12468320540",           // <-- digits only, for wa.me link
  email: "bookings@islandpartyrentals.bb",  // <-- your email
  adminNotifyEmail: "admin@islandpartyrentals.bb", // <-- where order alerts go
  currency: "BBD",
  depositPercent: 50,                // deposit required at checkout
  serviceArea: "Island-wide delivery, Barbados"
};

// ---- 3. PAYMENT INSTRUCTIONS shown at checkout --------------
// The customer picks a method, pays the 50% deposit, and quotes
// their order reference. Staff confirm receipt in the admin panel.
const PAYMENT_METHODS = {
  "bank-transfer": {
    label: "Bank transfer",
    instructions:
      "Transfer the deposit to:\n" +
      "Bank: [Your bank name]\n" +
      "Account name: Island Party Rentals\n" +
      "Account #: [000000000]\n" +
      "Branch/Transit: [00000]\n" +
      "Use your order reference as the transfer description."
  },
  "cibc-1st-pay": {
    label: "CIBC 1st Pay",
    instructions:
      "Send the deposit via CIBC 1st Pay to:\n" +
      "Recipient: Island Party Rentals\n" +
      "Phone/email: [your registered 1st Pay contact]\n" +
      "Put your order reference in the message field."
  },
  "bimpay": {
    label: "BimPay",
    instructions:
      "Send the deposit with BimPay to:\n" +
      "BimPay handle: [@islandpartyrentals]\n" +
      "Phone: [(246) 555-0123]\n" +
      "Include your order reference in the note."
  }
};

// ---- 4. DELIVERY TIME SLOTS ---------------------------------
const TIME_SLOTS = [
  "8:00 AM – 10:00 AM",
  "10:00 AM – 12:00 PM",
  "12:00 PM – 2:00 PM",
  "2:00 PM – 4:00 PM",
  "4:00 PM – 6:00 PM"
];

// ---- 5. EMAILJS (invoice emails) ----------------------------
// Free account at emailjs.com — see README section 4.
// Leave as-is to skip email sending (orders still work).
const EMAILJS = {
  publicKey: "YOUR_EMAILJS_PUBLIC_KEY",
  serviceId: "YOUR_EMAILJS_SERVICE_ID",
  customerTemplateId: "template_customer_invoice",
  adminTemplateId: "template_admin_alert"
};

// ------------------------------------------------------------
const DEMO_MODE = FIREBASE_CONFIG.apiKey === "YOUR_API_KEY";
const EMAIL_ENABLED = EMAILJS.publicKey !== "YOUR_EMAILJS_PUBLIC_KEY";

function money(n) {
  return "$" + Number(n).toFixed(2) + " " + BUSINESS.currency;
}
