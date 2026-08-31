# HOODED concept direction

## Accepted versions

| Screen | Accepted file | Status |
| --- | --- | --- |
| Entry portal | `01-hooded-entry.png` | Accepted v1 |
| Command center | `02-secret-command-center.png` | Accepted v1 |
| Power Grid | `03-power-grid-mission.png` | Accepted v1 |

The three v1 images are the preserved concept baseline. Any future revision must use a suffix such as `-v2` or `-v3`; the accepted files are never overwritten.

## Accepted visual language

- Modern pop-comic interface on a near-black ground.
- Saturated red, blue, green, and yellow house colors.
- Paper-white captions, thick black ink, hard offset shadows, halftone texture, and diagonal panels.
- Original hooded silhouettes; no resemblance to existing comic characters and no Robinhood brand marks.
- Production UI should recreate the system in HTML, CSS, and Canvas rather than using the concept screens as flat backgrounds.

## Typography direction

Use a condensed, italic display face for action headlines and a legible grotesk sans-serif for interface copy. The implementation uses local/system fallbacks to avoid remote-font build dependencies.

## Concept prompts

### Entry portal

Modern pop-comic desktop landing page for **HOODED**, with five original hooded silhouettes, a concealed headquarters doorway, black background, saturated four-color power panels, wallet entry actions, and a 3,000 genesis hero scarcity counter.

### Secret command center

Members-only superhero headquarters presented as an explorable comic dashboard containing Mission Deck, Code Bazaar, Assembly, Launch Bay, Stock Token Vault, and Hero Workshop, plus a central six-house city map and hero progression card.

### Power Grid

Browser-game screen where an original hooded hero routes red, blue, green, and yellow energy through a city circuit grid. The screen includes score, timer, combo, energy, objectives, action bursts, and a strong uncluttered play area.

## Revision notes

- v1: established the diagonal entry composition, room-card command center, readable grid board, original hood silhouettes, and the core five-color system.
- Production translation v2: the accepted entry concept became a single fixed comic-cover viewport with no document scrolling. Five separately designed character assets replace the earlier CSS silhouettes while responsive code recreates the headline, access door, diagonal cast panels, wallet gate, and genesis counter.

## Palette

| Role | Hex |
| --- | --- |
| Background | `#050505` |
| Paper | `#fff7df` |
| Red | `#f23838` |
| Blue | `#2376ff` |
| Green | `#39d353` |
| Yellow | `#ffd52e` |
