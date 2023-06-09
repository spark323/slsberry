const builder = require("./builder");
const lambdaHandler = require("./lambdaHandler");
module.exports.generateServerlessFunction = builder.generateServerlessFunction;
module.exports.generateExportFile = builder.generateExportFile;
module.exports.createNotionTable = builder.createNotionTable;
module.exports.uploadToNotion = builder.uploadToNotion;
module.exports.handleLambdaEvent = lambdaHandler.handleLambdaEvent;
module.exports.handleHttpRequest = lambdaHandler.handleHttpRequest;
module.exports.appendHeaderToResponse = lambdaHandler.appendHeaderToResponse;
module.exports.createRedirectionResponse = lambdaHandler.createRedirectionResponse;
module.exports.createOKResponse = lambdaHandler.createOKResponse;
module.exports.handleTestInput = lambdaHandler.handleTestInput;
module.exports.checkInput = lambdaHandler.checkInput;
module.exports.createErrorResponse = lambdaHandler.createErrorResponse;
module.exports.createColumnSpec = lambdaHandler.createColumnSpec;
module.exports.setDefaultValue = lambdaHandler.setDefaultValue;
module.exports.replaceAll = lambdaHandler.replaceAll;
module.exports.createInternalErrorResponse = lambdaHandler.createInternalErrorResponse;
module.exports.sendError = lambdaHandler.sendError;
module.exports.createPredefinedErrorResponse = lambdaHandler.createPredefinedErrorResponse;
module.exports.createRedirectionResponseV2 = lambdaHandler.createRedirectionResponseV2;
module.exports.createOKResponseV2 = lambdaHandler.createOKResponseV2;
module.exports.createErrorResponseV2 = lambdaHandler.createErrorResponseV2;
module.exports.createInternalErrorResponseV2 = lambdaHandler.createInternalErrorResponseV2;
module.exports.createPredefinedErrorResponseV2 = lambdaHandler.createPredefinedErrorResponseV2;

