import { Game } from './Game.js';

const ASSETS = {
  bg: 'assets/backround.png',
  floor: 'assets/floor.png',
  platform: 'assets/platform.png',
  let: 'assets/let.png',
  worm: 'assets/worm.png',
  pten1: 'assets/pten1.png',
  pten1_1: 'assets/pten1_1.png',
  pten1_jump: 'assets/pten1_jump.png',
  pten1_jump_1: 'assets/pten1_jump_1.png',
  pten2: 'assets/pten2.png',
  pten2_1: 'assets/pten2_1.png',
  pten2_jump_1: 'assets/pten2_jump_1.png',
  pten3: 'assets/pten3.png',
  pten3_1: 'assets/pten3_1.png',
  pten3_jump: 'assets/pten3_jump.png',
  secret1: 'assets/secret1.png',
  secret1_1: 'assets/secret1_1.png',
  secret1_jump: 'assets/secret1_jump.png',
  secret1_jump_1: 'assets/secret1_jump_1.png',
  secret2: 'assets/secret2.png',
  secret2_jump: 'assets/secret2_jump.png',
  secret3: 'assets/secret3.png',
  secret3_1: 'assets/secret3_1.png',
  secret3_jump: 'assets/secret3_jump.png',
  secret3_jump_1: 'assets/secret3_jump_1.png'
};

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Failed to load ' + src));
    img.src = src;
  });
}

async function main() {
  const canvas = document.getElementById('gameCanvas');
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#1a2238';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#a8c4ff';
  ctx.font = '18px ZeroCool, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('ЗАГРУЗКА...', canvas.width / 2, canvas.height / 2);

  try {
    const images = {};
    await Promise.all(
      Object.entries(ASSETS).map(async ([key, src]) => {
        images[key] = await loadImage(src);
      })
    );
    window.game = new Game(canvas, images);
  } catch (err) {
    console.error(err);
    ctx.fillStyle = '#1a2238';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#ff6b8a';
    ctx.font = '16px ZeroCool, sans-serif';
    ctx.fillText('ОШИБКА ЗАГРУЗКИ', canvas.width / 2, canvas.height / 2);
    ctx.font = '14px ZeroCool, sans-serif';
    ctx.fillStyle = '#c8d8ff';
    ctx.fillText('Открой через локальный сервер', canvas.width / 2, canvas.height / 2 + 28);
  }
}

main();
