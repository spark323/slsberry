var AWS = require("aws-sdk");
var Base64 = require('js-base64').Base64;

/**
 * @param {APIGatewayEvent} event - Handler로 전달받은 APIGatewayEvent
 * @param {RestApiSpec} apiSpec - apiSpec
 * @return {HandleTestInputResult} { inputObject, checkInputObject }
 */
function handleTestInput(event, apiSpec) {
  if (event.testing) {
    var credentials = new AWS.SharedIniFileCredentials({ profile: event.testProfile });
    AWS.config.credentials = credentials;
    process.env.enviroment = "jest"
    process.env.TZ = 'Asia/Seoul'
    process.env.app = event.app;
    process.env.stage = event.stage;
    process.env.testing = true;
    if (event.hasOwnProperty("requestContext")) {
      event["requestContext"]["identity"] = { sourceIp: "-" }
      event["requestContext"]["http"] = { sourceIp: "-" }
    }
    else {
      event["requestContext"] = { identity: { sourceIp: "-" }, http: { sourceIp: "-" } }
    }
    event.env.forEach((item, index) => {
      process.env[item.key] = item.value;
    });
  }
  const method = (apiSpec.method) ? apiSpec.method.toLowerCase() : (apiSpec.event[0].method) ? apiSpec.event[0].method.toLowerCase() : "post";
  let inputObject;
  if (method === "get" || method === "delete" || method == "websocket") {
    inputObject = (event.queryStringParameters) ? event.queryStringParameters : {};
  }
  else {
    if (event.isBase64Encoded) {
      inputObject = (event.body) ? JSON.parse(Base64.decode(event.body)) : {};

    }
    else {

      inputObject = (event.body) ? JSON.parse(event.body) : {};
    }
  }

  let inputCheckObject = checkInput(inputObject, apiSpec)

  inputObject = setDefaultValue(inputObject, apiSpec)

  return { inputObject, inputCheckObject };

}
function replaceAll(str, find, replace) {
  return str.replace(new RegExp(find, 'g'), replace);
}
function setDefaultValue(inputObject, apiSpec) {
  const parms = apiSpec.parameters;
  for (var property in parms) {
    const parm = parms[property];
    if (parm.default != undefined) {
      if (inputObject[property] === undefined) {
        if (parm.default == "undefined") {
          inputObject[property] = undefined;
        }
        else {
          inputObject[property] = parm.default;
        }
      }
    }

  }
  return inputObject;

}
function createColumnSpec(apiSpec) {

  const prop = apiSpec.responses.Columns.sub;
  let dt = 0;
  let columnsMap = [];
  for (var property in prop) {
    columnsMap.push({ db: property, dt: dt++, searchable: (prop[property].searchable) ? true : false, projection: (prop[property].projection != undefined && prop[property].projection === false) ? false : true })
  }
  return columnsMap;
}

/**
 * @param {APIGatewayProxyResult} response - APIGatewayProxyResult
 * @param {string} headerKey - 헤더 Key
 * @param {string} headerValue - 헤더 Value
 * @return {APIGatewayProxyResult} 헤더가 추가된 response
 */
function appendHeaderToResponse(response, headerKey, headerValue) {
  response.headers = response.headers || {};
  response.headers[headerKey] = headerValue;
  return response;
}

function createRedirectionResponse(url, body, newToken) {
  var response = {
    isBase64Encoded: true,
    statusCode: 302,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Access-Control-Expose-Headers": "*",
      "Refreshed-Token": (newToken) ? newToken : "none",
      "Access-Control-Allow-Origin": "*",
      Location: url
    },
    body: JSON.stringify(body)
  };
  return response;
}

/**
 * @param {string} url - Redirect 할 URL
 * @param {LambdaResponseBody} body - Response 생성 시 포함할 body
 * @param {string=} newToken - refresh token
 * @return {APIGatewayProxyResult} 생성된 Redirection Response
 */
function createRedirectionResponseV2(url, body, newToken) {
  var response = {
    isBase64Encoded: false,
    statusCode: 302,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Access-Control-Expose-Headers": "*",
      "Refreshed-Token": (newToken) ? newToken : "none",
      "Access-Control-Allow-Origin": "*",
      Location: url
    },
    body: JSON.stringify(body)
  };
  return response;
}

/**
 * @param {LambdaResponseBody} body - Response 생성 시 포함할 body
 * @param {string=} newToken - refresh token
 * @return {APIGatewayProxyResult} 생성된 OK Response
 */
function createOKResponse(body, newToken) {
  let response = {
    isBase64Encoded: true,
    statusCode: 200,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Access-Control-Expose-Headers": "*",
      "Refreshed-Token": (newToken) ? newToken : "none",
      "Access-Control-Allow-Origin": "*",
      "api-version": process.env.version,
    },
    body: JSON.stringify(body)
  };
  return response;
}

