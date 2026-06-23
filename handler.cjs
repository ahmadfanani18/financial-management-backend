const { getApp } = require('./dist/index.cjs');

let app = null;

module.exports = async (req, res) => {
  if (!app) {
    app = await getApp();
  }
  await app.ready();
  app.server.emit('request', req, res);
};
