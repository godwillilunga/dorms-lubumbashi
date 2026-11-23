/* Calendrier des lits libres (page Chambres). Ne reçoit aucune donnée personnelle :
   seulement la liste des lits et les périodes occupées. */
(function () {
  "use strict";
  var D = window.DORMS, $ = D.$, T = D.t;
  var bloc = $("[data-dispo]"); if (!bloc) return;
  var etat = $("[data-etat]", bloc), wrap = $(".cal-wrap", bloc), titre = $(".mois", bloc);
  var mois = new Date(); mois.setDate(1);
  var nomsMois = D.lang === "fr"
    ? ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"]
    : ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

  var afficher = function () {
    titre.textContent = nomsMois[mois.getMonth()] + " " + mois.getFullYear();
    if (!D.enLigne) { etat.textContent = T.dispo_hors_ligne; etat.hidden = false; wrap.hidden = true; return; }
    var debut = D.iso(mois), finD = new Date(mois.getFullYear(), mois.getMonth() + 1, 1), fin = D.iso(finD);
    var nbJours = new Date(mois.getFullYear(), mois.getMonth() + 1, 0).getDate();
    etat.textContent = "…"; etat.hidden = false;
    D.supabase("calendrier_public", { p_debut: debut, p_fin: fin }).then(function (r) {
      var lits = (r && r.lits) || [], occ = (r && r.occupations) || [], auj = D.iso(new Date());
      var h = "<table class='cal'><thead><tr><th scope='col'></th>";
      for (var j = 1; j <= nbJours; j++) {
        var jd = new Date(mois.getFullYear(), mois.getMonth(), j).getDay();
        h += "<th scope='col'" + (jd === 0 || jd === 6 ? " class='we'" : "") + ">" + j + "</th>";
      }
      h += "</tr></thead><tbody>";
      lits.forEach(function (l) {
        h += "<tr><th scope='row'>" + String(l.libelle).replace(/</g, "&lt;") + "</th>";
        for (var j = 1; j <= nbJours; j++) {
          var jour = D.iso(new Date(mois.getFullYear(), mois.getMonth(), j));
          var pris = occ.some(function (o) { return o.lit_id === l.id && o.debut <= jour && jour < o.fin; });
          h += "<td class='" + (pris ? "p" : "l") + (jour < auj ? " passe" : "") + "' title='" + jour + " · " + (pris ? T.dispo_pris : T.dispo_libre) + "'></td>";
        }
        h += "</tr>";
      });
      wrap.innerHTML = h + "</tbody></table>"; wrap.hidden = !lits.length; etat.hidden = !!lits.length;
      if (!lits.length) etat.textContent = T.dispo_hors_ligne;
    }).catch(function () { etat.textContent = T.dispo_erreur; wrap.hidden = true; });
  };
  bloc.querySelectorAll("[data-mois]").forEach(function (b) {
    b.addEventListener("click", function () { mois.setMonth(mois.getMonth() + +b.getAttribute("data-mois")); afficher(); });
  });
  afficher();
})();
