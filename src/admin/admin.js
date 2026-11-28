/* The Dorms Lubumbashi — espace administrateur.
   Toutes les données passent par Supabase avec votre session : les règles RLS refusent tout accès à un compte non administrateur. */
(function () {
  "use strict";
  var CFG = window.DORMS_ADMIN || {};
  var $ = function (s, el) { return (el || document).querySelector(s); };
  var $$ = function (s, el) { return Array.prototype.slice.call((el || document).querySelectorAll(s)); };
  if (!CFG.url || !CFG.key || !window.supabase) { $("#ecran-config").hidden = false; return; }
  var sb = window.supabase.createClient(CFG.url, CFG.key);

  /* ---------- Outils ---------- */
  var e = function (s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); };
  var usd = function (n) { return n == null || n === "" ? "—" : (Math.round(+n * 100) / 100).toLocaleString("fr-FR") + " $"; };
  var ref = function (id) { return "DL-" + String(id).padStart(4, "0"); };
  var iso = function (d) { var m = d.getMonth() + 1, j = d.getDate(); return d.getFullYear() + "-" + (m < 10 ? "0" : "") + m + "-" + (j < 10 ? "0" : "") + j; };
  var versDate = function (s) { var p = s.split("-"); return new Date(+p[0], +p[1] - 1, +p[2]); };
  var auj = iso(new Date());
  var jours = function (a, b) { return Math.round((Date.UTC.apply(null, b.split("-").map(function (x, i) { return i === 1 ? x - 1 : +x; })) - Date.UTC.apply(null, a.split("-").map(function (x, i) { return i === 1 ? x - 1 : +x; }))) / 864e5); };
  var ajMois = function (s, n) { var d = versDate(s), j = d.getDate(); d.setDate(1); d.setMonth(d.getMonth() + n); d.setDate(Math.min(j, new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate())); return iso(d); };
  var nbMois = function (a, b) { var n = 0; while (ajMois(a, n + 1) <= b) n++; return Math.max(1, n); };
  var fdate = function (s) { if (!s) return "—"; var p = s.slice(0, 10).split("-"); return p[2] + "/" + p[1] + "/" + p[0]; };
  var STATUTS = { en_attente: "En attente", approuvee: "Approuvée", confirmee: "Confirmée", refusee: "Refusée", annulee: "Annulée", terminee: "Terminée", conflit: "Conflit Airbnb" };
  var METHODES = { especes: "Espèces", mpesa: "M-Pesa", orange_money: "Orange Money", airtel_money: "Airtel Money", autre: "Autre" };
  var BLOQUANTS = ["approuvee", "confirmee", "conflit"];
  var telWa = function (t) { var d = String(t || "").replace(/\D/g, ""); if (d.indexOf("00") === 0) d = d.slice(2); if (d.indexOf("0") === 0) d = "243" + d.slice(1); if (d.length === 9) d = "243" + d; return d; };
  var waLien = function (tel, txt) { return "https://wa.me/" + telWa(tel) + "?text=" + encodeURIComponent(txt); };

  var msgEl = $("#message"), minuteurMsg;
  var dire = function (txt, erreur) {
    msgEl.textContent = txt; msgEl.className = "toast" + (erreur ? " erreur" : ""); msgEl.hidden = false;
    clearTimeout(minuteurMsg); minuteurMsg = setTimeout(function () { msgEl.hidden = true; }, erreur ? 7000 : 3500);
  };
  var expliquer = function (err) {
    var m = (err && (err.message || err.details)) || String(err);
    if (/23P01|double_reservation/.test(m + (err && err.code))) return "Ce lit est déjà occupé (réservation approuvée ou confirmée) sur une partie de ces dates.";
    if (/row-level security|permission/.test(m)) return "Accès refusé : ce compte n'est pas administrateur.";
    return m;
  };

  /* ---------- Données ---------- */
  var D = {};
  var charger = function () {
    var q = function (t, ordre) { return sb.from(t).select("*").order(ordre || "id"); };
    return Promise.all([q("maisons", "ordre"), q("chambres", "ordre"), q("lits", "ordre"), q("tarifs", "type"),
      q("reservations"), q("paiements"), q("sources_ical"), q("reglages", "cle")]).then(function (r) {
      var err = r.filter(function (x) { return x.error; })[0]; if (err) throw err.error;
      D = { maisons: r[0].data, chambres: r[1].data, lits: r[2].data, tarifs: r[3].data, resas: r[4].data, paiements: r[5].data, sources: r[6].data, reglages: {} };
      r[7].data.forEach(function (x) { D.reglages[x.cle] = x.valeur; });
      $("#nb-demandes").textContent = D.resas.filter(function (x) { return x.statut === "en_attente"; }).length || "";
      $("#nb-retards").textContent = etudiants().filter(function (x) { return x.retard > 0; }).length || "";
    });
  };
  var lit = function (id) { return D.lits.filter(function (l) { return l.id === id; })[0]; };
  var chambre = function (id) { return D.chambres.filter(function (c) { return c.id === id; })[0]; };
  var maison = function (id) { return D.maisons.filter(function (m) { return m.id === id; })[0]; };
  var libLit = function (id) { var l = lit(id); if (!l) return "Lit non choisi"; var c = chambre(l.chambre_id); return (c ? c.nom + " · " : "") + l.nom; };
  var litsActifs = function (type) {
    return D.lits.filter(function (l) {
      var c = chambre(l.chambre_id), m = c && maison(c.maison_id);
      return l.actif && c && c.actif && m && m.actif && (!type || c.type === type);
    }).sort(function (a, b) { return (chambre(a.chambre_id).ordre - chambre(b.chambre_id).ordre) || (a.ordre - b.ordre); });
  };
  var litLibre = function (litId, debut, fin, saufId) {
    return !D.resas.some(function (r) { return r.id !== saufId && r.lit_id === litId && BLOQUANTS.indexOf(r.statut) >= 0 && r.debut < fin && r.fin > debut; });
  };
  var payeTotal = function (resaId) { return D.paiements.filter(function (p) { return p.reservation_id === resaId; }).reduce(function (s, p) { return s + +p.montant; }, 0); };
  var tarif = function (type) { return D.tarifs.filter(function (t) { return t.type === type; })[0] || {}; };

  /* Échéances des étudiants : une échéance au début de chaque trimestre */
  var etudiants = function () {
    return D.resas.filter(function (r) { return r.client === "etudiant" && (r.statut === "approuvee" || r.statut === "confirmee") && r.fin > auj; })
      .map(function (r) {
        var mois = nbMois(r.debut, r.fin), mensuel = r.montant ? +r.montant / mois : +tarif(r.formule).mois || 0;
        var ech = [], cumul = 0, paye = payeTotal(r.id), du = 0, prochaine = null;
        for (var k = 0; k * 3 < mois; k++) {
          var montant = Math.round(mensuel * Math.min(3, mois - 3 * k) * 100) / 100, date = ajMois(r.debut, 3 * k);
          cumul += montant; ech.push({ date: date, montant: montant });
          if (date <= auj) du = cumul;
          else if (!prochaine && cumul > paye) prochaine = { date: date, montant: Math.min(montant, cumul - paye) };
        }
        return { r: r, ech: ech, paye: paye, retard: Math.max(0, Math.round((du - paye) * 100) / 100), prochaine: prochaine };
      });
  };

  /* ---------- Modale générique ---------- */
  var modale = $("#modale"), mform = $("#modale-form");
  var ouvrir = function (html, surValider) {
    mform.innerHTML = html + '<menu><button class="btn btn-ligne" value="annuler" type="submit" formnovalidate>Annuler</button><button class="btn btn-or" value="ok" type="submit">Enregistrer</button></menu>';
    modale.showModal();
    mform.onsubmit = function (ev) {
      if (ev.submitter && ev.submitter.value === "annuler") return;
      ev.preventDefault();
      var donnees = {}; $$("[name]", mform).forEach(function (i) { donnees[i.name] = i.type === "checkbox" ? i.checked : i.value; });
      Promise.resolve(surValider(donnees)).then(function (ok) { if (ok !== false) modale.close(); });
    };
  };
  var champ = function (lab, nom, val, type, extra) {
    return '<div class="champ"><label for="m-' + nom + '">' + lab + '</label><input id="m-' + nom + '" name="' + nom + '" type="' + (type || "text") + '" value="' + e(val == null ? "" : val) + '"' + (extra || "") + '></div>';
  };
  var choix = function (lab, nom, options, val) {
    return '<div class="champ"><label for="m-' + nom + '">' + lab + '</label><select id="m-' + nom + '" name="' + nom + '">' +
      options.map(function (o) { return '<option value="' + e(o[0]) + '"' + (String(o[0]) === String(val) ? " selected" : "") + ">" + e(o[1]) + "</option>"; }).join("") + "</select></div>";
  };

  /* ---------- Actions sur les réservations ---------- */
  var majResa = function (id, champs, succes) {
    return sb.from("reservations").update(champs).eq("id", id).then(function (r) {
      if (r.error) { dire(expliquer(r.error), true); return false; }
      dire(succes || "Enregistré"); return charger().then(afficher);
    });
  };
  var messageAcceptation = function (r) {
    var en = r.langue === "en", instr = (en ? D.reglages.instructions_paiement_en : null) || D.reglages.instructions_paiement || "";
    var periode = fdate(r.debut) + (en ? " to " : " au ") + fdate(r.fin);
    return en
      ? "Hello " + r.nom + ", your booking request " + ref(r.id) + " at The Dorms Lubumbashi is accepted: " + libLit(r.lit_id) + ", " + periode + ", total " + usd(r.montant) + ".\n\n" + instr + "\n\nYour place is confirmed as soon as we receive the payment. Thank you!"
      : "Bonjour " + r.nom + ", votre demande " + ref(r.id) + " aux Dorms Lubumbashi est acceptée : " + libLit(r.lit_id) + ", du " + periode + ", total " + usd(r.montant) + ".\n\n" + instr + "\n\nVotre place est confirmée dès réception du paiement. Merci !";
  };
  var messageRefus = function (r) {
    return r.langue === "en"
      ? "Hello " + r.nom + ", thank you for your request " + ref(r.id) + ". Unfortunately no bed is available for these dates. Feel free to ask us for other dates."
      : "Bonjour " + r.nom + ", merci pour votre demande " + ref(r.id) + ". Malheureusement aucun lit n'est libre à ces dates. N'hésitez pas à nous demander d'autres dates.";
  };
  var approuver = function (r) {
    var libres = litsActifs(r.formule).filter(function (l) { return litLibre(l.id, r.debut, r.fin, r.id); });
    if (!libres.length) { dire("Aucun lit de ce type n'est libre sur toute la période. Refusez ou proposez d'autres dates.", true); return; }
    var defaut = r.lit_id && libres.some(function (l) { return l.id === r.lit_id; }) ? r.lit_id : libres[0].id;
    ouvrir("<h2>Approuver " + ref(r.id) + "</h2><p class='petit'>" + e(r.nom) + " · " + fdate(r.debut) + " → " + fdate(r.fin) + "</p>" +
      choix("Lit attribué", "lit", libres.map(function (l) { return [l.id, libLit(l.id)]; }), defaut) +
      champ("Montant total ($)", "montant", r.montant, "number", ' step="0.01" min="0"') +
      "<p class='petit'>Après l'enregistrement, WhatsApp s'ouvre avec le message d'acceptation et les instructions de paiement.</p>",
      function (v) {
        var fen = window.open("", "_blank");
        return majResa(r.id, { statut: "approuvee", lit_id: +v.lit, montant: v.montant === "" ? null : +v.montant }, "Demande approuvée").then(function (ok) {
          var maj = D.resas.filter(function (x) { return x.id === r.id; })[0];
          if (ok === false || !maj || maj.statut !== "approuvee") { if (fen) fen.close(); return false; }
          if (fen) fen.location = waLien(maj.telephone, messageAcceptation(maj)); else window.open(waLien(maj.telephone, messageAcceptation(maj)), "_blank");
        });
      });
  };
  var refuser = function (r) {
    ouvrir("<h2>Refuser " + ref(r.id) + " ?</h2><p>La demande de " + e(r.nom) + " passera en « Refusée ».</p>" +
      '<label class="ligne"><input type="checkbox" name="wa" checked style="width:auto;min-height:0"> Ouvrir WhatsApp avec un message poli</label>',
      function (v) {
        if (v.wa) window.open(waLien(r.telephone, messageRefus(r)), "_blank");
        return majResa(r.id, { statut: "refusee" }, "Demande refusée");
      });
  };
  var encaisser = function (r) {
    var reste = r && r.montant ? Math.max(0, +r.montant - payeTotal(r.id)) : "";
    var resas = D.resas.filter(function (x) { return x.source !== "airbnb" && ["approuvee", "confirmee", "terminee"].indexOf(x.statut) >= 0; });
    ouvrir("<h2>Enregistrer un paiement</h2>" +
      choix("Réservation", "resa", [["", "— Sans réservation —"]].concat(resas.map(function (x) { return [x.id, ref(x.id) + " · " + x.nom + " · " + fdate(x.debut)]; })), r ? r.id : "") +
      champ("Montant ($)", "montant", reste, "number", ' step="0.01" min="0.01" required') +
      choix("Moyen de paiement", "methode", Object.keys(METHODES).map(function (k) { return [k, METHODES[k]]; }), "mpesa") +
      champ("Référence de la transaction", "reference", "") +
      champ("Date", "date", auj, "date", " required") +
      '<label class="ligne"><input type="checkbox" name="confirmer" checked style="width:auto;min-height:0"> Passer la réservation en « Confirmée »</label>',
      function (v) {
        return sb.from("paiements").insert({ reservation_id: v.resa ? +v.resa : null, montant: +v.montant, methode: v.methode, reference: v.reference || null, date_paiement: v.date })
          .then(function (res) {
            if (res.error) { dire(expliquer(res.error), true); return false; }
            var x = v.resa && D.resas.filter(function (y) { return y.id === +v.resa; })[0];
            if (v.confirmer && x && x.statut === "approuvee") return majResa(x.id, { statut: "confirmee" }, "Paiement enregistré, réservation confirmée");
            dire("Paiement enregistré"); return charger().then(afficher);
          });
      });
  };
  var editer = function (r) {
    var nouveau = !r; r = r || { client: "voyageur", formule: "dortoir", debut: auj, fin: iso(new Date(Date.now() + 864e5)), statut: "confirmee", langue: "fr" };
    ouvrir("<h2>" + (nouveau ? "Nouvelle réservation" : "Réservation " + ref(r.id)) + "</h2>" +
      '<div class="champs">' + choix("Client", "client", [["etudiant", "Étudiant"], ["voyageur", "Voyageur"]], r.client) +
      choix("Formule", "formule", D.tarifs.map(function (t) { return [t.type, t.type]; }), r.formule) + "</div>" +
      choix("Lit", "lit", [["", "— À choisir —"]].concat(D.lits.map(function (l) { return [l.id, libLit(l.id)]; })), r.lit_id) +
      '<div class="champs">' + champ("Arrivée", "debut", r.debut, "date", " required") + champ("Départ", "fin", r.fin, "date", " required") + "</div>" +
      '<div class="champs">' + champ("Nom", "nom", r.nom, "text", " required") + champ("Téléphone", "telephone", r.telephone, "tel", " required") + "</div>" +
      '<div class="champs">' + champ("Montant total ($)", "montant", r.montant, "number", ' step="0.01" min="0"') +
      choix("Statut", "statut", Object.keys(STATUTS).map(function (k) { return [k, STATUTS[k]]; }), r.statut) + "</div>" +
      champ("Université", "universite", r.universite) +
      '<div class="champ"><label for="m-notes">Notes (privées)</label><textarea id="m-notes" name="notes">' + e(r.notes) + "</textarea></div>",
      function (v) {
        if (v.fin <= v.debut) { dire("La date de départ doit être après l'arrivée.", true); return false; }
        var champs = { client: v.client, formule: v.formule, lit_id: v.lit ? +v.lit : null, debut: v.debut, fin: v.fin, nom: v.nom, telephone: v.telephone,
          montant: v.montant === "" ? null : +v.montant, statut: v.statut, universite: v.universite || null, notes: v.notes || null };
        if (!nouveau) return majResa(r.id, champs, "Réservation mise à jour");
        champs.source = "admin";
        return sb.from("reservations").insert(champs).then(function (res) {
          if (res.error) { dire(expliquer(res.error), true); return false; }
          dire("Réservation ajoutée"); return charger().then(afficher);
        });
      });
  };
  var trouver = function (id) { return D.resas.filter(function (r) { return r.id === +id; })[0]; };

  var fiche = function (r, avecActions) {
    var paye = payeTotal(r.id);
    return '<article class="fiche' + (r.statut === "conflit" ? " alerte-f" : "") + '"><header><b>' + e(r.nom) + "</b><span class='statut " + r.statut + "'>" + STATUTS[r.statut] + "</span><span class='petit'>" + ref(r.id) + " · reçue le " + fdate(r.created_at) + "</span></header>" +
      "<dl><dt>Séjour</dt><dd>" + fdate(r.debut) + " → " + fdate(r.fin) + " (" + (r.client === "etudiant" ? nbMois(r.debut, r.fin) + " mois" : jours(r.debut, r.fin) + " nuit(s)") + ")</dd>" +
      "<dt>Client</dt><dd>" + (r.client === "etudiant" ? "Étudiant" : "Voyageur") + " · " + e(r.formule) + (r.universite ? " · " + e(r.universite) : "") + "</dd>" +
      "<dt>Lit</dt><dd>" + e(libLit(r.lit_id)) + "</dd>" +
      "<dt>Téléphone</dt><dd>" + e(r.telephone) + (r.email ? " · " + e(r.email) : "") + "</dd>" +
      "<dt>Montant</dt><dd>" + usd(r.montant) + (paye ? " · payé " + usd(paye) : "") + "</dd>" +
      (r.message ? "<dt>Message</dt><dd>" + e(r.message) + "</dd>" : "") + (r.notes ? "<dt>Notes</dt><dd>" + e(r.notes) + "</dd>" : "") + "</dl>" +
      (avecActions ? '<div class="actions">' +
        (r.statut === "en_attente" ? '<button class="btn btn-or btn-petit" data-act="approuver" data-id="' + r.id + '">Approuver</button><button class="btn btn-ligne btn-petit" data-act="refuser" data-id="' + r.id + '">Refuser</button>' : "") +
        (r.statut === "approuvee" ? '<button class="btn btn-or btn-petit" data-act="encaisser" data-id="' + r.id + '">Marquer payé</button>' : "") +
        (r.source !== "airbnb" ? '<a class="btn btn-wa btn-petit" target="_blank" rel="noopener" href="' + e(waLien(r.telephone, r.statut === "approuvee" ? messageAcceptation(r) : "Bonjour " + r.nom + ", ")) + '">WhatsApp</a>' : "") +
        '<button class="btn btn-ligne btn-petit" data-act="editer" data-id="' + r.id + '">Modifier</button></div>' : "") + "</article>";
  };

  /* ---------- Vues ---------- */
  var onglet = "bord", moisVue = auj.slice(0, 7);
  var barreMois = function (titre) {
    return '<div class="barre"><h2>' + titre + '</h2><input type="month" id="mois" value="' + moisVue + '" aria-label="Mois"></div>';
  };
  var bornesMois = function () { var d = moisVue + "-01"; return [d, ajMois(d, 1)]; };

  var VUES = {
    bord: function () {
      var b = bornesMois(), nbJ = jours(b[0], b[1]), lits = litsActifs(), capacite = lits.length * nbJ, occupe = 0;
      D.resas.forEach(function (r) {
        if (BLOQUANTS.indexOf(r.statut) < 0 || !lits.some(function (l) { return l.id === r.lit_id; })) return;
        var d = r.debut > b[0] ? r.debut : b[0], f = r.fin < b[1] ? r.fin : b[1]; if (f > d) occupe += jours(d, f);
      });
      var revenu = D.paiements.filter(function (p) { return p.date_paiement >= b[0] && p.date_paiement < b[1]; }).reduce(function (s, p) { return s + +p.montant; }, 0);
      var attente = D.resas.filter(function (r) { return r.statut === "en_attente"; }), et = etudiants();
      var retards = et.filter(function (x) { return x.retard > 0; }), conflits = D.resas.filter(function (r) { return r.statut === "conflit" && r.fin > auj; });
      var bientot = et.filter(function (x) { return x.prochaine && jours(auj, x.prochaine.date) <= 10; });
      var alertes = conflits.map(function (r) { return "<li><b>Conflit Airbnb</b> : " + e(libLit(r.lit_id)) + " du " + fdate(r.debut) + " au " + fdate(r.fin) + " chevauche une réservation du site.</li>"; })
        .concat(retards.map(function (x) { return "<li><b>Retard</b> : " + e(x.r.nom) + " doit " + usd(x.retard) + ".</li>"; }))
        .concat(bientot.map(function (x) { return "<li><b>Échéance proche</b> : " + e(x.r.nom) + " · " + usd(x.prochaine.montant) + " le " + fdate(x.prochaine.date) + ".</li>"; }));
      return barreMois("Tableau de bord") + '<div class="kpis">' +
        '<div class="kpi"><span>Encaissé ce mois</span><b>' + usd(revenu) + "</b><small>" + D.paiements.filter(function (p) { return p.date_paiement >= b[0] && p.date_paiement < b[1]; }).length + " paiement(s)</small></div>" +
        '<div class="kpi"><span>Taux d\'occupation</span><b>' + (capacite ? Math.round(occupe / capacite * 100) : 0) + " %</b><small>" + occupe + " nuits-lit / " + capacite + "</small></div>" +
        '<div class="kpi"><span>Demandes en attente</span><b>' + attente.length + "</b><small>à traiter</small></div>" +
        '<div class="kpi"><span>Étudiants en retard</span><b>' + retards.length + "</b><small>" + usd(retards.reduce(function (s, x) { return s + x.retard; }, 0)) + " dus</small></div></div>" +
        "<h3>Alertes</h3>" + (alertes.length ? '<ul class="liste" style="padding-left:1.2rem">' + alertes.join("") + "</ul>" : '<p class="vide">Aucune alerte.</p>');
    },
    demandes: function () {
      var l = D.resas.filter(function (r) { return r.statut === "en_attente"; }).sort(function (a, b) { return a.id - b.id; });
      return '<div class="barre"><h2>Demandes en attente</h2></div>' + (l.length ? '<div class="liste">' + l.map(function (r) { return fiche(r, true); }).join("") + "</div>" : '<p class="vide">Aucune demande en attente.</p>');
    },
    calendrier: function () {
      var b = bornesMois(), nbJ = jours(b[0], b[1]), h = barreMois("Calendrier des lits") +
        '<p class="petit" style="margin-bottom:.6rem"><span class="statut approuvee">Approuvée</span> <span class="statut confirmee">Confirmée</span> <span class="statut" style="background:#FF5A5F;color:#fff">Airbnb</span> <span class="statut conflit">Conflit</span> · touchez une case pour ouvrir la réservation.</p>' +
        "<div class='cal-wrap'><table class='cal'><thead><tr><th scope='col'></th>";
      for (var j = 1; j <= nbJ; j++) h += "<th scope='col'>" + j + "</th>";
      h += "</tr></thead><tbody>";
      D.lits.filter(function (l) { var c = chambre(l.chambre_id), m = c && maison(c.maison_id); return l.actif && c && c.actif && m && m.actif; }).forEach(function (l) {
        h += "<tr><th scope='row'>" + e(libLit(l.id)) + "</th>";
        for (var j = 1; j <= nbJ; j++) {
          var jour = b[0].slice(0, 8) + (j < 10 ? "0" : "") + j;
          var r = D.resas.filter(function (x) { return x.lit_id === l.id && BLOQUANTS.indexOf(x.statut) >= 0 && x.debut <= jour && jour < x.fin; })[0];
          var cl = !r ? "" : r.statut === "conflit" ? "x" : r.source === "airbnb" ? "b" : r.statut === "confirmee" ? "c" : "a";
          h += "<td" + (r ? " class='" + cl + "' data-id='" + r.id + "' title='" + e(r.nom + " · " + fdate(r.debut) + " → " + fdate(r.fin)) + "'" : "") + "></td>";
        }
        h += "</tr>";
      });
      return h + "</tbody></table></div>";
    },
    reservations: function () {
      var filtre = (VUES._filtre = VUES._filtre || "actives"), cherche = (VUES._cherche || "").toLowerCase();
      var l = D.resas.filter(function (r) {
        if (filtre === "actives" && (["approuvee", "confirmee", "conflit", "en_attente"].indexOf(r.statut) < 0 || r.fin < auj)) return false;
        if (filtre !== "actives" && filtre !== "toutes" && r.statut !== filtre) return false;
        return !cherche || (r.nom + " " + r.telephone + " " + ref(r.id)).toLowerCase().indexOf(cherche) >= 0;
      }).sort(function (a, b) { return a.debut < b.debut ? 1 : -1; });
      return '<div class="barre"><h2>Réservations</h2><input type="search" id="cherche" placeholder="Nom, téléphone, DL-…" value="' + e(VUES._cherche || "") + '" aria-label="Rechercher">' +
        '<select id="filtre" aria-label="Filtre"><option value="actives">En cours et à venir</option><option value="toutes">Toutes</option>' + Object.keys(STATUTS).map(function (k) { return '<option value="' + k + '">' + STATUTS[k] + "</option>"; }).join("") + "</select>" +
        '<button class="btn btn-or btn-petit" data-act="nouvelle">+ Ajouter</button><button class="btn btn-ligne btn-petit" data-act="csv-resas">Export CSV</button></div>' +
        (l.length ? '<div class="table-wrap"><table class="donnees"><thead><tr><th>Réf.</th><th>Nom</th><th>Statut</th><th>Lit</th><th>Arrivée</th><th>Départ</th><th class="num">Montant</th><th class="num">Payé</th><th>Source</th></tr></thead><tbody>' +
          l.map(function (r) { return '<tr class="clic" data-id="' + r.id + '"><td>' + ref(r.id) + "</td><td>" + e(r.nom) + "</td><td><span class='statut " + r.statut + "'>" + STATUTS[r.statut] + "</span></td><td>" + e(libLit(r.lit_id)) + "</td><td>" + fdate(r.debut) + "</td><td>" + fdate(r.fin) + "</td><td class='num'>" + usd(r.montant) + "</td><td class='num'>" + usd(payeTotal(r.id) || null) + "</td><td>" + r.source + "</td></tr>"; }).join("") +
          "</tbody></table></div>" : '<p class="vide">Aucune réservation pour ce filtre.</p>');
    },
    paiements: function () {
      var b = bornesMois(), l = D.paiements.filter(function (p) { return p.date_paiement >= b[0] && p.date_paiement < b[1]; }).sort(function (a, c) { return a.date_paiement < c.date_paiement ? 1 : -1; });
      var parMethode = {}; l.forEach(function (p) { parMethode[p.methode] = (parMethode[p.methode] || 0) + +p.montant; });
      return barreMois("Paiements").replace("</div>", '<button class="btn btn-or btn-petit" data-act="encaisser">+ Paiement</button><button class="btn btn-ligne btn-petit" data-act="csv-paiements">Export CSV</button></div>') +
        '<div class="kpis"><div class="kpi"><span>Total du mois</span><b>' + usd(l.reduce(function (s, p) { return s + +p.montant; }, 0)) + "</b></div>" +
        Object.keys(parMethode).map(function (k) { return '<div class="kpi"><span>' + METHODES[k] + "</span><b>" + usd(parMethode[k]) + "</b></div>"; }).join("") + "</div>" +
        (l.length ? '<div class="table-wrap"><table class="donnees"><thead><tr><th>Date</th><th>Réservation</th><th>Moyen</th><th>Référence</th><th class="num">Montant</th></tr></thead><tbody>' +
          l.map(function (p) { var r = trouver(p.reservation_id); return "<tr><td>" + fdate(p.date_paiement) + "</td><td>" + (r ? ref(r.id) + " · " + e(r.nom) : "—") + "</td><td>" + METHODES[p.methode] + "</td><td>" + e(p.reference || "") + "</td><td class='num'>" + usd(p.montant) + "</td></tr>"; }).join("") +
          "</tbody></table></div>" : '<p class="vide">Aucun paiement ce mois-ci.</p>');
    },
    etudiants: function () {
      var l = etudiants().sort(function (a, b) { return b.retard - a.retard || ((a.prochaine || {}).date > (b.prochaine || {}).date ? 1 : -1); });
      return '<div class="barre"><h2>Étudiants : échéances trimestrielles</h2></div>' + (l.length ? '<div class="table-wrap"><table class="donnees"><thead><tr><th>Étudiant</th><th>Lit</th><th>Séjour</th><th class="num">Payé</th><th class="num">En retard</th><th>Prochaine échéance</th><th></th></tr></thead><tbody>' +
        l.map(function (x) {
          return '<tr><td><b>' + e(x.r.nom) + "</b><br><span class='petit'>" + e(x.r.telephone) + "</span></td><td>" + e(libLit(x.r.lit_id)) + "</td><td>" + fdate(x.r.debut) + " → " + fdate(x.r.fin) + "</td><td class='num'>" + usd(x.paye) + "</td><td class='num'>" +
            (x.retard > 0 ? "<span class='statut conflit'>" + usd(x.retard) + "</span>" : "<span class='statut confirmee'>À jour</span>") + "</td><td>" + (x.prochaine ? fdate(x.prochaine.date) + " · " + usd(x.prochaine.montant) : "—") + "</td>" +
            '<td><button class="btn btn-or btn-petit" data-act="encaisser" data-id="' + x.r.id + '">Encaisser</button> <a class="btn btn-wa btn-petit" target="_blank" rel="noopener" href="' + e(waLien(x.r.telephone, "Bonjour " + x.r.nom + ", petit rappel : " + (x.retard > 0 ? "un montant de " + usd(x.retard) + " est en retard" : "votre prochain trimestre (" + usd(x.prochaine && x.prochaine.montant) + ") est à payer le " + fdate(x.prochaine && x.prochaine.date)) + ". " + (D.reglages.instructions_paiement || "") + " Merci !")) + '">Rappel</a></td></tr>';
        }).join("") + "</tbody></table></div>" : '<p class="vide">Aucun étudiant en cours.</p>');
    },
    logement: function () {
      var types = D.tarifs.map(function (t) { return t.type; });
      return '<div class="barre"><h2>Tarifs</h2><button class="btn btn-or btn-petit" data-act="tarifs">Enregistrer les tarifs</button></div>' +
        '<p class="petit" style="margin-bottom:.6rem">Ces prix servent au calcul des demandes. Pensez à mettre les mêmes dans <code>src/donnees/site.json</code> (prix affichés sur le site).</p>' +
        '<div class="table-wrap" style="margin-bottom:2rem"><table class="donnees"><thead><tr><th>Type</th><th>Mois, 3 mois et + ($)</th><th>Mois, moins de 3 mois ($)</th><th>Trimestre ($)</th><th>Nuit ($)</th></tr></thead><tbody>' +
        D.tarifs.map(function (t) { return "<tr><td>" + e(t.type) + "</td>" + ["mois", "mois_court", "trimestre", "nuit"].map(function (k) { return '<td><input type="number" step="0.01" min="0" style="min-height:36px;width:7rem" data-tarif="' + e(t.type) + '" data-k="' + k + '" value="' + (t[k] == null ? "" : t[k]) + '"></td>'; }).join("") + "</tr>"; }).join("") +
        "</tbody></table></div>" +
        '<div class="barre"><h2>Maisons, chambres et lits</h2><button class="btn btn-or btn-petit" data-act="add-maison">+ Maison</button></div>' +
        '<p class="petit" style="margin-bottom:.6rem">Décochez « actif » pour cacher une maison, une chambre ou un lit des réservations. Une chambre individuelle louée entière = une chambre avec un seul lit.</p><div class="arbre">' +
        D.maisons.map(function (m) {
          return '<div class="maison"><div class="ligne"><b class="nom">' + e(m.nom) + "</b>" + actif("maisons", m) + '<button class="btn btn-ligne btn-petit" data-act="add-chambre" data-id="' + m.id + '">+ Chambre</button></div>' +
            D.chambres.filter(function (c) { return c.maison_id === m.id; }).map(function (c) {
              return '<div class="ch"><div class="ligne"><span class="nom">' + e(c.nom) + " <span class='pastille'>" + e(c.type) + "</span></span>" + actif("chambres", c) + '<button class="btn btn-ligne btn-petit" data-act="add-lit" data-id="' + c.id + '">+ Lit</button></div>' +
                D.lits.filter(function (l) { return l.chambre_id === c.id; }).map(function (l) { return '<div class="ligne petit" style="padding-left:1rem"><span class="nom">' + e(l.nom) + "</span>" + actif("lits", l) + "</div>"; }).join("") + "</div>";
            }).join("") + "</div>";
        }).join("") + "</div>";
      function actif(table, x) { return '<label class="ligne petit"><input type="checkbox" style="width:auto;min-height:0" data-actif="' + table + '" data-id="' + x.id + '"' + (x.actif ? " checked" : "") + "> actif</label>"; }
    },
    airbnb: function () {
      return '<div class="barre"><h2>Synchronisation Airbnb</h2><button class="btn btn-or btn-petit" data-act="add-source">+ Annonce Airbnb</button><button class="btn btn-ligne btn-petit" data-act="sync">Synchroniser maintenant</button></div>' +
        '<ol class="petit" style="padding-left:1.2rem;margin-bottom:1rem"><li>Dans Airbnb : Calendrier › Disponibilité › Synchroniser les calendriers › <b>Exporter</b> : copiez le lien et collez-le ici (« lien Airbnb »).</li><li>Puis <b>Importer</b> un calendrier dans Airbnb : collez le « lien à donner à Airbnb » ci-dessous.</li><li>La synchronisation se fait toute seule toutes les 30 minutes (Airbnb relit notre lien environ toutes les 2 à 3 heures).</li></ol>' +
        (D.sources.length ? '<div class="liste">' + D.sources.map(function (s) {
          var exp = CFG.url + "/functions/v1/ical?jeton=" + s.jeton_export;
          return '<article class="fiche"><header><b>' + e(s.nom) + "</b><span class='petit'>bloque : " + e(libLit(s.lit_id)) + "</span></header>" +
            '<div class="champ"><label>Lien à donner à Airbnb (export)</label><div class="lien-copie"><input readonly value="' + e(exp) + '"><button class="btn btn-ligne btn-petit" data-act="copier" data-val="' + e(exp) + '">Copier</button></div></div>' +
            '<div class="champ"><label for="src-' + s.id + '">Lien Airbnb (import)</label><div class="lien-copie"><input id="src-' + s.id + '" value="' + e(s.url_import || "") + '" placeholder="https://www.airbnb.com/calendar/ical/…"><button class="btn btn-or btn-petit" data-act="save-source" data-id="' + s.id + '">Enregistrer</button></div></div>' +
            "<p class='petit'>Dernière synchro : " + (s.derniere_synchro ? new Date(s.derniere_synchro).toLocaleString("fr-FR") + " · " + e(s.dernier_resultat || "") : "jamais") + "</p></article>";
        }).join("") + "</div>" : '<p class="vide">Aucune annonce Airbnb reliée. Ajoutez-en une et choisissez le lit qu\'elle représente.</p>');
    },
    reglages: function () {
      return '<div class="barre"><h2>Message de paiement</h2></div><form id="form-reglages" class="calc" style="max-width:46rem">' +
        '<div class="champ"><label for="rg-fr">Instructions de paiement (français)</label><textarea id="rg-fr" name="instructions_paiement" rows="4">' + e(D.reglages.instructions_paiement || "") + "</textarea><small>Ajoutées au message WhatsApp quand vous approuvez une demande. Indiquez vos numéros M-Pesa, Orange Money et Airtel Money.</small></div>" +
        '<div class="champ"><label for="rg-en">Payment instructions (English)</label><textarea id="rg-en" name="instructions_paiement_en" rows="4">' + e(D.reglages.instructions_paiement_en || "") + "</textarea></div>" +
        '<button class="btn btn-or" type="submit">Enregistrer</button></form>' +
        '<div class="barre" style="margin-top:2rem"><h2>Sauvegarde</h2></div><p class="petit" style="margin-bottom:.6rem">Téléchargez vos données en CSV (ouvrable dans Excel). Faites-le une fois par mois.</p>' +
        '<div class="actions"><button class="btn btn-ligne" data-act="csv-resas">Réservations (CSV)</button><button class="btn btn-ligne" data-act="csv-paiements">Paiements (CSV)</button></div>';
    }
  };

  var afficher = function () {
    $$(".onglets button").forEach(function (b) { b.setAttribute("aria-selected", String(b.getAttribute("data-onglet") === onglet)); });
    $("#vue").innerHTML = VUES[onglet]();
    var m = $("#mois"); if (m) m.addEventListener("change", function () { if (m.value) { moisVue = m.value; afficher(); } });
    var f = $("#filtre"); if (f) { f.value = VUES._filtre; f.addEventListener("change", function () { VUES._filtre = f.value; afficher(); }); }
    var c = $("#cherche"); if (c) c.addEventListener("input", function () { VUES._cherche = c.value; var pos = c.selectionStart; afficher(); var n = $("#cherche"); n.focus(); n.setSelectionRange(pos, pos); });
    var fr = $("#form-reglages"); if (fr) fr.addEventListener("submit", function (ev) {
      ev.preventDefault();
      sb.from("reglages").upsert([{ cle: "instructions_paiement", valeur: fr.instructions_paiement.value }, { cle: "instructions_paiement_en", valeur: fr.instructions_paiement_en.value }])
        .then(function (r) { if (r.error) dire(expliquer(r.error), true); else { dire("Réglages enregistrés"); charger(); } });
    });
  };

  var csv = function (nom, lignes) {
    var txt = "﻿" + lignes.map(function (l) { return l.map(function (v) { v = v == null ? "" : String(v); return /[";\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; }).join(";"); }).join("\r\n");
    var a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([txt], { type: "text/csv;charset=utf-8" }));
    a.download = nom + "-" + auj + ".csv"; document.body.appendChild(a); a.click(); a.remove();
  };

  /* ---------- Clics ---------- */
  document.addEventListener("click", function (ev) {
    var t = ev.target.closest("[data-onglet]"); if (t) { onglet = t.getAttribute("data-onglet"); afficher(); return; }
    var ligne = ev.target.closest("tr.clic[data-id], .cal td[data-id]"); if (ligne) { var r0 = trouver(ligne.getAttribute("data-id")); if (r0) montrerResa(r0); return; }
    var b = ev.target.closest("[data-act]"); if (!b) return;
    var act = b.getAttribute("data-act"), id = b.getAttribute("data-id"), r = id && trouver(id);
    if (act === "approuver") approuver(r);
    else if (act === "refuser") refuser(r);
    else if (act === "encaisser") encaisser(r);
    else if (act === "editer") { modale.close(); editer(r); }
    else if (act === "nouvelle") editer(null);
    else if (act === "csv-resas") csv("reservations", [["ref", "statut", "source", "client", "formule", "lit", "arrivee", "depart", "nom", "telephone", "email", "universite", "montant", "paye", "message", "notes", "recue_le"]]
      .concat(D.resas.map(function (x) { return [ref(x.id), x.statut, x.source, x.client, x.formule, libLit(x.lit_id), x.debut, x.fin, x.nom, x.telephone, x.email, x.universite, x.montant, payeTotal(x.id), x.message, x.notes, x.created_at]; })));
    else if (act === "csv-paiements") csv("paiements", [["date", "reservation", "nom", "montant", "moyen", "reference", "notes"]]
      .concat(D.paiements.map(function (p) { var x = trouver(p.reservation_id); return [p.date_paiement, x ? ref(x.id) : "", x ? x.nom : "", p.montant, METHODES[p.methode], p.reference, p.notes]; })));
    else if (act === "tarifs") {
      var maj = D.tarifs.map(function (tf) { var o = { type: tf.type }; ["mois", "mois_court", "trimestre", "nuit"].forEach(function (k) { var v = $('[data-tarif="' + tf.type + '"][data-k="' + k + '"]').value; o[k] = v === "" ? (k === "nuit" || k === "mois_court" ? null : 0) : +v; }); return o; });
      sb.from("tarifs").upsert(maj).then(function (res) { if (res.error) dire(expliquer(res.error), true); else { dire("Tarifs enregistrés"); charger().then(afficher); } });
    }
    else if (act === "add-maison") ouvrir("<h2>Nouvelle maison</h2>" + champ("Nom", "nom", "", "text", " required"), function (v) { return inserer("maisons", { nom: v.nom, ordre: D.maisons.length + 1 }); });
    else if (act === "add-chambre") ouvrir("<h2>Nouvelle chambre</h2>" + champ("Nom", "nom", "", "text", " required") + choix("Type (tarif)", "type", D.tarifs.map(function (x) { return [x.type, x.type]; }), "dortoir"),
      function (v) { return inserer("chambres", { maison_id: +id, nom: v.nom, type: v.type, ordre: D.chambres.length + 1 }); });
    else if (act === "add-lit") ouvrir("<h2>Nouveau lit</h2>" + champ("Nom", "nom", "Lit " + (D.lits.filter(function (l) { return l.chambre_id === +id; }).length + 1), "text", " required"),
      function (v) { return inserer("lits", { chambre_id: +id, nom: v.nom, ordre: D.lits.length + 1 }); });
    else if (act === "add-source") ouvrir("<h2>Relier une annonce Airbnb</h2>" + champ("Nom de l'annonce", "nom", "Airbnb", "text", " required") + choix("Lit représenté par cette annonce", "lit", litsActifs().map(function (l) { return [l.id, libLit(l.id)]; })) + champ("Lien Airbnb (export iCal)", "url", "", "url"),
      function (v) { return inserer("sources_ical", { nom: v.nom, lit_id: +v.lit, url_import: v.url || null }); });
    else if (act === "save-source") sb.from("sources_ical").update({ url_import: $("#src-" + id).value.trim() || null }).eq("id", +id).then(function (res) { if (res.error) dire(expliquer(res.error), true); else { dire("Lien enregistré"); charger().then(afficher); } });
    else if (act === "sync") { dire("Synchronisation…"); sb.auth.getSession().then(function (r) { var t = r.data.session ? r.data.session.access_token : ""; return fetch(CFG.url + "/functions/v1/ical?sync=1", { method: "POST", headers: { Authorization: "Bearer " + t } }); }).then(function (x) { if (!x.ok) throw new Error("HTTP " + x.status); return x.json(); })
      .then(function (j) { dire(Object.values(j).join(" · ") || "Aucune annonce à synchroniser"); return charger().then(afficher); }).catch(function (er) { dire("Échec : " + er.message, true); }); }
    else if (act === "copier") { navigator.clipboard.writeText(b.getAttribute("data-val")).then(function () { dire("Lien copié"); }, function () { dire("Copiez le lien à la main", true); }); }
  });
  document.addEventListener("change", function (ev) {
    var c = ev.target.closest("[data-actif]"); if (!c) return;
    sb.from(c.getAttribute("data-actif")).update({ actif: c.checked }).eq("id", +c.getAttribute("data-id")).then(function (res) {
      if (res.error) { dire(expliquer(res.error), true); c.checked = !c.checked; } else { dire("Enregistré"); charger(); }
    });
  });
  var inserer = function (table, ligne) {
    return sb.from(table).insert(ligne).then(function (res) { if (res.error) { dire(expliquer(res.error), true); return false; } dire("Ajouté"); return charger().then(afficher); });
  };
  var montrerResa = function (r) {
    mform.innerHTML = fiche(r, true) + '<menu><button class="btn btn-ligne" value="fermer" type="submit">Fermer</button></menu>';
    mform.onsubmit = null; modale.showModal();
  };

  /* ---------- Connexion ---------- */
  var demarrer = function (session) {
    $("#ecran-connexion").hidden = !!session; $("#app").hidden = !session; $("#deconnexion").hidden = !session;
    $("#qui").textContent = session ? session.user.email : "";
    if (session) charger().then(afficher).catch(function (err) { dire(expliquer(err), true); });
  };
  $("#form-connexion").addEventListener("submit", function (ev) {
    ev.preventDefault(); var er = $("#cx-erreur"); er.hidden = true;
    sb.auth.signInWithPassword({ email: $("#cx-email").value.trim(), password: $("#cx-mdp").value }).then(function (res) {
      if (res.error) { er.textContent = "Connexion impossible : e-mail ou mot de passe incorrect."; er.hidden = false; }
    });
  });
  $("#deconnexion").addEventListener("click", function () { sb.auth.signOut(); });
  var derniere = null;  // INITIAL_SESSION, SIGNED_IN, SIGNED_OUT… ; on ne recharge que si l'utilisateur change
  sb.auth.onAuthStateChange(function (_evt, session) {
    var u = session ? session.user.id : null; if (u === derniere && _evt !== "INITIAL_SESSION") return; derniere = u; demarrer(session);
  });
})();
