"""item_texture.json and language files, derived from the item/block tables so names stay in sync."""
import json, os, sys
sys.path.insert(0, os.path.dirname(__file__))
from gen_bp_items import WEAPONS, AMMO, ATTACHMENTS, MISC, ALL_NAMES
from gen_bp_blocks import BLOCK_NAMES
ROOT = os.path.join(os.path.dirname(__file__), '..', 'addon')
BP, RP = os.path.join(ROOT, 'BunkerArsenal_BP'), os.path.join(ROOT, 'BunkerArsenal_RP')
PACK_NAME = 'Bunker Arsenal'
PACK_DESC = 'Underground military bunkers, blast doors, control panels and a sci-fi arsenal for Minecraft Bedrock 1.21 (mobile friendly).'

def build():
    tex = {'bunker_' + k: {'textures': 'textures/items/bunker/' + k} for k in ALL_NAMES}
    json.dump({'resource_pack_name': 'bunker_arsenal', 'texture_name': 'atlas.items', 'texture_data': tex},
              open(os.path.join(RP, 'textures', 'item_texture.json'), 'w'), indent=2)
    lines = ['pack.name=%s' % PACK_NAME, 'pack.description=%s' % PACK_DESC, '']
    for k, name in ALL_NAMES.items():
        lines.append('item.bunker:%s.name=%s' % (k, name)); lines.append('item.bunker:%s=%s' % (k, name))
    lines.append('')
    for k, name in BLOCK_NAMES.items():
        lines.append('tile.bunker:%s.name=%s' % (k, name))
    lines += ['', 'entity.bunker:grenade.name=Frag Grenade', 'entity.bunker:stun_charge.name=Stun Grenade', 'entity.bunker:rocket.name=Rocket',
              'item.spawn_egg.entity.bunker:grenade.name=Frag Grenade', 'item.spawn_egg.entity.bunker:stun_charge.name=Stun Grenade', 'item.spawn_egg.entity.bunker:rocket.name=Rocket']
    with open(os.path.join(RP, 'texts', 'en_US.lang'), 'w') as f: f.write('\n'.join(lines) + '\n')
    with open(os.path.join(BP, 'texts', 'en_US.lang'), 'w') as f: f.write('pack.name=%s\npack.description=%s\n' % (PACK_NAME + ' [BP]', PACK_DESC))
    print('wrote item_texture.json (%d) and lang files' % len(tex))

if __name__ == '__main__':
    build()
