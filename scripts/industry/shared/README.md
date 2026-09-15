# shared/

The three framework icons are medtech's Figma exports (`medtech/export-assets.mjs`,
nodes 4793:1225 / 1228 / 1234), copied here byte for byte so a city without a
board can stage them. Nothing renders them today: the TextColumns model dropped
its `icon` field when the board replaced icons with numerals, and the smoke
suite asserts no `<img>` in the framework. Both cities' `data.json` still name
them and the loader ignores the key, so they stay until the field is removed
from the data files too. If the Figma nodes change, re-export and copy again;
do not edit one copy.
