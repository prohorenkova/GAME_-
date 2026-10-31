export function aabb(a, b) {
  return (
    a.x < b.x + b.w &&
    a.x + a.w > b.x &&
    a.y < b.y + b.h &&
    a.y + a.h > b.y
  );
}

export function resolvePlatforms(player, platforms, prevX, prevY) {
  let grounded = false;
  const pw = player.w;
  const ph = player.h;

  for (const p of platforms) {
    if (!aabb(player, p)) continue;

    const oL = player.x + pw - p.x;
    const oR = p.x + p.w - player.x;
    const oT = player.y + ph - p.y;
    const oB = p.y + p.h - player.y;

    const minX = Math.min(oL, oR);
    const minY = Math.min(oT, oB);

    const wasAbove = prevY + ph <= p.y + 2;
    const wasBelow = prevY >= p.y + p.h - 2;
    const wasLeft = prevX + pw <= p.x + 2;
    const wasRight = prevX >= p.x + p.w - 2;

    if (wasAbove && player.vy >= 0 && oT <= minX + 4) {
      player.y = p.y - ph;
      player.vy = 0;
      grounded = true;
    } else if (wasBelow && player.vy < 0 && oB <= minX + 4) {
      player.y = p.y + p.h;
      player.vy = 0;
    } else if (wasLeft && player.vx > 0) {
      player.x = p.x - pw;
      player.vx = 0;
    } else if (wasRight && player.vx < 0) {
      player.x = p.x + p.w;
      player.vx = 0;
    } else if (minY < minX) {
      if (oT < oB) {
        player.y = p.y - ph;
        player.vy = 0;
        grounded = true;
      } else {
        player.y = p.y + p.h;
        player.vy = 0;
      }
    } else if (oL < oR) {
      player.x = p.x - pw;
      player.vx = 0;
    } else {
      player.x = p.x + p.w;
      player.vx = 0;
    }
  }

  return grounded;
}
