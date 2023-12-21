const yaml = require("js-yaml");
const fs = require("fs");
const {
  getApiSpecList,
  createPostmanImport,
  printServerlessFunction,
} = require("./builder");
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

module.exports.generateServerlessFunction = generateServerlessFunction;
module.exports.generateExportFile = generateExportFile;
module.exports.uploadToNotion = uploadToNotion;