/**
 * @param {LambdaResponseBody} body - Response 생성 시 포함할 body
 * @param {string=} newToken - refresh token
 * @return {APIGatewayProxyResult} 생성된 OK Response
 */
function createOKResponseV2(body, newToken) {
  let response = {
    isBase64Encoded: false,
    statusCode: 200,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Access-Control-Expose-Headers": "*",
      "Refreshed-Token": (newToken) ? newToken : "none",
      "Access-Control-Allow-Origin": "*",
      "api-version": process.env.version,
    },
    body: JSON.stringify(body)
  };
  return response;
}
function createPredefinedErrorResponse(errors, errorType, comment) {

  // if (comment) {
  //   console.log(comment);
  // }
  const obj = errors[errorType];
  const reason = obj.reason;
  const statusCode = obj.status_code;
  let body = { "result": errorType };
  if (reason && process.env.stage === "dev") {
    body["reason"] = reason;
  }
  let response = {
    isBase64Encoded: true,
    statusCode: statusCode,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Access-Control-Allow-Origin": "*",
      "api-version": process.env.version,
    },
    body: JSON.stringify(body)
  };
  //console.log(response);
  return response;
}
function createPredefinedErrorResponseV2(errors, errorType, comment) {

  // if (comment) {
  //   console.log(comment);
  // }
  const obj = errors[errorType];
  const reason = obj.reason;
  const statusCode = obj.status_code;
  let body = { "result": errorType };
  if (reason && process.env.stage === "dev") {
    body["reason"] = reason;
  }
  let response = {
    isBase64Encoded: false,
    statusCode: statusCode,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Access-Control-Allow-Origin": "*",
      "api-version": process.env.version,
    },
    body: JSON.stringify(body)
  };
  //console.log(response);
  return response;
}

/**
 * @param {number} httpCode - Response의 status code
 * @param {LambdaResponseBody} body - Response 생성 시 포함할 body
 * @param {string=} reason - 현재 사용되지 않음
 * @return {APIGatewayProxyResult} 생성된 Error Response
 */
function createErrorResponse(httpCode, body, reason = undefined) {
  let response = {
    isBase64Encoded: true,
    statusCode: httpCode,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Access-Control-Allow-Origin": "*",
      "api-version": process.env.version,
    },
    body: JSON.stringify(body)
  };
  //console.log(response);
  return response;
}

/**
 * @param {number} httpCode - Response의 status code
 * @param {LambdaResponseBody} body - Response 생성 시 포함할 body
 * @param {string=} reason - 현재 사용되지 않음
 * @return {APIGatewayProxyResult} 생성된 Error Response
 */
function createErrorResponseV2(httpCode, body, reason = undefined) {
  let response = {
    isBase64Encoded: false,
    statusCode: httpCode,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Access-Control-Allow-Origin": "*",
      "api-version": process.env.version,
    },
    body: JSON.stringify(body)
  };
  //console.log(response);
  return response;
}
async function sendError(error, event) {
  if (!event.testing) {
    const path = `(${process.env.version})${process.env.app}${event.requestContext.path}/${event.requestContext.httpMethod}`;

    // console.log(path);
    // console.log(error);

    const lambdaName = process.env.error_trace_lambda
    var stack = new Error().stack
    const obj = {};
    Error.captureStackTrace(obj);
    const params = {
      FunctionName: lambdaName,
      Payload: JSON.stringify({
        'path': path,
        'error': error,
        'error_str': error.toString(),
        'stack': stack,
        'obj_stack': obj.stack,
      }),

    };
    //console.log(params);
    try {
      const lambda = new AWS.Lambda();
      const result = await lambda.invoke(params).promise();
      //  console.log(result);
    }
    catch (e) {
      console.error(e);
    }

  }
}

async function createInternalErrorResponse(event, error, httpCode, body, reason = undefined) {

  if (reason && process.env.stage === "dev") {
    body["result"] = reason;
  }
  if (error) {
    await sendError(error, event);

  }
  let response = {
    isBase64Encoded: true,
    statusCode: httpCode,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Access-Control-Allow-Origin": "*",
      "api-version": process.env.version,
    },
    body: JSON.stringify(body)
  };
  return response;
}
async function createInternalErrorResponseV2(event, error, httpCode, body, reason = undefined) {

  if (reason && process.env.stage === "dev") {
    body["result"] = reason;
  }
  if (error) {
    await sendError(error, event);

  }
  let response = {
    isBase64Encoded: false,
    statusCode: httpCode,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Access-Control-Allow-Origin": "*",
      "api-version": process.env.version,
    },
    body: JSON.stringify(body)
  };
  return response;
}
function isNumber(n) {
  return !isNaN(parseFloat(n)) && isFinite(n);
}

