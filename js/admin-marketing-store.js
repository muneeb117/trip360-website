/* Trip360 admin: Marketing portal data store.

   The portal talks to its data through a small interface:
     db.collection(name).onSnapshot(onData, onError)  -> unsubscribe()
     db.collection(name).add(data)                     -> Promise
     db.collection(name).doc()                         -> ref with set(data)
     db.doc('name/id').set(data) / .delete()           -> Promise
     db.doc('name/id').onSnapshot(onData, onError)     -> unsubscribe()
   A collection snapshot is { docs: [{ id, data() }] }.
   A document snapshot is { exists, data() }.

   This file keeps the data in this browser (localStorage), so the portal
   works as soon as it is deployed. Each admin's browser keeps its own copy.

   For a shared store, write the same interface on top of the site's
   database (Supabase), behind the admin login, and set
   window.T360MarketingStore to it before admin-marketing.js runs.
   Set mode to 'shared' on that object so the portal stops showing the
   "this browser only" notice. Never put keys or passwords in this file. */
(function () {
  'use strict';
  if (window.T360MarketingStore) return; // a shared store was installed first

  var PREFIX = 't360-marketing:';
  var listeners = {}; // key -> array of callbacks

  function storage() {
    try { var t = '__t360_test__'; localStorage.setItem(t, t); localStorage.removeItem(t); return localStorage; }
    catch (e) { return null; }
  }
  var ls = storage();
  var memory = {}; // used when the browser blocks storage

  function readCol(name) {
    var raw = null;
    try { raw = ls ? ls.getItem(PREFIX + name) : memory[name] || null; } catch (e) { raw = null; }
    if (!raw) return {};
    try { var v = JSON.parse(raw); return v && typeof v === 'object' ? v : {}; } catch (e) { return {}; }
  }
  function writeCol(name, obj) {
    var raw = JSON.stringify(obj);
    if (ls) {
      try { ls.setItem(PREFIX + name, raw); }
      catch (e) { var err = new Error('Storage is full'); err.code = 'quota_exceeded'; throw err; }
    } else memory[name] = raw;
    emit(name);
  }
  function newId() {
    var a = new Uint8Array(10);
    (window.crypto || window.msCrypto).getRandomValues(a);
    return Array.prototype.map.call(a, function (b) { return ('0' + b.toString(16)).slice(-2); }).join('');
  }
  function clone(v) { return JSON.parse(JSON.stringify(v)); }

  function colSnap(name) {
    var all = readCol(name);
    return { docs: Object.keys(all).map(function (id) { var d = all[id]; return { id: id, data: function () { return clone(d); } }; }) };
  }
  function docSnap(name, id) {
    var all = readCol(name); var has = Object.prototype.hasOwnProperty.call(all, id);
    return { exists: has, id: id, data: function () { return has ? clone(all[id]) : undefined; } };
  }

  function on(name, fn) {
    (listeners[name] = listeners[name] || []).push(fn);
    return function () { listeners[name] = (listeners[name] || []).filter(function (f) { return f !== fn; }); };
  }
  function emit(name) {
    (listeners[name] || []).slice().forEach(function (fn) { setTimeout(fn, 0); });
  }

  // Keep other open tabs of the portal in step.
  window.addEventListener('storage', function (e) {
    if (e.key && e.key.indexOf(PREFIX) === 0) emit(e.key.slice(PREFIX.length));
  });

  function docRef(name, id) {
    return {
      id: id,
      set: function (data) {
        return Promise.resolve().then(function () { var all = readCol(name); all[id] = clone(data || {}); writeCol(name, all); });
      },
      update: function (data) {
        return Promise.resolve().then(function () { var all = readCol(name); all[id] = Object.assign({}, all[id] || {}, clone(data || {})); writeCol(name, all); });
      },
      delete: function () {
        return Promise.resolve().then(function () { var all = readCol(name); delete all[id]; writeCol(name, all); });
      },
      get: function () { return Promise.resolve(docSnap(name, id)); },
      onSnapshot: function (onData) {
        var fire = function () { onData(docSnap(name, id)); };
        setTimeout(fire, 0);
        return on(name, fire);
      },
    };
  }

  function split(path) {
    var i = String(path).indexOf('/');
    return [path.slice(0, i), path.slice(i + 1)];
  }

  window.T360MarketingStore = {
    mode: ls ? 'local' : 'memory',
    collection: function (name) {
      return {
        add: function (data) { var id = newId(); return docRef(name, id).set(data).then(function () { return { id: id }; }); },
        doc: function (id) { return docRef(name, id || newId()); },
        onSnapshot: function (onData) {
          var fire = function () { onData(colSnap(name)); };
          setTimeout(fire, 0);
          return on(name, fire);
        },
      };
    },
    doc: function (path) { var p = split(path); return docRef(p[0], p[1]); },
  };
})();
