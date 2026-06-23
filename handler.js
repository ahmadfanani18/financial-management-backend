const { default: app } = require('./dist/index');

module.exports = async (req, res) => {
  return app(req, res);
};