function isObject(o) {
  return (!!o) && (o.constructor === Object);
}

function checkInput(inputObject, apiSpec) {

  if (!inputObject && Object.keys(apiSpec.parameters).length) {
    return { "passed": false, "result": "parameter_does_not_exist", "stack": "-" }
  }
  const check = iterate(apiSpec.parameters, inputObject, "inputObject");

  if (check != true) {
    return { "passed": false, "result": check.reason, "stack": check.stack }
  }
  return ({ "passed": true });
}
function isFloat(n) {
  return Number(n) === n && n % 1 !== 0;
}
function iterate(apiSpec, inputObject, stack = "") {

  for (var property in apiSpec) {

    if (apiSpec.hasOwnProperty(property)) {
      const val = apiSpec[property];

      if (val.req && ((inputObject[property] === undefined) || inputObject[property].length < 1)) {
        return { "result": "parameter_not_exist", "stack": stack + '.' + property, "reason": `${property} is required` };
      }
      if (inputObject[property] != undefined) {
        if (val.type === "Integer") {
          if (isNaN(inputObject[property])) {
            return { "result": "invalid_type_of_parameter", "reason": "invalid_type_of_parameter,expected integer", "stack": stack + '.' + property };
          }
          if (inputObject[property].length > 0) {
            const valueToInspect = parseInt(inputObject[property]);
            if (val.min) {
              if (val.min > valueToInspect) {
                return { "result": "parameter_value_too_small", "reason": `parameter less than min, expected greater than ${val.min}`, "stack": stack + '.' + property };
              }
            }
            if (val.max) {
              if (val.max < valueToInspect) {
                return { "result": "parameter_value_too_big", "reason": `parameter greater than max, expected less than ${val.max}`, "stack": stack + '.' + property };
              }
            }
          }
        }
        if (val.type === "Float") {
          if (isNaN(inputObject[property])) {
            return { "result": "invalid_type_of_parameter", "reason": "invalid_type_of_parameter,expected float", "stack": stack + '.' + property };
          }
          if ((!isFloat(inputObject[property]) && !Number.isInteger(inputObject[property]))) {
            return { "result": "invalid_type_of_parameter", "reason": "invalid_type_of_parameter,expected float", "stack": stack + '.' + property };
          }
          if (inputObject[property].length > 0) {
            const valueToInspect = parseInt(inputObject[property]);
            if (val.min) {
              if (val.min > valueToInspect) {
                return { "result": "parameter_value_too_small", "reason": `parameter less than min, expected greater than ${val.min}`, "stack": stack + '.' + property };
              }
            }
            if (val.max) {
              if (val.max < valueToInspect) {
                return { "result": "parameter_value_too_big", "reason": `parameter greater than max, expected less than ${val.max}`, "stack": stack + '.' + property };
              }
            }
          }
        }
        if (val.type === "Array") {

          if (!Array.isArray(inputObject[property])) {

            return { "result": "invalid_type_of_parameter", "reason": `invalid_type_of_parameter,expected array`, "stack": stack + '.' + property };

          }
          if (val.req) {
            if (inputObject[property].length < 1) {
              return { "result": "array_is_empty", "reason": `array_is_empty`, "stack": stack + '.' + property };
            }
          }
        }
        if (val.type.toLowerCase() === "string") {
          const valueToInspect = inputObject[property]
          // if (valueToInspect.length < 1) {
          //   return { "result": "invalid_type_of_parameter", "reason": `parameter cannot be an empty string`, "stack": stack + '.' + property };
          // }
          if (val.notEmpty) {
            if (valueToInspect === "") {
              return { "result": "parameter_canot_be_an_emptystring", "reason": `parameter cannot be an empty string`, "stack": stack + '.' + property };
            }
          }
          if (val.min) {
            if (valueToInspect.length > 0 && (val.min > valueToInspect.length)) {
              return { "result": "parameter_length_too_short", "reason": `parameter length less than min, expected greater than ${val.min}`, "stack": stack + '.' + property };
            }
          }
          if (val.max) {
            if (valueToInspect.length > 0 && (val.max < valueToInspect.length)) {
              return { "result": "parameter_length_too_long", "reason": `parameter length greater than max, expected less than ${val.max}`, "stack": stack + '.' + property };
            }
          }
        }
        if (val.type.toLowerCase() === "password") {
          const valueToInspect = inputObject[property]

          if (val.min) {
            if (val.min > valueToInspect.length) {
              return { "result": "parameter_length_too_short", "reason": `parameter length less than min, expected greater than ${val.min}`, "stack": stack + '.' + property };
            }
          }
          if (val.max) {
            if (val.max < valueToInspect.length) {
              return { "result": "parameter_length_too_long", "reason": `parameter length greater than max, expected less than ${val.max}`, "stack": stack + '.' + property };
            }
          }
        }


      }
    }
  }
  return true;
}
/**
 *  @author: 허세현(marshall@reconlabs.ai)
  * @param {object} event Lambda HttpApi event
  * @param {object} context Lambda context
  * @param {object} apiSpec API specification
  * @param {object} handler Business logic
  * @param {object} Logger Logger class, 추후 Logger가 공용 모듈로 분리되면 dependancy로 두고 직접 require하도록 수정 예정
  */
