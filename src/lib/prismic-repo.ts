import config from "../../slicemachine.config.json";

/**
 * The project's Prismic repository name, importable from client code (the
 * preview toolbar in the root layout needs it). `$lib/prismicio` is
 * server-only: it decides which documents a request may see.
 */
export const repositoryName: string = config.repositoryName;
