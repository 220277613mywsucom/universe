// Curated list of UWC school email domains.
// Add more here as needed without touching app code.
export const UWC_DOMAINS: Record<string, string> = {
  "myuwc.ac.za": "University of the Western Cape (Student)",
  "uwc.ac.za": "University of the Western Cape (Staff)",
  "uwcad.it": "UWC Adriatic",
  "uwc-usa.org": "UWC-USA",
  "uwcusa.org": "UWC-USA",
  "pearsoncollege.ca": "Pearson College UWC",
  "uwcatlantic.org": "UWC Atlantic",
  "atlanticcollege.org": "UWC Atlantic",
  "uwcsea.edu.sg": "UWC South East Asia",
  "uwcmaastricht.nl": "UWC Maastricht",
  "uwcmahindracollege.org": "UWC Mahindra College",
  "uwcrcn.no": "UWC Red Cross Nordic",
  "uwccr.com": "UWC Costa Rica",
  "uwcsa.org.za": "Waterford Kamhlaba UWC",
  "uwcdilijan.org": "UWC Dilijan",
  "uwcchina.org": "UWC Changshu China",
  "uwcrobertbosch.de": "UWC Robert Bosch College",
  "uwcthailand.ac.th": "UWC Thailand",
  "uwcisak.jp": "UWC ISAK Japan",
  "uwcmostar.ba": "UWC Mostar",
  "uwcea.org": "UWC East Africa",
  "uwc.net": "UWC International",
  "uwc.org": "UWC International",
};

export interface UwcCheck {
  ok: boolean;
  school?: string;
  domain?: string;
}

export function checkUwcEmail(email: string): UwcCheck {
  const at = email.toLowerCase().trim();
  const domain = at.split("@")[1];
  if (!domain) return { ok: false };
  const school = UWC_DOMAINS[domain];
  if (school) return { ok: true, school, domain };
  return { ok: false, domain };
}
