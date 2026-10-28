// Builds GPT_IMAGE_PROMPTS.md, assets/gpt/README.md and assets_manifest.json for "The Face of God" (idea 60).
// The STYLE block and the CHARACTER BIBLE live here once, so every prompt repeats them word for word.
// Run from anywhere: node grace-reels/episodes/face-of-god/tools/build_prompts.mjs
import {mkdirSync, writeFileSync} from 'node:fs';
import {dirname, join} from 'node:path';
import {fileURLToPath} from 'node:url';

const EP = join(dirname(fileURLToPath(import.meta.url)), '..');

// From reference/style_notes.md (sections 6, 9 and 10): the never-died / Friend block, plus storm colours.
const STYLE =
	'Flat 2D paper-cut illustration for a cinematic 2.5D animated Bible story. Characters and props: simple bold shapes with a clean, even, dark brown outline (#2B1D12) and rounded joins; matte flat colors with exactly one soft shadow tone per color (far-side arm and leg one shade darker); no gradients on characters, no texture, no noise, no 3D rendering, no realism. Expressive but minimal cartoon faces, like our earlier episodes: one almond-shaped eye (white with a round dark pupil) and a simple eyebrow that shows the feeling, a small rounded nose bump on the profile, usually no mouth; hair and beards are flat shapes. Bodies about 5.5 heads tall, tube-like arms ending in rounded mitten hands (no separate fingers), simple rounded feet, robes as clean A-line shapes. Scenery: a warm low-poly diorama look, with mountains, rocks, tents, hills and trees built from large flat-shaded triangular facets, no outlines, soft haze and cinematic lighting. Warm biblical palette: sand #D9B27C, ochre #C98A4B, terracotta #B4643C, olive #8A8F45, sage #A3A36E, dusty blue #6F8FA0, cream #F3ECDF, deep brown #2B1D12, and storm blues #1B2440, #2A2F4A and #3B3F5C for the night storm. High detail but clean and readable, crisp edges. No text, no letters, no numbers, no watermark, no signature, no logo, no frame, no border.';

// CHARACTER BIBLE: one fixed description per character, pasted word for word into every prompt.
// JESUS is the exact text from "Friend", so he looks the same in every reel.
const BIBLE = {
	MOSES:
		'MOSES: an old man of about eighty with warm brown skin (#A5673E); long white hair (#F1ECE2) that falls to his shoulders and a long, full white beard that reaches the middle of his chest, both with soft light-grey shadow tones (#C9C3B8); thick white eyebrows; one almond eye with a dark pupil and a strong, kind look, a small rounded nose, no mouth (the beard covers it). He wears a long red-brown robe (#8C3B2A) that reaches his ankles, tied at the waist with a long cream sash (#E9DCC0) whose ends hang down at his side, and simple brown leather sandals (#6B4A2E). His tall, plain wooden shepherd\'s staff (#7A5532), a little taller than he is, appears only where a pose asks for it. Sturdy, upright build for his age, about 5.5 heads tall. No halo, no glow unless a prompt asks for it.',
	AARON:
		'AARON: Moses\' older brother, an old man of about eighty-three with warm brown skin (#9E6440); a medium-length grey beard (#9A968E) and short grey hair under a simple white cloth head covering (a plain wrapped head cloth, #F1ECE2); one almond eye with a dark pupil and a gentle, worried look, a small rounded nose, no mouth. He wears a long white linen tunic (#F1ECE2) that reaches his ankles, a sleeveless blue over-robe (#4F6E9A) that reaches his knees, a plain blue-and-white sash, and brown sandals. No staff, no jewelry, no breastplate, no symbols. A little shorter and rounder than Moses, about 5.5 heads tall.',
	ISRAELITES:
		'THE ISRAELITES: ordinary families of ancient Israel: men, women and children in simple, plain robes of earthy colors (sand #C9A46E, olive #7A8A55, terracotta #B4643C, dusty blue #6F8FA0, cream #EDE7DD, brown #7A5233); some men with a plain head cloth, the women with simple head scarves; varied warm skin tones from light tan to deep brown; dark hair, some grey beards; simple sandals. No jewelry, no armor, no badges, no emblems and no symbols of any group.',
	JESUS:
		'JESUS: a calm, kind man of about thirty with warm brown skin (#A8693F); shoulder-length dark-brown hair (#3B271A) tucked behind his ear; a short, neat dark-brown beard; one almond eye with a dark pupil and a soft, gentle look, a small rounded nose, no mouth. He wears a long off-white robe (#EFE8D8) that reaches his ankles, tied with a soft blue-grey sash (#7E8FA0), and over it a light sand-colored outer robe (mantle, #CDB892) that hangs from his shoulders to his knees; simple brown sandals (#6B4A2E). Slim build, calm upright posture, about 5.5 heads tall. No halo, no glow, no crown, no realistic face.',
	PHILIP:
		'PHILIP: one of the twelve disciples, a man of about thirty with warm brown skin (#B07A50); long dark-brown hair (#3B271A) tied back at the neck and a short dark beard; one almond eye with a dark pupil and an earnest, curious look, a small rounded nose, no mouth; a mustard-yellow robe (#D3A33A) over a cream tunic, and a brown belt. About 5.5 heads tall.',
};

const SIZE = {
	L: {w: 1536, h: 1024, label: '1536×1024 (landscape 3:2)', format: 'FORMAT: landscape 3:2 (1536×1024).'},
	P: {w: 1024, h: 1536, label: '1024×1536 (portrait 2:3)', format: 'FORMAT: portrait 2:3 (1024×1536).'},
};

