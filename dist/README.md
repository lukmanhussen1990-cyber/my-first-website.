# Downloads

- `hollow_bride.mcaddon` - both packs in one file. Tap it on Android, Minecraft
  imports the behaviour pack and the resource pack together. This is the one
  you want.
- `hollow_bride_BP.mcpack` - behaviour pack only.
- `hollow_bride_RP.mcpack` - resource pack only.

Install the two `.mcpack` files only if the combined `.mcaddon` fails to import;
tap BP first, then RP, then activate both in the world settings.

Rebuild from source at any time:

    python3 tools/make_textures.py
    python3 tools/validate.py
    python3 tools/build_mcaddon.py
