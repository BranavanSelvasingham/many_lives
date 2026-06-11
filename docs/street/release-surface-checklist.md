# Street Release Surface Checklist

The street app shows its current build identity and latest user-facing release notes through the small bottom-screen release icon.

For each user-facing PR or release:

1. Update `apps/many-lives-web/src/lib/street/streetReleaseNotes.ts`.
2. The note must describe this release or PR, not the previous one. If the PR
   number is not known yet, update it before merge.
3. Keep the note short and player-facing: what changed, why it matters, and any visible regression guard.
4. Use the merge commit or release commit short SHA for `build`, and the PR or release number for `source`.
5. Run the narrowest validation that covers the surface:
   - `corepack pnpm lint` for TypeScript changes.
   - `corepack pnpm visual:game` for the bottom icon and popover layout.
   - `corepack pnpm --filter @many-lives/many-lives-web build` if metadata wiring crosses Next.js build/runtime boundaries.
6. Inspect desktop and mobile screenshots from visual smoke when the icon, popover, HUD, or layout changes.
7. After deploy, open the live release popup and verify it shows the just-merged PR/source rather than the previous release.