const BG = {
	clear: 'BACKGROUND: fully transparent (PNG with a real alpha channel). Nothing behind the subject: no ground, no floor, no cast shadow, no scenery, no white or checkerboard pattern.',
	layer: 'BACKGROUND: everything above and around the scenery is fully transparent (PNG with a real alpha channel): no sky color, no white, no checkerboard pattern.',
	full: 'BACKGROUND: a complete, opaque picture that fills the whole image (no transparency).',
	hole: 'BACKGROUND: the rock fills the whole image, EXCEPT the inside of the opening, which is left completely empty and fully transparent (PNG with a real alpha channel), so a person and a light can be placed there later. If real transparency is not possible, fill only the inside of the opening with flat magenta (#FF00FF).',
};
const BG_KIND = {clear: 'yes', layer: 'yes (around the scenery)', full: 'no', hole: 'only inside the opening'};
const MAGENTA_LINE = 'BACKGROUND: plain solid flat magenta (#FF00FF) filling all empty areas, no shadow on the background, no gradient, no ground.';

// Characters and props are drawn in neutral light so the same art works in the storm, the glory light and the sunrise.
const LIGHT = {
	neutral: 'LIGHT: soft, even, neutral light from the upper left, so the art can be re-lit later in animation; no colored light, no strong shadows, no glow, no rim light, no cast shadows.',
	glowface: 'LIGHT: soft, even, neutral light from the upper left on everything except his face; the only glow is the soft white-gold light of his face itself; no rays, no halo, no glow around the body, no cast shadows.',
	stormsky: 'LIGHT: a night storm. The clouds are lit faintly from inside by distant lightning (soft cool blue-white edges #8FA3C8); deep blue-violet everywhere else; the opening in the clouds is only a little paler. No beam, no sun, no lightning bolt and no glowing light (those are added later in animation).',
	stormrock: 'LIGHT: a night storm. Cool blue-grey storm light from above catches the top edges of the rocks (#8FA3C8); deep blue-violet shadows (#1E2236, #2B2440), never pure black; rain haze in the distance. No light beams, no glow, no lightning bolts.',
	cleft: 'LIGHT: dim, even night light, so every facet of the rock is visible and a bright light can be added in front of it later; the inner edges of the opening are a little darker; no glow, no beam.',
	morning: 'LIGHT: early morning sun from the upper left, warm and soft, with long gentle shadows and a pale blue sky.',
	sunrise: 'LIGHT: sunrise. A warm golden glow low on the horizon behind the far hills (no sun disc drawn), warm gold light on the hilltops, soft long shadows, peaceful.',
	sea: 'LIGHT: dusk. A deep blue-violet sky; the water walls glow from inside in deep teal and blue; a soft warm glow far ahead at the end of the path. No beams.',
	desert: 'LIGHT: warm late-afternoon sun from the upper left, long soft shadows, a warm ochre sky.',
};

const AVOID = {
	char: 'AVOID: text, letters, numbers, labels, arrows, guide lines, grid lines, frames, borders; extra fingers, extra arms or legs, mouths (unless a pose allows a smile), realistic faces, halos, glows, cast shadows, gradients.',
	prop: 'AVOID: text, letters, numbers, writing, carvings or symbols, people, hands, human faces, frames, borders, cast shadows.',
	scene: 'AVOID: text, letters, numbers, people, animals, signs, frames, borders; any figure, face, hand or eye in the sky, clouds, light or rocks; light beams, sun discs, lightning bolts, halos.',
	sky: 'AVOID: text, letters, numbers, ground, mountains, trees, buildings, people, birds, frames, borders; any figure, face, hand or eye in the clouds; light beams, sun discs, lightning bolts.',
};

// ChatGPT cannot see file names, so the "ATTACHED" sentences describe what is attached.
const A = {
	refs: (n, what = 'drawing style (outline, flat colors, minimal faces, proportions)') =>
		`ATTACHED: ${n} style reference screenshot${n > 1 ? 's' : ''} from our earlier episode. Copy only ${n > 1 ? 'their' : 'its'} ${what}, never ${n > 1 ? 'their' : 'its'} people, palm trees or scene.`,
	moses: (bits = 'face, white hair, beard, robe, sash') => `ATTACHED: our approved MOSES character sheet. Keep his ${bits}, colors, proportions and scale exactly the same.`,
	anchor: (who) =>
		`ATTACHED: our approved MOSES character sheet as a STYLE MATCH and SCALE. Use the exact same drawing style, outline weight, proportions and level of detail, but draw ${who} as described below, not Moses.`,
	scene: (what) => `ATTACHED: ${what}. Match its light, colors, haze and level of detail exactly.`,
};

const TURN = (name, extra = '') =>
	`IMAGE: a character turnaround sheet of ${name}. Three full-body views of the same man in a relaxed, neutral standing pose, arranged left to right with wide empty space between them: (1) side view facing right, (2) three-quarter front view turned toward the right, (3) back view. All three are exactly the same height and scale, with the feet on one shared invisible ground line, and each figure fills about 90% of the image height. The arms hang slightly away from the body so the mitten hands are clearly separate from the clothes.${extra}`;

const PARTS = (name, list) =>
	`IMAGE: an animation parts sheet (a cut-out puppet kit for a 2D bone rig) of ${name} in side view facing right, at exactly the same scale as the side view in the attached ${name} character sheet. Every part is a separate flat paper-cut piece, laid out in a tidy grid with clear empty space around each piece; no piece touches or overlaps another: ${list}. Each limb piece has rounded ends with a little extra overlap area at the joints (neck, shoulder, elbow, hip, knee), so the pieces can rotate and overlap without gaps. The far-side arm and leg are one shade darker. Every piece keeps the same outline and colors. No shadows.`;

