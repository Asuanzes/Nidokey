# `screens/tsx/` — TSX extractions ready for handoff

Real `.tsx` versions of the 3 HTML artifacts in `screens/`. The HTML files are for **design review** (drop into a browser, click around); the TSX files are for **implementation in the real BuySell repo**.

## Files

| File | Target file in the BuySell repo |
|---|---|
| `web-inmuebles.tsx` | Replaces `src/components/AppShell.tsx` (Sidebar piece) + adapts `src/app/properties/page.tsx` |
| `mobile-android-inmuebles.tsx` | `apps/mobile/app/(tabs)/index.tsx` — Android visual variant (see `Platform.OS` in the prompt) |
| `mobile-ios-inmuebles.tsx` | `apps/mobile/app/(tabs)/index.tsx` — iOS visual variant |
| `CLAUDE_CODE_PROMPT.md` | The prompt to paste into Claude Code (VS Code) to actually do the work |

## How to use

1. Open the BuySell repo in VS Code with the Claude Code extension active.
2. Open `CLAUDE_CODE_PROMPT.md`, copy the section under the `---`, paste into Claude Code as a new message.
3. Drop the 3 `.tsx` files into the chat as attachments (or let Claude Code read them from this design-system project if you've linked it).
4. Approve the plan Claude Code returns, then let it edit.

## Notes

- The mobile TSX files share ~80 % of their code intentionally — the prompt tells Claude Code to dedupe them into one screen with `Platform.OS` branching.
- All Tailwind classes used in the web file already exist in the repo's `tailwind.config.ts`. No config changes needed.
- The placeholder `<Text>⚿</Text>` brand mark in the mobile files is a marker — the prompt instructs Claude Code to port the real `IconKey` SVG to `react-native-svg`.
