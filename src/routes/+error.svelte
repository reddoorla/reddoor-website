<script lang="ts">
  import { page } from "$app/state";

  const headline = $derived(page.status === 404 ? "Page not found" : "Something went wrong");
  const message = $derived(
    page.status === 404
      ? "The page you're looking for doesn't exist or has moved."
      : (page.error?.message ?? "An unexpected error occurred. Please try again."),
  );
</script>

<svelte:head>
  <meta name="robots" content="noindex" />
</svelte:head>

<section
  class="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-6 py-32 text-center text-black"
>
  <h2>Error {page.status}</h2>
  <h1>{headline}</h1>
  <p class="max-w-150">{message}</p>
  <a href="/" class="underline">Back to home</a>
</section>
