import { App } from './App.js';

const app = new App();
// 테스트 / 디버그용 훅
window.__BOOM__ = {
  app,
  get gm() {
    return app.gm;
  },
};
app.boot().catch((e) => {
  console.error(e);
  const msg = document.querySelector('.boot-msg');
  if (msg) msg.textContent = `ERROR: ${e.message}`;
});
