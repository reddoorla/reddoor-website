export async function checkVimeoVideo(videoId: string): Promise<boolean> {
  if (!videoId) return false;

  try {
    const response = await fetch(
      `https://vimeo.com/api/oembed.json?url=https://vimeo.com/${videoId}`,
      {
        headers: {
          "User-Agent": "SvelteKit App",
        },
      },
    );

    return response.ok;
  } catch (error) {
    console.error(`Failed to check Vimeo video ${videoId}:`, error);
    return false;
  }
}
