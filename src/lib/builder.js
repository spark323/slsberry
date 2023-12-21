const yaml = require("js-yaml");
const fs = require("fs");
const fspr = require("fs").promises;
const {
  getApiSpecList,
  createPostmanImport,
  printServerlessFunction,
  createNotionTable,
} = require("./builder");

/*
svlsbdr의 진입점
*/
async function generateServerlessFunction(
  templateFile,
  stage = "dev",
  version = 1
) {
  //먼저 src/lambda 이하의 파일을 파싱해 apiSpec들을 가져와서
  const apiSpecList = await getApiSpecList();
  //serverless.yml로 프린트한다.
  await printServerlessFunction(templateFile, apiSpecList, stage, version);
}

async function generateExportFile(stag) {
  const apiSpecList = await getApiSpecList();

  let yamlStr = yaml.dump(await createPostmanImport(apiSpecList, stag));
  fs.writeFileSync(
    stag ? `api_doc_${stag}.yml` : `api_doc.yml`,
    yamlStr,
    "utf8"
  );
}

async function uploadToNotion(secret, stage, ver) {
  const apiSpecList = await getApiSpecList();
  await createNotionTable(apiSpecList, secret, stage, ver);
}

/**
 * generate oas.paths by iterating apiSpecList
 * @param {Object} apiSpecList
 * @returns {Object} oas.paths
 */
function generateOasPaths(apiSpecList) {
  const paths = {};
  const obj = apiSpecList;

  for (var property in obj) {
    const _property = "/" + property;
    paths[_property] = {};
    for (var method in obj[property]) {
      const api = obj[property][method];
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
          paths[_property][method].responses[statusCode]["content"][
            api.responses.content
          ]["schema"]["properties"][ptr] = {
            type: api.responses.schema.properties[ptr].type.toLowerCase(),
            description: api.responses.schema.properties[ptr].desc,
            items: api.responses.schema.properties[ptr].items,
          };
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
            schema: { type: parm.type.toLowerCase() },
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

module.exports.generateServerlessFunction = generateServerlessFunction;
module.exports.generateExportFile = generateExportFile;
module.exports.uploadToNotion = uploadToNotion;
module.exports.generateOasPaths = generateOasPaths;
module.exports.generateOasComponents = generateOasComponents;
