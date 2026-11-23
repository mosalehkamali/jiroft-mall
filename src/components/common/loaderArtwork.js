import storeConfig from "base/store.config";

// Vector geometry and keyframe timing from loading.json (180 frames at 60 fps).
// Inline styles let the first document paint use the same artwork as navigation.
const logo = storeConfig.brand.logo.replaceAll("&", "&amp;").replaceAll('"', "&quot;").replaceAll("<", "&lt;");
export const loaderArtwork = `
<style>
  .store-loader-art {
    display: block;
    direction: ltr;
    width: min(216px, 72vw);
    height: auto;
    filter: drop-shadow(0 8px 16px color-mix(in srgb, var(--color-primary) 18%, transparent));
  }
  .store-loader-disc { fill: var(--color-primary); animation: store-loader-disc 3s linear infinite }
  .store-loader-ink { fill: var(--color-background); animation: store-loader-ink 3s linear infinite }
  .store-loader-rim, .store-loader-ball { filter: drop-shadow(0 2px 3px color-mix(in srgb, var(--color-primary-dark) 42%, transparent)) }
  .store-loader-arc { transform: rotate(136deg); animation: store-loader-turn 1.5s cubic-bezier(.893,0,.114,1) infinite }
  .store-loader-ball { transform: translateY(47.9px); animation: store-loader-bounce 1.5s infinite }
  @keyframes store-loader-turn {
    from { transform: rotate(136deg) }
    to { transform: rotate(496deg) }
  }
  @keyframes store-loader-bounce {
    0%, 100% { transform: translateY(47.9px); animation-timing-function: cubic-bezier(1,0,.936,1) }
    50% { transform: translateY(-45.7px); animation-timing-function: cubic-bezier(.064,0,0,1) }
  }
  @keyframes store-loader-disc {
    0%, 24.444%, 75.556%, 100% { fill: var(--color-primary) }
    25%, 75% { fill: var(--color-background) }
  }
  @keyframes store-loader-ink {
    0%, 24.444%, 75.556%, 100% { fill: var(--color-background) }
    25%, 75% { fill: var(--color-primary) }
  }
  @media (prefers-reduced-motion: reduce) {
    .store-loader-art * { animation: none }
  }
</style>
<svg class="store-loader-art" xmlns="http://www.w3.org/2000/svg" viewBox="-135 -135 270 270" aria-hidden="true">
  <circle class="store-loader-disc" cy="-.766" r="91.96"/>
  <path class="store-loader-disc store-loader-rim" fill-rule="evenodd" d="M0-123.816a123.05 123.05 0 1 0 0 246.1a123.05 123.05 0 1 0 0-246.1ZM0-92.726a91.96 91.96 0 1 0 0 183.92a91.96 91.96 0 1 0 0-183.92Z"/>
  <g class="store-loader-arc">
    <path class="store-loader-ink" d="M0 60.45C-33.81 60.45-61.22 33.04-61.22-.766H-71.445C-71.445 38.69-39.458 70.68 0 70.68Z"/>
  </g>
  <g class="store-loader-ball">
    <circle class="store-loader-ink" cy="-.766" r="32.37"/>
    <circle cy="-.766" r="27" fill="var(--color-background)"/>
    <image href="${logo}" x="-18" y="-18.766" width="36" height="36"/>
  </g>
</svg>`;
