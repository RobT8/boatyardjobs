import type { SourceAdapter } from "../types";

/**
 * Template adapter. Copy this file per source (mtam.ts, mainemarinetrades.ts, ...),
 * point it at the source's listing page, and implement the parse.
 *
 * Most association boards are simple server-rendered HTML — parse with a
 * tolerant regex or bring in cheerio when structure warrants it. Before writing
 * a parser, check whether the site exposes an RSS feed or JSON endpoint; several
 * association career centers do.
 */
const exampleAssociation: SourceAdapter = {
  id: "example-association",
  name: "Example State Marine Trades Association",
  url: "https://example.org/jobs",

  async fetchJobs() {
    // const html = await politeFetch(this.url);
    // ...parse listings out of html...
    return [];
  },
};

export default exampleAssociation;