const WIND = 'In every pose of this sheet a strong storm wind blows from the right: his long beard, his hair, the sash ends and the bottom of his robe stream out to the left.';

// group: char | prop | bg (characters are listed first, as asked). file, size, bg, light, prio, attach, use, lines, avoid
const assets = [
	// ---------------- CHARACTERS ----------------
	{group: 'char', file: 'char_moses_turnaround.png', size: 'L', bg: 'clear', light: 'neutral', prio: 'MUST',
		attach: ['ref_moses.png', 'ref_jesus_turnaround.png', 'style_ref_1.png'],
		use: 'design master for Moses and the style anchor for every new image; S1–S15',
		lines: ['ATTACHED: (1) a rough version of our MOSES from an earlier episode: keep his look (white hair, long white beard, red-brown robe, cream sash) but redraw him cleanly at full quality; (2) our approved JESUS character sheet as a STYLE MATCH only: use the exact same drawing style, outline weight, proportions and level of detail, but do not draw Jesus; (3) 1 style reference screenshot: copy only its drawing style, never its people or scene.',
			BIBLE.MOSES, TURN('MOSES', ' No staff in this sheet. His long beard and the hanging sash ends are clearly visible in all three views. Strong, kind and humble.')], avoid: 'char'},
	{group: 'char', file: 'char_moses_poses_a.png', size: 'P', bg: 'clear', light: 'neutral', prio: 'MUST',
		attach: ['char_moses_turnaround.png', 'style_ref_1.png'],
		use: 'S1 the opening on the ledge, S2 shielding his eyes, S4 kneeling to ask, S5 bowed low; the cover',
		lines: [`${A.moses()} Also attached: 1 style reference screenshot. Copy only its drawing style, never its people or scene.`, BIBLE.MOSES,
			`IMAGE: a poses sheet of MOSES on a stormy mountain top, matching the attached MOSES character sheet exactly. Four full-body poses of the same man, all at the same scale (a standing figure is about 45% of the image height), arranged in 2 rows of 2 with clear empty space between them (no pose touches another). ${WIND} (1) side view facing right, standing firm with his feet apart, his near arm raised high above his head toward the sky with the open mitten hand, his head tilted up, his far hand gripping his tall wooden staff planted on the ground beside him; (2) side view facing right, leaning back a little, his near forearm raised in front of his eyes to shield them from a blinding light ahead and above, his far hand gripping the staff; (3) side view facing right, kneeling on both knees with his back straight and his head lifted up, both arms raised forward and up with open mitten hands, asking; the staff lies on the ground beside him; (4) side view facing right, kneeling and bowed low, his forehead near the ground and both hands flat on the ground in front of him, humble and afraid; the staff lies beside him. Strong, clear silhouettes; the hands stay rounded mittens.`], avoid: 'char'},
	{group: 'char', file: 'char_moses_poses_b.png', size: 'P', bg: 'clear', light: 'neutral', prio: 'MUST',
		attach: ['char_moses_turnaround.png', 'char_moses_poses_a.png'],
		use: 'S6 pressed into the cleft, S7 peeking out, S8 walking down with the tablets, S10 the veil, S12 hidden in the rock',
		lines: [`${A.moses()} Also attached: our approved first MOSES poses sheet. Match its scale exactly.`, BIBLE.MOSES,
			'IMAGE: a second poses sheet of MOSES, matching the attached sheets exactly (same scale: a standing figure is about 45% of the image height). Four full-body poses of the same man in calm air (no wind), arranged in 2 rows of 2 with clear empty space between them (no pose touches another): (1) three-quarter front view turned toward the right, standing pressed flat against a rock wall behind him (do not draw the rock): his back and head flat against it, both arms spread low at his sides with the palms pressed back against the rock, his head turned toward the right and his eye wide open, small and trembling; (2) side view facing right, leaning forward from the waist to look out from behind an edge (do not draw the edge): his near mitten hand raised at shoulder height resting on the invisible edge, his head and shoulders stretched forward, his eye wide with awe; draw the whole body; (3) side view facing right, walking forward calmly mid-step, holding two flat stone tablets with rounded tops against his chest with both arms (blank grey-tan stone #B8AE98, no writing), no staff, his face calm and peaceful; (4) three-quarter front view turned toward the right, standing, gently lifting a soft cream cloth veil (#EDE3CF) with both hands and placing it over his face, the veil covering his face from the eye down, its edges hanging softly. Strong, clear silhouettes; the hands stay rounded mittens.'], avoid: 'char'},
	{group: 'char', file: 'char_moses_parts.png', size: 'L', bg: 'clear', light: 'neutral', prio: 'MUST',
		attach: ['char_moses_turnaround.png', 'style_ref_1.png'],
		use: 'bone rig: breathing, head turns, the beard, hair, sash and robe hem whipping in the storm wind',
		lines: [`${A.moses()} Also attached: 1 style reference screenshot. Copy only its drawing style.`, BIBLE.MOSES,
			PARTS('MOSES', 'the head with the face, eye, eyebrow and ear but WITHOUT the hair and beard; the white hair (top and back of the head and the hair falling to the shoulders) as one piece; the long white beard as one piece; the upper body with the robe down to the waist and the cream sash knot; the lower robe from the waist to the ankles as one piece; the two hanging sash ends as one piece; the near upper arm with its sleeve; the far upper arm with its sleeve; the near forearm with its mitten hand; the far forearm with its mitten hand; the near leg from the hip to the sandal; the far leg from the hip to the sandal; the tall wooden staff')], avoid: 'char'},
	{group: 'char', file: 'char_aaron.png', size: 'L', bg: 'clear', light: 'neutral', prio: 'MUST',
		attach: ['char_moses_turnaround.png', 'style_ref_3.png'],
		use: 'S9 the camp: Aaron stops, steps back and shields his eyes',
		lines: [`${A.anchor('AARON')} Also attached: 1 style reference screenshot. Copy only its drawing style, never its people or scene.`, BIBLE.AARON,
			'IMAGE: a sheet of AARON with four full-body figures of the same man at the same scale (each figure fills about 80% of the image height), arranged left to right with wide empty space between them and the feet on one shared invisible ground line: (1) side view facing right, standing calmly; (2) three-quarter front view turned toward the right, standing calmly; (3) side view facing right, stepping back in alarm: his weight on the back foot, his body leaning back, both forearms raised in front of his face to shield his eyes from a bright light ahead; (4) side view facing right, half turned away, one forearm across his eyes and the other hand reaching back as if to keep the people behind him back. Clear silhouettes; the hands stay rounded mittens.'], avoid: 'char'},
	{group: 'char', file: 'char_israelites_group1.png', size: 'L', bg: 'clear', light: 'neutral', prio: 'MUST',
		attach: ['char_moses_turnaround.png', 'char_aaron.png', 'style_ref_3.png'],
		use: 'S9 the people step back and shield their eyes; a child peeks out from behind her mother',
		lines: [`${A.anchor('THE ISRAELITES')} Also attached: our approved AARON sheet (match the scale) and 1 style reference screenshot (copy only its drawing style).`, BIBLE.ISRAELITES,
			'IMAGE: a sheet of six ISRAELITES at the foot of a mountain, all in side view facing right toward a bright light (do not draw the light), all at the same scale as the attached sheets (an adult fills about 75% of the image height), standing in a row left to right with clear empty space between them (no figure touches another; the child is a separate figure): (1) a bearded man in a sand robe stepping back with both forearms raised in front of his eyes; (2) a woman in a terracotta robe and head scarf turning her face away, one hand shielding her eyes; (3) an old man with a grey beard in a brown robe leaning back on his walking stick, one hand raised in front of his face; (4) a mother in a dusty-blue robe and cream head scarf, standing with one arm stretched back protectively; (5) a little girl of about five in an olive dress, peeking out sideways as if from behind her mother, one hand held up as if holding her mother\'s robe (do not draw the robe), one wide eye; (6) a boy of about ten in a cream tunic covering his eyes with both hands. Afraid but gentle, family-safe.'], avoid: 'char'},
	{group: 'char', file: 'char_jesus_poses_c.png', size: 'P', bg: 'clear', light: 'neutral', prio: 'MUST',
		attach: ['ref_jesus_turnaround.png', 'ref_jesus_poses_b.png'],
		use: 'S11 at the table pointing to himself, S12 facing us with open hands and a child in his arms, S13 the push-in on his face, the FACE badge',
		lines: ['ATTACHED: our approved JESUS character sheet and his approved poses sheet. Keep his face, hair, beard, clothes, colors, proportions and scale exactly the same.', BIBLE.JESUS,
			'IMAGE: a third poses sheet of JESUS, matching the attached sheets exactly. Four poses of the same man at the same scale, arranged in 2 rows of 2 with clear empty space between them (no pose touches another): (1) wearing the outer robe, sitting cross-legged on a floor cushion, side view facing right, talking gently: his near mitten hand resting on his own chest (pointing to himself), his far hand open toward the people he is speaking to; (2) wearing the outer robe, standing, FRONT view facing the viewer, both arms open low and wide in welcome with open palms, a warm and kind expression with both almond eyes visible and a small soft smile line (allowed in this pose); (3) wearing the outer robe, kneeling on one knee, side view facing right, both arms opened wide toward a child who is running to him (do not draw the child), a small soft smile line allowed; (4) the same kneeling pose, now gently hugging a little girl of about five (a simple ochre dress #C98A4B, dark hair, warm brown skin) who stands in his arms with her arms around his neck, both happy; a small smile line is allowed for both. Clear silhouettes; the hands stay rounded mittens.'], avoid: 'char'},
	{group: 'char', file: 'char_moses_glowing.png', size: 'L', bg: 'clear', light: 'glowface', prio: 'MUST',
		attach: ['char_moses_turnaround.png', 'char_moses_poses_b.png'],
		use: 'S8 the close-up of his shining face on the way down, S9 the camp, S10 just before the veil',
		lines: [`${A.moses('face, white hair, beard, robe, sash')} Also attached: our approved second MOSES poses sheet (match the walking pose with the tablets exactly).`, BIBLE.MOSES,
			'IMAGE: the SHINING FACE of MOSES, three separate figures with wide empty space between them: (1) a large CLOSE-UP of Moses from the middle of his chest to the top of his head, side view facing right, filling about 85% of the image height: his face, beard and hair are drawn lighter and warmer, as if lit softly from within by white-gold light (pale gold #FFE7B0 on the face, cream-gold beard), with a calm, peaceful look; he does not know that his face shines; (2) the same CLOSE-UP with his face in its normal colors (for a soft cross-fade); (3) the walking pose from the attached poses sheet (holding the two blank stone tablets against his chest), small, with his face shining in the same way. No rays, no halo, no glow around the body.'], avoid: 'char'},
	{group: 'char', file: 'char_israelites_group2.png', size: 'L', bg: 'clear', light: 'neutral', prio: 'NICE',
		attach: ['char_israelites_group1.png', 'char_moses_turnaround.png'],
		use: 'S9 the camp before they see his face; S12 people walking up to Jesus, unafraid',
		lines: [`${A.anchor('THE ISRAELITES')} Also attached: our approved first ISRAELITES sheet: draw the SAME six people (same faces, clothes and colors).`, BIBLE.ISRAELITES,
			'IMAGE: the same six ISRAELITES as in the attached sheet, now calm and unafraid, all in side view facing right and walking forward mid-step at an easy pace, at exactly the same scale, in a row with clear empty space between them (no figure touches another): the bearded man, the woman with the head scarf, the old man with his walking stick, the mother, the little girl skipping happily, and the boy. Relaxed and glad; a small, simple curved smile line is allowed for them.'], avoid: 'char'},
	{group: 'char', file: 'char_philip.png', size: 'L', bg: 'clear', light: 'neutral', prio: 'NICE',
		attach: ['ref_disciples_seated.png', 'ref_jesus_turnaround.png'],
		use: 'S11 Philip at the supper ("Shew us the Father"); the other disciples are reused from Friend',
		lines: ['ATTACHED: our approved seated DISCIPLES sheet (PHILIP is the man in the mustard-yellow robe with long dark hair, top row, fourth from the left: draw that same man) and our approved JESUS character sheet as a STYLE MATCH only (do not draw Jesus).', BIBLE.PHILIP,
			'IMAGE: two full-body figures of PHILIP sitting on a round floor cushion, side view facing right, at the same scale as the attached seated disciples, with wide empty space between them: (1) asking a question: leaning forward a little, his near hand raised in front of him with the open palm up, an earnest, curious look; (2) listening closely: sitting back, both hands on his knees, his head tilted a little, his eye soft with wonder. Clear silhouettes; the hands stay rounded mittens.'], avoid: 'char'},

	// ---------------- PROPS ----------------
	{group: 'prop', file: 'prop_tablets_veil.png', size: 'L', bg: 'clear', light: 'neutral', prio: 'MUST',
		attach: ['char_moses_turnaround.png', 'style_ref_1.png'],
		use: 'S8 the two tablets, S10 the veil (animated as cloth), S1–S5 the staff',
		lines: [`${A.anchor('the props')} Also attached: 1 style reference screenshot. Copy only its drawing style.`,
			'IMAGE: a props sheet, every item a separate flat paper-cut piece with wide empty space around it, all at the scale of the attached MOSES sheet: (1) two flat stone tablets with rounded tops standing side by side, front view, completely BLANK (no writing, no marks), grey-tan stone (#B8AE98) with darker chipped edges (#8E8470), each about as tall as a man\'s forearm; (2) the same two tablets held together as a pair, seen from the side so their thickness shows; (3) Moses\' tall wooden shepherd\'s staff (#7A5532) alone, slightly crooked, as tall as a man; (4) a soft cream linen veil (#EDE3CF), a simple rectangle of cloth hanging straight down from two corners, with soft folds; (5) the same veil draped over an invisible head (a rounded top with folds falling around it), front view.'], avoid: 'prop'},
	{group: 'prop', file: 'prop_burning_bush.png', size: 'L', bg: 'clear', light: 'neutral', prio: 'MUST',
		attach: ['style_ref_2.png', 'char_moses_turnaround.png'],
		use: 'S3 the burning bush (the fire is added in code); the FIRE badge',
		lines: [`${A.refs(1, 'low-poly rocks and level of detail')} Also attached: our approved MOSES sheet, only to match the outline style and the scale (do not draw Moses).`,
			'IMAGE: a props sheet, every item a separate flat piece with wide empty space around it: (1) a desert thornbush: a low, wide shrub with twisted brown branches (#6B4A2E) and small clusters of dull green leaves (#7A8A55), about waist-high to a man, front view, standing on a small mound of sand (include the mound); (2) a large faceted desert rock in sand and ochre colors; (3) a smaller faceted desert rock; (4) a small tuft of dry desert grass. No fire, no flames, no smoke, no glow (fire is added later in animation).'], avoid: 'prop'},
	{group: 'prop', file: 'prop_plagues.png', size: 'L', bg: 'clear', light: 'neutral', prio: 'NICE',
		attach: ['char_moses_turnaround.png'],
		use: 'S3 the quick flash of plagues: frogs and hail',
		lines: [`${A.anchor('the props')}`,
			'IMAGE: a props sheet, every item a separate flat piece with wide empty space around it: (1) a cartoon green frog (#6E9A3A with a lighter belly #B8C878) sitting, side view facing right, one almond eye, simple and a little funny; (2) the same frog in mid-jump with its legs stretched back; (3) the same frog landing; (4) a cluster of five big hailstones: chunky faceted lumps of white-blue ice (#E8F1F8 with blue-grey shading #9FB4C8); (5) one single hailstone. Family-safe and simple.'], avoid: 'prop'},

	// ---------------- BACKGROUNDS (layers) ----------------
	{group: 'bg', file: 'bg_sinai_storm_sky.png', size: 'P', bg: 'full', light: 'stormsky', prio: 'MUST',
		attach: ['style_ref_2.png'],
		use: 'S1, S2, S4, S5 the night storm over Sinai (the glory light breaks through the opening in code); the cover',
		lines: [A.refs(1, 'flat, low-poly look and soft haze'),
			'IMAGE: the SKY layer of a night storm over a high mountain, filling the whole image: heavy, dark, rolling thunderclouds built from large soft low-poly facets (#1B2440, #2A2F4A, #3B3F5C) swirling around one round opening in the clouds near the top center, where the sky behind is only a little paler (#4A5578); thin slanted streaks of rain in the lower half. Huge, dramatic and still. Sky only.'], avoid: 'sky'},
	{group: 'bg', file: 'bg_sinai_storm_far.png', size: 'L', bg: 'layer', light: 'stormrock', prio: 'MUST',
		attach: ['bg_sinai_storm_sky.png', 'style_ref_2.png'],
		use: 'S1, S2, S4, S5 distant peaks behind the summit (parallax)',
		lines: [`${A.scene('the approved storm sky of this same scene')} Also attached: 1 style reference screenshot. Copy only its low-poly look.`,
			'IMAGE: the FAR layer: a wide range of distant jagged mountain peaks and ridges at night in a storm, low-poly with large flat facets in deep blue-grey (#2A2F45 to #3D4560), cool storm light on their upper edges, and rain haze softening the lowest ridges; the ridges fill the lower half of the image across the full width. Everything above the peaks is transparent.'], avoid: 'scene'},
	{group: 'bg', file: 'bg_sinai_ledge.png', size: 'L', bg: 'layer', light: 'stormrock', prio: 'MUST',
		attach: ['bg_sinai_storm_far.png', 'style_ref_2.png'],
		use: 'S1 Moses on the ledge (the speed-ramp push-in), S2, S4 kneeling, S5; the cover',
		lines: [`${A.scene('the approved far layer of this same storm scene')} Also attached: 1 style reference screenshot. Copy only its low-poly rocks.`,
			'IMAGE: the MIDDLE layer: the rocky summit of a high mountain at night in a storm. On the right half, a big jutting granite ledge with a flat, walkable top surface (clearly visible, about 45% of the image height above the bottom edge) where a man can stand at its edge; on the left half, the rock drops away steeply into darkness. Jagged boulders and sharp low-poly facets of dark granite (#4A4440, #5A524C, #6B625A). The rock fills the bottom of the image across the full width and continues all the way down to the bottom edge. Everything above the rock is transparent.'], avoid: 'scene'},
	{group: 'bg', file: 'bg_rock_crack.png', size: 'P', bg: 'hole', light: 'cleft', prio: 'MUST',
		attach: ['bg_sinai_ledge.png', 'style_ref_2.png'],
		use: 'S6 the clift of the rock (Moses inside, the river of light rushing past), S7, S12 left half',
		lines: [`${A.scene('the approved summit rock of this same mountain')} Also attached: 1 style reference screenshot. Copy only its low-poly look.`,
			'IMAGE: a close-up of a steep granite rock face high on the mountain, seen straight on and filling the whole image: large flat-shaded low-poly facets of grey-brown granite (#5A524C, #6B625A, #7A7068) with a few dark cracks. In the middle, one tall, narrow vertical cleft (a split in the rock) about as wide as a man\'s shoulders, reaching from the bottom edge up to about 75% of the image height, with jagged inner edges that step inward like a doorway in the rock. The space inside the cleft is the OPENING (see BACKGROUND).'], avoid: 'scene'},
	{group: 'bg', file: 'bg_mountain_path.png', size: 'L', bg: 'full', light: 'morning', prio: 'MUST',
		attach: ['bg_sinai_ledge.png', 'style_ref_2.png'],
		use: 'S8 Moses walks down the mountain path (slow tracking shot)',
		lines: [`${A.scene('the approved summit rock of this same mountain (now seen by day)')} Also attached: 1 style reference screenshot. Copy only its low-poly look and level of detail.`,
			'IMAGE: a wide view across a steep mountain slope in the early morning, as a strip for a slow sideways camera move: a narrow, pale, rocky footpath zig-zags down the slope from the upper right to the lower left and stays clearly visible all the way; low-poly granite rocks and boulders, a few dry desert shrubs, the warm reddish-brown mountain (#8A5A40, #A8714E) rising above; far below on the left, a wide sandy plain with a tiny cluster of dark tents (the camp); a pale blue sky with a few soft clouds. The ground reaches the bottom edge across the full width.'], avoid: 'scene'},
	{group: 'bg', file: 'bg_camp_mid.png', size: 'L', bg: 'layer', light: 'morning', prio: 'MUST',
		attach: ['bg_mountain_path.png', 'style_ref_2.png'],
		use: 'S9 the camp steps back, S10 the veil',
		lines: [`${A.scene('the approved mountain path of this same morning')} Also attached: 1 style reference screenshot. Copy only its low-poly look.`,
			'IMAGE: the MIDDLE layer of the Israelite camp at the foot of the mountain in the morning, as a wide strip: rows of simple tents of dark brown and beige striped goat-hair cloth with wooden poles and ropes, a few clay jars, baskets, woven mats and a small unlit fire pit ringed with stones; an open, flat sandy area across the middle and front where people can stand; warm sand ground (#D9B27C, #C9A46E) across the full width that continues all the way down to the bottom edge. Everything above the tents is transparent.'], avoid: 'scene'},
	{group: 'bg', file: 'bg_sea_walls.png', size: 'P', bg: 'full', light: 'sea', prio: 'MUST',
		attach: ['style_ref_2.png'],
		use: 'S3 the sea split in two (the water moves in code); the SEA badge',
		lines: [A.refs(1, 'low-poly look, flat facets and soft haze'),
			'IMAGE: the Red Sea parted, seen from the start of the path: a straight path of dry, dark wet sand leads away into the distance through the middle of the image, between two towering vertical walls of deep water on the left and the right, built from large flat-shaded low-poly facets of deep teal and blue (#1F5F6E, #2E7F8A, #5FA7B0) with foam-white crests along their tops and fine spray; a few shells and pebbles on the sand; a deep blue-violet dusk sky in the narrow gap far above. Huge and awe-inspiring. No people.'], avoid: 'scene'},
	{group: 'bg', file: 'bg_hillside_sunrise.png', size: 'P', bg: 'full', light: 'sunrise', prio: 'MUST',
		attach: ['style_ref_2.png'],
		use: 'S12 right half: Jesus and the people in warm light, S13 the 2 Corinthians 4:6 card at sunrise, S14 background glow',
		lines: [A.refs(1, 'low-poly look, rounded hills and soft haze'),
			'IMAGE: a gentle green hillside in Galilee at sunrise, filling the whole image: a soft grassy slope in the lower half (#8A8F45, #A3A36E) with a few low-poly olive trees and small cream and gold wildflowers, a pale footpath curving up the slope, an open grassy area in the lower middle where people can stand, distant soft hills; a warm sunrise sky glowing gold and peach (#F2B544, #F7D9A0, #F3ECDF) low behind the far hills and fading to soft blue at the top. Peaceful and welcoming. The ground reaches the bottom edge.'], avoid: 'scene'},
	{group: 'bg', file: 'bg_rock_crack_inside.png', size: 'P', bg: 'hole', light: 'cleft', prio: 'NICE',
		attach: ['bg_rock_crack.png', 'style_ref_2.png'],
		use: 'S6 the tight shot from inside the cleft, looking out at the river of light',
		lines: [`${A.scene('the approved rock cleft of this same scene')} Also attached: 1 style reference screenshot. Copy only its low-poly look.`,
			'IMAGE: the view from INSIDE a narrow cleft in the granite, looking out: dark rock walls fill the left and right sides of the image and close in at the top, built from large flat-shaded low-poly facets in deep grey-brown (#2E2A28, #3E3834, #4A4440); in the middle, a tall, narrow, jagged opening from the bottom edge to near the top, through which the outside will be seen. The space inside this gap is the OPENING (see BACKGROUND).'], avoid: 'scene'},
	{group: 'bg', file: 'bg_camp_far.png', size: 'L', bg: 'full', light: 'morning', prio: 'NICE',
		attach: ['bg_camp_mid.png', 'bg_mountain_path.png'],
		use: 'S9 the mountain and the plain behind the camp (parallax)',
		lines: [`${A.scene('the approved camp and mountain path of this same morning')}`,
			'IMAGE: the FAR view behind the Israelite camp, filling the whole image: the great mountain rising high in the middle, rocky and reddish-brown in low-poly facets, with a soft white cloud resting on its top; a wide sandy desert plain in front of it reaching the bottom edge; a pale morning sky.'], avoid: 'scene'},
	{group: 'bg', file: 'bg_desert_bush.png', size: 'P', bg: 'full', light: 'desert', prio: 'NICE',
		attach: ['prop_burning_bush.png', 'style_ref_2.png'],
		use: 'S3 the desert behind the burning bush',
		lines: [`${A.refs(1, 'low-poly look and soft haze')} Also attached: our approved bush props (do not draw the bush; leave room for it).`,
			'IMAGE: a quiet desert valley at the foot of a rocky mountain, filling the whole image: sand dunes and faceted rocks, a few small dry shrubs far away, the mountain slope behind; an open sandy spot in the center front, about a third of the way up from the bottom, where a bush will be placed later. The ground reaches the bottom edge.'], avoid: 'scene'},
	{group: 'bg', file: 'bg_sinai_near_rocks.png', size: 'L', bg: 'layer', light: 'stormrock', prio: 'NICE',
		attach: ['bg_sinai_ledge.png'],
		use: 'S1, S4, S6 foreground rocks close to the lens (blurred in code)',
		lines: [`${A.scene('the approved summit rock of this same storm scene')}`,
			'IMAGE: the NEAR layer: big dark jagged rocks and boulders along the bottom edge and in the lower corners of the image, very close to the camera, in dark granite facets (#2E2A28, #3E3834) with cool storm-light edges; the middle and top of the image are empty. Everything that is not rock is transparent.'], avoid: 'scene'},
];
assets.forEach((a, i) => (a.n = i + 1));

