# Land of Eem Character Sheet for Owlbear Rodeo — v0.2.5

## v0.2.5

Adds progression-aware imports for leveled characters. The level 10 Knight-Errant save format now imports its level, XP, mastered abilities, current-level abilities, Martial Prowess Courage/Dread changes, Second Skin armor effects, second Ideal/Flaw, deficiency from quirks, and Legendary Item choice.


This update fixes the token context-menu launcher and the detached character sheet connection.

## What changed
- The Owlbear context-menu button now uses the supported Character-layer filter only, so **Open Land of Eem Character** appears for a single selected Character token.
- The extension checks for saved Land of Eem data after the button is clicked and shows an Owlbear warning if none is present.
- Opening from the token menu now launches the detached character sheet directly from the extension background page.
- The pop-out communicates with its Owlbear-hosted opener using `postMessage`, avoiding browser partitioning that prevented the previous BroadcastChannel bridge from working.
- The normal in-extension **Pop Out** button also loads the character immediately through its opener. If that Owlbear action panel later closes, the detached sheet stays visible, but saving requires reopening the sheet from the token menu for a persistent connection.

## Recommended player workflow
1. Import a `.eem.json` character in the extension.
2. Choose a Character-layer token and Save to token.
3. Select/right-click that Character token in Owlbear.
4. Click **Open Land of Eem Character** in Owlbear's item context menu.
5. Keep the detached sheet beside Owlbear while using dice and the map.

Owlbear's custom context menu is attached to selected scene items. Depending on device/input, select the token first and then use its context menu.

## v0.2.4 — Magnificent item collection

- Magnificent items are stored separately from ordinary inventory so a character can own more than one as play continues.
- A Knight-Errant starting Magnificent item is shown in both Class Perks and Inventory.
- Later acquired or crafted Magnificent items appear in Inventory only.
- Each Magnificent item preserves its name, slots, type, cost, worn state, source, and one or more trait names/descriptions.
- The Inventory tab includes **+ Add Magnificent item** and **+ Trait** controls for adding new items as characters level up or acquire/craft gear.
- Older saved Owlbear sheets that had Magnificent items inside ordinary inventory are migrated automatically when loaded.

## v0.2.4
- Added trash-can controls at the far right of inventory item names.
- Added per-trait trash controls for Magnificent items.
- Whole-item deletion asks for confirmation; trait removal is immediate.
- Restored the extension toolbar icon to a transparent SVG `E` and updated the manifest to use `icon.svg`.
