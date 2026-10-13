/* Casca do app de apontamentos fora do Claude (GitHub Pages).
   Substitui o runtime do Claude (window.claude.use) por uma camada simples:
   - "db":   lê os dados do dia de dados/<empreendimento>.json (publicado pela tarefa agendada);
             o que é de cada pessoa (apontamentos marcados, disciplinas) fica no navegador dela.
   - "user": sem login; cada navegador recebe um identificador próprio.
   Ninguém edita os apontamentos aqui: canEdit() é sempre falso. */
(function () {
  "use strict";
  var EMP = "duarte-schutel";
  var ARQ = "dados/" + EMP + ".json";
  var RECARREGAR_MIN = 15;
  var SNAP = null, carregado = null, ouvintes = [];

  function lsGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function lsSet(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
  var UID = lsGet("casca-uid");
  if (!UID) { UID = "v-" + Math.random().toString(36).slice(2) + Date.now().toString(36); lsSet("casca-uid", UID); }

  function copia(x) { return x == null ? x : JSON.parse(JSON.stringify(x)); }
  function snapDoc(id, d) { return { id: id, exists: d != null, data: function () { return d == null ? undefined : copia(d); } }; }

  async function carregar() {
    var r = await fetch(ARQ + "?v=" + Date.now(), { cache: "no-store" });
    if (!r.ok) throw new Error("HTTP " + r.status);
    SNAP = await r.json();
    ouvintes.forEach(avisar);
  }
  function docDe(path) {
    var p = path.split("/");
    if (!SNAP || p[0] !== "empreendimentos" || p[1] !== EMP) return null;
    if (p.length === 2) return SNAP.empreendimento || null;
    if (p.length === 4) { var c = SNAP[p[2]]; return c && c[p[3]] != null ? c[p[3]] : null; }
    return null;
  }
  function colDe(path) {
    var p = path.split("/");
    if (!SNAP || p[0] !== "empreendimentos" || p[1] !== EMP || p.length !== 3) return [];
    var c = SNAP[p[2]] || {};
    return Object.keys(c).sort().map(function (k) { return snapDoc(k, c[k]); });
  }
  function avisar(o) {
    try {
      if (o.tipo === "doc") o.fn(snapDoc(o.path.split("/").pop(), docDe(o.path)));
      else { var docs = colDe(o.path); o.fn({ docs: docs, size: docs.length, empty: !docs.length }); }
    } catch (e) { try { console.error(e); } catch (x) {} }
  }

  /* documentos da própria pessoa (data/users/<id>/...) ficam no navegador */
  function chaveLocal(path) {
    var p = path.split("/");
    if (p[0] === "data" && p[1] === "users" && p.length >= 4) return "casca-doc:" + EMP + ":" + p.slice(3).join("/");
    return null;
  }
  function lerLocal(k) { var v = lsGet(k); try { return v ? JSON.parse(v) : null; } catch (e) { return null; } }
  function soLeitura() { return Promise.reject({ code: "not_granted", message: "Somente leitura nesta página." }); }

  function docRef(path) {
    var k = chaveLocal(path), id = path.split("/").pop();
    return {
      id: id, path: path,
      get: function () { return Promise.resolve(snapDoc(id, k ? lerLocal(k) : docDe(path))); },
      set: function (d) { if (!k) return soLeitura(); lsSet(k, JSON.stringify(d)); return Promise.resolve(); },
      update: function (d) { if (!k) return soLeitura(); lsSet(k, JSON.stringify(Object.assign({}, lerLocal(k) || {}, copia(d)))); return Promise.resolve(); },
      delete: soLeitura,
      onSnapshot: function (fn) {
        if (k) { setTimeout(function () { fn(snapDoc(id, lerLocal(k))); }, 0); return function () {}; }
        var o = { tipo: "doc", path: path, fn: fn }; ouvintes.push(o); if (SNAP) avisar(o);
        return function () { ouvintes = ouvintes.filter(function (x) { return x !== o; }); };
      }
    };
  }
  function colRef(path) {
    return {
      path: path,
      doc: function (id) { return docRef(path + "/" + id); },
      get: function () { var docs = colDe(path); return Promise.resolve({ docs: docs, size: docs.length, empty: !docs.length }); },
      add: soLeitura,
      onSnapshot: function (fn) {
        var o = { tipo: "col", path: path, fn: fn }; ouvintes.push(o); if (SNAP) avisar(o);
        return function () { ouvintes = ouvintes.filter(function (x) { return x !== o; }); };
      }
    };
  }
  var DB = { doc: docRef, collection: colRef };
  var USER = {
    isOwner: function () { return false; },
    canEdit: function () { return Promise.resolve(false); },
    can: function () { return false; },
    id: function () { return Promise.resolve(UID); },
    me: function () { return Promise.resolve({ id: UID, name: "" }); },
    profiles: function () { return Promise.resolve({}); }
  };

  function aviso(t) {
    var a = document.createElement("div");
    a.setAttribute("role", "alert");
    a.style.cssText = "position:fixed;left:12px;bottom:12px;z-index:40;background:var(--sheet,#fff);color:var(--crit,#B3261E);border:1px solid currentColor;padding:8px 12px;font-size:13.5px;max-width:calc(100% - 24px)";
    a.textContent = t; document.body.appendChild(a);
  }

  window.claude = {
    use: function (nome) {
      if (nome === "user") return Promise.resolve(USER);
      if (nome === "db") {
        carregado = carregado || carregar().then(function () { return DB; }).catch(function (e) {
          try { console.error("Casca: falha ao ler os dados", e); } catch (x) {}
          aviso("Não foi possível carregar os dados. Recarregue a página em alguns minutos.");
          return null;
        });
        return carregado;
      }
      return Promise.resolve(null); // sem conectores, sem Claude nesta página
    }
  };

  // Recarrega os dados periodicamente e quando a aba volta a ficar visível.
  var ultima = Date.now(), intervalo = RECARREGAR_MIN * 60000;
  function talvezRecarregar() { if (!SNAP || Date.now() - ultima < intervalo) return; ultima = Date.now(); carregar().catch(function () {}); }
  setInterval(talvezRecarregar, 60000);
  document.addEventListener("visibilitychange", function () { if (!document.hidden) talvezRecarregar(); });
})();
