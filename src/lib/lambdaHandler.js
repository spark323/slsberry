
var Base64 = require("js-base64").Base64;
const Joi = require("joi");
/**
 * @param {APIGatewayEvent} event - Handler로 전달받은 APIGatewayEvent
 * @param {RestApiSpec} apiSpec - apiSpec
 * @return {HandleTestInputResult} { inputObject, validateInputObject }
 */
function handleTestInput(event, apiSpec) {
	const method = apiSpec.method ? apiSpec.method.toLowerCase() : apiSpec.event[0].method ? apiSpec.event[0].method.toLowerCase() : "post";
	let inputObject;
	if (method === "get" || method === "delete" || method == "websocket") {
		inputObject = event.queryStringParameters ? event.queryStringParameters : {};
	} else {
		if (event.isBase64Encoded) {
			inputObject = event.body ? JSON.parse(Base64.decode(event.body)) : {};
		} else {
			inputObject = event.body ? JSON.parse(event.body) : {};
		}
	}

	let inputCheckObject = validateInput(inputObject, apiSpec);

	inputObject = setDefaultValue(inputObject, apiSpec);

	return { inputObject, inputCheckObject };
}
function replaceAll(str, find, replace) {
	return str.replace(new RegExp(find, "g"), replace);
}
function setDefaultValue(inputObject, apiSpec) {
	const parms = apiSpec.parameters;
	for (var property in parms) {
		const parm = parms[property];
		if (parm.default != undefined) {
			if (inputObject[property] === undefined) {
				if (parm.default == "undefined") {
					inputObject[property] = undefined;
				} else {
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
		columnsMap.push({ db: property, dt: dt++, searchable: prop[property].searchable ? true : false, projection: prop[property].projection != undefined && prop[property].projection === false ? false : true });
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
			"Refreshed-Token": newToken ? newToken : "none",
			"Access-Control-Allow-Origin": "*",
			Location: url,
		},
		body: JSON.stringify(body),
	};
	return response;
}

/**
 * @param {string} url - Redirect 할 URL
 * @param {LambdaResponseBody} body - Response 생성 시 포함할 body
 * @param {string=} newToken - refresh token
 * @return {APIGatewayProxyResult} 생성된 Redirection Response
 */
function createRedirectionResponseV2(url, body, newToken, apiSpec) {
	var response = {
		isBase64Encoded: false,
		statusCode: 302,

		body: JSON.stringify(body),
	};
	if (!apiSpec.url) {
		response = {
			...response,
			headers: {
				"Content-Type": "application/json; charset=utf-8",
				"Access-Control-Expose-Headers": "*",
				"Refreshed-Token": newToken ? newToken : "none",
				"Access-Control-Allow-Origin": "*",
				Location: url,
			},
		}
	}
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
			"Refreshed-Token": newToken ? newToken : "none",
			"Access-Control-Allow-Origin": "*",
			"api-version": process.env.version,
		},
		body: JSON.stringify(body),
	};
	return response;
}

/**
 * @param {LambdaResponseBody} body - Response 생성 시 포함할 body
 * @param {string=} newToken - refresh token
 * @return {APIGatewayProxyResult} 생성된 OK Response
 */
