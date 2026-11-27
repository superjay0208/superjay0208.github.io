const room = document.getElementById('room');
const canvas = document.getElementById('room-canvas');
const index = document.getElementById('project-index');
const reveal = document.getElementById('reveal-link');
const links = new Map([...document.querySelectorAll('[data-object]')].map(link => [link.dataset.object, link]));

function openIndexForHash() {
  if (['#work', '#vision'].includes(location.hash)) index.open = true;
}

window.addEventListener('hashchange', openIndexForHash);
document.querySelectorAll('a[href="#work"]').forEach(link => {
  link.addEventListener('click', () => { index.open = true; });
});
openIndexForHash();

if ('WebGL2RenderingContext' in window) {
  import('./assets/portfolio/room.bundle.mjs?v=object-passage-2').then(({ mountRoom }) => {
    mountRoom({ room, canvas, grip: document.getElementById('projector-grip'), reveal, links });
    if (room.classList.contains('ready') && !['#work', '#vision'].includes(location.hash)) index.open = false;
    canvas.addEventListener('webglcontextlost', () => {
      index.open = true;
    });
  }).catch(() => {
    room.classList.remove('ready');
    reveal.hidden = true;
    index.open = true;
  });
}
