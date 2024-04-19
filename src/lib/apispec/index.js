const yaml = require("js-yaml");
const fs = require("fs");
const fspr = require("fs").promises;
const path = require("path");
const { findAllByKey, replaceAll, replaceHttpMethod } = require("../utils");

/**
 * Recursively generates a list of all files in the specified directory and its subdirectories.
 *
 * @param {string} dir - The directory path to iterate.
 * @param {Array} arr - An array to store the generated file list.
 * @returns {Promise<[{ path: string }]>} - A promise that resolves to an array containing objects with 'path' property for each file.
 */
async function getFunctionList(dir, arr) {
  // Get a list of files in the specified directory
  const result = await fspr.readdir(dir);

  // Iterate through each file in the directory
  let prom = result.map(async (file) => {
    // Resolve the absolute path of the file
    file = path.resolve(dir, file);

    // Get the file information (stats)
    const element = await fspr.stat(file);

    // Check if the file is a directory
    if (element.isDirectory()) {
      // If it's a directory, recursively call getFunctionList for the subdirectory
      const newar = await getFunctionList(file, arr);
      arr.concat(newar); // [bugfix] Use `arr = arr.concat(newar)` to concatenate arrays
    } else {
      // If it's a file, add an object with the file path to the array
      arr.push({ path: file });
    }
  });

  // Wait for all promises to be resolved
  await Promise.all(prom);

  // Return the final array containing file objects
  return arr;
}

/**
 * Retrieves a list of API specifications from Lambda function files.
 *
 * @param {Array<{ path: string }>} targetFiles - An array containing objects with 'path' property for each file.
 * @returns {{ [category: string]: import("../..").ApiSpec }} - An object containing API specifications categorized by function and any errors encountered.
 */
