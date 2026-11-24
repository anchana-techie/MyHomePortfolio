/* Portfolio Content Editor
   ------------------------
   A local, no-server editor for the JSON files behind the site.
   It uses the browser's File System Access API (Chrome / Edge) to read
   and write files inside the portfolio folder you pick, so nothing is
   uploaded anywhere: you save here, then commit and push as usual.

   The form is generated from the JSON itself:
     text            -> text box (long text -> text area)
     list of text    -> one item per line
     list of images  -> thumbnails with Upload / remove / reorder
     list of objects -> cards you can add, duplicate, move and delete
     named groups    -> cards with an editable name (Beyond Work)
   Fields that hold an image path get a preview and an Upload button. */

(function () {
  'use strict';

  /* ── Sections ─────────────────────────────────────────────── */
  var FILES = [
    { file: 'JSON_Files/home.json', name: 'Home', desc: 'Hero text, photo, contact links and the certification.', imgDir: 'Images' },
    { file: 'JSON_Files/whats-new.json', name: "What's New", desc: 'Dated updates. The newest one also shows as the "New" link on the homepage.', imgDir: 'Images/whats-new', newest: 'items' },
    { file: 'JSON_Files/achievements.json', name: 'Achievements', desc: 'Hackathons and awards. Add a new card for every new achievement — the newest date shows first.', imgDir: 'Achievements', newest: 'achievements',
      news: { list: 'achievements', type: 'achievement', link: '#achievements',
        title: function (it) { return (it.placement ? it.placement + ' at the ' : '') + (it.title || 'New achievement'); },
        text: function (it) { return it.summary || ''; },
        image: function (it) { return it.cover && it.cover.src || ''; } } },
    { file: 'JSON_Files/personal-projects.json', name: 'Personal Projects', desc: 'Your own projects, with links to play or see the code.', imgDir: 'Images/projects',
      news: { list: 'projects', type: 'project', link: '#personal-projects',
        title: function (it) { return 'New personal project: ' + (it.title || ''); },
        text: function (it) { return it.summary || ''; },
        image: function () { return ''; } } },
    { file: 'JSON_Files/experience.json', name: 'Experience timeline', desc: 'Roles over time. Use {auto} as a duration to count it automatically from the period.' },
    { file: 'JSON_Files/projects.json', name: 'Work projects', desc: 'Projects from your job. {tenure} in the period shows live years and months.' },
    { file: 'JSON_Files/skills.json', name: 'Skills', desc: 'Skill cards. Each card is also a planet in the Skills solar system; its pills are the moons.' },
    { file: 'JSON_Files/skills-orbit.json', name: 'Skills solar system', desc: 'Which planets go on which orbit, how fast, and the one-line note for each skill.' },
    { file: 'JSON_Files/education.json', name: 'Education', desc: 'Degree, CGPA and the course-certificate carousel.', imgDir: 'Carousel1' },
    { file: 'JSON_Files/beyondwork-images.json', name: 'Beyond Work', desc: 'Hobby categories and their photos.', imgDir: 'BeyondWork', mapRoot: true },
    { file: 'JSON_Files/csr-images.json', name: 'CSR', desc: 'Community service photos and captions.', imgDir: 'CSR' },
    { file: 'portfolio_content.json', name: 'Chatbot knowledge', desc: 'What the chat assistant knows. After pushing, the Render backend rebuilds its search index when it restarts.' }
  ];

  var IMG_KEYS = ['image', 'photo', 'src', 'img', 'picture'];
  var LONG_KEYS = ['description', 'summary', 'text', 'problem', 'intro', 'subtitle', 'uniqueIntro', 'uniqueOutro', 'icon', 'note'];
  var SELECTS = {
    medal: ['gold', 'silver', 'bronze', 'star'],
    type: ['achievement', 'project', 'site', 'skill', 'certification', 'role', 'other']
  };
  var HINTS = {
    medal: 'gold = winner, silver = 1st runner-up, bronze = 2nd runner-up, star = other award',
    date: 'Used for sorting — newest first',
    link: 'A page on your site like #achievements, or a full https:// address',
    duration: 'Write {auto} to count it from the period automatically',
    glyph: 'A single symbol shown on the card and the planet',
    seconds: 'Seconds for one full lap — bigger is slower',
    planets: 'Card numbers, 1 = first skill card',
    me: 'Your name exactly as in the list, to highlight it',
    current: 'Tick for your current role'
  };
  var LABELS = { src: 'Image', alt: 'Image description', url: 'Link address', tech: 'Tech tags', pills: 'Skills', points: 'Bullet points',
    uniqueIntro: 'Intro line', uniqueOutro: 'Closing line', uniqueTitle: 'Section title', problemTitle: 'Section title', dateLabel: 'Date shown',
    eyebrow: 'Section label', linkedinUrl: 'LinkedIn address', linkedinLabel: 'LinkedIn text', firstName: 'First name', lastName: 'Last name' };

  /* ── State ────────────────────────────────────────────────── */
  var root = null;          // folder handle
  var cur = null;           // { cfg, data, original }
  var templates = {};       // "a.*.b" -> blank object for new list items
  var openCards = new Set();
  var urlCache = {};
  var raw = false;

  var $ = function (id) { return document.getElementById(id); };
  function h(tag, attrs, kids) {
    var n = document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(function (k) {
      if (k === 'class') n.className = attrs[k];
      else if (k === 'text') n.textContent = attrs[k];
      else if (k.slice(0, 2) === 'on') n.addEventListener(k.slice(2), attrs[k]);
      else if (attrs[k] !== false && attrs[k] != null) n.setAttribute(k, attrs[k] === true ? '' : attrs[k]);
    });
    (kids || []).forEach(function (c) { if (c) n.appendChild(typeof c === 'string' ? document.createTextNode(c) : c); });
    return n;
  }
  function toast(msg, bad) {
    var t = $('toast');
    t.textContent = msg; t.className = 'toast' + (bad ? ' bad' : ''); t.hidden = false;
    clearTimeout(toast.timer); toast.timer = setTimeout(function () { t.hidden = true; }, 4200);
  }
  function humanize(k) {
    if (LABELS[k]) return LABELS[k];
    var s = String(k).replace(/_/g, ' ').replace(/([a-z])([A-Z])/g, '$1 $2');
    return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
  }
  function isImagePath(v) { return typeof v === 'string' && /\.(png|jpe?g|webp|gif|svg|avif)$/i.test(v.trim()); }
  function isImageKey(k) { return IMG_KEYS.indexOf(String(k).toLowerCase()) !== -1; }
  function today() { var d = new Date(); return d.toISOString().slice(0, 10); }
  function slug(s) { return String(s || '').toLowerCase().replace(/&[a-z]+;/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60) || 'item'; }
  function pattern(path) { return path.map(function (p) { return typeof p === 'number' ? '*' : p; }).join('.'); }
  function getAt(path) { return path.reduce(function (o, k) { return o == null ? o : o[k]; }, cur.data); }
  function setAt(path, v) {
    if (!path.length) { cur.data = v; return; }
    var parent = getAt(path.slice(0, -1));
    parent[path[path.length - 1]] = v;
    markDirty();
  }
  function blank(v) {
    if (Array.isArray(v)) return [];
    if (v && typeof v === 'object') { var o = {}; Object.keys(v).forEach(function (k) { o[k] = blank(v[k]); }); return o; }
    if (typeof v === 'number') return 0;
    if (typeof v === 'boolean') return false;
    return '';
  }
  function collectTemplates(v, path) {
    if (Array.isArray(v)) {
      var firstObj = v.find(function (x) { return x && typeof x === 'object' && !Array.isArray(x); });
      if (firstObj && !templates[pattern(path)]) templates[pattern(path)] = blank(firstObj);
      v.forEach(function (x, i) { collectTemplates(x, path.concat(i)); });
    } else if (v && typeof v === 'object') {
      Object.keys(v).forEach(function (k) { collectTemplates(v[k], path.concat(k)); });
    }
  }
  function cardTitle(o, i) {
    var keys = ['title', 'name', 'label', 'role', 'placement', 'caption', 'tag', 'alt', 'value'];
    for (var j = 0; j < keys.length; j++) if (o && typeof o[keys[j]] === 'string' && o[keys[j]].trim()) {
      return o[keys[j]].replace(/<[^>]+>/g, '').replace(/&[a-z]+;/g, ' ').trim();
    }
    return 'Item ' + (i + 1);
  }

  /* ── Files on disk ────────────────────────────────────────── */
  async function dirAt(parts, create) {
    var d = root;
    for (var i = 0; i < parts.length; i++) if (parts[i]) d = await d.getDirectoryHandle(parts[i], { create: !!create });
    return d;
  }
  async function fileHandle(rel, create) {
    var parts = rel.split('/');
    var name = parts.pop();
    return (await dirAt(parts, create)).getFileHandle(name, { create: !!create });
  }
  async function readText(rel) { return (await (await fileHandle(rel)).getFile()).text(); }
  async function writeFile(rel, data) {
    var w = await (await fileHandle(rel, true)).createWritable();
    await w.write(data); await w.close();
  }
  async function imageURL(rel) {
    if (!rel || /^https?:/i.test(rel)) return rel;
    if (urlCache[rel]) return urlCache[rel];
    try { urlCache[rel] = URL.createObjectURL(await (await fileHandle(decodeURI(rel))).getFile()); }
    catch (e) { urlCache[rel] = ''; }
    return urlCache[rel];
  }

  /* Shrinks big photos so the site stays fast (max 1600px, JPEG). */
  async function prepareImage(file) {
    var big = file.size > 500 * 1024 && /image\/(jpeg|png|webp)/.test(file.type);
    var base = slug(file.name.replace(/\.[^.]+$/, ''));
    if (!big) return { blob: file, name: base + (file.name.match(/\.[^.]+$/) || ['.jpg'])[0].toLowerCase() };
    var bmp = await createImageBitmap(file);
    var scale = Math.min(1, 1600 / Math.max(bmp.width, bmp.height));
    var c = document.createElement('canvas');
    c.width = Math.round(bmp.width * scale); c.height = Math.round(bmp.height * scale);
    c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
    var blob = await new Promise(function (r) { c.toBlob(r, 'image/jpeg', 0.85); });
    return { blob: blob, name: base + '.jpg' };
  }
  function folderFor(path, currentValue) {
    if (currentValue && currentValue.indexOf('/') !== -1) return currentValue.slice(0, currentValue.lastIndexOf('/'));
    var cfg = cur.cfg;
    if (cfg.mapRoot && path.length) return (cfg.imgDir || 'Images') + '/' + path[0];
    // An achievement's photos go in Achievements/<its id>/
    for (var i = path.length; i > 0; i--) {
      var o = getAt(path.slice(0, i));
      if (o && !Array.isArray(o) && typeof o === 'object' && (o.id || o.title) && typeof path[i - 1] === 'number') {
        return (cfg.imgDir || 'Images') + '/' + slug(o.id || o.title);
      }
    }
    var arr = getAt(path.slice(0, -1));
    if (Array.isArray(arr)) {
      var sib = arr.find(function (x) { return typeof x === 'string' && x.indexOf('/') !== -1; });
      if (sib) return sib.slice(0, sib.lastIndexOf('/'));
    }
    return cfg.imgDir || 'Images';
  }
  async function uploadInto(path, currentValue) {
    var input = h('input', { type: 'file', accept: 'image/*' });
    return new Promise(function (resolve) {
      input.addEventListener('change', async function () {
        var f = input.files[0];
        if (!f) return resolve(null);
        try {
          var folder = folderFor(path, currentValue);
          var prepared = await prepareImage(f);
          var rel = folder + '/' + prepared.name;
          await writeFile(rel, prepared.blob);
          delete urlCache[rel];
          toast('Saved image to ' + rel);
          resolve(rel);
        } catch (e) { toast('Could not save the image: ' + e.message, true); resolve(null); }
      });
      input.click();
    });
  }

  /* ── Form building ────────────────────────────────────────── */
  function render() {
    var ed = $('editor');
    var y = ed.scrollTop;
    ed.innerHTML = '';
    if (!cur) return;
    if (raw) { ed.appendChild(rawEditor()); return; }
    var form = h('div', { class: 'form' });
    if (cur.cfg.mapRoot) form.appendChild(mapList(cur.data, []));
    else if (Array.isArray(cur.data)) form.appendChild(listField('Items', cur.data, []));
    else Object.keys(cur.data).forEach(function (k) {
      if (k.charAt(0) === '_') { form.appendChild(h('p', { class: 'note', text: cur.data[k] })); return; }
      form.appendChild(field(k, cur.data[k], [k]));
    });
    ed.appendChild(form);
    ed.scrollTop = y;
  }

  function field(key, value, path) {
    if (Array.isArray(value)) return listField(humanize(key), value, path, key);
    if (value && typeof value === 'object' && key === 'notes' && Object.keys(value).every(function (k) { return typeof value[k] === 'string'; })) {
      return notesField(value, path);
    }
    if (value && typeof value === 'object') {
      var box = h('fieldset', { class: 'group' }, [h('legend', { text: humanize(key) })]);
      Object.keys(value).forEach(function (k) { box.appendChild(field(k, value[k], path.concat(k))); });
      return box;
    }
    return scalar(key, value, path);
  }

  function scalar(key, value, path) {
    var label = h('label', { class: 'f' }, [h('span', { class: 'f-label', text: humanize(key) })]);
    var input;
    var hint = HINTS[key];
    if (typeof value === 'boolean') {
      input = h('input', { type: 'checkbox', onchange: function () { setAt(path, input.checked); } });
      input.checked = value;
      label.classList.add('f-check');
    } else if (typeof value === 'number') {
      input = h('input', { type: 'number', step: 'any', value: value, oninput: function () { setAt(path, input.value === '' ? 0 : Number(input.value)); } });
    } else if (SELECTS[key] && (value === '' || SELECTS[key].indexOf(value) !== -1)) {
      input = h('select', { onchange: function () { setAt(path, input.value); } },
        [h('option', { value: '', text: '—' })].concat(SELECTS[key].map(function (o) { return h('option', { value: o, text: o }); })));
      input.value = value;
    } else if (key === 'date' && (value === '' || /^\d{4}-\d{2}(-\d{2})?$/.test(value))) {
      var monthOnly = /^\d{4}-\d{2}$/.test(value) || (value === '' && cur.cfg.file.indexOf('achievements') !== -1);
      input = h('input', { type: monthOnly ? 'month' : 'date', value: value, oninput: function () { setAt(path, input.value); } });
    } else if (LONG_KEYS.indexOf(key) !== -1 || String(value).length > 90) {
      input = h('textarea', { rows: key === 'icon' ? 3 : Math.min(8, Math.max(2, Math.ceil(String(value).length / 90))), oninput: function () { setAt(path, input.value); } });
      input.value = value;
    } else {
      input = h('input', { type: 'text', value: value == null ? '' : value, oninput: function () { setAt(path, input.value); } });
    }
    label.appendChild(input);
    if (typeof value === 'string' && (isImageKey(key) || isImagePath(value))) label.appendChild(imageTools(path, input));
    if (hint) label.appendChild(h('span', { class: 'f-hint', text: hint }));
    return label;
  }

  function imageTools(path, input) {
    var img = h('img', { class: 'thumb', alt: '' });
    var refresh = async function () { var u = await imageURL(input.value); img.src = u || ''; img.hidden = !u; };
    refresh();
    input.addEventListener('change', refresh);
    var btn = h('button', { type: 'button', class: 'btn btn-small', text: 'Upload…', onclick: async function () {
      var rel = await uploadInto(path, input.value);
      if (rel) { input.value = rel; setAt(path, rel); refresh(); }
    } });
    return h('span', { class: 'img-tools' }, [img, btn]);
  }

  function listField(label, arr, path, key) {
    var allPrimitive = arr.every(function (x) { return x === null || typeof x !== 'object'; });
    var tpl = templates[pattern(path)];
    var wrap = h('div', { class: 'list' }, [h('div', { class: 'list-head' }, [h('span', { class: 'f-label', text: label }), h('span', { class: 'count', text: arr.length + '' })])]);

    // Images: thumbnails
    if (!tpl && (arr.some(isImagePath) || /^(images|photos|gallery)$/i.test(key || ''))) {
      var grid = h('div', { class: 'img-grid' });
      arr.forEach(function (src, i) {
        var img = h('img', { alt: '' });
        imageURL(src).then(function (u) { if (u) img.src = u; else img.classList.add('missing'); });
        grid.appendChild(h('div', { class: 'img-cell' }, [img, h('span', { class: 'img-name', text: String(src).split('/').pop() }),
          h('div', { class: 'img-actions' }, [
            h('button', { type: 'button', class: 'icon', title: 'Move left', text: '←', disabled: i === 0, onclick: function () { move(arr, i, -1); } }),
            h('button', { type: 'button', class: 'icon', title: 'Move right', text: '→', disabled: i === arr.length - 1, onclick: function () { move(arr, i, 1); } }),
            h('button', { type: 'button', class: 'icon danger', title: 'Remove from list', text: '✕', onclick: function () { arr.splice(i, 1); markDirty(); render(); } })
          ])]));
      });
      grid.appendChild(h('button', { type: 'button', class: 'img-add', onclick: async function () {
        var rel = await uploadInto(path.concat(arr.length), arr[arr.length - 1]);
        if (rel) { arr.push(rel); markDirty(); render(); }
      } }, [h('span', { text: '+' }), h('small', { text: 'Upload image' })]));
      wrap.appendChild(grid);
      return wrap;
    }

    // Text items: one per line
    if (allPrimitive && !tpl) {
      var ta = h('textarea', { rows: Math.max(3, arr.length + 1), placeholder: 'One per line', oninput: function () {
        var lines = ta.value.split('\n').map(function (s) { return s.trim(); }).filter(Boolean);
        var numeric = arr.length && arr.every(function (x) { return typeof x === 'number'; });
        setAt(path, numeric ? lines.map(Number) : lines);
      } });
      ta.value = arr.join('\n');
      wrap.appendChild(ta);
      wrap.appendChild(h('span', { class: 'f-hint', text: 'One item per line' }));
      return wrap;
    }

    // Objects: cards
    arr.forEach(function (item, i) {
      var p = path.concat(i);
      var id = p.join('.');
      var card = h('details', { class: 'card' });
      if (openCards.has(id)) card.open = true;
      card.addEventListener('toggle', function () { if (card.open) openCards.add(id); else openCards.delete(id); });
      var summary = h('summary', null, [
        h('span', { class: 'card-title', text: cardTitle(item, i) }),
        h('span', { class: 'card-actions' }, [
          h('button', { type: 'button', class: 'icon', title: 'Move up', text: '↑', disabled: i === 0, onclick: function (e) { e.preventDefault(); move(arr, i, -1); } }),
          h('button', { type: 'button', class: 'icon', title: 'Move down', text: '↓', disabled: i === arr.length - 1, onclick: function (e) { e.preventDefault(); move(arr, i, 1); } }),
          h('button', { type: 'button', class: 'icon', title: 'Duplicate', text: '⧉', onclick: function (e) { e.preventDefault(); arr.splice(i + 1, 0, JSON.parse(JSON.stringify(item))); markDirty(); render(); } }),
          h('button', { type: 'button', class: 'icon danger', title: 'Delete', text: '✕', onclick: function (e) {
            e.preventDefault();
            if (confirm('Delete "' + cardTitle(item, i) + '"?')) { arr.splice(i, 1); markDirty(); render(); }
          } })
        ])
      ]);
      card.appendChild(summary);
      var body = h('div', { class: 'card-body' });
      if (item && typeof item === 'object') Object.keys(item).forEach(function (k) { body.appendChild(field(k, item[k], p.concat(k))); });
      else body.appendChild(scalar('value', item, p));
      card.appendChild(body);
      wrap.appendChild(card);
    });
    wrap.appendChild(h('button', { type: 'button', class: 'btn btn-add', text: '+ Add ' + singular(label), onclick: function () {
      addItem(path, arr, false);
    } }));
    return wrap;
  }

  /* Skill -> note pairs (Skills solar system) */
  function notesField(obj, path) {
    var box = h('fieldset', { class: 'group' }, [h('legend', { text: 'Skill notes' }),
      h('p', { class: 'f-hint', text: 'The skill name must match the skill pill exactly (e.g. Power BI).' })]);
    Object.keys(obj).forEach(function (name) {
      var nameIn = h('input', { type: 'text', value: name, class: 'note-key' });
      var textIn = h('input', { type: 'text', value: obj[name], oninput: function () { obj[name] = textIn.value; markDirty(); } });
      nameIn.addEventListener('change', function () {
        var nn = nameIn.value.trim();
        if (!nn || nn === name || obj[nn] != null) { nameIn.value = name; return; }
        var rebuilt = {};
        Object.keys(obj).forEach(function (k) { rebuilt[k === name ? nn : k] = obj[k]; });
        Object.keys(obj).forEach(function (k) { delete obj[k]; });
        Object.assign(obj, rebuilt); markDirty(); render();
      });
      box.appendChild(h('div', { class: 'note-row' }, [nameIn, textIn,
        h('button', { type: 'button', class: 'icon danger', title: 'Remove', text: '✕', onclick: function () { delete obj[name]; markDirty(); render(); } })]));
    });
    box.appendChild(h('button', { type: 'button', class: 'btn btn-add', text: '+ Add note', onclick: function () {
      var nn = prompt('Skill name (exactly as on the skill card):');
      if (!nn || obj[nn] != null) return;
      obj[nn] = ''; markDirty(); render();
    } }));
    return box;
  }

  function singular(label) {
    var l = label.toLowerCase();
    if (/ies$/.test(l)) return l.replace(/ies$/, 'y');
    if (/(ches|shes|xes)$/.test(l)) return l.replace(/es$/, '');
    return l.replace(/s$/, '');
  }
  function addItem(path, arr, atTop) {
    var tpl = templates[pattern(path)];
    var item = tpl ? JSON.parse(JSON.stringify(tpl)) : (arr.length ? blank(arr[0]) : {});
    if ('date' in item) item.date = /achievements/.test(cur.cfg.file) ? today().slice(0, 7) : today();
    if (atTop) arr.unshift(item); else arr.push(item);
    var idx = atTop ? 0 : arr.length - 1;
    openCards.add(path.concat(idx).join('.'));
    markDirty();
    render();
    var cards = $('editor').querySelectorAll('details.card[open]');
    var target = Array.prototype.find.call(cards, function (c) { return c.querySelector('.card-title').textContent === cardTitle(item, idx); });
    if (target) { target.scrollIntoView({ behavior: 'smooth', block: 'start' }); var f = target.querySelector('input, textarea, select'); if (f) setTimeout(function () { f.focus(); }, 300); }
  }
  function move(arr, i, d) {
    var j = i + d;
    if (j < 0 || j >= arr.length) return;
    var t = arr[i]; arr[i] = arr[j]; arr[j] = t;
    markDirty(); render();
  }

  /* Named groups, e.g. Beyond Work categories */
  function mapList(obj, path) {
    var wrap = h('div', { class: 'list' }, [h('div', { class: 'list-head' }, [h('span', { class: 'f-label', text: 'Categories' }), h('span', { class: 'count', text: Object.keys(obj).length + '' })])]);
    Object.keys(obj).forEach(function (name) {
      var id = 'map.' + name;
      var card = h('details', { class: 'card' });
      if (openCards.has(id)) card.open = true;
      card.addEventListener('toggle', function () { if (card.open) openCards.add(id); else openCards.delete(id); });
      card.appendChild(h('summary', null, [h('span', { class: 'card-title', text: name }), h('span', { class: 'card-actions' }, [
        h('button', { type: 'button', class: 'icon danger', title: 'Delete category', text: '✕', onclick: function (e) {
          e.preventDefault();
          if (confirm('Delete the "' + name + '" category? (Its image files stay in your folder.)')) { delete obj[name]; markDirty(); render(); }
        } })
      ])]));
      var body = h('div', { class: 'card-body' });
      var nameInput = h('input', { type: 'text', value: name });
      nameInput.addEventListener('change', function () {
        var nn = nameInput.value.trim();
        if (!nn || nn === name || obj[nn]) { nameInput.value = name; return; }
        var rebuilt = {};
        Object.keys(obj).forEach(function (k) { rebuilt[k === name ? nn : k] = obj[k]; });
        Object.keys(obj).forEach(function (k) { delete obj[k]; });
        Object.assign(obj, rebuilt);
        openCards.add('map.' + nn);
        markDirty(); render();
      });
      body.appendChild(h('label', { class: 'f' }, [h('span', { class: 'f-label', text: 'Category name' }), nameInput,
        h('span', { class: 'f-hint', text: 'New photos for this category go into BeyondWork/' + name + '/' })]));
      Object.keys(obj[name]).forEach(function (k) { body.appendChild(field(k, obj[name][k], path.concat(name, k))); });
      card.appendChild(body);
      wrap.appendChild(card);
    });
    wrap.appendChild(h('button', { type: 'button', class: 'btn btn-add', text: '+ Add category', onclick: function () {
      var nn = prompt('Name of the new category (e.g. Cycling):');
      if (!nn || obj[nn]) return;
      var first = obj[Object.keys(obj)[0]];
      obj[nn] = first ? blank(first) : { description: '', images: [] };
      openCards.add('map.' + nn);
      markDirty(); render();
    } }));
    return wrap;
  }

  function rawEditor() {
    var ta = h('textarea', { class: 'raw', spellcheck: 'false' });
    ta.value = JSON.stringify(cur.data, null, 2);
    var msg = h('p', { class: 'raw-msg' });
    ta.addEventListener('input', function () {
      try { cur.data = JSON.parse(ta.value); msg.textContent = 'Valid JSON'; msg.className = 'raw-msg ok'; markDirty(); }
      catch (e) { msg.textContent = 'Not valid yet: ' + e.message; msg.className = 'raw-msg bad'; }
    });
    return h('div', { class: 'raw-wrap' }, [ta, msg]);
  }

  /* ── Open / save ──────────────────────────────────────────── */
  function markDirty() {
    var dirty = cur && JSON.stringify(cur.data) !== cur.original;
    $('saveBtn').disabled = !dirty;
    $('revertBtn').disabled = !dirty;
    document.querySelectorAll('.file-btn').forEach(function (b) { b.classList.toggle('dirty', !!(dirty && b.dataset.file === cur.cfg.file)); });
  }
  function isDirty() { return cur && JSON.stringify(cur.data) !== cur.original; }

  async function openFile(cfg) {
    if (isDirty() && !confirm('You have unsaved changes in ' + cur.cfg.name + '. Leave without saving?')) return false;
    try {
      var data = JSON.parse(await readText(cfg.file));
      cur = { cfg: cfg, data: data, original: JSON.stringify(data) };
      templates = {}; collectTemplates(data, []);
      openCards = new Set();
      $('fileTitle').textContent = cfg.name;
      $('fileDesc').textContent = cfg.desc || cfg.file;
      document.querySelectorAll('.file-btn').forEach(function (b) { b.classList.toggle('active', b.dataset.file === cfg.file); });
      markDirty(); render();
      return true;
    } catch (e) {
      toast('Could not open ' + cfg.file + ': ' + e.message, true);
      return false;
    }
  }

  async function save() {
    if (!cur) return;
    var before = JSON.parse(cur.original);
    // New achievements / projects get an id from their title.
    if (cur.cfg.news && Array.isArray(cur.data[cur.cfg.news.list])) {
      cur.data[cur.cfg.news.list].forEach(function (it) {
        if (it && 'id' in it && !it.id && it.title) it.id = slug(it.title + (it.date ? '-' + String(it.date).slice(0, 4) : ''));
      });
    }
    try {
      await writeFile(cur.cfg.file, JSON.stringify(cur.data, null, 2) + '\n');
      cur.original = JSON.stringify(cur.data);
      markDirty();
      toast('Saved ' + cur.cfg.file + ' — commit and push to publish.');
    } catch (e) { toast('Could not save: ' + e.message, true); return; }

    // Offer a What's New post for each newly added achievement / project.
    var news = cur.cfg.news;
    if (!news) return;
    var oldKeys = (before[news.list] || []).map(function (x) { return JSON.stringify([x.id || '', x.title || '']); });
    var added = (cur.data[news.list] || []).filter(function (x) { return x.title && oldKeys.indexOf(JSON.stringify([x.id || '', x.title || ''])) === -1; });
    for (var i = 0; i < added.length; i++) await offerNews(news, added[i]);
  }

  function offerNews(news, item) {
    return new Promise(function (resolve) {
      var dlg = $('newsDialog'), f = $('newsForm');
      f.title.value = news.title(item); f.text.value = news.text(item);
      f.date.value = today(); f.type.value = news.type; f.link.value = news.link; f.image.value = news.image(item);
      dlg.returnValue = '';
      dlg.onclose = async function () {
        if (dlg.returnValue === 'add') {
          try {
            var path = 'JSON_Files/whats-new.json';
            var wn = JSON.parse(await readText(path));
            wn.items = wn.items || [];
            var entry = { date: f.date.value, type: f.type.value, title: f.title.value, text: f.text.value, link: f.link.value };
            if (f.image.value) entry.image = f.image.value;
            wn.items.unshift(entry);
            await writeFile(path, JSON.stringify(wn, null, 2) + '\n');
            toast("Added to What's New.");
          } catch (e) { toast("Could not update What's New: " + e.message, true); }
        }
        resolve();
      };
      dlg.showModal();
    });
  }

  /* ── Folder access (remembered between visits) ────────────── */
  function idb(mode, fn) {
    return new Promise(function (resolve) {
      try {
        var req = indexedDB.open('portfolio-editor', 1);
        req.onupgradeneeded = function () { req.result.createObjectStore('kv'); };
        req.onsuccess = function () {
          var tx = req.result.transaction('kv', mode);
          var r = fn(tx.objectStore('kv'));
          tx.oncomplete = function () { resolve(r && r.result); };
          tx.onerror = function () { resolve(null); };
        };
        req.onerror = function () { resolve(null); };
      } catch (e) { resolve(null); }
    });
  }
  async function useFolder(handle) {
    try {
      await handle.getDirectoryHandle('JSON_Files');
    } catch (e) {
      var err = $('startError');
      err.textContent = 'That folder has no JSON_Files folder inside. Choose the portfolio folder that contains index.html.';
      err.hidden = false;
      return;
    }
    root = handle;
    idb('readwrite', function (s) { return s.put(handle, 'root'); });
    $('folderName').textContent = handle.name;
    $('start').hidden = true; $('app').hidden = false;
    buildSidebar();
  }
  function buildSidebar() {
    var list = $('fileList'); list.innerHTML = '';
    FILES.forEach(function (cfg) {
      list.appendChild(h('button', { type: 'button', class: 'file-btn', 'data-file': cfg.file, onclick: function () { openFile(cfg); } }, [
        h('span', { text: cfg.name }), h('small', { text: cfg.file.replace('JSON_Files/', '') })
      ]));
    });
  }

  $('openFolder').addEventListener('click', async function () {
    if (!window.showDirectoryPicker) {
      var err = $('startError');
      err.textContent = 'This browser cannot open folders. Please use Chrome or Microsoft Edge on a computer.';
      err.hidden = false;
      return;
    }
    try { await useFolder(await window.showDirectoryPicker({ id: 'portfolio', mode: 'readwrite' })); }
    catch (e) { if (e.name !== 'AbortError') toast(e.message, true); }
  });
  idb('readonly', function (s) { return s.get('root'); }).then(function (handle) {
    if (!handle) return;
    $('lastFolder').textContent = '“' + handle.name + '”';
    var btn = $('reopenFolder'); btn.hidden = false;
    btn.addEventListener('click', async function () {
      try {
        var ok = (await handle.requestPermission({ mode: 'readwrite' })) === 'granted';
        if (ok) useFolder(handle); else toast('Permission was not granted.', true);
      } catch (e) { toast(e.message, true); }
    });
  });

  // Lets automated tests hand the editor a folder without the picker.
  window.portfolioEditor = { useFolder: useFolder };

  $('saveBtn').addEventListener('click', save);
  $('revertBtn').addEventListener('click', function () {
    if (!cur || !confirm('Undo all unsaved changes in ' + cur.cfg.name + '?')) return;
    cur.data = JSON.parse(cur.original); templates = {}; collectTemplates(cur.data, []);
    markDirty(); render();
  });
  $('rawToggle').addEventListener('change', function (e) { raw = e.target.checked; render(); });
  document.addEventListener('keydown', function (e) {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') { e.preventDefault(); if (!$('saveBtn').disabled) save(); }
  });
  window.addEventListener('beforeunload', function (e) { if (isDirty()) { e.preventDefault(); e.returnValue = ''; } });

  document.querySelectorAll('[data-quick]').forEach(function (b) {
    b.addEventListener('click', async function () {
      var kind = b.getAttribute('data-quick');
      var file = { achievement: 'JSON_Files/achievements.json', project: 'JSON_Files/personal-projects.json', news: 'JSON_Files/whats-new.json' }[kind];
      var cfg = FILES.find(function (f) { return f.file === file; });
      if (!(cur && cur.cfg === cfg) && !(await openFile(cfg))) return;
      var key = { achievement: 'achievements', project: 'projects', news: 'items' }[kind];
      cur.data[key] = cur.data[key] || [];
      addItem([key], cur.data[key], kind !== 'project');
      toast(kind === 'news' ? 'New post added at the top — fill it in and Save.' : 'New card added — fill it in and Save. You\'ll be asked about What\'s New.');
    });
  });
})();
