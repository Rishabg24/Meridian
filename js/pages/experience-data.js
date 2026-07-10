/**
 * Chart geometry for the constellation.
 *
 * This file holds only what the *chart* needs: which band an entry sits in, what
 * year it plots at, and which other entries it caused. The entries' actual prose
 * lives in experience.html, inside the archive index, which is the accessible
 * source of truth. The plaque reads from there. Nothing is duplicated.
 *
 * `year: null` means the CV gives no date. Those entries appear in the archive
 * but are not plotted, because a star on a year axis asserts a year.
 */

export const BANDS = [
  { id: "education",   label: "Education" },
  { id: "position",    label: "Positions" },
  { id: "funding",     label: "Funding" },
  { id: "award",       label: "Awards" },
  { id: "publication", label: "Publications" },
  { id: "recognition", label: "Recognition" },
];

export const YEAR_RANGE = [2006, 2028];

/**
 * `links` are causal threads, not citations: the grant that funded the paper,
 * the paper that drew the coverage. Hovering a node lights its whole thread.
 */
export const ENTRIES = [
  { id: "phd",              band: "education",   year: 2008, links: ["aaas"] },
  { id: "ucdavis",          band: "education",   year: 2009, links: ["coal2011"] },

  { id: "ucsf",             band: "position",    year: 2016, links: ["eapbi", "c3ai", "jhu", "gates", "lancet2020", "bmj2022"] },
  { id: "nasem-committee",  band: "position",    year: 2021, links: ["nasem2023"] },
  { id: "ala",              band: "position",    year: null, links: [] },

  { id: "gates",            band: "funding",     year: 2025, links: ["plos2021"] },
  { id: "jhu",              band: "funding",     year: 2025, links: [] },
  { id: "c3ai",             band: "funding",     year: 2022, links: [] },
  { id: "eapbi",            band: "funding",     year: 2018, links: ["plos2021"] },

  { id: "teaching",         band: "award",       year: 2023, links: [] },
  { id: "simulation",       band: "award",       year: 2019, links: [] },
  { id: "basel",            band: "award",       year: 2013, links: [] },
  { id: "aaas",             band: "award",       year: 2007, links: [] },

  { id: "plos2021",         band: "publication", year: 2021, links: ["media"] },
  { id: "bmj2022",          band: "publication", year: 2022, links: [] },
  { id: "nasem2023",        band: "publication", year: 2023, links: [] },
  { id: "lancet2020",       band: "publication", year: 2020, links: [] },
  { id: "ehp2015",          band: "publication", year: 2015, links: [] },
  { id: "lung2015",         band: "publication", year: 2015, links: [] },
  { id: "coal2011",         band: "publication", year: 2011, links: ["media"] },

  { id: "media",            band: "recognition", year: 2021, links: [] },
  { id: "isee",             band: "recognition", year: null, links: [] },
  { id: "fph",              band: "recognition", year: null, links: [] },
];

/** Both directions of every declared thread, so a hover lights the whole chain. */
export function buildAdjacency() {
  const adjacency = new Map(ENTRIES.map((e) => [e.id, new Set()]));

  for (const entry of ENTRIES) {
    for (const target of entry.links) {
      if (!adjacency.has(target)) continue;
      adjacency.get(entry.id).add(target);
      adjacency.get(target).add(entry.id);
    }
  }

  return adjacency;
}
