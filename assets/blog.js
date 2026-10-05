/* Little Chef blog — starter posts + shared helpers.
   New posts are written in the Visit Planner (Blog tab) once the planner is connected.
   Body format: blank line = new paragraph, "## " = heading, "- " = bullet, **bold**. */
(function () {
  var STARTER = [
    {
      slug: 'what-happens-on-a-little-chef-visit',
      date: '2026-10-05',
      category: 'Inside Little Chef',
      author: 'Team Little Chef',
      cover: 'assets/factory.webp',
      title: 'What happens on a Little Chef factory visit?',
      excerpt: 'From putting on the chef cap to the applause tunnel, here is how a 90 to 120 minute Little Chef adventure unfolds inside the Pista House factory.',
      body: 'Every Little Chef visit is a guided journey through the real Pista House factory in Shamshabad, Hyderabad. Here is what your child or class can look forward to.\n\n## 1. Becoming a Little Chef\nChildren start by putting on their Little Chef gear and learning the first rule of any kitchen: clean hands and safe habits. It is the moment they stop being visitors and start being chefs.\n\n## 2. Where baking begins\nIn the bakery zone, children see how ingredients are measured, mixed and baked, and discover why dough rises and why an oven needs exactly the right temperature.\n\n## 3. From dough to biscuit\nThey follow biscuits from the mixer all the way to the pack, and see how every batch is kept the same.\n\n## 4. Quality, packaging and dispatch\nChildren find out who checks the food, why packaging matters and how a box reaches the right shop.\n\n## 5. The signature moments\n- **Passport stamps** at every stop of the journey\n- **The Little Chef oath**, a promise to stay safe, keep clean and bake with happiness\n- **The applause tunnel** and graduation celebration\n\nEvery child goes home with a Little Chef certificate, a Factory Passport, a Pista House cookie box and a group photo memory.\n\nReady to plan a visit? Use the booking form on our home page and our team will call you to confirm the date.'
    },
    {
      slug: 'five-hygiene-habits-every-little-chef-learns',
      date: '2026-10-03',
      category: 'Food safety',
      author: 'Team Little Chef',
      cover: 'assets/safety.webp',
      title: '5 kitchen hygiene habits every Little Chef learns',
      excerpt: 'Little Chefs use safe bakery hands! These five simple habits keep food safe in a big factory and in your kitchen at home.',
      body: 'Safety and hygiene are at the heart of every Little Chef visit. These are the five habits children practise with us, and they work just as well at home.\n\n## 1. Wash hands the chef way\nSoap, warm water and at least 20 seconds, scrubbing between the fingers and under the nails. We wash before we touch any food, and again after touching our face or hair.\n\n## 2. Tie hair back and wear a cap\nProfessional kitchens keep hair covered so nothing ends up in the food. Little Chefs wear a white chef cap for the whole visit.\n\n## 3. Hands away from the face\nTouching your nose or mouth and then the dough spreads germs. If it happens, it is back to the sink.\n\n## 4. Start with a clean table\nChefs wipe down surfaces before and after they work. A clean table means safe food.\n\n## 5. Gloves for ready-to-eat food\nFood that will not be cooked again is handled with gloves or clean tools.\n\nWant to test your child? Try the **Safe or oops?** game on our website and see if they can earn the Hygiene Hero badge.'
    },
    {
      slug: 'school-trip-checklist-for-teachers',
      date: '2026-10-01',
      category: 'For schools',
      author: 'Team Little Chef',
      cover: 'assets/welcome.webp',
      title: 'Planning a school trip to Little Chef: a teacher’s checklist',
      excerpt: 'Group sizes, timings, allergies and confirmations. Everything a coordinator needs to plan a smooth Little Chef school visit.',
      body: 'Bringing a class to Little Chef is easy to organise. Here is a simple checklist for coordinators.\n\n## Before you book\n- Plan for **25 to 40 students** per visit\n- Bring **1 teacher for every 20 students**\n- Allow **90 to 120 minutes** for the experience\n- Choose a preferred date and a second-choice date\n\n## Booking\nFill in the booking form on our website with your school name, number of students and teachers, classes and preferred date. Our team will call you to confirm.\n\n## After confirmation\nYou will receive a confirmation by email and WhatsApp with a personal link. Open it and tap **Yes, we confirm our visit** so our team knows you are coming. You can also add the visit to your calendar from the same page.\n\n## On the day\n- Share any **food allergies** with our team in advance\n- Plan your bus to arrive a little before the batch time\n- Teachers stay with their students throughout the visit\n\nEvery student receives a Little Chef certificate, a Factory Passport and a Pista House cookie box, and enjoys a complimentary meal from Pista House.\n\nQuestions? Call or WhatsApp us on +91 91333 08091.'
    }
  ];

  var MON = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function inline(t) { return esc(t).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>'); }
  function md(src) {
    var out = [], list = null;
    String(src || '').replace(/\r/g, '').split('\n').forEach(function (line) {
      var l = line.trim();
      if (/^- /.test(l)) { if (!list) { list = []; } list.push('<li>' + inline(l.slice(2)) + '</li>'); return; }
      if (list) { out.push('<ul>' + list.join('') + '</ul>'); list = null; }
      if (!l) return;
      if (/^### /.test(l)) out.push('<h3>' + inline(l.slice(4)) + '</h3>');
      else if (/^## /.test(l)) out.push('<h2>' + inline(l.slice(3)) + '</h2>');
      else out.push('<p>' + inline(l) + '</p>');
    });
    if (list) out.push('<ul>' + list.join('') + '</ul>');
    return out.join('');
  }
  function fmtDate(s) {
    var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s || '');
    return m ? (+m[3]) + ' ' + MON[+m[2] - 1] + ' ' + m[1] : (s || '');
  }
  function readMins(body) { return Math.max(1, Math.round(String(body || '').split(/\s+/).length / 200)); }
  function safeUrl(u) { u = String(u || ''); return /^(https:\/\/|assets\/)/.test(u) ? u : 'assets/welcome.webp'; }

  function getPosts() {
    var cfg = window.LC_CONFIG || {};
    var local = STARTER.slice();
    if (!cfg.API_URL) return Promise.resolve(sort(local));
    return fetch(cfg.API_URL + '?action=posts').then(function (r) { return r.json(); }).then(function (j) {
      var remote = (j && j.ok && j.posts) || [];
      var slugs = {};
      remote.forEach(function (p) { slugs[p.slug] = 1; });
      return sort(remote.concat(local.filter(function (p) { return !slugs[p.slug]; })));
    }).catch(function () { return sort(local); });
  }
  function sort(a) { return a.sort(function (x, y) { return x.date < y.date ? 1 : x.date > y.date ? -1 : 0; }); }

  window.LC_BLOG = { getPosts: getPosts, md: md, esc: esc, fmtDate: fmtDate, readMins: readMins, safeUrl: safeUrl, starter: STARTER };
})();
