# 09: Local saving and JSON export/import

**What to build:** Users do not lose their work. The current strategy survives a reload; users can save several named strategies in the browser and switch between them; they can export a strategy as a JSON file and import it back, with a clear error for invalid files.

**Blocked by:** 01

**Status:** done

- [x] Current strategy restored from localStorage after reload
- [ ] Save, rename, delete and switch between named strategies in the browser
- [x] Export downloads a JSON file containing the strategy and its schema version
- [x] Import loads a valid file into the editor; an invalid file shows a clear error and leaves the current strategy untouched
- [x] App works when localStorage is unavailable (no crash; saving simply does nothing)
- [x] Converter seam test: exported JSON imports back to the same strategy

## Comments

Save, delete and switch work; there is no separate rename (save under a new name, then delete the old one).
