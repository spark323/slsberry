const yaml = require("js-yaml");
const fs = require("fs");

function createNotionTable(apiSpecList, secret, stage, ver) {
  const projectInfo = yaml.load(
    fs.readFileSync(stage ? `./info_${stage}.yml` : `./info.yml`, "utf8")
  );
  doCreateNotionTable(apiSpecList, secret, stage, ver, projectInfo);
}

async function doCreateNotionTable(
  apiSpecList,
  secret,
  stage,
  version,
  projectInfo
) {
  const { Client } = require("@notionhq/client");
  const notion = new Client({ auth: secret });
  const nowFormat = moment().format("YYYY-MM-DD HH:mm:ss");

  const title = projectInfo.info.title;
  const host = projectInfo.info.host;
  const description = `${projectInfo.info.description}(${nowFormat})`;
  const contact = projectInfo.info.contact;

  const servers = [{ url: host }];
  const schemes = ["https"];

  const database_id = projectInfo.database_id;
  const page_id = projectInfo.page_id;

  //우선 DB에 페이지를 생성한다.
  let createMainPage = {
    parent: {
      type: "database_id",
      database_id: database_id,
    },
    properties: {
      Name: {
        title: [
          {
            text: {
              content: `${title}-${stage}-${version}`,
            },
          },
        ],
      },
      Stage: {
        select: {
          name: stage,
        },
      },
      Version: {
        rich_text: [
          {
            text: {
              content: version,
            },
          },
        ],
      },
      Description: {
        rich_text: [
          {
            text: {
              content: description,
            },
          },
        ],
      },
    },
    children: [
      {
        object: "block",
        heading_2: {
          rich_text: [
            {
              text: {
                content: "이 페이지는 자동 생성된 문서입니다.",
              },
            },
          ],
        },
      },
      {
        object: "block",
        paragraph: {
          rich_text: [
            {
              text: {
                content: `생성 시간:${nowFormat} `,
                //Notion API의 문제로 테이블 column 순서가 올바르게 표현되지 않을 수 있습니다. 처음 보신분은 Seq,Name,Type,Method,Description 순서로 변경해주세요.`,
              },
            },
          ],
          color: "default",
        },
      },
    ],
  };
  const mainPageResponse = await notion.pages.create(createMainPage);
  // console.log(mainPageResponse);
  let mainPageId = mainPageResponse.id;

  //DB를 생성한다.
  let createDBPayload = {
    parent: {
      type: "page_id",
      page_id: mainPageId,
    },

    title: [
      {
        type: "text",
        text: {
          content: `${title}-${stage}-${version}`,
          link: null,
        },
      },
    ],
    is_inline: true,
    properties: {
      Name: {
        title: {},
      },
      "(A)Category": {
        select: {},
      },
      "(B)Type": {
        rich_text: {},
      },
      "(C)Description": {
        rich_text: {},
      },
      "(D)Seq": {
        rich_text: {},
      },
    },
  };
  const dbresponse = await notion.databases.create(createDBPayload);
  const mainDBId = dbresponse.id;
  let cnt = 0;
  for (var property in apiSpecList) {
    let apiSpec = apiSpecList[property];
    if (apiSpec.length > 0) {
      apiSpec.forEach(() => {
        cnt++;
      });
    }
  }
  cnt -= 1;
  for (var property in apiSpecList) {
    let apiSpec = apiSpecList[property];
    apiSpec = apiSpec.reverse();
    if (apiSpec.length > 0) {
      await apiSpec.reduce(async (previousPromise2, obj) => {
        await previousPromise2;
        return new Promise(async (resolve2, reject2) => {
          const item = obj.item;

          try {
            let type = item.type
              ? item.type.toLowerCase()
              : item.event[0].type.toLowerCase();
            let method =
              type == "rest"
                ? item.method
                  ? item.method.toLowerCase()
                  : item.event[0].method.toLowerCase()
                : "-";
            method = type == "datatable" ? "get" : method;
            let uri =
              type == "rest" || type == "datatable"
                ? item.uri
                  ? item.uri.toLowerCase()
                  : item.event[0].uri.toLowerCase()
                : "-";
            let createSubPage = {
              parent: {
                type: "database_id",
                database_id: mainDBId,
              },
              properties: {
                Name: {
                  title: [
                    {
                      text: {
                        content: `${item.name}`,
                      },
                    },
                  ],
                },
                "(A)Category": {
                  select: {
                    name: `${item.category}`,
                  },
                },
                "(B)Type": {
                  rich_text: [
                    {
                      text: {
                        content: `${
                          type == "rest" || type == "datatable"
                            ? type.toUpperCase() + ":" + method.toUpperCase()
                            : type.toUpperCase()
                        }`,
                      },
                    },
                  ],
                },
                "(C)Description": {
                  rich_text: [
                    {
                      text: {
                        content: item.desc,
                      },
                    },
                  ],
                },
                "(D)Seq": {
                  rich_text: [
                    {
                      text: {
                        content: `${cnt--}`,
                      },
                    },
                  ],
                },
              },
              children: [
                {
                  object: "block",
                  heading_2: {
                    rich_text: [
                      {
                        text: {
                          content: `${item.name}`,
                        },
                      },
                    ],
                  },
                },
              ],
            };
            createSubPage.children.push(
              generateSingleNotionBulletItem("Description:" + item.desc)
            );
            createSubPage.children.push(generateEmptyItem());
            if (type == "sqs") {
              let bList = [];
              item.event.forEach((element) => {
                bList.push(
                  generateSingleNotionBulletItem(element.sqsARN || element.sqs)
                );
              });
              createSubPage.children.push(
                generateNotionBulletWithChilderenItem("SQS Arn", bList)
              );
            }
            if (type == "s3") {
              let bList = [];
              item.event.forEach((element) => {
                let arrb = [];
                arrb.push(
                  generateSingleNotionBulletItem(
                    "existing: " + element.existing
                  )
                );
                arrb.push(
                  generateSingleNotionBulletItem("bucket: " + element.bucket)
                );
                bList.push(
                  generateNotionBulletWithChilderenItem(element.event, arrb)
                );
              });

              createSubPage.children.push(
                generateNotionBulletWithChilderenItem("S3 Event", bList)
              );
              // console.log(JSON.stringify(createSubPage.children));
            }
            if (type == "rest" || type == "datatable") {
              createSubPage.children.push(
                generateSingleNotionBulletItem("URI: " + uri)
              );
              createSubPage.children.push(generateEmptyItem());

              createSubPage.children.push(
                generateSingleNotionBulletItem(
                  "Method: " + (type == "datatable" ? "get" : method)
                )
              );

              let parmText = "";
              let bList = [];
              for (var property in item.parameters) {
                const obj = item.parameters[property];
                //minmax
                let minMax = "";
                if (obj.min != undefined && obj.max != undefined) {
                  minMax = `(${obj.min}~${obj.max}${
                    obj.type.toLowerCase() == "string" ? "글자" : ""
                  })`;
                } else if (obj.min != undefined) {
                  minMax = `(${obj.min}~${
                    obj.type.toLowerCase() == "string" ? "글자" : ""
                  })`;
                } else if (obj.max != undefined) {
                  minMax = `(~${obj.max}${
                    obj.type.toLowerCase() == "string" ? "글자" : ""
                  })`;
                }
                parmText = `${property}[${obj.type}]${
                  !obj.req ? "(Optional)" : ""
                }:${obj.desc}${minMax == "" ? "" : minMax}`;

                if (obj.sub) {
                  let arrb = [];
                  for (var prop in obj.sub) {
                    const obj2 = obj.sub[prop];
                    arrb.push(
                      generateSingleNotionBulletItem(
                        `${prop}[${obj2.type}](${
                          !obj2.req ? "Optional" : ""
                        }):${obj2.desc}`
                      )
                    );
                  }
                  bList.push(
                    generateNotionBulletWithChilderenItem(parmText, arrb)
                  );
                } else {
                  bList.push(generateSingleNotionBulletItem(parmText));
                }
              }
              createSubPage.children.push(generateEmptyItem());

              createSubPage.children.push(
                generateNotionBulletWithChilderenItem("Parameter", bList)
              );
              //createSubPage.children.push(generateNotionBulletItem("parameter", parmText));
              createSubPage.children.push(generateEmptyItem());

              //에러

              if (item && item.errors) {
                let bList = [];
                for (var property in item.errors) {
                  const obj = item.errors[property];
                  bList.push(
                    generateSingleNotionBulletItem(
                      `${property}(${obj.status_code}):${obj.reason}`
                    )
                  );
                }
                createSubPage.children.push(
                  generateNotionBulletWithChilderenItem("Error", bList)
                );
                createSubPage.children.push(generateEmptyItem());
              }

              let responseString = JSON.stringify(item.responses, null, 2);
              if (responseString.length > 1990) {
                let iterateList = undefined;
                if (type == "datatable") {
                  iterateList = item.responses.Columns.sub;
                } else {
                  iterateList = item.responses.schema.properties;
                }
                let bList = [];
                for (var property in iterateList) {
                  const obj = iterateList[property];
                  if (!Array.isArray(obj)) {
                    bList.push(
                      generateSingleNotionBulletItem(
                        `${property}[${obj.type}]:${obj.desc}`
                      )
                    );
                  } else {
                    let modelObject = obj[0];
                    let arrb = [];
                    for (var prop in modelObject) {
                      const obj2 = modelObject[prop];
                      arrb.push(
                        generateSingleNotionBulletItem(
                          `${prop}[${obj2.type}]${
                            !obj2.searchable ? "(Searhable)" : ""
                          }:${obj2.desc}`
                        )
                      );
                    }
                    bList.push(
                      generateNotionBulletWithChilderenItem(property, arrb)
                    );
                  }
                }
                createSubPage.children.push(
                  generateNotionBulletWithChilderenItem("Response", bList)
                );
                createSubPage.children.push(generateEmptyItem());
              } else {
                createSubPage.children.push(
                  generateNotionCodeBlock(
                    "Response",
                    JSON.stringify(item.responses, null, 2)
                  )
                );
              }
            }
            const response = await notion.pages.create(createSubPage);
            resolve2("ok");
          } catch (e) {
            console.log(e);
            reject2();
          }
        });
      }, Promise.resolve());
    }
  }
}

