"""Shared event timeline: the defaults from build_scene.py plus timeline.json."""
import ast, json, os
HERE = os.path.dirname(os.path.abspath(__file__))


def load_T():
    src = open(os.path.join(HERE, 'build_scene.py')).read()
    node = ast.parse(src[src.index('T = dict('):src.index(')\nif os.path.exists(TL_PATH)') + 1]).body[0].value
    T = {kw.arg: ast.literal_eval(kw.value) for kw in node.keywords}
    p = os.path.join(HERE, 'timeline.json')
    if os.path.exists(p):
        T.update(json.load(open(p)))
    return T
