#!/bin/sh
# Concatenate src/ into the single-file deliverable, index.html.
set -e
cd "$(dirname "$0")"
cat src/01-shell.html src/02-core.js src/03-art-core.js src/04-art-chars.js \
    src/05-world.js src/06-defs.js src/07-play.js src/08-render.js \
    src/09-ui.js src/10-main.js > index.html
printf '</script>\n</body>\n</html>\n' >> index.html
echo "built index.html — $(wc -l < index.html) lines"
