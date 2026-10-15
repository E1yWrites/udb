<script lang="ts" module>
  // Authored glyphs on a 20px grid, 1.5px stroke, round joins. currentColor only.
  const PATHS = {
    plus: 'M10 4v12M4 10h12',
    check: 'M4.5 10.5l3.5 3.5 7.5-8',
    alert: 'M10 3.5l7 12.5H3L10 3.5zM10 8.5v3.5M10 14.2v.1',
    unverified: 'M10 3.5a6.5 6.5 0 1 1 0 13 6.5 6.5 0 0 1 0-13zM10 7v3.5M10 13v.1',
    blocked: 'M10 3.5a6.5 6.5 0 1 1 0 13 6.5 6.5 0 0 1 0-13zM5.4 14.6l9.2-9.2',
    unplug: 'M7 3.5v3M13 3.5v3M5.5 6.5h9v3a4.5 4.5 0 0 1-9 0v-3zM10 14v2.5M3.5 3.5l13 13',
    wired: 'M7 3.5v3M13 3.5v3M5.5 6.5h9v3a4.5 4.5 0 0 1-9 0v-3zM10 14v2.5',
    dongle: 'M7.5 3.5h5v6h-5zM6 9.5h8v7H6zM8.5 12.5h3',
    bluetooth: 'M6 6.5l8 7-4 3.5v-14l4 3.5-8 7',
    copy: 'M7.5 7.5h8v9h-8zM4.5 13V3.5h8',
    external: 'M11 3.5h5.5V9M16.5 3.5L9.5 10.5M14 12v4.5H3.5V6H8',
    busy: 'M10 3.5a6.5 6.5 0 1 1 0 13 6.5 6.5 0 0 1 0-13zM10 6.5V10l2.5 2',
  } as const;
  export type IconName = keyof typeof PATHS;
</script>

<script lang="ts">
  let { name, size = 16, label }: { name: IconName; size?: number; label?: string } = $props();
</script>

<svg
  width={size}
  height={size}
  viewBox="0 0 20 20"
  fill="none"
  stroke="currentColor"
  stroke-width="1.5"
  stroke-linecap="round"
  stroke-linejoin="round"
  role={label ? 'img' : undefined}
  aria-label={label}
  aria-hidden={label ? undefined : 'true'}
>
  <path d={PATHS[name]} />
</svg>

<style>
  svg {
    flex: none;
  }
</style>
