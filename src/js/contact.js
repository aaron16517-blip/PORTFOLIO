import gsap from 'gsap';
import ScrollTrigger from 'gsap/ScrollTrigger';
import { track as vaTrack } from '@vercel/analytics';

gsap.registerPlugin(ScrollTrigger);

/* ============================================================
   CONTACT — the form, and the reveal for the panel and the map.

   The pin's pulse and float are CSS keyframes; this file only
   handles the scroll reveal and the submission.
   ============================================================ */

/* ------------------------------------------------------------------
   WHERE SUBMISSIONS GO.

   Web3Forms emails every submission to the inbox the key was created
   for and keeps a copy in its dashboard. Get a key at
   https://web3forms.com (enter info@genesisproductions.design) and
   paste it below. The key is public by design — it can only send
   to that inbox.

   Without a key the form still works: it opens the visitor's mail app
   with the message filled in, addressed to CONTACT_EMAIL.
   ------------------------------------------------------------------ */
const WEB3FORMS_KEY = '0b5876ae-6b41-4684-968e-ec4c96ee5961';
const FORM_ENDPOINT = 'https://api.web3forms.com/submit';
const CONTACT_EMAIL = 'info@genesisproductions.design';

/* Vercel Web Analytics custom event (shown on Pro plans); harmless otherwise */
const track = (name, data) => { try { vaTrack(name, data); } catch {} };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

const RULES = {
  cfName:    (v) => (v.trim().length >= 2 ? '' : 'Please enter your name.'),
  cfEmail:   (v) => (EMAIL_RE.test(v.trim()) ? '' : 'Please enter a valid email address.'),
  cfMessage: (v) => (v.trim().length >= 10 ? '' : 'A little more detail, please — at least 10 characters.')
};

export function initContact() {
  const section = document.getElementById('contact');
  const form = document.getElementById('contactForm');
  if (!section || !form) return;

  const status = document.getElementById('cfStatus');
  const submit = document.getElementById('cfSubmit');
  const label  = submit.querySelector('.cform__submit-text');

  /* ---------- reveal ---------- */
  gsap.from(gsap.utils.toArray('.js-contact-reveal', section), {
    scrollTrigger: { trigger: section, start: 'top 78%' },
    opacity: 0,
    y: 44,
    duration: 1.1,
    ease: 'expo.out',
    stagger: 0.12
  });

  /* ---------- validation ---------- */
  const errorFor = (id) => form.querySelector(`.cform__error[data-for="${id}"]`);

  const showError = (field, message) => {
    const slot = errorFor(field.id);
    if (slot) slot.textContent = message;
    field.setAttribute('aria-invalid', message ? 'true' : 'false');
    return !message;
  };

  const validateField = (field) => {
    const rule = RULES[field.id];
    return rule ? showError(field, rule(field.value)) : true;
  };

  /* clear a field's error as soon as it becomes valid — never scold mid-type */
  Object.keys(RULES).forEach((id) => {
    const field = form.querySelector(`#${id}`);
    if (!field) return;
    field.addEventListener('input', () => {
      if (field.getAttribute('aria-invalid') === 'true') validateField(field);
    });
    field.addEventListener('blur', () => {
      if (field.value.trim()) validateField(field);
    });
  });

  const setStatus = (text, state) => {
    status.textContent = text;
    if (state) status.dataset.state = state;
    else delete status.dataset.state;
  };

  /* ---------- submit ---------- */
  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const fields = Object.keys(RULES).map((id) => form.querySelector(`#${id}`)).filter(Boolean);
    const firstBad = fields.filter((f) => !validateField(f))[0];

    if (firstBad) {
      setStatus('Please fix the highlighted fields.', 'fail');
      firstBad.focus();
      track('contact_invalid', { field: firstBad.name });
      return;
    }

    const data = Object.fromEntries(new FormData(form).entries());

    /* the hidden honeypot is only ever filled in by bots */
    if (data.botcheck) return;
    delete data.botcheck;

    const service = data.service || 'Not specified';

    if (!WEB3FORMS_KEY) {
      const body =
        `Name: ${data.name}\nEmail: ${data.email}\n` +
        (data.company ? `Company: ${data.company}\n` : '') +
        `Looking for: ${service}\n\n${data.message}`;
      window.location.href =
        `mailto:${CONTACT_EMAIL}` +
        `?subject=${encodeURIComponent(`New enquiry from ${data.name}`)}` +
        `&body=${encodeURIComponent(body)}`;
      setStatus(`Your email app should open with the message ready — just press send. Or write to ${CONTACT_EMAIL}.`, 'ok');
      track('contact_mailto', { service });
      return;
    }

    submit.disabled = true;
    label.textContent = 'Sending…';
    setStatus('');

    try {
      const res = await fetch(FORM_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          access_key: WEB3FORMS_KEY,
          subject: `New enquiry from ${data.name} — ${service}`,
          from_name: 'Portfolio contact form',
          replyto: data.email,
          ...data,
          service,
          page: window.location.href
        })
      });
      const json = await res.json().catch(() => ({}));

      if (!res.ok || json.success === false) {
        throw new Error(json.message || `Request failed (${res.status})`);
      }

      form.reset();
      fields.forEach((f) => f.setAttribute('aria-invalid', 'false'));
      setStatus('Thanks — your message is on its way. I’ll reply within one working day.', 'ok');
      label.textContent = 'Sent';
      track('contact_sent', { service });
    } catch (err) {
      setStatus(
        `That didn’t send (${err.message}). Email ${CONTACT_EMAIL} and I’ll pick it up.`,
        'fail'
      );
      label.textContent = 'Submit';
      track('contact_failed');
    } finally {
      submit.disabled = false;
      /* put the button back once the confirmation has been read */
      if (label.textContent === 'Sent') {
        gsap.delayedCall(4, () => { label.textContent = 'Submit'; });
      }
    }
  });
}
