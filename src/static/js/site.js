/* The Dorms Lubumbashi — script commun (menu, visionneuse, carte, vidéo, calculateur, contact). */
(function () {
  "use strict";
  var D = window.DORMS || {};
  var $ = function (sel, el) { return (el || document).querySelector(sel); };
  var $$ = function (sel, el) { return Array.prototype.slice.call((el || document).querySelectorAll(sel)); };

  /* ---------- Outils partagés (utilisés aussi par reserver.js et dispo.js) ---------- */
  D.$ = $; D.$$ = $$;
  D.usd = function (n) { return D.lang === "fr" ? n + " $" : "$" + n; };
  D.waLien = function (texte) { return "https://wa.me/" + D.whatsapp + "?text=" + encodeURIComponent(texte); };
  D.iso = function (d) { // Date -> "AAAA-MM-JJ" (heure locale)
    var m = d.getMonth() + 1, j = d.getDate();
    return d.getFullYear() + "-" + (m < 10 ? "0" : "") + m + "-" + (j < 10 ? "0" : "") + j;
  };
  D.versDate = function (s) { var p = (s || "").split("-"); return p.length === 3 ? new Date(+p[0], +p[1] - 1, +p[2]) : null; };
  D.nuits = function (a, b) {
    var da = D.versDate(a), db = D.versDate(b);
    if (!da || !db) return 0;
    return Math.round((Date.UTC(db.getFullYear(), db.getMonth(), db.getDate()) - Date.UTC(da.getFullYear(), da.getMonth(), da.getDate())) / 864e5);
  };
  D.ajouterMois = function (s, n) {
    var d = D.versDate(s); if (!d) return null;
    var j = d.getDate(); d.setDate(1); d.setMonth(d.getMonth() + n);
    var fin = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
    d.setDate(Math.min(j, fin)); return D.iso(d);
  };
  D.type = function (id) { return (D.types || []).filter(function (t) { return t.id === id; })[0] || D.types[0]; };
  D.fmt = function (modele, vals) { return modele.replace(/\{(\w+)\}/g, function (_, k) { return vals[k]; }); };
  /* Calcule le prix : client "etudiant" (mois) ou "voyageur" (nuits). Retourne {total, detail} ou {erreur}. */
  D.calcul = function (client, formule, o) {
    var ty = D.type(formule);
    if (client === "etudiant") {
      var n = +o.mois || 1;
      return { total: n * ty.mois, detail: D.fmt(D.t.detail_mois, { n: n, p: ty.mois }) };
    }
    var nb = D.nuits(o.arrivee, o.depart);
    if (!o.arrivee || !o.depart) return { total: null, detail: "" };
    if (nb < 1) return { erreur: true };
    var p = ty.nuit || ty.mois;
    return { total: nb * p, detail: D.fmt(D.t.detail_nuits, { n: nb, p: p }) };
  };
  D.supabase = function (fn, args) {
    return fetch(D.sb.url + "/rest/v1/rpc/" + fn, {
      method: "POST",
      headers: { apikey: D.sb.key, Authorization: "Bearer " + D.sb.key, "Content-Type": "application/json" },
      body: JSON.stringify(args || {})
    }).then(function (r) {
      return r.json().catch(function () { return null; }).then(function (j) {
        if (!r.ok) { var e = new Error((j && j.message) || r.statusText); e.code = j && j.code; e.detail = j; throw e; }
        return j;
      });
    });
  };
  D.enLigne = !!(D.sb && D.sb.url && D.sb.key);

  /* ---------- Menu mobile ---------- */
  var burger = $(".burger"), tiroir = $("#tiroir");
  if (burger && tiroir) burger.addEventListener("click", function () {
    var ouvert = burger.getAttribute("aria-expanded") === "true";
    burger.setAttribute("aria-expanded", String(!ouvert)); tiroir.hidden = ouvert;
  });

  /* ---------- Galerie : filtres + visionneuse ---------- */
  var galerie = $("[data-galerie]"), dlg = $(".visionneuse");
  if (galerie) {
    $$(".filtres button").forEach(function (b) {
      b.addEventListener("click", function () {
        var f = b.getAttribute("data-filtre");
        $$(".filtres button").forEach(function (x) { x.setAttribute("aria-pressed", String(x === b)); });
        $$("a", galerie).forEach(function (a) { a.hidden = f !== "tout" && a.getAttribute("data-cat") !== f; });
      });
    });
  }
  if (galerie && dlg && dlg.showModal) {
    var img = $(".scene img", dlg), leg = $(".v-leg", dlg), idx = 0;
    var visibles = function () { return $$("a", galerie).filter(function (a) { return !a.hidden; }); };
    var montrer = function (i) {
      var liste = visibles(); idx = (i + liste.length) % liste.length;
      var a = liste[idx]; img.src = a.getAttribute("href"); img.alt = a.getAttribute("data-leg") || "";
      leg.textContent = (a.getAttribute("data-leg") || "") + "  ·  " + (idx + 1) + " / " + liste.length;
    };
    galerie.addEventListener("click", function (e) {
      var a = e.target.closest("a"); if (!a) return;
      e.preventDefault(); montrer(visibles().indexOf(a)); dlg.showModal();
    });
    $(".v-prec", dlg).addEventListener("click", function () { montrer(idx - 1); });
    $(".v-suiv", dlg).addEventListener("click", function () { montrer(idx + 1); });
    $(".v-fermer", dlg).addEventListener("click", function () { dlg.close(); });
    dlg.addEventListener("click", function (e) { if (e.target === dlg || e.target.classList.contains("scene")) dlg.close(); });
    dlg.addEventListener("keydown", function (e) {
      if (e.key === "ArrowLeft") montrer(idx - 1);
      if (e.key === "ArrowRight") montrer(idx + 1);
    });
    var x0 = null;
    dlg.addEventListener("touchstart", function (e) { x0 = e.touches[0].clientX; }, { passive: true });
    dlg.addEventListener("touchend", function (e) {
      if (x0 === null) return; var dx = e.changedTouches[0].clientX - x0; x0 = null;
      if (Math.abs(dx) > 50) montrer(idx + (dx < 0 ? 1 : -1));
    });
  }

  /* ---------- Carte chargée à la demande ---------- */
  $$("[data-carte]").forEach(function (c) {
    var b = $("button", c); if (!b) return;
    b.addEventListener("click", function () {
      var f = document.createElement("iframe");
      f.src = c.getAttribute("data-carte"); f.title = c.getAttribute("data-titre") || "Carte";
      f.loading = "lazy"; f.referrerPolicy = "no-referrer-when-downgrade"; f.allowFullscreen = true;
      c.innerHTML = ""; c.classList.add("chargee"); c.appendChild(f);
    });
  });

  /* ---------- Vidéo YouTube chargée à la demande ---------- */
  $$("[data-youtube]").forEach(function (b) {
    b.addEventListener("click", function () {
      var f = document.createElement("iframe");
      f.src = "https://www.youtube-nocookie.com/embed/" + encodeURIComponent(b.getAttribute("data-youtube")) + "?autoplay=1&rel=0";
      f.title = b.getAttribute("aria-label"); f.allow = "autoplay; encrypted-media; picture-in-picture"; f.allowFullscreen = true;
      b.innerHTML = ""; b.appendChild(f); b.removeAttribute("aria-label");
    }, { once: true });
  });

  /* ---------- Formulaire de contact -> WhatsApp ---------- */
  var fc = $("[data-contact]");
  if (fc) fc.addEventListener("submit", function (e) {
    e.preventDefault();
    var nom = fc.nom.value.trim(), msg = fc.message.value.trim();
    if (!nom || !msg) { (nom ? fc.message : fc.nom).focus(); return; }
    window.open(D.waLien(msg + "\n\n— " + nom), "_blank", "noopener");
  });

  /* ---------- Calculateur de prix (page Prix) ---------- */
  var calc = $("[data-calc]");
  if (calc) {
    var auj = new Date(), dem = new Date(); dem.setDate(dem.getDate() + 1);
    calc.arrivee.value = D.iso(auj); calc.depart.value = D.iso(dem); calc.arrivee.min = D.iso(auj);
    var maj = function () {
      var client = calc.querySelector("input[name=type]:checked").value;
      $$("[data-si]", calc).forEach(function (el) { el.hidden = el.getAttribute("data-si") !== client; });
      var r = D.calcul(client, D.types[0].id, { mois: calc.mois.value, arrivee: calc.arrivee.value, depart: calc.depart.value });
      $("[data-erreur]", calc).hidden = !r.erreur;
      $("[data-total]", calc).textContent = r.total != null && !r.erreur ? D.usd(r.total) : "–";
      $("[data-detail]", calc).textContent = r.detail || "";
      var q = client === "etudiant" ? "?type=etudiant&mois=" + calc.mois.value
        : "?type=voyageur&arrivee=" + calc.arrivee.value + "&depart=" + calc.depart.value;
      var lien = $("[data-lien-resa]", calc); lien.href = lien.href.split("?")[0] + q;
    };
    calc.addEventListener("input", maj); calc.addEventListener("change", maj); maj();
  }
})();
