
export default {
  bootstrap: () => import('./main.server.mjs').then(m => m.default),
  inlineCriticalCss: true,
  baseHref: '/',
  locale: undefined,
  routes: [
  {
    "renderMode": 2,
    "route": "/"
  },
  {
    "renderMode": 0,
    "route": "/usuario/*"
  },
  {
    "renderMode": 2,
    "route": "/acerca-de"
  }
],
  entryPointToBrowserMapping: undefined,
  assets: {
    'index.csr.html': {size: 741, hash: '2a2aac04a0eef03a9f71f8df1cecf2c71a0016822ebfa06dec07440388415955', text: () => import('./assets-chunks/index_csr_html.mjs').then(m => m.default)},
    'index.server.html': {size: 949, hash: '08f82c41f979a8e30a64f6dae584a60d25e4f5e52f0a42bca7e60f3babe9701f', text: () => import('./assets-chunks/index_server_html.mjs').then(m => m.default)},
    'index.html': {size: 20829, hash: '20e4847eb4c812d3b133079d5c56f0ccca967eb8a339f96ff884c19b1b691509', text: () => import('./assets-chunks/index_html.mjs').then(m => m.default)},
    'acerca-de/index.html': {size: 12838, hash: 'ae92791d2ad9044342e1abec55a74a51da218ad4bf9c0e0e9e74af14836af836', text: () => import('./assets-chunks/acerca-de_index_html.mjs').then(m => m.default)},
    'styles-OTEM2SPL.css': {size: 180, hash: 'S1NxJMMRY1A', text: () => import('./assets-chunks/styles-OTEM2SPL_css.mjs').then(m => m.default)}
  },
};
