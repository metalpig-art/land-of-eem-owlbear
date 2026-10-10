## v0.3.5 — Bestiary library

- GM-only searchable Bestiary Vol. 1 index with 190 entries and source page references.
- Add adversaries to the existing encounter tracker with level/class Courage estimates.
- Entries with unverified stat extraction are marked for manual entry; check the book for special cases.
- Core Rulebook adversaries are not yet imported.

# Land of Eem Character Sheet for Owlbear Rodeo — v0.3.4

## v0.3.4 — GM encounter tracker

- GM-only toggle beside Broadcast Settings switches the embedded sheet to a private encounter tracker.
- Add multiple adversaries with name, current/max Courage, Attack, Defense, Dread die and flat Dread bonus.
- Roll attacks and counterattacks using Normal, Advantage or Disadvantage and target Defense; Dread rolls at the same time.
- Results broadcast to other room participants using the existing styled roll card.
- Track damage/healing, delete adversaries and save encounter state in GM player metadata.
- Player-facing character sheets and detached pop-out sheets are unchanged.

## v0.3.3 — Embedded attribute layout

- In the embedded Owlbear sheet, Vim, Vigor, Knack, and Knowhow and their associated Skills appear in a single four-column row.
- The detached pop-out sheet keeps its existing layout.

## v0.3.2 broadcast placement and settings
- Broadcast settings moved into the main extension header (gear button).
- Positions: top center, middle left, middle right. Duration: 3, 5, 7, 10, 15 seconds, or until closed.
- Corrected Owlbear popover anchor origins to match the requested viewport location; coordinates use Owlbear viewport dimensions, not the embedded character-sheet iframe dimensions.
- Preferences are stored per browser and applied to the next incoming roll.


v0.3.3: Embedded Owlbear sheet displays Vim, Vigor, Knack and Knowhow with their skills in a single four-column row. Detached pop-out layout unchanged.

## v0.3.1 — Roll card preferences
Open the gear icon on any received roll card to choose Top center, Middle left, or Middle right placement, and 3, 5, 7, 10, 15 seconds or Until closed. Preferences are saved per browser; position changes apply to the next received roll. The receiver controls their own card preferences.

## v0.3.0 roll cards
Remote rolls open a styled Owlbear popover instead of a plain notification. Cards show roll math, have a 10-second auto-dismiss, pin/close controls and per-client local roll history (last 30). Pop-out and embedded sheet roll broadcasting remains supported. The roller sees their existing local roll modal; only remote clients get a card.

## v0.2.9
- Vim, Vigor, Knack, Knowhow and all Skills are rollable in both the embedded Owlbear sheet and pop-out sheet.
- Roll prompts remain modal with Normal / Advantage / Disadvantage.
- Roll math is shown in brackets with raw die results in parentheses.
- Roll broadcasts use REMOTE delivery so every other connected Owlbear participant, including GMs, receives the result while the roller does not.
- Broadcast text mirrors the local roll result.

## v0.2.8
- Vim, Vigor, Knack and Knowhow are clickable checks.
- Roll choices open in a modal dialog.
- Completed checks and attacks are broadcast to all connected players using Owlbear Broadcast and appear as room notifications.
- Pop-out rolls bridge through the extension background page so they can also broadcast to the room.

## v0.2.7

- Positive modifiers display with a leading `+`; negative modifiers keep `-`.
- Skills are visually inset beneath their parent Attribute.
- Weapon rows show `*` and the Block stat shows `†`.
- Checking an item as equipped/worn recalculates supported stat modifiers immediately.
- Medium/Heavy armor apply their normal Block when the item data does not already specify Block.
- Item and Magnificent trait text can modify Attack, Defense, Block, Dread, maximum Courage, Inventory Slots, and named Skills.
- Knight-Errant Second Skin recalculates when armor is equipped or removed.

## v0.2.7
- Keeps Attributes/Skills and the combat stat row visible while the right-side tab content changes.
- Moves Attributes, Inventory, Background, and Journal tabs into the changing content area.
- Adds a persistent Journal tab saved with the character.
- Skill names are clickable 1d12 checks with Normal/Advantage/Disadvantage.
- Attack is clickable and resolves Attack + target Defense and Dread in the same roll.

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
