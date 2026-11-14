/* Standalone storage for the GitHub version of Steak & Fries.

   On claude.ai the site gets shared storage and accounts from the platform (window.claude).
   On a plain website there is none, so this file provides the same calls and keeps everything
   in this browser's own storage (localStorage). Every feature works, but only on this device:
   another phone or laptop has its own separate questions, scores and marks.

   It is loaded only by the GitHub build (see tools/build_github.py), before app.js.
   If window.claude already exists, it does nothing. */
(function () {
  'use strict';
  if (window.claude) return;

  var PREFIX = 'sf-db:', SEED_FLAG = 'sf-seeded';
  var mem = {};          /* used if the browser refuses localStorage (private windows) */
  var listeners = [];    /* { kind: 'doc' | 'col', path, order, cb } */

  function read(path) {
    try { var raw = localStorage.getItem(PREFIX + path); return raw === null ? undefined : JSON.parse(raw); }
    catch (e) { return mem[path]; }
  }
  function write(path, value) {
    mem[path] = value;
    try { localStorage.setItem(PREFIX + path, JSON.stringify(value)); } catch (e) { /* stays in memory for this visit */ }
  }
  function remove(path) {
    delete mem[path];
    try { localStorage.removeItem(PREFIX + path); } catch (e) { /* nothing to remove */ }
  }
  function allPaths() {
    var out = {};
    Object.keys(mem).forEach(function (k) { out[k] = 1; });
    try { for (var i = 0; i < localStorage.length; i++) { var k = localStorage.key(i); if (k && k.indexOf(PREFIX) === 0) out[k.slice(PREFIX.length)] = 1; } } catch (e) { /* memory only */ }
    return Object.keys(out);
  }
  function clone(v) { return v === undefined ? undefined : JSON.parse(JSON.stringify(v)); }

  /* Each person's private progress copy exists so progress can follow them between devices.
     Here there is one device, and the site already keeps progress itself, so it is skipped. */
  function isPrivate(path) { return path.indexOf('data/users/') === 0; }

  function docSnap(path) {
    var v = isPrivate(path) ? undefined : read(path);
    return { id: path.split('/').pop(), exists: v !== undefined, data: function () { return clone(v); } };
  }
  function colSnap(name, order) {
    var depth = name.split('/').length + 1;
    var docs = allPaths().filter(function (p) { return p.indexOf(name + '/') === 0 && p.split('/').length === depth; }).map(docSnap).filter(function (d) { return d.exists; });
    if (order) docs.sort(function (a, b) { var x = (a.data() || {})[order], y = (b.data() || {})[order]; return x < y ? -1 : x > y ? 1 : 0; });
    else docs.sort(function (a, b) { return a.id < b.id ? -1 : a.id > b.id ? 1 : 0; });
    return { docs: docs, empty: !docs.length, size: docs.length };
  }
  function notify(path) {
    listeners.slice().forEach(function (l) {
      if (l.kind === 'doc' && l.path === path) l.cb(docSnap(path));
      if (l.kind === 'col' && path.indexOf(l.path + '/') === 0 && path.split('/').length === l.path.split('/').length + 1) l.cb(colSnap(l.path, l.order));
    });
  }
  function listen(entry) {
    listeners.push(entry);
    setTimeout(function () { if (listeners.indexOf(entry) !== -1) entry.cb(entry.kind === 'doc' ? docSnap(entry.path) : colSnap(entry.path, entry.order)); }, 0);
    return function () { var i = listeners.indexOf(entry); if (i !== -1) listeners.splice(i, 1); };
  }
  /* Another tab of the same site changed something: pass it on, so a student tab and a staff tab stay in step. */
  window.addEventListener('storage', function (e) { if (e.key && e.key.indexOf(PREFIX) === 0) notify(e.key.slice(PREFIX.length)); });

  function newId() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 8); }
  function docRef(path) {
    return {
      id: path.split('/').pop(), path: path,
      get: function () { return Promise.resolve(docSnap(path)); },
      set: function (value) { if (!isPrivate(path)) { write(path, clone(value)); notify(path); } return Promise.resolve(); },
      update: function (value) { if (!isPrivate(path)) { write(path, Object.assign({}, read(path) || {}, clone(value))); notify(path); } return Promise.resolve(); },
      delete: function () { remove(path); notify(path); return Promise.resolve(); },
      onSnapshot: function (cb) { return listen({ kind: 'doc', path: path, cb: cb }); }
    };
  }
  function colRef(name, order) {
    var q = {
      doc: function (id) { return docRef(name + '/' + (id || newId())); },
      orderBy: function (field) { return colRef(name, field); },
      where: function () { return q; },
      limit: function () { return q; },
      get: function () { return Promise.resolve(colSnap(name, order)); },
      onSnapshot: function (cb) { return listen({ kind: 'col', path: name, order: order, cb: cb }); }
    };
    return q;
  }
  var db = { collection: function (name) { return colRef(name, ''); }, doc: docRef };

  /* One id for this browser. The same person is the student and, with the staff password, the teacher. */
  function deviceId() {
    var id = read('__device');
    if (!id) { id = 'local-' + newId(); write('__device', id); }
    return id;
  }
  var user = {
    id: function () { return Promise.resolve(deviceId()); },
    me: function () { return Promise.resolve({ id: deviceId(), name: '' }); },
    canEdit: function () { return Promise.resolve(true); },
    isOwner: function () { return true; },
    can: function () { return true; }
  };

  /* Saving a file is an ordinary browser download here. */
  var downloads = {
    save: function (req) {
      try {
        var blob = req.data instanceof Blob ? req.data : new Blob([req.data], { type: /\.csv$/i.test(req.filename) ? 'text/csv;charset=utf-8' : 'application/octet-stream' });
        var url = URL.createObjectURL(blob), a = document.createElement('a');
        a.href = url; a.download = req.filename; document.body.appendChild(a); a.click(); a.remove();
        setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
        return Promise.resolve({ status: 'saved' });
      } catch (e) { return Promise.reject({ code: 'unavailable', message: String(e) }); }
    }
  };

  /* First visit on this device: load the questions and quiz settings that ship with the site.
     After that the Staff page owns them, so deleting a question here keeps it deleted. */
  var seed = window.SF_SEED;
  if (seed && read('__seed') !== seed.version) {
    var firstTime = read('__seed') === undefined;
    if (firstTime) {
      Object.keys(seed.questions || {}).forEach(function (id) { write('questions/' + id, seed.questions[id]); });
      Object.keys(seed.controls || {}).forEach(function (id) { write('controls/' + id, seed.controls[id]); });
    }
    write('__seed', seed.version);
  }

  window.claude = {
    standalone: true,
    use: function (name) { return Promise.resolve(name === 'db' ? db : name === 'user' ? user : name === 'downloads' ? downloads : null); }
  };
})();
