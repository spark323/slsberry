const yaml = require("js-yaml");
const fs = require("fs");
const moment = require("moment");
const { findAllByKey, replaceAll, replaceHttpMethod } = require("../utils");

/*
경로를 iterate하면서 모든 파일 목록을 생성한다.
*/
async function getFunctionList(dir, arr) {
  const result = await fspr.readdir(dir);
  let prom = result.map(async (file) => {
    file = path.resolve(dir, file);
    const element = await fspr.stat(file);
    if (element.isDirectory()) {
      const newar = await getFunctionList(file, arr);
      arr.concat(newar);
    } else {
      arr.push({ path: file });
    }
  });
  await Promise.all(prom);
  return arr;
}

/*
serverless.yml 파일에 쓰기 전에 람다 함수의 목록을 작성한다.
*/
async function getApiSpecList() {
  //[todo1: 소스파일 경로 지정할 수 있도록 변경]
  let files = await getFunctionList("./src/lambda", []);
  let apiSpecList = { nomatch: [], error: [] };
  files.forEach((fileItem) => {
    const path = fileItem.path;
    try {
      //serverless.yml에서 사용될 함수의 이름을 자동으로 지정한다. 이름은 src/lambda를 제외한 경로를 _ 로 나누어서 만든다
      //예: src/lambda/build/test/get.js = build_test_get
      //[todo2]Path Parsing 최적화
      let name = "";
      name = path.replace(".js", "");
      name = replaceAll(name, "\\\\", "/");
      let nameArr = name.split("/");
      const idxLambda = nameArr.indexOf("lambda");
      nameArr = nameArr.slice(idxLambda - 1);
      name = nameArr.slice(2).join("/");
      try {
        file = fs.readFileSync(path);
      } catch (e) {
        console.error(e);
      }
      try {
        let obj = require(path).apiSpec;
        if (obj) {
          obj["name"] = name;
          obj["uri"] = replaceHttpMethod(name);
          //추후 문서화를 대비해서 카테고리 별로 정렬
          if (!apiSpecList[obj.category]) {
            apiSpecList[obj.category] = [];
          }
          apiSpecList[obj.category].push({ path: path, item: obj });
        }
      } catch (e) {
        console.log("Error parsing ", path);
        apiSpecList["error"].push({ path: path, obj: "error" });
        console.error(e);
      }
    } catch (e) {
      console.log("Error parsing ", path);
      apiSpecList["error"].push({ path: path, obj: "error" });
      console.error(e);
    }
  });
  return apiSpecList;
}

//[todo4: 포스트맨에 Export 기능 추가하기]
async function createPostmanImport(apiSpecList, stage) {
  const projectInfo = yaml.load(
    fs.readFileSync(stage ? `./info_${stage}.yml` : `./info.yml`, "utf8")
  );

  const host = projectInfo.host;
  const sortedApiSpecList = sortApiSpecListByPath(apiSpecList);
  const paths = generateOasPaths(sortedApiSpecList);
  const components = await generateOasComponents();

  const all = {
    openapi: "3.0.0",
    info: {
      ...projectInfo.info,
    },

    servers: projectInfo.servers,
    paths: paths,
    components: {
      ...components,
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
        },
      },
    },
  };
  return all;
}

function sortApiSpecListByPath(apiSpecList) {
  let obj = {};
  for (var category in apiSpecList) {
    const prop = apiSpecList[category];
    prop.forEach((itemt) => {
      const item = itemt.item;

      if (
        !item ||
        item.hide ||
        (item.event.length > 0
          ? item.event[0].type.toLowerCase() !== "rest"
          : true)
      ) {
        return;
      }
      if (!obj[item.uri]) {
        obj[item.uri] = [];
      }
      obj[item.uri][item.event[0].method.toLowerCase()] = item;
    });
  }
  return obj;
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
          const nameArr = item.name.split("/");
          let funcObject = {
            name: item.functionName
              ? item.functionName
              : `\${self:service}_${stage}_${version}_${nameArr.join("_")}`,
            handler: `src/lambda/${item.name}.handler`,
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
                  path: `/${stage}/${item.uri}`,
                  method: `${
                    item.method
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
                    path: `/${stage}/${item.uri}`,
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
  serverlessTemplet1.functions = functions;
  serverlessTemplet1.provider.stage = `${stage}-${version}`;
  if (!serverlessTemplet1.resources) {
    serverlessTemplet1.resources = {
      Outputs: {},
    };
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

module.exports = {
  getApiSpecList,
  createPostmanImport,
  printServerlessFunction,
};
