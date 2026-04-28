<script lang="ts">
  let {
    height = "60px",
    color = "transparent",
  }: { height?: string; color?: string } = $props();
  const bgColor = $derived(color === "dark" ? "#424B5A;" : color);
</script>

<div style="height:{height}; background-color:{bgColor}"></div>