const prompt = (a) => [STYLE, ...a.lines, LIGHT[a.light], BG[a.bg], SIZE[a.size].format, AVOID[a.avoid] ?? a.avoid].join('\n\n');
const must = assets.filter((a) => a.prio === 'MUST');
const nice = assets.filter((a) => a.prio === 'NICE');
const GROUP_TITLE = {char: 'Characters', prop: 'Props', bg: 'Backgrounds (layers)'};

const md = [];
md.push(`# The Face of God: GPT Image prompts

Idea 60, GPT Image episode. **${assets.length} images: ${must.length} MUST-HAVE, ${nice.length} NICE-TO-HAVE.** Characters come first.
Make the **MUST** images first, in number order, then the NICE ones. Later prompts attach earlier images
as references. Every NICE image has a code fallback, so skipping one is fine. If time runs short,
**#1, #2, #3, #7, #11, #14, #16 and #17 matter most** (Moses and his poses, Jesus, the tablets, the storm
sky, the summit and the rock cleft).

Reused from earlier episodes, so **no new image is needed**: Jesus (turnaround, poses and parts from
Friend), the twelve at the table and the upper room by lamplight (Friend), and the look of Moses
(They Never Died).

## How to make them in ChatGPT

1. Download the files in \`style_refs/\`: \`style_ref_1.png\` (close-up), \`style_ref_2.png\` (wide scene),
   \`style_ref_3.png\` (group), \`ref_moses.png\` (our Moses from They Never Died), \`ref_jesus_turnaround.png\`
   and \`ref_jesus_poses_b.png\` (Jesus from Friend), and \`ref_disciples_seated.png\` (the disciples from Friend).
2. **Make #1, \`char_moses_turnaround.png\`, first.** Re-roll until it is right: dark brown outline, one
   almond eye, no mouth, mitten hands, white hair and a long white beard, a red-brown robe with a cream
   sash, no halo and no text. **This is the style anchor: attach it to the images after it**, as the
   "Attach" lists show.
3. For each image: open a chat, attach the files in **Attach**, paste the prompt from its box, and send.
   If it is close but not right, fix it in the same chat (for example "same image, but the beard is longer").
4. Save each result as a full-size PNG (download it, don't screenshot it) and **rename it to the exact
   file name** shown.
5. Re-roll any image that has text, letters, a frame, a border, a mouth (except where a pose allows a
   smile), extra fingers, a halo, writing on the tablets, or **anything that looks like a figure, face or
   hand in the sky or the light**. God is never drawn: his glory is light that I make in code.

Tips: use one ChatGPT chat for Moses (#1–#4, #8) so he stays consistent, one for the people (#5, #6, #9),
and a new chat for each background scene. Characters and props are drawn in plain, even light on purpose:
I add the storm, the lightning, the glory and the sunrise in animation.

## If transparency fails

ChatGPT sometimes paints a fake checkerboard, or a white or grey background, instead of real
transparency. Then send the same prompt again, but **replace the whole BACKGROUND line** with:

\`\`\`text
${MAGENTA_LINE}
\`\`\`

For the rock cleft (#17 and #22), only the inside of the opening should be magenta. I remove the magenta
in code.

## Where to put them

Put every finished image in **\`grace-reels/episodes/face-of-god/assets/gpt/\`** with the exact file name.

- **Easiest:** on GitHub, open the branch \`ccr-a41eecd7-s7gufw\`, go to that folder, choose
  **Add file → Upload files**, drop the PNGs in, and commit to the same branch.
- **Or:** attach them in our chat and say which number each one is.

Then type **DONE**.

## STYLE BLOCK (starts every prompt)

> ${STYLE}

## CHARACTER BIBLE (repeated word for word in every prompt for that character)

${Object.values(BIBLE).map((b) => `- ${b}`).join('\n')}
- GOD is never drawn as a person, a face or a hand. His glory is only light, made in code.

## All images at a glance

| # | File | Size | Transparent | Priority | Attach | Used in |
|---|---|---|---|---|---|---|
${assets.map((a) => `| ${a.n} | \`${a.file}\` | ${SIZE[a.size].w}×${SIZE[a.size].h} | ${BG_KIND[a.bg]} | ${a.prio} | ${a.attach.join(', ')} | ${a.use} |`).join('\n')}

