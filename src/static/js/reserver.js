/* Formulaire de demande de réservation.
   En ligne (Supabase configuré) : la demande est enregistrée avec le statut « en attente ».
   Hors ligne : le bouton ouvre WhatsApp avec la demande déjà écrite. */
(function () {
  "use strict";
  var D = window.DORMS, $ = D.$, $$ = D.$$, T = D.t;
  var f = $("[data-resa]"); if (!f) return;
  var erreur = $("[data-erreur]", f), btn = $("[data-envoyer]", f), blocLit = $("[data-lit]", f);

  // Valeurs par défaut + paramètres de l'adresse (?type=voyageur&arrivee=...)
  var q = new URLSearchParams(location.search), auj = new Date(), dem = new Date();
  dem.setDate(dem.getDate() + 1);
  f.debut.value = D.iso(auj); f.arrivee.value = D.iso(auj); f.depart.value = D.iso(dem);
  f.debut.min = f.arrivee.min = D.iso(auj);
  if (q.get("type") === "voyageur") f.querySelector("input[value=voyageur]").checked = true;
  if (q.get("mois")) f.mois.value = q.get("mois");
  if (q.get("arrivee")) f.arrivee.value = q.get("arrivee");
  if (q.get("depart")) f.depart.value = q.get("depart");

  if (!D.enLigne) { $("[data-hors-ligne]", f).hidden = false; btn.textContent = T.envoyer_wa; btn.classList.replace("btn-or", "btn-wa"); }

  var client = function () { return f.querySelector("input[name=type]:checked").value; };
  var periode = function () { // [debut, fin) ; fin = jour de départ (exclu)
    return client() === "etudiant"
      ? { debut: f.debut.value, fin: D.ajouterMois(f.debut.value, +f.mois.value) }
      : { debut: f.arrivee.value, fin: f.depart.value };
  };

  var genre = function () { var g = f.querySelector("input[name=genre]:checked"); return g ? g.value : ""; };
  var montrerErreur = function (msg) { erreur.textContent = msg || ""; erreur.hidden = !msg; };

  /* ---------- Plan des lits : chaque chambre est dessinée avec ses lits ; on touche un lit vert pour le choisir ---------- */
  var plan = $("[data-plan]", f), texteChoix = $("[data-choix-lit]", f);
  var esc = function (s) { return String(s).replace(/[&<>"']/g, function (c) { return "&#" + c.charCodeAt(0) + ";"; }); };
  var decoupe = function (lib) { // "Chambre A · Lit 4" -> {chambre: "Chambre A", lit: "Lit 4"}
    lib = String(lib); var i = lib.lastIndexOf(" · ");
    return i < 0 ? { chambre: "", lit: lib } : { chambre: lib.slice(0, i), lit: lib.slice(i + 3) };
  };
  var iconeLit = "<svg viewBox='0 0 40 24' aria-hidden='true'><rect x='1' y='3' width='38' height='18' rx='3'/><rect class='o' x='4' y='6' width='9' height='12' rx='2'/></svg>";
  var libelleChoisi = function () {
    var r = f.querySelector("input[name=lit]:checked");
    return r && r.value ? r.getAttribute("data-libelle") : "";
  };
  var litChoisi = function () { var r = f.querySelector("input[name=lit]:checked"); return r && r.value ? +r.value : null; };
  var majChoix = function () {
    var lib = libelleChoisi(), d = decoupe(lib);
    texteChoix.textContent = lib ? "✔ " + D.fmt(T.choix_lit, { chambre: d.chambre, lit: d.lit }) : T.choix_auto;
  };
  var dessiner = function (tous, libres) {
    var garder = String(litChoisi() || "");
    var estLibre = {}; libres.forEach(function (l) { estLibre[l.id] = true; });
    var chambres = [], parNom = {};
    tous.forEach(function (l) {
      var d = decoupe(l.libelle);
      if (!parNom[d.chambre]) { parNom[d.chambre] = { nom: d.chambre, lits: [] }; chambres.push(parNom[d.chambre]); }
      parNom[d.chambre].lits.push({ id: l.id, nom: d.lit, libelle: l.libelle, libre: !!estLibre[l.id] });
    });
    // Toujours dessiner tous les lits de la chambre (4 en dortoir) : un lit absent de la liste = occupé
    var capacite = { dortoir: 4, double: 2 }[f.formule.value] || 0;
    chambres.forEach(function (c) {
      var num = function (l) { var m = /(\d+)\s*$/.exec(l.nom); return m ? +m[1] : 0; };
      var modele = c.lits[0] && c.lits[0].nom.replace(/\d+\s*$/, "");
      if (!capacite || !modele || c.lits.some(function (l) { return !num(l); })) return;
      for (var n = 1; n <= capacite; n++) {
        if (!c.lits.some(function (l) { return num(l) === n; })) c.lits.push({ id: "x" + n, nom: modele + n, libelle: c.nom + " · " + modele + n, libre: false });
      }
      c.lits.sort(function (a, b) { return num(a) - num(b); });
    });
    var h = "", sdb ="<div class='piece commun sdb'><span>" + esc(T.plan_sdb) + "</span></div>";
    chambres.forEach(function (c, i) {
      var nbLibres = c.lits.filter(function (l) { return l.libre; }).length;
      h += "<div class='piece chambre'><div class='piece-titre'><b>" + esc(c.nom) + "</b><small>" +
        esc(D.fmt(T.plan_libres, { n: nbLibres, total: c.lits.length })) + "</small></div><div class='lits'>";
      c.lits.forEach(function (l) {
        var etat = l.libre ? T.leg_libre : T.leg_pris;
        h += "<label class='lit" + (l.libre ? "" : " pris") + "'><input type='radio' name='lit' value='" + l.id + "' data-libelle='" + esc(l.libelle) + "'" +
          (l.libre ? "" : " disabled") + (l.libre && String(l.id) === garder ? " checked" : "") +
          " aria-label='" + esc(c.nom + ", " + l.nom + " : " + etat) + "'>" + iconeLit +
          "<b>" + esc(l.nom) + "</b><small><span class='e'>" + esc(etat) + "</span><span class='c'>✔ " + esc(T.leg_choix) + "</span></small></label>";
      });
      h += "</div><div class='porte' aria-hidden='true'>" + esc(T.plan_porte) + "</div></div>";
      if (i === 0 && chambres.length === 2) h += sdb;
    });
    if (chambres.length !== 2) h += sdb;
    h += "<div class='piece commun salon'><span>" + esc(T.plan_salon) + "</span></div>";
    plan.innerHTML = h;
    if (!f.querySelector("input[name=lit]:checked")) f.querySelector("input[name=lit][value='']").checked = true;
    majChoix();
  };
  f.addEventListener("change", function (e) { if (e.target.name === "lit") majChoix(); });

  var minuteur = null, dernier = "";
  var chargerLits = function () {
    if (!D.enLigne) return;
    var p = periode(); if (!p.debut || !p.fin || p.fin <= p.debut) return;
    var cle = p.debut + p.fin + f.formule.value; if (cle === dernier) return; dernier = cle;
    Promise.all([
      D.supabase("lits_libres", { p_debut: p.debut, p_fin: p.fin, p_formule: f.formule.value }),
      D.supabase("calendrier_public", { p_debut: p.debut, p_fin: p.fin })
    ]).then(function (r) {
      var libres = r[0] || [], tous = (r[1] && r[1].lits) || libres;
      // Seulement les chambres du type choisi : celles qui ont au moins un lit du même type (libre) ou, si tout est plein, les chambres « Chambre … »
      var chambresType = {}; libres.forEach(function (l) { chambresType[decoupe(l.libelle).chambre] = true; });
      tous = tous.filter(function (l) { var c = decoupe(l.libelle).chambre; return libres.length ? chambresType[c] : /^(Chambre|Room)\b/i.test(c); });
      dessiner(tous, libres);
      blocLit.hidden = !tous.length;
      montrerErreur(libres.length ? "" : T.aucun_lit);
    }).catch(function () { blocLit.hidden = true; });
  };

  var maj = function () {
    var c = client();
    $$("[data-si]", f).forEach(function (el) { el.hidden = el.getAttribute("data-si") !== c; });
    var r = D.calcul(c, f.formule.value, { mois: f.mois.value, arrivee: f.arrivee.value, depart: f.depart.value });
    $("[data-total]", f).textContent = r.total != null && !r.erreur ? D.usd(r.total) : "–";
    $("[data-detail]", f).textContent = r.detail || "";
    if (r.erreur) montrerErreur(T.erreur_dates); else if (erreur.textContent === T.erreur_dates) montrerErreur("");
    clearTimeout(minuteur); minuteur = setTimeout(chargerLits, 400);
    return r;
  };
  f.addEventListener("input", maj); f.addEventListener("change", maj); maj();

  var recap = function (ref) {
    var p = periode(), c = client(), r = maj(), l = [], dp = D.lang === "fr" ? " :" : ":";
    l.push(T.wa_recap + (ref ? " (n° " + ref + ")" : "") + dp);
    l.push("• " + (c === "etudiant" ? T.etudiant : T.voyageur) + " — " + $("option:checked", f.formule).textContent);
    l.push("• " + p.debut + " → " + p.fin + (r.detail ? " (" + r.detail + ")" : ""));
    l.push("• " + (libelleChoisi() || T.lit_peu_importe));
    if (genre()) l.push("• " + (genre() === "femme" ? T.femme : T.homme));
    if (r.total != null) l.push("• Total" + dp + " " + D.usd(r.total));
    l.push("• " + f.nom.value.trim() + " — " + f.telephone.value.trim());
    if (f.universite.value.trim() && c === "etudiant") l.push("• " + f.universite.value.trim());
    if (f.message.value.trim()) l.push("• " + f.message.value.trim());
    return l.join("\n");
  };

  // Anti-robot Cloudflare Turnstile : le widget s'affiche au-dessus du bouton ; la fonction Edge « reserver » vérifie le jeton.
  var zoneTs = $("[data-turnstile]"), idTs = null;
  var afficherTs = function () {
    if (idTs !== null || !zoneTs || !D.enLigne || !D.turnstile) return;
    if (!window.turnstile) { setTimeout(afficherTs, 300); return; }
    idTs = window.turnstile.render(zoneTs, { sitekey: D.turnstile, language: D.lang, action: "reservation" });
  };
  afficherTs();
  var jetonTs = function () { return idTs !== null && window.turnstile ? window.turnstile.getResponse(idTs) || "" : ""; };
  var envoyer = function (args) {
    return fetch(D.sb.url + "/functions/v1/reserver", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(args)
    }).then(function (r) {
      return r.json().catch(function () { return null; }).then(function (j) {
        if (!r.ok) { var e = new Error((j && j.message) || r.statusText); e.code = j && j.code; e.detail = j; throw e; }
        return j;
      });
    });
  };

  f.addEventListener("submit", function (e) {
    e.preventDefault();
    if (f.site.value) return; // piège à robots
    var r = maj();
    if (r.erreur) { montrerErreur(T.erreur_dates); return; }
    if (!f.nom.value.trim() || f.telephone.value.replace(/\D/g, "").length < 8) {
      montrerErreur(T.erreur_champs); (f.nom.value.trim() ? f.telephone : f.nom).focus(); return;
    }
    if (!genre()) { montrerErreur(T.erreur_genre); f.querySelector("input[name=genre]").focus(); return; }
    montrerErreur("");
    if (!D.enLigne) { window.open(D.waLien(recap()), "_blank", "noopener"); return; }

    var jeton = jetonTs();
    if (D.turnstile && !jeton) { montrerErreur(T.erreur_robot); return; }
    var p = periode();
    btn.disabled = true; btn.textContent = T.envoi;
    envoyer({ jeton: jeton,
      p_client: client(), p_formule: f.formule.value, p_debut: p.debut, p_fin: p.fin,
      p_lit: litChoisi(),
      p_nom: f.nom.value.trim(), p_telephone: f.telephone.value.trim(),
      p_email: f.email.value.trim() || null,
      p_universite: client() === "etudiant" ? (f.universite.value.trim() || null) : null,
      p_message: ("[" + (genre() === "femme" ? T.femme : T.homme) + "] " + f.message.value.trim()).trim(), p_langue: D.lang
    }).then(function (res) {
      var ref = res && (res.ref || res);
      $("[data-succes-texte]").textContent = D.fmt(T.succes_texte, { ref: ref });
      $("[data-succes-wa]").href = D.waLien(recap(ref));
      f.hidden = true; var s = $("[data-succes]"); s.hidden = false; s.focus();
    }).catch(function (err) {
      var pris = /LIT_PRIS|COMPLET|23P01/.test((err && (err.message + " " + err.code)) || "");
      var robot = /^TURNSTILE/.test((err && err.message) || "");
      montrerErreur(pris ? T.erreur_pris : robot ? T.erreur_robot : T.erreur_reseau);
      if (pris) { dernier = ""; chargerLits(); }
    }).then(function () {
      btn.disabled = false; btn.textContent = T.envoyer;
      if (idTs !== null && window.turnstile) window.turnstile.reset(idTs); // un jeton ne sert qu'une fois
    });
  });
})();
