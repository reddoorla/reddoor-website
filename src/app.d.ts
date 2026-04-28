// See https://kit.svelte.dev/docs/types#app
// for information about these interfaces
declare global {
  namespace App {
    interface Locals {
      prismic: {
        client: PrismicClient;
        previewData: { ref: string } | null;
      };
    }
  }
}

export {};
