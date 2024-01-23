const yaml = require("js-yaml");
const fs = require("fs");
const {
  getApiSpecList,
  printServerlessFunction,
  getFunctionList,
  generateOasPaths,
  generateOasComponents,
} = require("./apispec");
const { createNotionTable } = require("./notion");

/*
svlsbdr의 진입점
*/
async function generateServerlessFunction(
  templateFile,
  stage = "dev",
  version = 1
) {
  //먼저 src/lambda 이하의 파일을 파싱해 apiSpec들을 가져와서
  const targetFiles = await getFunctionList("./src/lambda", []);
  const apiSpecList = await getApiSpecList(targetFiles);

  //serverless.yml로 프린트한다.
  await printServerlessFunction(templateFile, apiSpecList, stage, version);
}

async function generateOpenApiSpecFile(stag) {
  const targetFiles = await getFunctionList("./src/lambda", []);
  const apiSpecList = await getApiSpecList(targetFiles);

  const projectInfo = yaml.load(
    fs.readFileSync(stag ? `./info_${stag}.yml` : `./info.yml`, "utf8")
  );

  const paths = generateOasPaths(apiSpecList);
  const components = await generateOasComponents();

  const openApiSpec = {
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

  let yamlStr = yaml.dump(openApiSpec);

  fs.writeFileSync(
    stag ? `${projectInfo.info.title}_doc_${stag}.yml` : `api_doc.yml`,
    yamlStr,
    "utf8"
  );
}

async function uploadToNotion(secret, stage, ver) {
  const targetFiles = await getFunctionList("./src/lambda", []);
  const apiSpecList = await getApiSpecList(targetFiles);

  createNotionTable(apiSpecList, secret, stage, ver);
}

module.exports.generateServerlessFunction = generateServerlessFunction;
module.exports.generateOpenApiSpecFile = generateOpenApiSpecFile;
module.exports.uploadToNotion = uploadToNotion;