async function getApiSpecList(targetFiles, os = "linux") {
  const apiSpecList = {};

  for (const fileItem of targetFiles) {
    const { path } = fileItem;

    try {
      // [todo2: Optimize path parsing]
      // Generate a function name from the file path, excluding the "./src/lambda" part
      let name = path.replace(".js", "");
      name = replaceAll(name, "\\\\", "/");
      let nameArr = name.split("/");
      const idxLambda = nameArr.indexOf("lambda");
      nameArr = nameArr.slice(idxLambda - 1);
      name = nameArr.slice(2).join("/");

      //
      // Parse the function file to extract the API specification
      let obj;

      if (process.env.MODULE === "ESM") {
        obj = (await import((os.toString().toLowerCase().includes("windows")) ? `file://${path}` : path)).apiSpec;
      } else {
        obj = require(path).apiSpec;
      }

      if (obj) {
        // Add additional properties to the API specification object
        obj.operationId = obj.operationId || name;
        obj.name = name;
        obj.uri = replaceHttpMethod(name);

        // Categorize the API specification by its "category"
        apiSpecList[obj.category] = apiSpecList[obj.category] || [];
        apiSpecList[obj.category].push({ path, item: obj });
      }
    } catch (e) {
      console.log(`Error parsing ${path}`);
      console.error(e);
    }
  }

  // Return the final API specification list
  return apiSpecList;
}
function capitalizeFirstLetter(str) {
  if (!str) return str; // return the original string if it is empty or undefined
  return str.charAt(0).toUpperCase() + str.slice(1);
}
/*
가져온 apiSpec 리스트를 기반으로 serverless.yml파일을 만든다.
*/
async function printServerlessFunction(
  templateFile,
  apiSpecList,
  stage,
  version
) {
  //템플릿 파일을 읽는다.
  let serverlessTemplet1 = yaml.load(fs.readFileSync(templateFile, "utf8"));
  let functions = {};
  let extraResources = []
  //만들어둔 apiSpecList를 활용해서
  let restExist = false;
  for (var property in apiSpecList) {
    //apiSpecList는 카테고리 를 Key로 하여 구성되어 있다.
    let apiSpec = apiSpecList[property];
    if (apiSpec.length > 0) {
      //각 카테고리 별로..
      apiSpec.forEach(async (obj) => {
        const item = obj.item;
        //item의 method가 존재하고  disabled가 아니라면,
        if (
          item &&
          item.disabled !== true &&
          !(item.disabled_stages && item.disabled_stages.includes(stage))
        ) {
          const nameArr = (item.target_function) ? item.target_function.split("/") : item.name.split("/");
          let funcObject = {
            name: item.functionName
              ? item.functionName
              : `\${self:service}_${stage}_${version}_${nameArr.join("_")}`,
            handler: (item.target_function) ? `src/lambda/${item.target_function}.handler` : `src/lambda/${item.name}.handler`,
            events: [],
          };
          //event가 array가 아닐 때, 즉 옛날 버전

          if (!Array.isArray(item.event)) {
            //웹소켓 타입
            if (item.type == "websocket") {
              funcObject.events.push({
                websocket: {
                  route: `${item.event.route}`,
                },
              });
            } else if (item.type == "REST") {
              restExist = true;
              funcObject.events.push({
                httpApi: {
                  path: element.path ? element.path : `/${stage}/${(item.target_function) ? item.target_function : item.uri}`,
                  method: `${item.method
                    ? item.method.toLowerCase()
                    : item.event.method.toLowerCase()
                    }`,
                  authorizer: item.authorizer
                    ? { name: item.authorizer }
                    : undefined,
                },
              });
            }

            //s3에 의해 트리거 되는 함수
            else if (item.type == "s3") {
              funcObject.events.push({
                s3: {
                  bucket: `${item.event.bucket}`,
                  event: item.event.event,
                  existing: item.event.existing ? item.event.existing : false,
                  rules: item.event.rules ? item.event.rules : undefined,
                },
              });
            }
            //sqs에 의해 트리거 되는 함수
            else if (item.type == "sqs") {
              //sqs arn을 명시할 경우, 즉 이 serverless에서 SQS를 생성하는 것이 아닐 경우,
              if (item.sqsARN) {
                funcObject["events"].push({
                  sqs: {
                    arn: item.sqsARN,
                    batchSize: item.batchSize,
                    maximumBatchingWindow: item.maximumBatchingWindow,
                    maximumConcurrency: item.maximumConcurrency,
                  },
                });
              }
              //이 serverless에서 sqs를 생성하는 경우
              else {
                funcObject["events"].push({
                  sqs: {
                    arn: { "Fn::GetAtt": [item.sqs, "Arn"] },
                    batchSize: item.batchSize,
                    maximumBatchingWindow: item.maximumBatchingWindow,
                    maximumConcurrency: item.maximumConcurrency,
                  },
                });
              }
            }
            //cognito user pool에 의해 트리거 되는 함수
            else if (item.type == "cognito") {
              funcObject["events"].push({
                cognitoUserPool: {
                  pool: serverlessTemplet1.custom.apiSpec[item.poolNameRef],
                  trigger: item.trigger,
                  existing: true,
                },
              });
            }
            //step function에 의해 트리거 되는 함수
            else if (item.type == "sfn") {
              // serverless_template.yml에 정의된 step function에서 해당 state를 찾아서 functionName에 arn을 넣어준다
              const foundObjects = findAllByKey(
                serverlessTemplet1.resources.Resources[item.machineName]
                  .Properties.Definition.States,
                item.stateName
              );
              if (foundObjects.length === 0 || foundObjects.length > 2) {
                throw new Error(`Cannot find state ${item.stateName}`);
              }
              foundObjects[0].Parameters.FunctionName = funcObject.name;
            }
            //iot action에 의해 트리거 되는 함수
            else if (item.type == "iot") {
              funcObject["events"].push({
                iot: {
                  sql: `select *, topic() as topic from "${item.topic}"`,
                  enabled: true,
                },
              });
            }
            //어느 이벤트에도 트리거되지 않는 함수
            else if (item.type == "pure") {
            }
            //별도의 명시가 없다면 pure
            else {
            }
          } else {
            item.event.forEach((element) => {
              //웹소켓 타입
              if (element.type == "websocket") {
                funcObject.events.push({
                  websocket: {
                    route: `${element.route}`,
                  },
                });
              } else if (element.type == "REST") {
                restExist = true;
                funcObject.events.push({
                  httpApi: {
                    path: element.path ? element.path : `/${stage}/${(item.target_function) ? item.target_function : item.uri}`,
                    method: `${element.method.toLowerCase()}`,
                    authorizer: element.authorizer,
                  },
                });
              }
              //dynamodb/kinesis stream
              else if (element.type == "dynamodb_stream") {
                funcObject.events.push({
                  stream: {
                    type: "dynamodb",
                    arn: element.arn,
                  },
                });
              } else if (element.type == "kinesis_stream") {
                funcObject.events.push({
                  stream: {
                    type: "kinesis",
                    arn: element.arn,
                  },
                });
              } else if (element.type == "cloudFront") {
                funcObject.events.push({
                  cloudFront: {
                    eventType: element.eventType,
                    origin: element.origin,
                  },
                });
              } else if (element.type == "datatable") {
                funcObject.events.push({
                  httpApi: {
                    path: `/${stage}/${item.uri}`,
                    method: `get`,
                    authorizer: element.authorizer,
                  },
                });
              }
              //s3에 의해 트리거 되는 함수
              else if (element.type == "s3") {
                funcObject.events.push({
                  s3: {
                    bucket: `${element.bucket}`,
                    event: element.event,
                    existing: element.existing ? element.existing : false,
                    rules: element.rules ? element.rules : undefined,
                  },
                });
              }
              //sqs에 의해 트리거 되는 함수
              else if (element.type == "sqs") {
                //sqs arn을 명시할 경우, 즉 이 serverless에서 SQS를 생성하는 것이 아닐 경우,
                if (element.sqsARN) {
                  funcObject["events"].push({
                    sqs: {
                      arn: element.sqsARN,
                      batchSize: element.batchSize.Array,
                      maximumBatchingWindow: element.maximumBatchingWindow,
                      maximumBatchingWindow: element.maximumBatchingWindow,
                      maximumConcurrency: element.maximumConcurrency,
                    },
                  });
                }
                //이 serverless에서 sqs를 생성하는 경우
                else {
                  funcObject["events"].push({
                    sqs: {
                      arn: { "Fn::GetAtt": [element.sqs, "Arn"] },
                      batchSize: element.batchSize,
                      maximumBatchingWindow: element.maximumBatchingWindow,
                      maximumConcurrency: element.maximumConcurrency,
                    },
                  });
                }
              }
              //cognito user pool에 의해 트리거 되는 함수
              else if (element.type == "cognito") {
                funcObject["events"].push({
                  cognitoUserPool: {
                    pool: serverlessTemplet1.custom.apiSpec[
                      element.poolNameRef
                    ],
                    trigger: element.trigger,
                    existing: true,
                  },
                });
              }
              //step function에 의해 트리거 되는 함수
              else if (element.type == "sfn") {
                // serverless_template.yml에 정의된 step function에서 해당 state를 찾아서 functionName에 arn을 넣어준다
                serverlessTemplet1.resources.Resources[
                  element.machineName
                ].Properties.Definition.States[
                  element.stateName
                ].Parameters.FunctionName = funcObject.name;
              }
              //iot action에 의해 트리거 되는 함수
              else if (item.type == "iot") {
                funcObject["events"].push({
                  iot: {
                    sql: `select *, topic() as topic from "${element.topic}"`,
                    enabled: true,
                  },
                });
              }
              //dynamo db에 의해 트리거 되는 함수
              else if (element.type == "ddb") {
                funcObject["events"].push({
                  stream: {
                    type: "dynamodb",
                    arn: { "Fn::GetAtt": [element.table, "StreamArn"] },
                    filterPatterns: element.filterPatterns,
                  },
                });
              }
              //어느 이벤트에도 트리거되지 않는 함수
              else if (item.type == "pure") {
              }
              //별도의 명시가 없다면 pure
              else {
              }
            });
          }
          //레이어가 존재한다면 레이어 추가
          if (item.layer) {
            // 하위호환을 위해 배열로 들어오지 않은 경우 배열로 변환
            funcObject["layers"] = Array.isArray(item.layer)
              ? item.layer
              : [item.layer];
          }
          //타임아웃이 존재한다면, 타임아웃 추가
          if (item.timeout) {
            funcObject["timeout"] = parseInt(item.timeout);
          }
          if (item.environment) {
            funcObject["environment"] = item.environment;
          }
          if (item.role) {
            funcObject["role"] = item.role;
          }
          //메모리 설정이 존재한다면 메모리 추가
          if (item.memorySize) {
            funcObject["memorySize"] = parseInt(item.memorySize);
          }
          //function url + Lambda Streaming
          if (item.url) {
            funcObject["url"] = item.url
            if (item.response_stream) {
              extraResources.push({
                key: capitalizeFirstLetter(nameArr.join("Underscore") + "LambdaFunctionUrl"),
                Value:
                {
                  "Properties": {
                    "InvokeMode": "RESPONSE_STREAM"
                  }
                }
              })
            }
          }

          //스토리지 설정이 존재한다면 스토리지 추가
          if (item.ephemeralStorageSize) {
            funcObject["ephemeralStorageSize"] = parseInt(
              item.ephemeralStorageSize
            );
          }
          functions[`${nameArr.join("_")}`] = funcObject;
        }
      });
    }
  }
  serverlessTemplet1.functions = {
    ...functions,
    ...serverlessTemplet1.functions,
  };
  serverlessTemplet1.provider.stage = `${stage}-${version}`;
  if (!serverlessTemplet1.resources) {
    serverlessTemplet1.resources = {
      Outputs: {},
    };
  }

  let extraResourcesObj = {}
  extraResources.forEach((element) => {
    extraResourcesObj[element.key] = element.Value
  })
  //추가 리소스 추가
  serverlessTemplet1.resources.Resources = {
    ...serverlessTemplet1.resources.Resources,
    ...extraResourcesObj

  }

  serverlessTemplet1.resources.Outputs = {
    ServerlessDeploymentBucketName: {
      Export: {
        Name: "${self:provider.stackName}-ServiceEndpoint",
      },
      Value: "${self:provider.stackName}-ServiceEndpoint",
    },

    ...serverlessTemplet1.resources.Outputs,
  };
  if (restExist) {
    serverlessTemplet1.resources.Outputs["HttpApiUrl"] = {
      Export: {
        Name: "${self:provider.stackName}-HttpApiUrl",
      },
    };
    serverlessTemplet1.resources.Outputs["HttpApiId"] = {
      Export: {
        Name: "${self:provider.stackName}-HttpApiId",
      },
    };
  }
  //serverless.yml파일을 쓴다.
  let yamlStr = yaml.dump(serverlessTemplet1, { lineWidth: 140 });
  fs.writeFileSync(`serverless.yml`, yamlStr, "utf8");
}

