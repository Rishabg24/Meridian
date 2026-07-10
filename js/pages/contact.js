/**
 * Contact.
 *
 * Validation on blur (never on keystroke), errors announced through a live
 * region, and a submit button whose own baseline is the progress bar.
 *
 * On failure the form says so. It never reports a success it did not get: if
 * the EmailJS keys in js/config.js are still placeholders, the submit fails
 * honestly and surfaces a mailto: recovery, because a silently-dropped inquiry
 * is worse than an error message.
 */

import { CONTACT, isEmailConfigured } from "../config.js";
import { magnetize } from "../core/cursor.js";
import { prefersReduced } from "../core/motion.js";

const EMAILJS_SDK = "https://cdn.jsdelivr.net/npm/@emailjs/browser@4/dist/email.min.js";

const RULES = {
  name: (v) => (v.trim().length >= 2 ? "" : "Please enter your full name."),
  subject: (v) => (v.trim().length >= 3 ? "" : "Please give the inquiry a subject."),
  message: (v) =>
    v.trim().length >= 20 ? "" : "Please describe the work in at least a sentence or two.",
};

const teardown = [];

export function init({ fluid, obstacles }) {
  const form = document.querySelector(".inquiry");
  if (form) initForm(form);

  panelAuras(obstacles);

  // The ink settles under the contact panels: this page is for reading and
  // typing, not for watching.
  fluid?.setResting(true);
  teardown.push(() => fluid?.setResting(false));
}

export function destroy() {
  while (teardown.length) teardown.pop()();
}

/* ---------------------------------------------------------------- */

function initForm(form) {
  const fields = Array.from(form.querySelectorAll(".field"));
  const submit = form.querySelector(".submit");
  const status = form.querySelector(".status");

  if (submit) teardown.push(magnetize(submit, { strength: 0.14 }));

  /* ---- validation ---- */

  const validate = (field, { shake = false } = {}) => {
    const input = field.querySelector(".field__input");
    const error = field.querySelector(".field__error");
    const rule = RULES[input.name];
    if (!rule) return true;

    const message = rule(input.value);
    const valid = message === "";

    field.classList.toggle("is-invalid", !valid);
    input.setAttribute("aria-invalid", String(!valid));
    error.textContent = message;

    if (!valid && shake && !prefersReduced) {
      field.classList.remove("is-shaking");
      // Force a reflow so the animation restarts on a repeat submit.
      void field.offsetWidth;
      field.classList.add("is-shaking");
      field.addEventListener("animationend", () => field.classList.remove("is-shaking"), {
        once: true,
      });
    }

    return valid;
  };

  for (const field of fields) {
    const input = field.querySelector(".field__input");

    const onBlur = () => validate(field);
    // Once a field is already marked invalid, correct it live — the user is
    // now actively fixing it and deserves to see it clear.
    const onInput = () => { if (field.classList.contains("is-invalid")) validate(field); };

    input.addEventListener("blur", onBlur);
    input.addEventListener("input", onInput);

    teardown.push(() => {
      input.removeEventListener("blur", onBlur);
      input.removeEventListener("input", onInput);
    });
  }

  /* ---- status ---- */

  const setStatus = (state, html) => {
    form.classList.remove("is-sending", "is-sent", "is-failed");
    status.classList.remove("status--ok", "status--error");

    if (state) form.classList.add(`is-${state}`);

    if (!html) {
      status.classList.remove("is-shown");
      status.innerHTML = "";
      return;
    }

    if (state === "sent") status.classList.add("status--ok");
    if (state === "failed") status.classList.add("status--error");

    status.innerHTML = html;
    status.classList.add("is-shown");
  };

  /* ---- submit ---- */

  const onSubmit = async (e) => {
    e.preventDefault();

    const results = fields.map((f) => validate(f, { shake: true }));
    if (results.includes(false)) {
      const firstBad = fields.find((f) => f.classList.contains("is-invalid"));
      firstBad?.querySelector(".field__input")?.focus();
      setStatus("failed", "Some fields still need attention.");
      return;
    }

    submit.disabled = true;
    setStatus("sending", '<span class="spinner" aria-hidden="true"></span><span>Sending your inquiry…</span>');

    const data = new FormData(form);
    const payload = {
      from_name: data.get("name"),
      subject: data.get("subject"),
      message: data.get("message"),
      to_email: CONTACT.destination,
      reply_to: CONTACT.destination,
    };

    try {
      await send(payload);
      form.reset();
      setStatus(
        "sent",
        `<svg class="check" viewBox="0 0 18 18" aria-hidden="true"><path d="M3 9.5 L7 13.5 L15 4.5"/></svg>
         <span>Thank you. Your inquiry has reached Dr.&nbsp;Ghosh. Expect a reply within two working days.</span>`
      );
    } catch (err) {
      console.error("[meridian] contact form:", err);
      setStatus("failed", `<span>${escapeHtml(recoveryMessage(err))} ${mailtoLink(payload)}</span>`);
    } finally {
      submit.disabled = false;
    }
  };

  form.addEventListener("submit", onSubmit);
  teardown.push(() => form.removeEventListener("submit", onSubmit));
}

/* ---------------------------------------------------------------- */

let sdkPromise = null;

/** Load the EmailJS SDK on first submit, not on page load. */
function loadSdk() {
  if (window.emailjs) return Promise.resolve(window.emailjs);
  if (sdkPromise) return sdkPromise;

  sdkPromise = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = EMAILJS_SDK;
    script.onload = () => (window.emailjs ? resolve(window.emailjs) : reject(new Error("SDK_LOAD")));
    script.onerror = () => reject(new Error("SDK_LOAD"));
    document.head.appendChild(script);
  });

  return sdkPromise;
}

async function send(payload) {
  if (!isEmailConfigured()) throw new Error("NOT_CONFIGURED");

  const emailjs = await loadSdk();
  const { publicKey, serviceId, templateId } = CONTACT.emailjs;

  emailjs.init({ publicKey });
  return emailjs.send(serviceId, templateId, payload);
}

function recoveryMessage(err) {
  if (err?.message === "NOT_CONFIGURED") {
    return "The form is not connected to an email service yet. Please write directly:";
  }
  if (err?.message === "SDK_LOAD") {
    return "Could not reach the mail service. Please write directly:";
  }
  return "Something went wrong sending that. Please write directly:";
}

/** Never lose an inquiry: hand the user a pre-filled message they can send. */
function mailtoLink({ subject, message, from_name: fromName }) {
  const body = encodeURIComponent(`${message}\n\n— ${fromName}`);
  const subj = encodeURIComponent(subject || "Inquiry via Meridian");
  return `<a href="mailto:${CONTACT.destination}?subject=${subj}&body=${body}">${CONTACT.destination}</a>`;
}

function escapeHtml(s) {
  const div = document.createElement("div");
  div.textContent = s;
  return div.innerHTML;
}

/* ---------------------------------------------------------------- */

function panelAuras(obstacles) {
  document.querySelectorAll("[data-obstacle]").forEach((panel) => {
    const enter = () => obstacles.setActive(panel);
    const leave = () => {
      if (obstacles.activeEl === panel) obstacles.setActive(null);
    };

    panel.addEventListener("pointerenter", enter);
    panel.addEventListener("pointerleave", leave);
    panel.addEventListener("focusin", enter);
    panel.addEventListener("focusout", leave);

    teardown.push(() => {
      panel.removeEventListener("pointerenter", enter);
      panel.removeEventListener("pointerleave", leave);
      panel.removeEventListener("focusin", enter);
      panel.removeEventListener("focusout", leave);
    });
  });
}