Made in code, so no image is needed: God's glory (the light, the river of light, the light trails), the
storm (lightning, rain, wind), fire, the moving sea, Moses' glow, dust and sparks, the light-streak
transition, the split screen, the three badges, the end card, the comment box and every word on screen.
`);

for (const g of ['char', 'prop', 'bg']) {
	md.push(`## ${GROUP_TITLE[g]}\n`);
	for (const a of assets.filter((x) => x.group === g)) {
		md.push(`### ${a.n}. \`${a.file}\` · ${a.prio === 'MUST' ? 'MUST-HAVE' : 'NICE-TO-HAVE'}

- **Size:** ${SIZE[a.size].label}
- **Transparent:** ${BG_KIND[a.bg]}
- **Attach:** ${a.attach.join(', ')}
- **Used in:** ${a.use}

\`\`\`text
${prompt(a)}
\`\`\`
`);
	}
}

writeFileSync(join(EP, 'GPT_IMAGE_PROMPTS.md'), md.join('\n'));

mkdirSync(join(EP, 'assets', 'gpt'), {recursive: true});
writeFileSync(join(EP, 'assets', 'gpt', 'README.md'), `# GPT Image uploads: The Face of God

Upload the finished PNGs here with these exact names. Prompts: \`../../GPT_IMAGE_PROMPTS.md\`.

| # | File | Size | Transparent | Priority |
|---|---|---|---|---|
${assets.map((a) => `| ${a.n} | \`${a.file}\` | ${SIZE[a.size].w}×${SIZE[a.size].h} | ${BG_KIND[a.bg]} | ${a.prio} |`).join('\n')}
`);

writeFileSync(join(EP, 'assets_manifest.json'), JSON.stringify(assets.map((a) => ({
	n: a.n, group: a.group, file: a.file, width: SIZE[a.size].w, height: SIZE[a.size].h, background: a.bg, light: a.light,
	priority: a.prio, attach: a.attach, use: a.use,
})), null, 2) + '\n');

console.log(`${assets.length} prompts (${must.length} MUST, ${nice.length} NICE) written to ${EP}`);