function generateNotionCodeBlock(key, text) {
  return {
    object: "block",
    type: "bulleted_list_item",
    bulleted_list_item: {
      rich_text: [
        {
          type: "text",
          text: {
            content: key,
            link: null,
          },
        },
      ],
      color: "default",
      children: [
        {
          object: "block",
          type: "code",

          code: {
            rich_text: [
              {
                type: "text",
                text: {
                  content: text,
                },
              },
            ],
            language: "javascript",
          },
        },
      ],
    },
  };
}

//https://developers.notion.com/reference/block
function generateSingleNotionBulletItem(key) {
  return {
    object: "block",
    type: "bulleted_list_item",
    bulleted_list_item: {
      rich_text: [
        {
          type: "text",
          text: {
            content: key,
            link: null,
          },
        },
      ],
      color: "default",
    },
  };
}

function generateNotionBulletItem(key, item) {
  return {
    object: "block",
    type: "bulleted_list_item",
    bulleted_list_item: {
      rich_text: [
        {
          type: "text",
          text: {
            content: key,
            link: null,
          },
        },
      ],
      color: "default",
      children: [
        {
          object: "block",
          paragraph: {
            rich_text: [
              {
                text: {
                  content: `${item}`,
                },
              },
            ],
            color: "default",
          },
        },
      ],
    },
  };
}

function generateEmptyItem(key, items) {
  let org = {
    object: "block",
    paragraph: {
      rich_text: [
        {
          text: {
            content: ``,
          },
        },
      ],
      color: "default",
    },
  };
  return org;
}

function generateNotionBulletWithChilderenItem(key, items) {
  let org = {
    object: "block",
    type: "bulleted_list_item",
    bulleted_list_item: {
      rich_text: [
        {
          type: "text",
          text: {
            content: key,
            link: null,
          },
        },
      ],
      color: "default",
      children: [],
    },
  };

  items.forEach((element) => {
    org.bulleted_list_item.children.push(element);
  });
  return org;
}

module.exports = {
  createNotionTable,
};
