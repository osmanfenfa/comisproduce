// Sierra Leone districts (2017 boundaries). Must match beyen/app/core/locations.py
export const DISTRICTS = [
  "Bo", "Bombali", "Bonthe", "Falaba", "Kailahun", "Kambia", "Karene", "Kenema",
  "Koinadugu", "Kono", "Moyamba", "Port Loko", "Pujehun", "Tonkolili",
  "Western Area Rural", "Western Area Urban",
];

export const sellerLocation = (s) =>
  [s?.section, s?.chiefdom, s?.district].filter(Boolean).join(", ");
