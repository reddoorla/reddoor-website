<script lang="ts">
  import { type Writable } from "svelte/store";


  
      export let trigger:Writable<boolean>;

     
      export let style ="";
      export let transitionDuration = 2000;

  </script>
  
  
     
  
          <div class="transition ease-fast-slow {!$trigger? "opacity-100 translate-y-0 delay-1000":"opacity-0 translate-y-[50%]"} {$$props.class || ''}" style="transition-duration:{transitionDuration}ms; {style}">
              <slot />
          </div>
  