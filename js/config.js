/**
 * The one place any of this is configured.
 *
 * To make the contact form live:
 *   1. Create a free account at https://www.emailjs.com
 *   2. Add an email service   → copy its Service ID
 *   3. Add an email template  → copy its Template ID
 *   4. Account → API Keys     → copy your Public Key
 *   5. Paste the three values below.
 *
 * The EmailJS template should reference these variables, which is exactly what
 * `js/pages/contact.js` sends:
 *
 *   {{from_name}}   {{subject}}   {{message}}   {{to_email}}   {{reply_to}}
 *
 * The public key is safe to commit — EmailJS scopes it to your allowed origins.
 * Set those in the EmailJS dashboard before going live, or anyone can send mail
 * through your quota.
 */

export const CONTACT = {
  /** Where inquiries land. Change this and nothing else needs to move. */
  destination: "Rakesh.ghosh@gmail.com",

  emailjs: {
    publicKey: "AJjV3SCpwTY5F8tOY",
    serviceId: "service_i6dragj",
    templateId: "template_x6gfglg",
  },
};

/** True once real keys are in place. Until then the form fails honestly. */
export const isEmailConfigured = () =>
  Object.values(CONTACT.emailjs).every((v) => v && !v.startsWith("REPLACE_WITH_"));
