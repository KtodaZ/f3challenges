# Bedrock Bicep artwork — August 2026

Drop four transparent PNGs here, named exactly:

| File | Tier | Finish |
|------|------|--------|
| `bicep-participant.png` | 🎖️ Bedrock Bicep | neutral grey stone |
| `bicep-bronze.png`      | 🥉 Bronze Bicep  | warm copper |
| `bicep-silver.png`      | 🥈 Silver Bicep  | cool slate steel |
| `bicep-gold.png`        | 🥇 Gold Bicep    | rich gold |

Square, transparent background, 512×512 or larger (they render at up to 128px
and get downscaled by the browser, so 512 is plenty).

Declared in `shared/src/challenges.ts` → `aug-2026.trophyStyle.iconUrl`, and
rendered by `src/components/ui/TrophyIcon.tsx`.

**Missing files are safe.** TrophyIcon falls back to the tier emoji if a file
is absent or fails to load, so the app looks correct either way — the artwork
just won't appear until the PNGs land.

Used only where the mark renders large: the trophy case (44px), badge detail
(68px), and the gold celebration (128px). The tiny rung chips on the trophy
bar deliberately stay on emoji — an illustration at 10px is mush.
