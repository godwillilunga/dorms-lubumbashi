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

  var montrerErreur = function (msg) { erreur.textContent = msg || ""; erreur.hidden = !msg; };

  var minuteur = null, dernier = "";
  var chargerLits = function () {
    if (!D.enLigne) return;
    var p = periode(); if (!p.debut || !p.fin || p.fin <= p.debut) return;
    var cle = p.debut + p.fin + f.formule.value; if (cle === dernier) return; dernier = cle;
    D.supabase("lits_libres", { p_debut: p.debut, p_fin: p.fin, p_formule: f.formule.value }).then(function (lits) {
      var choisi = f.lit.value;
      f.lit.length = 1;
      (lits || []).forEach(function (l) {
        var o = document.createElement("option"); o.value = l.id; o.textContent = l.libelle; f.lit.appendChild(o);
      });
      f.lit.value = (lits || []).some(function (l) { return String(l.id) === choisi; }) ? choisi : "";
      blocLit.hidden = false;
      montrerErreur(lits && lits.length ? "" : T.aucun_lit);
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
    if (f.lit.value) l.push("• " + $("option:checked", f.lit).textContent);
    if (r.total != null) l.push("• Total" + dp + " " + D.usd(r.total));
    l.push("• " + f.nom.value.trim() + " — " + f.telephone.value.trim());
    if (f.universite.value.trim() && c === "etudiant") l.push("• " + f.universite.value.trim());
    if (f.message.value.trim()) l.push("• " + f.message.value.trim());
    return l.join("\n");
  };

  f.addEventListener("submit", function (e) {
    e.preventDefault();
    if (f.site.value) return; // piège à robots
    var r = maj();
    if (r.erreur) { montrerErreur(T.erreur_dates); return; }
    if (!f.nom.value.trim() || f.telephone.value.replace(/\D/g, "").length < 8) {
      montrerErreur(T.erreur_champs); (f.nom.value.trim() ? f.telephone : f.nom).focus(); return;
    }
    montrerErreur("");
    if (!D.enLigne) { window.open(D.waLien(recap()), "_blank", "noopener"); return; }

    var p = periode();
    btn.disabled = true; btn.textContent = T.envoi;
    D.supabase("demander_reservation", {
      p_client: client(), p_formule: f.formule.value, p_debut: p.debut, p_fin: p.fin,
      p_lit: f.lit.value ? +f.lit.value : null,
      p_nom: f.nom.value.trim(), p_telephone: f.telephone.value.trim(),
      p_email: f.email.value.trim() || null,
      p_universite: client() === "etudiant" ? (f.universite.value.trim() || null) : null,
      p_message: f.message.value.trim() || null, p_langue: D.lang
    }).then(function (res) {
      var ref = res && (res.ref || res);
      $("[data-succes-texte]").textContent = D.fmt(T.succes_texte, { ref: ref });
      $("[data-succes-wa]").href = D.waLien(recap(ref));
      f.hidden = true; var s = $("[data-succes]"); s.hidden = false; s.focus();
    }).catch(function (err) {
      var pris = /LIT_PRIS|COMPLET|23P01/.test((err && (err.message + " " + err.code)) || "");
      montrerErreur(pris ? T.erreur_pris : T.erreur_reseau);
      if (pris) { dernier = ""; chargerLits(); }
    }).then(function () { btn.disabled = false; btn.textContent = T.envoyer; });
  });
})();
