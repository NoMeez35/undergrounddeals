// Partagé par l'appli et le Worker. Pays : codes ISO 3166-1 alpha-2, ceux que
// Steam utilise pour les profils et les prix (paramètre `cc`). Les noms sont
// fournis par le navigateur dans la langue de l'interface (Intl.DisplayNames).
export const PAYS = `
  AD AE AF AG AI AL AM AO AQ AR AS AT AU AW AX AZ
  BA BB BD BE BF BG BH BI BJ BL BM BN BO BQ BR BS BT BV BW BY BZ
  CA CC CD CF CG CH CI CK CL CM CN CO CR CU CV CW CX CY CZ
  DE DJ DK DM DO DZ
  EC EE EG EH ER ES ET
  FI FJ FK FM FO FR
  GA GB GD GE GF GG GH GI GL GM GN GP GQ GR GS GT GU GW GY
  HK HM HN HR HT HU
  ID IE IL IM IN IO IQ IR IS IT
  JE JM JO JP
  KE KG KH KI KM KN KP KR KW KY KZ
  LA LB LC LI LK LR LS LT LU LV LY
  MA MC MD ME MF MG MH MK ML MM MN MO MP MQ MR MS MT MU MV MW MX MY MZ
  NA NC NE NF NG NI NL NO NP NR NU NZ
  OM
  PA PE PF PG PH PK PL PM PN PR PS PT PW PY
  QA
  RE RO RS RU RW
  SA SB SC SD SE SG SH SI SJ SK SL SM SN SO SR SS ST SV SX SY SZ
  TC TD TF TG TH TJ TK TL TM TN TO TR TT TV TW TZ
  UA UG UM US UY UZ
  VA VC VE VG VI VN VU
  WF WS
  YE YT
  ZA ZM ZW
`.trim().split(/\s+/);

const ENSEMBLE_PAYS = new Set(PAYS);

// Renvoie le code (en majuscules) si c'est un pays connu, sinon null.
export function lirePays(texte) {
  if (typeof texte !== "string") return null;
  const code = texte.toUpperCase();
  return ENSEMBLE_PAYS.has(code) ? code : null;
}

// Pays du profil Steam s'il est public, sinon celui déduit des langues du
// navigateur (« fr-BE » → BE, « fr » → FR), sinon null : l'utilisateur choisit.
export function proposerPays(paysProfil, languesNavigateur = []) {
  if (lirePays(paysProfil)) return lirePays(paysProfil);
  for (const etiquette of languesNavigateur) {
    try {
      const pays = lirePays(new Intl.Locale(etiquette).maximize().region);
      if (pays) return pays;
    } catch {
      // Étiquette de langue invalide : on passe à la suivante.
    }
  }
  return null;
}
