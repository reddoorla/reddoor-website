// Creates the four contact fields the /digital question set writes to, and
// prints their ids. Idempotent: a field whose name already exists is reused,
// never duplicated, so a re-run after a partial failure is safe.
//
//   node --env-file=.env.local scripts/crm/create-digital-fields.mjs --dry-run
//   node --env-file=.env.local scripts/crm/create-digital-fields.mjs
//
// Needs CRM_CLAUDE_TOKEN: the site's runtime token is not authorised for
// /locations/{loc}/customFields/*.
const LOCATION = "nluRF7uH234gl3PdTBVD";
const DRY_RUN = process.argv.includes("--dry-run");
const token = process.env.CRM_CLAUDE_TOKEN;
if (!token) {
  console.error("✗ CRM_CLAUDE_TOKEN is not set (use --env-file=.env.local)");
  process.exit(1);
}
const H = {
  Authorization: `Bearer ${token}`,
  Version: "2021-07-28",
  "Content-Type": "application/json",
};

// dataType mirrors the medtech counterpart of each question, read back
// 2026-09-17: multi-select answers are CHECKBOX, single-select are RADIO.
const WANT = [
  {
    key: "needs",
    name: "Digital Inquiry - Needs",
    dataType: "CHECKBOX",
    options: [
      "A new website",
      "Redesigning our current website",
      "Showing up in Google and AI search",
      "Keeping our site updated",
      "Not sure yet",
    ],
  },
  {
    key: "goal",
    name: "Digital Inquiry - Website Goal",
    dataType: "RADIO",
    options: [
      "Bring in leads and calls",
      "Sell online",
      "Make us look credible",
      "Support hiring",
      "Other",
    ],
  },
  {
    key: "stakeholders",
    name: "Digital Inquiry - Stakeholders",
    dataType: "RADIO",
    options: [
      "Just myself",
      "My business partner",
      "My department head",
      "Our board of directors",
      "Other",
    ],
  },
  {
    key: "budget",
    name: "Digital Inquiry - Budget Range",
    dataType: "RADIO",
    // PLACEHOLDER RANGES — Tim sets the real ones. Changing them later is a
    // rename on this field followed by the matching edit in questions.ts.
    options: ["Under $5,000", "$5,000 - $10,000", "$10,000 - $25,000", "$25,000+", "Not sure yet"],
  },
];

const call = async (path, init) => {
  const r = await fetch(`https://services.leadconnectorhq.com${path}`, { headers: H, ...init });
  const body = await r.json().catch(() => ({}));
  if (!r.ok)
    throw new Error(
      `${init?.method ?? "GET"} ${path} → ${r.status} ${JSON.stringify(body).slice(0, 300)}`,
    );
  return body;
};

const existing = await call(`/locations/${LOCATION}/customFields?model=contact`);
const byName = new Map(
  (existing.customFields ?? []).map((f) => [String(f.name).trim().toLowerCase(), f]),
);

const out = {};
for (const want of WANT) {
  const found = byName.get(want.name.toLowerCase());
  if (found) {
    console.log(`= ${want.name} already exists (${found.id})`);
    out[want.key] = found.id;
    continue;
  }
  if (DRY_RUN) {
    console.log(`+ would create ${want.name} (${want.dataType}, ${want.options.length} options)`);
    continue;
  }
  const created = await call(`/locations/${LOCATION}/customFields`, {
    method: "POST",
    body: JSON.stringify({
      name: want.name,
      dataType: want.dataType,
      model: "contact",
      // Undocumented but real — see the 2026-08-24 survey-copy findings. The
      // documented DTO has no options key, and the {key,label} shape 400s.
      options: want.options,
    }),
  });
  const id = created.customField?.id;
  if (!id) throw new Error(`created ${want.name} but no id came back`);
  console.log(`+ created ${want.name} (${id})`);
  out[want.key] = id;
}

// Read each one back BY ID. The list endpoint lags a write by 1-2s and a
// single read of it looks exactly like a silent no-op.
console.log("\nread-back:");
for (const [key, id] of Object.entries(out)) {
  const { customField: f } = await call(`/locations/${LOCATION}/customFields/${id}`);
  console.log(
    `  ${key.padEnd(13)} ${id}  ${f.dataType.padEnd(9)} ${(f.picklistOptions ?? []).length} options  "${f.name}"`,
  );
}
console.log("\nPaste into src/lib/ghl/questions.ts:\n");
console.log(
  `const DIGITAL_FIELDS = {\n${Object.entries(out)
    .map(([k, v]) => `  ${k}: "${v}",`)
    .join("\n")}\n} as const;`,
);