function createOKResponseV2(body, newToken, apiSpec) {
	let response = {
		isBase64Encoded: false,
		statusCode: 200,

		body: JSON.stringify(body),
	};
	if (!apiSpec.url) {
		response = {
			...response,
			headers: {
				headers: {
					"Content-Type": "application/json; charset=utf-8",
					"Access-Control-Expose-Headers": "*",
					"Refreshed-Token": newToken ? newToken : "none",
					"Access-Control-Allow-Origin": "*",
					"api-version": process.env.version,
				},
			}
		}
		return response;
	}
}
function createPredefinedErrorResponse(errors, errorType, comment) {
	// if (comment) {
	//   console.log(comment);
	// }
	const obj = errors[errorType];
	const reason = obj.reason;
	const statusCode = obj.status_code;
	let body = { result: errorType };
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
		body: JSON.stringify(body),
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
	let body = { result: errorType };
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
		body: JSON.stringify(body),
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
		body: JSON.stringify(body),
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
		body: JSON.stringify(body),
	};
	//console.log(response);
	return response;
}
async function sendError(error, event, errorHandler = undefined) {
	if (!event.testing) {
		const path = `(${process.env.version})${process.env.app}${event.requestContext.path}/${event.requestContext.httpMethod}`;

		// console.log(path);
		// console.log(error);

		const lambdaName = process.env.error_trace_lambda;
		var stack = new Error().stack;
		const obj = {};
		Error.captureStackTrace(obj);
		const params = {
			FunctionName: lambdaName,
			Payload: JSON.stringify({
				path: path,
				error: error,
				error_str: error.toString(),
				stack: stack,
				obj_stack: obj.stack,
			}),
		};
		//console.log(params);
		if (errorHandler) {
			await errorHandler(params);
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
		body: JSON.stringify(body),
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
		body: JSON.stringify(body),
	};
	return response;
}
function isNumber(n) {
	return !isNaN(parseFloat(n)) && isFinite(n);
}

function isObject(o) {
	return !!o && o.constructor === Object;
}

function validateInput(inputObject, apiSpec) {
	//apiSpec->joi
	let joiObject = {};
	for (const prop in apiSpec.parameters) {
		const parm = apiSpec.parameters[prop];
		let joiprop = undefined;
		if (parm.type.toLowerCase() === "json" || parm.type.toLowerCase() === "object") {
			joiprop = Joi.object();
		} else if (parm.type.toLowerCase() === "integer") {
			joiprop = Joi.number().integer();
		} else if (parm.type.toLowerCase() === "float") {
			joiprop = Joi.number();
		} else if (parm.type.toLowerCase().includes("string")) {
			joiprop = Joi.string();
			if (parm.req == false || parm.req == undefined) {
				joiprop = joiprop.allow(null, "");
			}
			if (parm.subtype === "email") {
				joiprop = joiprop.email();
			}
			if (parm.pattern) {
				joiprop = joiprop.pattern(new RegExp(parm.pattern));
			}
		} else {
			continue;
		}
		if (parm.min) {
			joiprop = joiprop.min(parm.min);
		}
		if (parm.max) {
			joiprop = joiprop.max(parm.max);
		}
		if (parm.req) {
			joiprop = joiprop.required();
		} else {
			joiprop.allow(null, "");
		}
		if (parm.default) {
			joiprop = joiprop.default(parm.default);
		}
		joiprop = joiprop.error((errors) => {
			errors.forEach((err) => {
				switch (err.code) {
					case "any.empty":
						err.message = `"${err.path[0]}" should not be empty`;
						break;
					case "string.min":
						err.message = `"${err.path[0]}" should have at least ${err.local.limit} characters`;
						break;
					case "string.max":
						err.message = `"${err.path[0]}" should have at most ${err.local.limit} characters`;
						break;
					case "string.pattern.base":
						err.message = `invalid string format for "${err.path[0]}"`;
						break;
					default:
						break;
				}
			});
			return errors;
		});
		joiObject[prop] = joiprop;
	}
	//원하는게 없으면
	if (Object.keys(joiObject).length < 1) {
		return { passed: true };
	}
	let schema = Joi.object(joiObject).unknown(true);
	//with 처리
	for (const prop in apiSpec.parameters) {
		const parm = apiSpec.parameters[prop];
		if (parm.with) {
			schema = schema.with(prop, parm.with);
		}
		if (parm.xor) {
			schema = schema.xor(prop, parm.xor);
		}
	}
	const { error, value } = schema.validate(inputObject);

	if (error) {
		console.log(error.details[0].message);
		return { passed: false, result: error.details[0].message, stack: error.stack };
	}
	return { passed: true };
}
function isFloat(n) {
	return Number(n) === n && n % 1 !== 0;
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
		console.log("Parameter not found:", inputCheckObject.result);
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
				result: typeof inputObject.mockResult === "string" ? JSON.parse(inputObject.mockResult) : inputObject.mockResult,
				data: typeof inputObject.mock === "string" ? JSON.parse(inputObject.mock) : inputObject.mock,
			});
		}
	}

	//predefined error 추가
	let keys = Object.keys(apiSpec.errors);
	keys.map((key) => {
		apiSpec.errors[key].result = key;
	});

	let response;
	try {
		const result = await handler(inputObject, event);
		if (apiSpec.responses.raw) {
			response = result;
		} else if (result.status === 302) {
			response = createRedirectionResponseV2(result.url, result.response, undefined, apiSpec);
		} else if (result.status === 200) {
			response = createOKResponseV2(result.response, undefined, apiSpec);
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
}

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
module.exports.validateInput = validateInput;
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