async function handleHttpRequest(event, context, apiSpec, handler, Logger) {
  Logger?.init?.(context);
  // input 체크
  let { inputObject, inputCheckObject } = handleTestInput(event, apiSpec);
  if (!inputCheckObject.passed) {
    console.log('Parameter not found:', inputCheckObject.result);
    await Logger?.finalize?.();
    return createErrorResponseV2(422, {
      result: inputCheckObject.reason,
      parameter: inputCheckObject.stack,
    });
  }

  // test stage의 경우 echoing 기능 추가
  if (process.env.allow_mock === "true" && process.env.stage != "prod") {
    if (inputObject.mock) {
      await Logger?.finalize?.();
      return createOKResponseV2({
        result: (typeof inputObject.mockResult === 'string') ? JSON.parse(inputObject.mockResult) : inputObject.mockResult,
        data: (typeof inputObject.mock === 'string') ? JSON.parse(inputObject.mock) : inputObject.mock,
      });
    }
  }

  //predefined error 추가
  let keys = Object.keys(apiSpec.errors)
  keys.map(key => {
    apiSpec.errors[key].result = key
  })

  let response;
  try {
    const result = await handler(inputObject, event);
    if (apiSpec.responses.raw) {
      response = result
    }
    else if (result.status === 302) {
      response = createRedirectionResponseV2(result.url, result.response);
    }
    else if (result.status === 200) {
      response = createOKResponseV2(result.response);
    } else {
      const predefinedErrorName = isObject(result.predefinedError) ? result.predefinedError.result : result.predefinedError;
      if (predefinedErrorName) {
        if (Object.keys(apiSpec.errors || {}).includes(predefinedErrorName)) {
          response = createPredefinedErrorResponseV2(apiSpec.errors, predefinedErrorName);
        } else {
          // 주어진 predefinedError가 apiSpec에 정의되어 있지 않은 경우
          Logger?.Error("invalid_predefined_error", event.routeKey, event.requestContext?.apiId, inputObject, predefinedErrorName);
          response = createErrorResponseV2(500, {
            result: "invalid_predefined_error",
            predefinedError: predefinedErrorName,
          });
        }
      } else {
        response = createErrorResponseV2(result.status, result.response);
      }
    }
  } catch (error) {
    // handler 내에서 처리되지 않은 오류 발생 시 500, Internal Server Error 반환
    Logger?.Error("Uncaught exeception in handler", event.routeKey, event.requestContext?.apiId, inputObject, error);
    response = createErrorResponseV2(500, {
      result: "Internal Server Error",
    });
  }
  await Logger?.finalize?.();
  return response;
};


async function handleLambdaEvent(event, context, apiSpec, handler, Logger) {
  Logger?.init?.(context);
  try {
    const result = await handler(event, context);
    await Logger?.finalize?.();
    return result;
  } catch (error) {
    await Logger?.finalize?.();
    throw error;
  }
}



module.exports.handleLambdaEvent = handleLambdaEvent;
module.exports.handleHttpRequest = handleHttpRequest;
module.exports.appendHeaderToResponse = appendHeaderToResponse;
module.exports.createRedirectionResponse = createRedirectionResponse;
module.exports.createOKResponse = createOKResponse;
module.exports.handleTestInput = handleTestInput;
module.exports.checkInput = checkInput;
module.exports.createErrorResponse = createErrorResponse;
module.exports.createColumnSpec = createColumnSpec;
module.exports.setDefaultValue = setDefaultValue;
module.exports.replaceAll = replaceAll;

module.exports.createInternalErrorResponse = createInternalErrorResponse;
module.exports.sendError = sendError;
module.exports.createPredefinedErrorResponse = createPredefinedErrorResponse;


module.exports.createRedirectionResponseV2 = createRedirectionResponseV2;
module.exports.createOKResponseV2 = createOKResponseV2;
module.exports.createErrorResponseV2 = createErrorResponseV2;
module.exports.createInternalErrorResponseV2 = createInternalErrorResponseV2;
module.exports.createPredefinedErrorResponseV2 = createPredefinedErrorResponseV2;


