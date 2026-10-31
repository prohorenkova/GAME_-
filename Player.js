export class Player {
  constructor(x, y, imgs) {
    this.startX = x;
    this.startY = y;
    this.x = x;
    this.y = y;
    // Подгонка размера персонажа под игровой мир
    this.w = 52;
    this.h = 40;
    this.vx = 0;
    this.vy = 0;
    this.speed = 230;
    this.jumpForce = -580;
    this.gravity = 1200;
    this.grounded = false;
    this.facing = 1;
    this.imgs = imgs; // { idle, open, jump, jumpOpen }
    this.animTimer = 0;
    this.mouthOpen = false;
  }

  setImages(imgs) {
    this.imgs = imgs;
  }

  reset() {
    this.x = this.startX;
    this.y = this.startY;
    this.vx = 0;
    this.vy = 0;
    this.grounded = false;
    this.facing = 1;
    this.animTimer = 0;
    this.mouthOpen = false;
  }

  update(dt, input) {
    this.vx = 0;
    if (input.keys.left) {
      this.vx = -this.speed;
      this.facing = -1;
    }
    if (input.keys.right) {
      this.vx = this.speed;
      this.facing = 1;
    }

    if (input.keys.jumpPressed && this.grounded) {
      this.vy = this.jumpForce;
      this.grounded = false;
    }
    input.clearJumpPressed();

    this.vy += this.gravity * dt;
    if (this.vy > 850) this.vy = 850;

    this.x += this.vx * dt;
    this.y += this.vy * dt;

    // Простая анимация открытого рта при движении / прыжке
    this.animTimer += dt;
    if (this.animTimer > 0.18) {
      this.animTimer = 0;
      this.mouthOpen = !this.mouthOpen;
    }
    if (!this.grounded || Math.abs(this.vx) < 5) {
      // в воздухе чаще открываем рот, на земле в покое — закрыт
      if (this.grounded && Math.abs(this.vx) < 5) this.mouthOpen = false;
    }
  }

  draw(ctx, camX) {
    const px = Math.round(this.x - camX);
    const py = Math.round(this.y);

    let img;
    if (!this.grounded) {
      img = this.mouthOpen && this.imgs.jumpOpen ? this.imgs.jumpOpen : this.imgs.jump;
    } else {
      img = this.mouthOpen && this.imgs.open ? this.imgs.open : this.imgs.idle;
    }
    if (!img) img = this.imgs.idle;

    ctx.save();
    if (this.facing === -1) {
      ctx.translate(px + this.w, py);
      ctx.scale(-1, 1);
      ctx.drawImage(img, 0, 0, this.w, this.h);
    } else {
      ctx.drawImage(img, px, py, this.w, this.h);
    }
    ctx.restore();
  }
}
