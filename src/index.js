const builder = require("./lib/builder");
const lambdaHandler = require("./lib/lambdaHandler");

module.exports = {
  ...builder,
  ...lambdaHandler,
};
