// Scene: chat — "Imran, I got you!" bubble pops in, then the serif reply "I've got it!" types on below.
(function () {
  const { PAL, ease, remap, clamp, lerp } = L;
  const C = {
    start: 1.0, end: 5.0,
    // bubble geometry (1920x1080)
    bx: 330, by: 330, bw: 1080, bh: 200,
    avatarR: 62,
    msg: 'Imran, I got you!', msgSize: 96, msgFont: ['Shantell Sans', 700],
    reply: 'I’ve got it!', replySize: 84, replyFont: ['Newsreader', 500],
    // local timings (s)
    popIn: 0.0, scrollAt: 1.25, typeAt: 1.45, typeCps: 14,
    exitAt: 3.55, exitDur: 0.4,
  };

  SCENE({
    id: 'chat', start: C.start, end: C.end, z: 1, cfg: C,
    draw(ctx, lt, t) {
      const b = L.boil(t);
      // pop-in: spring scale with squash & stretch, anchored at bubble's left-center
      const pin = lt - C.popIn;
      if (pin < 0) return;
      const sp = L.spring(pin, 2.4, 0.42);
      const over = sp - 1; // overshoot drives squash
      const sx = sp * (1 - over * 0.35), sy = sp * (1 + over * 0.5);
      // chat "scroll" up when the reply arrives
      const scroll = ease.inOutCubic(remap(lt, C.scrollAt, C.scrollAt + 0.35)) * -40;
      // exit: everything shrinks back into a dot with anticipation
      const ex = remap(lt, C.exitAt, C.exitAt + C.exitDur);
      const exS = ex > 0 ? 1 - ease.inBack(ex, 2.2) : 1;
      if (exS <= 0.001) return;

      const ax = C.bx + 40, ay = C.by + C.bh / 2 + 20 + scroll;
      ctx.save();
      ctx.translate(ax, ay + (1 - sp) * 30);
      ctx.scale(sx * exS, sy * exS);
      ctx.translate(-ax, -(C.by + C.bh / 2 + 20));
      P.chatBubble(ctx, C.bx, C.by + 20, C.bw, C.bh, { b, seed: 2 });
      // avatar pops slightly after the bubble
      const av = L.spring(pin - 0.06, 3, 0.4);
      L.at(ctx, { x: C.bx + 98, y: C.by + 20 + C.bh / 2, s: Math.max(0, av) }, (c) => P.avatar(c, 0, 0, C.avatarR, { b }));
      // message words slide/fade in with a stagger
      const words = C.msg.split(' ');
      let x = C.bx + 190;
      const baseY = C.by + 20 + C.bh / 2 + C.msgSize * 0.34;
      words.forEach((w, i) => {
        const k = ease.outBack(remap(pin, 0.08 + i * 0.07, 0.38 + i * 0.07), 2);
        const ww = L.measure(ctx, w + ' ', { family: C.msgFont[0], weight: C.msgFont[1], size: C.msgSize });
        if (k > 0) {
          ctx.save();
          ctx.globalAlpha *= clamp(k * 1.5);
          L.text(ctx, w, x, baseY + (1 - k) * 22, { family: C.msgFont[0], weight: C.msgFont[1], size: C.msgSize, rough: 'soft', t });
          ctx.restore();
        }
        x += ww;
      });
      ctx.restore();

      // reply, typed letter by letter in serif
      const chars = (lt - C.typeAt) * C.typeCps;
      if (chars > 0) {
        const rx = C.bx + 190, ry = C.by + C.bh + 150;
        ctx.save();
        ctx.translate(rx, ry);
        ctx.scale(exS, exS);
        ctx.translate(-rx, -ry);
        const n = Math.min(C.reply.length, Math.floor(chars) + 1);
        L.text(ctx, C.reply, rx, ry, { family: C.replyFont[0], weight: C.replyFont[1], size: C.replySize, chars: n, rough: 'soft', t });
        ctx.restore();
      }
    },
  });
})();
