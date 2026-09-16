import gsap from 'gsap';
import ScrollTrigger from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

/* ============================================================
   CONTACT — the form, and the reveal for the panel and the map.

   The pin's pulse and float are CSS keyframes; this file only
   handles the scroll reveal and the submission.
   ============================================================ */

/* ------------------------------------------------------------------
   WHERE SUBMISSIONS GO.

   Paste the endpoint from whichever form service you use — Formspree
   (https://formspree.io/f/xxxxxxx), Web3Forms, Getform, Basin. They all
   accept a JSON POST and email you the result, which is what this sends.

   Leave it empty and the form says so plainly rather than pretending to
   have sent anything.
   ------------------------------------------------------------------ */
const FORM_ENDPOINT = '';

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
      return;
    }

    const payload = Object.fromEntries(new FormData(form).entries());

    if (!FORM_ENDPOINT) {
      setStatus(
        'The form has no endpoint yet — set FORM_ENDPOINT in src/js/contact.js. ' +
        'Nothing was sent.',
        'fail'
      );
      return;
    }

    submit.disabled = true;
    label.textContent = 'Sending…';
    setStatus('');

    try {
      const res = await fetch(FORM_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!res.ok) throw new Error(`Request failed (${res.status})`);

      form.reset();
      fields.forEach((f) => f.setAttribute('aria-invalid', 'false'));
      setStatus('Thanks — your message is on its way. I’ll reply soon.', 'ok');
      label.textContent = 'Sent';
    } catch (err) {
      setStatus(
        `That didn’t send (${err.message}). Email me directly and I’ll pick it up.`,
        'fail'
      );
      label.textContent = 'Submit';
    } finally {
      submit.disabled = false;
      /* put the button back once the confirmation has been read */
      if (label.textContent === 'Sent') {
        gsap.delayedCall(4, () => { label.textContent = 'Submit'; });
      }
    }
  });
}
