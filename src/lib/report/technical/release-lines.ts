/**
 * Server and runtime release lines, with the year each began and the date its
 * makers stopped standard support. Read at render time, against the date the
 * page is rendered, so a line that ages out between two reads of the same
 * report is reported as it stands that day (TEC-16).
 *
 * WHAT THIS CAN SAY, AND WHAT IT CANNOT. A server header names a release LINE,
 * not a patch level: a distribution backports security fixes into the version
 * it shipped, so "Apache 2.4.18 (Ubuntu)" says the machine runs Ubuntu's 2016
 * line, not that it is missing a particular fix. The page says how old the
 * line is and whether its makers still support it, and never that the site can
 * be broken into.
 *
 * NEVER PRINTED: the version string itself. The legal lens (LGL-05) rules
 * that out, and the wording "a 2016 release line" carries everything a reader
 * needs. `match` reads the raw header; `line` is what the page prints.
 *
 * Small on purpose. A row nobody can vouch for is worse than a missing row:
 * the page then says nothing about age, which is true. Each date is the
 * vendor's published end of standard support.
 */
export type ReleaseLine = {
  /** Matched against the raw `server` or `x-powered-by` header. */
  match: RegExp;
  /** What the page calls it. No version numbers. */
  line: string;
  /** The year the line was released. */
  released: number;
  /** ISO date standard support ended or ends. */
  supportEnds: string;
};

export const RELEASE_LINES: ReleaseLine[] = [
  // Ubuntu LTS, identified by the Apache build each release shipped.
  {
    match: /Apache\/2\.4\.7 \(Ubuntu\)/,
    line: "a 2014 long-term release line of Ubuntu",
    released: 2014,
    supportEnds: "2019-04-30",
  },
  {
    match: /Apache\/2\.4\.18 \(Ubuntu\)/,
    line: "a 2016 long-term release line of Ubuntu",
    released: 2016,
    supportEnds: "2021-04-30",
  },
  {
    match: /Apache\/2\.4\.29 \(Ubuntu\)/,
    line: "a 2018 long-term release line of Ubuntu",
    released: 2018,
    supportEnds: "2023-05-31",
  },
  {
    match: /Apache\/2\.4\.41 \(Ubuntu\)/,
    line: "a 2020 long-term release line of Ubuntu",
    released: 2020,
    supportEnds: "2025-05-31",
  },
  {
    match: /Apache\/2\.4\.52 \(Ubuntu\)/,
    line: "a 2022 long-term release line of Ubuntu",
    released: 2022,
    supportEnds: "2027-06-30",
  },
  {
    match: /Apache\/2\.4\.6 \(CentOS\)/,
    line: "a 2014 release line of CentOS",
    released: 2014,
    supportEnds: "2024-06-30",
  },
  // PHP, from x-powered-by. The branch is the line.
  {
    match: /PHP\/5\./,
    line: "a PHP release line from 2014 or earlier",
    released: 2014,
    supportEnds: "2018-12-31",
  },
  {
    match: /PHP\/7\.0\./,
    line: "a 2015 PHP release line",
    released: 2015,
    supportEnds: "2019-01-10",
  },
  {
    match: /PHP\/7\.1\./,
    line: "a 2016 PHP release line",
    released: 2016,
    supportEnds: "2019-12-01",
  },
  {
    match: /PHP\/7\.2\./,
    line: "a 2017 PHP release line",
    released: 2017,
    supportEnds: "2020-11-30",
  },
  {
    match: /PHP\/7\.3\./,
    line: "a 2018 PHP release line",
    released: 2018,
    supportEnds: "2021-12-06",
  },
  {
    match: /PHP\/7\.4\./,
    line: "a 2019 PHP release line",
    released: 2019,
    supportEnds: "2022-11-28",
  },
  {
    match: /PHP\/8\.0\./,
    line: "a 2020 PHP release line",
    released: 2020,
    supportEnds: "2023-11-26",
  },
  {
    match: /PHP\/8\.1\./,
    line: "a 2021 PHP release line",
    released: 2021,
    supportEnds: "2025-12-31",
  },
];

export type ReleaseLineReading = {
  /** Which header it was read from. */
  header: "server" | "x-powered-by";
  line: string;
  released: number;
  supportEnds: string;
  /** Standard support has ended as of the render date. */
  unsupported: boolean;
};

/** The release lines a site's headers name, judged against `today`. */
export function readReleaseLines(
  headers: Record<string, string>,
  today: Date,
): ReleaseLineReading[] {
  const out: ReleaseLineReading[] = [];
  for (const header of ["server", "x-powered-by"] as const) {
    const value = headers[header];
    if (!value) continue;
    const hit = RELEASE_LINES.find((r) => r.match.test(value));
    if (!hit) continue;
    out.push({
      header,
      line: hit.line,
      released: hit.released,
      supportEnds: hit.supportEnds,
      unsupported: new Date(`${hit.supportEnds}T23:59:59Z`).getTime() < today.getTime(),
    });
  }
  return out;
}
