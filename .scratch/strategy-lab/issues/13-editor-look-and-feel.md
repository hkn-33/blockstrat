# 13: Editor look and feel

**What to build:** Building a strategy feels smooth and pleasant. The Blockly editor matches the app's visual style, the toolbox is organised into categories (Market, Indicators, Conditions, Logic, Actions, Risk), and dragging and snapping feel immediate.

**Blocked by:** 05

**Status:** done

- [x] Custom Blockly theme consistent with the app's Tailwind design (colours per category, readable fonts)
- [x] Toolbox grouped into the six categories
- [x] Dragging, snapping and the Preview update feel smooth on a typical laptop (checked by hand; no visible lag or flicker)
- [x] Root Strategy block cannot be deleted or duplicated
- [x] Editor fits a laptop screen alongside the results without horizontal scrolling

## Comments

Zelos (Scratch-style) renderer, custom theme, six toolbox categories. Dragging blocks in and out was checked by hand in the browser. Duplicates of the root Strategy block are removed automatically.
