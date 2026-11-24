/**
 * What a crawler is for, by the name it reports in robots.txt. The class
 * decides what a block costs the reader:
 *   search     a search engine's index. Blocking it hides the site from search.
 *   retrieval  an AI assistant fetching pages to answer a question.
 *   training   a crawler collecting pages for model training. Nothing a visitor
 *              or a searcher sees depends on it.
 */
export type CrawlerClass = "search" | "retrieval" | "training";

const SEARCH = new Set(["Googlebot", "Bingbot"]);
const RETRIEVAL = new Set([
  "OAI-SearchBot",
  "ChatGPT-User",
  "PerplexityBot",
  "Perplexity-User",
  "Claude-SearchBot",
  "Claude-User",
]);

export function crawlerClass(name: string): CrawlerClass {
  if (SEARCH.has(name)) return "search";
  if (RETRIEVAL.has(name)) return "retrieval";
  return "training";
}