/**
 * generate oas.paths by iterating apiSpecList
 * @param {Object} apiSpecList
 * @returns {Object} oas.paths
 */
function generateOasPaths(apiSpecList) {
  const sortedApiSpecList = {};
  for (var category in apiSpecList) {
    const prop = apiSpecList[category];
    prop.forEach((itemt) => {
      const item = itemt.item;

      if (
        !item ||
        item.hide ||
        (item.event?.length > 0
          ? item.event[0].type.toLowerCase() !== "rest"
          : true)
      ) {
        return;
      }

      const path = item.event.find(
        (e) => e.type.toLowerCase() === "rest"
      )?.path;
      const uri = path ? path : item.uri;

      if (!sortedApiSpecList[uri]) {
        sortedApiSpecList[uri] = [];
      }

      sortedApiSpecList[uri][item.event[0].method.toLowerCase()] = item;
    });
  }

  const paths = {};

  for (var property in sortedApiSpecList) {
    const _property = property.startsWith("/") ? property : `/${property}`;
    paths[_property] = {};
    for (var method in sortedApiSpecList[property]) {
      const api = sortedApiSpecList[property][method];

      if (api.hide) {
        continue;
      }

      paths[_property][method] = {};
      paths[_property][method].description = api.desc;
      paths[_property][method].summary = api.summary;
      paths[_property][method].operationId = api.operationId;
      paths[_property][method].tags = [api.category, ...(api.tags || [])];

      if (!api.noAuth) {
        paths[_property][method].security = [
          {
            bearerAuth: ["test"],
          },
        ];
      }

      if (api.responses.content) {
        const statusCode = api.responses.statusCode
          ? api.responses.statusCode
          : 200;

        paths[_property][method].responses = {
          [statusCode]: {
            description: api.responses.description,
          },
        };

        paths[_property][method].responses[statusCode]["content"] = {};
        paths[_property][method].responses[statusCode]["content"][
          api.responses.content
        ] = {
          schema: {
            type: api.responses.schema.type,
            description: api.responses.schema.desc,
            properties: {},
            items: api.responses.schema.items,
          },
        };
        for (var ptr in api.responses.schema.properties) {
          if (api.responses.schema.properties[ptr].type) {
            paths[_property][method].responses[statusCode]["content"][
              api.responses.content
            ]["schema"]["properties"][ptr] = {
              type: api.responses.schema.properties[ptr].type.toLowerCase(),
              description: api.responses.schema.properties[ptr].desc,
              items: api.responses.schema.properties[ptr].items,
            };
          } else {
            paths[_property][method].responses[statusCode]["content"][
              api.responses.content
            ]["schema"]["properties"][ptr] = {
              type: "invalid or unsuppoerted type",
              description: api.responses.schema.properties[ptr].desc,
              items: api.responses.schema.properties[ptr].items,
            };
          }
        }

        for (var property2 in api.errors) {
          const errorName = property2;

          const statusCode = api.errors[errorName].status_code + "";

          const reason = api.errors[errorName].reason;
          const schema = api.errors[errorName].schema;
          paths[_property][method].responses[statusCode] = {};
          paths[_property][method].responses[statusCode]["description"] =
            errorName;
          // paths[_property][method].responses[statusCode]["content"] = {};
          // paths[_property][method].responses[statusCode]["content"]["application/json"] = {
          //     schema: {
          //         //type: schema.type,
          //         properties: {},
          //     }
          // }
          // for (var ptr in schema.properties) {
          //     paths[_property][method].responses[statusCode]["content"]["application/json"]["schema"]["properties"][ptr] = {
          //         type: schema.properties[ptr].type.toLowerCase()
          //     }
          // }
        }
      }

      paths[_property][method].parameters = [];

      let requireds = [];
      let proprs = {};

      for (var parmName in api.parameters) {
        const parm = api.parameters[parmName];

        if (parm.in == "path") {
          paths[_property][method].parameters.push({
            name: parmName,
            in: "path",
            description: parm.desc,
            required: parm.req,
            schema: { type: parm.type.toLowerCase() },
          });
        }

        if (parm.in == "header") {
          paths[_property][method].parameters.push({
            name: parmName,
            in: "header",
            description: parm.desc,
            required: parm.req,
            schema: { type: parm.type.toLowerCase() },
          });
        }

        if (parm.in == "query") {
          paths[_property][method].parameters.push({
            name: parmName,
            in: "query",
            description: parm.desc,
            required: parm.req,
            schema: { type: parm?.type?.toLowerCase() },
          });
        }

        if (parm.in == "body") {
          if (parm.req) {
            requireds.push(parmName);
          }
          proprs[parmName] = {
            description: parm.desc,
            type: parm.type.toLowerCase(),
            properties: parm.properties,
          };
        }

        // http method 가 GET or DELETE 이면서 in이 없는 경우 query로 간주한다. (하위호환)
        if ((method == "get" || method == "delete") && !parm.in) {
          paths[_property][method].parameters.push({
            name: parmName,
            in: "query",
            description: parm.desc,
            required: parm.req,
            schema: { type: parm.type.toLowerCase() },
          });
        }

        // http method 가 POST or PUT 이면서 in이 없는 경우 body로 간주한다. (하위호환)
        if ((method == "post" || method == "put") && !parm.in) {
          if (parm.req) {
            requireds.push(parmName);
          }
          proprs[parmName] = {
            description: parm.desc,
            type: parm.type.toLowerCase(),
            properties: parm.properties,
          };
        }
      }

      if (method == "post" || method == "put") {
        paths[_property][method].requestBody = {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: requireds,
                properties: proprs,
              },
            },
          },
        };
      }

      if (api.requestBody) {
        paths[_property][method].requestBody = api.requestBody;
      }

      if (api.requestQuery) {
        paths[_property][method].parameters = api.requestQuery;
      }

      if (api.responses && !api.responses.content) {
        paths[_property][method].responses = api.responses;
      }
    }
  }

  return paths;
}

/**
 *
 * @param {string} targetDir components 를 생성할 경로 (default: ./docs/components)
 */
async function generateOasComponents(targetDir = "./docs/components") {
  // components 디렉토리가 없으면 빈 객체를 반환
  if (!fs.existsSync(targetDir)) {
    return {};
  }

  // components 디렉토리의 파일 목록을 가져옴
  const root = await fspr.readdir(targetDir);

  const components = {};
  const validComponents = ["schemas", "parameters", "examples", "responses"];

  for (const component of root) {
    if (!validComponents.includes(component)) {
      continue;
    }

    components[component] = {};
    const componentFiles = await fspr.readdir(`${targetDir}/${component}`);
    for (const componentFile of componentFiles) {
      // Read the YAML file
      const fileContents = await fspr.readFile(
        `${targetDir}/${component}/${componentFile}`,
        "utf8"
      );

      // Parse YAML to JavaScript object
      const data = yaml.load(fileContents);

      // Add the data to the components object
      components[component] = {
        ...components[component],
        ...data,
      };
    }
  }

  return components;
}

module.exports = {
  getApiSpecList,
  printServerlessFunction,
  generateOasPaths,
  generateOasComponents,
  getFunctionList,
};
