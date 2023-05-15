const yaml = require('js-yaml');
const fs = require('fs');
const fspr = require('fs').promises;
var path = require('path')
var moment = require('moment');

// nested object에서 key 이름을 검색한다
// https://stackoverflow.com/a/57683319/19565265
function findAllByKey(obj, keyToFind) {
    return Object.entries(obj)
        .reduce((acc, [key, value]) => (key === keyToFind)
            ? acc.concat(value)
            : (typeof value === 'object' && value)
                ? acc.concat(findAllByKey(value, keyToFind))
                : acc
            , [])
}
function replaceAll(str, find, replace) {
    return str.replace(new RegExp(find, 'g'), replace);
}
function replaceHttpMethod(_str) {
    let str = _str.replace("/post", "");
    str = str.replace("/get", "");
    str = str.replace("/put", "");
    str = str.replace("/delete", "");
    return str;
}
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
        }
        else {
            arr.push({ path: file })
        }
    })
    await Promise.all(prom);
    return arr;
}

/*
svlsbdr의 진입점
*/
async function generateServerlessFunction(templateFile, stage = "dev", version = 1) {
    //먼저 src/lambda 이하의 파일을 파싱해 apiSpec들을 가져와서
    const apiSpecList = await getApiSepcList();
    //serverless.yml로 프린트한다.
    await printServerlessFunction(templateFile, apiSpecList, stage, version);
}

async function generateExportFile() {
    const apiSpecList = await getApiSepcList();
    let yamlStr = yaml.dump(createPostmanImport(apiSpecList));
    fs.writeFileSync(`export.yml`, yamlStr, 'utf8');
}

async function uploadToNotion(secret, stage, ver) {
    const apiSpecList = await getApiSepcList();
    await createNotionTable(apiSpecList, secret, stage, ver);

}




/*

serverless.yml 파일에 쓰기 전에 람다 함수의 목록을 작성한다.
*/
async function getApiSepcList() {
    //[todo1: 소스파일 경로 지정할 수 있도록 변경]
    let files = await getFunctionList("./src/lambda", []);
    let apiSpecList = { "nomatch": [], "error": [] };
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
            }
            catch (e) {
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
                    apiSpecList[obj.category].push({ path: path, item: obj })
                }
            } catch (e) {
                console.log("Error parsing ", path)
                apiSpecList["error"].push({ path: path, obj: "error" })
                console.error(e);
            }
        }
        catch (e) {
            console.log("Error parsing ", path)
            apiSpecList["error"].push({ path: path, obj: "error" })
            console.error(e);
        }
    });
    return apiSpecList;
}
function generateNotionCodeBlock(key, text) {

    return {
        "object": "block",
        "type": "bulleted_list_item",
        "bulleted_list_item": {
            "rich_text": [{
                "type": "text",
                "text": {
                    "content": key,
                    "link": null
                }
            }],
            "color": "default",
            "children": [{
                "object": "block",
                "type": "code",

                "code": {
                    "rich_text": [{
                        "type": "text",
                        "text": {
                            "content": text
                        }
                    }],
                    "language": "javascript"
                }
            }]
        }
    }

}
//https://developers.notion.com/reference/block
function generateSingleNotionBulletItem(key) {
    return {
        "object": "block",
        "type": "bulleted_list_item",
        "bulleted_list_item": {
            "rich_text": [{
                "type": "text",
                "text": {
                    "content": key,
                    "link": null
                }
            }],
            "color": "default",
        }
    }
}
function generateNotionBulletItem(key, item) {
    return {
        "object": "block",
        "type": "bulleted_list_item",
        "bulleted_list_item": {
            "rich_text": [{
                "type": "text",
                "text": {
                    "content": key,
                    "link": null
                }
            }],
            "color": "default",
            "children": [{
                "object": "block",
                "paragraph": {
                    "rich_text": [
                        {
                            "text": {
                                "content": `${item}`,
                            }
                        }
                    ],
                    "color": "default"
                }
            }]
        }
    }
}
function generateEmptyItem(key, items) {
    let org = {
        "object": "block",
        "paragraph": {
            "rich_text": [
                {
                    "text": {
                        "content": ``,
                    }
                }
            ],
            "color": "default"
        }
    }
    return org;
}
function generateNotionBulletWithChilderenItem(key, items) {
    let org = {
        "object": "block",
        "type": "bulleted_list_item",
        "bulleted_list_item": {
            "rich_text": [{
                "type": "text",
                "text": {
                    "content": key,
                    "link": null
                }
            }],
            "color": "default",
            "children": []
        }
    }

    items.forEach((element) => {
        org.bulleted_list_item.children.push(

            element
        )
    })
    return org;
}
async function createNotionTable(apiSpecList, secret, stage, ver) {

    const { Client } = require('@notionhq/client');

    const notion = new Client({ auth: secret });
    const nowFormat = moment().format("YYYY-MM-DD HH:mm:ss");


    const projectInfo = yaml.load(fs.readFileSync('./info.yml', "utf8"));

    const title = projectInfo.title;
    const _version = ver;
    const host = projectInfo.host;
    const description = `${projectInfo.description}(${nowFormat})`;
    const contact = projectInfo.contact;
    const version = `${stage}-${_version}`;
    const servers = [{ url: host }];
    const schemes = ["https"];

    const database_id = projectInfo.database_id;
    const page_id = projectInfo.page_id;


    //우선 DB에 페이지를 생성한다.
    let createMainPage = {
        "parent": {
            "type": "database_id",
            "database_id": database_id
        },
        "properties": {
            "Name": {
                "title": [
                    {
                        "text": {
                            "content": `${title}-${stage}-${_version}`
                        }
                    }
                ]
            },
            "Stage": {
                "select":
                {
                    "name": stage
                }

            },
            "Version": {
                "rich_text": [
                    {
                        "text": {
                            "content": _version
                        }
                    }
                ]
            },
            "Description": {
                "rich_text": [
                    {
                        "text": {
                            "content": description
                        }
                    }
                ]
            }
        },
        "children": [
            {
                "object": "block",
                "heading_2": {
                    "rich_text": [
                        {
                            "text": {
                                "content": "이 페이지는 자동 생성된 문서입니다."
                            }
                        }
                    ]
                }
            },
            {
                "object": "block",
                "paragraph": {
                    "rich_text": [
                        {
                            "text": {
                                "content": `생성 시간:${nowFormat} `
                                //Notion API의 문제로 테이블 column 순서가 올바르게 표현되지 않을 수 있습니다. 처음 보신분은 Seq,Name,Type,Method,Description 순서로 변경해주세요.`,
                            }
                        }
                    ],
                    "color": "default"
                }
            }
        ],
    }
    const mainPageResponse = await notion.pages.create(createMainPage)
    // console.log(mainPageResponse);
    let mainPageId = mainPageResponse.id;

    //DB를 생성한다.
    let createDBPayload = {
        "parent": {
            "type": "page_id",
            "page_id": mainPageId
        },

        "title": [
            {
                "type": "text",
                "text": {
                    "content": `${title}-${stage}-${_version}`,
                    "link": null
                }
            }
        ],
        "is_inline": true,
        "properties": {
            "Name": {
                "title": {}
            },

            "(A)Category": {
                "select": {}
            },


            "(B)Type": {
                "rich_text": {}
            },

            // "Method": {
            //     "select": {
            //         "options": [
            //             {
            //                 "name": "get",
            //                 "color": "green"
            //             },
            //             {
            //                 "name": "put",
            //                 "color": "red"
            //             },
            //             {
            //                 "name": "post",
            //                 "color": "yellow"
            //             },
            //             {
            //                 "name": "put",
            //                 "color": "blue"
            //             }
            //             ,
            //             {
            //                 "name": "delete",
            //                 "color": "red"
            //             }
            //         ]
            //     }
            // },
            "(C)Description": {
                "rich_text": {}
            },
            "(D)Seq": {
                "rich_text": {}
            },
            // "Food group": {

            // },
            // "Price": {
            //     "number": {
            //         "format": "dollar"
            //     }
            // },
            // "Last ordered": {
            //     "date": {}
            // },
            // "Meals": {
            //     "relation": {
            //         "database_id": "668d797c-76fa-4934-9b05-ad288df2d136",
            //         "single_property": {}
            //     }
            // },
            // "Number of meals": {
            //     "rollup": {
            //         "rollup_property_name": "Name",
            //         "relation_property_name": "Meals",
            //         "function": "count"
            //     }
            // },
            // "Store availability": {
            //     "type": "multi_select",
            //     "multi_select": {
            //         "options": [
            //             {
            //                 "name": "Duc Loi Market",
            //                 "color": "blue"
            //             },
            //             {
            //                 "name": "Rainbow Grocery",
            //                 "color": "gray"
            //             },
            //             {
            //                 "name": "Nijiya Market",
            //                 "color": "purple"
            //             },
            //             {
            //                 "name": "Gus'\''s Community Market",
            //                 "color": "yellow"
            //             }
            //         ]
            //     }
            // },
            // "+1": {
            //     "people": {}
            // },
            // "Photo": {
            //     "files": {}
            // }
        }
    }
    const dbresponse = await notion.databases.create(createDBPayload)

    const mainDBId = dbresponse.id;

    let cnt = 0;
    for (var property in apiSpecList) {
        let apiSpec = apiSpecList[property];
        if (apiSpec.length > 0) {
            apiSpec.forEach(() => {
                cnt++;
            })

        }
    }
    cnt -= 1;

    //

    for (var property in apiSpecList) {
        let apiSpec = apiSpecList[property]
        apiSpec = apiSpec.reverse()
        if (apiSpec.length > 0) {

            await apiSpec.reduce(async (previousPromise2, obj) => {
                await previousPromise2;
                return new Promise(async (resolve2, reject2) => {
                    const item = obj.item;
                    // console.log(item.event[0]);
                    // if ((item.type && item.type.toLowerCase() != "rest") || (item.event[0].type && item.event[0].type.toLowerCase() != "rest")) {
                    //     resolve2("ok")
                    //     return;
                    // }
                    try {

                        // oneRow.table_row.cells.push([generateNotionRow(`${cnt++}`)])
                        // oneRow.table_row.cells.push([generateNotionRow(item.name)]);
                        // oneRow.table_row.cells.push([generateNotionRow(item.type)]);
                        // oneRow.table_row.cells.push([generateNotionRow(item.desc)]);
                        // oneRow.table_row.cells.push([generateNotionRow(item.method)]);
                        let type = (item.type) ? item.type.toLowerCase() : item.event[0].type.toLowerCase()
                        let method = (type == "rest") ? ((item.method) ? item.method.toLowerCase() : item.event[0].method.toLowerCase()) : "-"
                        method = (type == "datatable") ? "get" : method
                        let uri = (type == "rest" || type == "datatable") ? ((item.uri) ? item.uri.toLowerCase() : item.event[0].uri.toLowerCase()) : "-"
                        let createSubPage = {
                            "parent": {
                                "type": "database_id",
                                "database_id": mainDBId
                            },
                            "properties": {
                                "Name": {
                                    "title": [
                                        {
                                            "text": {
                                                "content": `${item.name}`
                                            }
                                        }
                                    ]
                                },
                                "(A)Category": {
                                    "select":

                                    {
                                        "name": `${item.category}`
                                    }
                                },


                                // "D-Method": {
                                //     "select":

                                //     {
                                //         "name": `${method}`
                                //     }
                                // },
                                "(B)Type": {
                                    "rich_text": [
                                        {
                                            "text": {
                                                "content": `${(type == "rest" || type == "datatable") ? type.toUpperCase() + ":" + method.toUpperCase() : type.toUpperCase()}`
                                            }
                                        }
                                    ]
                                },

                                "(C)Description": {
                                    "rich_text": [
                                        {
                                            "text": {
                                                "content": item.desc
                                            }
                                        }
                                    ]
                                },
                                "(D)Seq": {
                                    "rich_text": [
                                        {
                                            "text": {
                                                "content": `${cnt--}`
                                            }
                                        }
                                    ]
                                }

                            },
                            "children": [
                                {
                                    "object": "block",
                                    "heading_2": {
                                        "rich_text": [
                                            {
                                                "text": {
                                                    "content": `${item.name}`
                                                }
                                            }
                                        ]
                                    }
                                },

                            ],
                        }
                        // console.log(item.event[0]);
                        // createSubPage.properties["Method"] = {
                        //     "select": {
                        //         "name": method
                        //     }
                        // }
                        // createSubPage.properties["Type"] = {
                        //     "rich_text": [
                        //         {
                        //             "text": {
                        //                 "content": type
                        //             }
                        //         }
                        //     ]
                        // };



                        createSubPage.children.push(generateSingleNotionBulletItem("Description:" + item.desc));
                        createSubPage.children.push(generateEmptyItem())
                        if (type == "sqs") {

                            let bList = []
                            item.event.forEach(element => {
                                bList.push(generateSingleNotionBulletItem(element.sqsARN || element.sqs))
                            });
                            createSubPage.children.push(generateNotionBulletWithChilderenItem("SQS Arn", bList))
                        }
                        if (type == "s3") {


                            // {
                            //     "type": "s3",
                            //     "existing": true,
                            //     "bucket": `my-test-bucket`,
                            //     "event": "s3:ObjectCreated:put"
                            // },
                            // {
                            //     "type": "s3",
                            //     "existing": false,
                            //     "bucket": `\${ssm:/\${self:app}/\${opt:stage, "dev"}/filebucket}`,
                            //     "event": "s3:ObjectCreated:post"
                            // }

                            let bList = []
                            item.event.forEach(element => {
                                let arrb = []
                                arrb.push(generateSingleNotionBulletItem("existing: " + element.existing));
                                arrb.push(generateSingleNotionBulletItem("bucket: " + element.bucket));
                                bList.push(generateNotionBulletWithChilderenItem(element.event, arrb))

                            });

                            createSubPage.children.push(generateNotionBulletWithChilderenItem("S3 Event", bList))
                            // console.log(JSON.stringify(createSubPage.children));
                        }
                        if (type == "rest" || type == "datatable") {
                            createSubPage.children.push(generateSingleNotionBulletItem("URI: " + uri));
                            createSubPage.children.push(generateEmptyItem())

                            createSubPage.children.push(generateSingleNotionBulletItem("Method: " + ((type == "datatable") ? "get" : method)));

                            let parmText = ""
                            let bList = []
                            for (var property in item.parameters) {
                                const obj = item.parameters[property];
                                //minmax
                                let minMax = "";
                                if (obj.min != undefined && obj.max != undefined) {
                                    minMax = `(${obj.min}~${obj.max}${obj.type.toLowerCase() == "string" ? "글자" : ""})`;
                                }
                                else if (obj.min != undefined) {
                                    minMax = `(${obj.min}~${obj.type.toLowerCase() == "string" ? "글자" : ""})`;
                                }
                                else if (obj.max != undefined) {
                                    minMax = `(~${obj.max}${obj.type.toLowerCase() == "string" ? "글자" : ""})`;
                                }
                                parmText = `${property}[${obj.type}]${!obj.req ? "(Optional)" : ""}:${obj.desc}${minMax == "" ? "" : minMax}`


                                if (obj.sub) {


                                    let arrb = []
                                    for (var prop in obj.sub) {
                                        const obj2 = obj.sub[prop];
                                        arrb.push(generateSingleNotionBulletItem(`${prop}[${obj2.type}](${!obj2.req ? "Optional" : ""}):${obj2.desc}`));
                                    }
                                    bList.push(generateNotionBulletWithChilderenItem(parmText, arrb))
                                }
                                else {
                                    bList.push(generateSingleNotionBulletItem(parmText))
                                }
                            }
                            createSubPage.children.push(generateEmptyItem())

                            createSubPage.children.push(generateNotionBulletWithChilderenItem("Parameter", bList))
                            //createSubPage.children.push(generateNotionBulletItem("parameter", parmText));
                            createSubPage.children.push(generateEmptyItem())



                            //에러


                            if (item && item.errors) {
                                let bList = []
                                for (var property in item.errors) {
                                    const obj = item.errors[property];
                                    bList.push(generateSingleNotionBulletItem(`${property}(${obj.status_code}):${obj.reason}`))
                                }
                                createSubPage.children.push(generateNotionBulletWithChilderenItem("Error", bList));
                                createSubPage.children.push(generateEmptyItem())
                            }


                            // let responseText = ""
                            // for (var property in item.responses) {
                            //     const obj = item.responses[property];
                            //     responseText = `${property}[${obj.type}]:${obj.desc}`

                            //     if (obj.sub) {

                            //         for (var prop in obj.sub) {
                            //             const obj2 = obj.sub[prop];
                            //             responseText = `${prop}[${obj2.type}]${obj2.searchable ? "(Searchable)" : ""}:${obj2.desc}\n`
                            //         }

                            //     }
                            // }
                            // console.log(JSON.stringify(item.responses));
                            let responseString = JSON.stringify(item.responses, null, 2);
                            if (responseString.length > 1990) {


                                let iterateList = undefined;
                                if (type == "datatable") {
                                    iterateList = item.responses.Columns.sub
                                }
                                else {
                                    iterateList = item.responses.schema.properties;
                                }
                                let bList = []
                                for (var property in iterateList) {
                                    const obj = iterateList[property];
                                    if (!Array.isArray(obj)) {
                                        bList.push(generateSingleNotionBulletItem(`${property}[${obj.type}]:${obj.desc}`))
                                    }
                                    else {
                                        let modelObject = obj[0];
                                        let arrb = []
                                        for (var prop in modelObject) {
                                            const obj2 = modelObject[prop];
                                            arrb.push(generateSingleNotionBulletItem(`${prop}[${obj2.type}]${!obj2.searchable ? "(Searhable)" : ""}:${obj2.desc}`));
                                        }
                                        bList.push(generateNotionBulletWithChilderenItem(property, arrb))
                                    }
                                }
                                createSubPage.children.push(generateNotionBulletWithChilderenItem("Response", bList));
                                createSubPage.children.push(generateEmptyItem())
                            }
                            else {
                                createSubPage.children.push(generateNotionCodeBlock("Response", JSON.stringify(item.responses, null, 2)));
                            }
                        }
                        const response = await notion.pages.create(createSubPage)
                        resolve2("ok")
                    } catch (e) {
                        console.log(e);
                        reject2();
                    }
                })
            }, Promise.resolve());
        }
    }
}
//[todo4: 포스트맨에 Export 기능 추가하기]
function createPostmanImport(apiSpecList) {
    const projectInfo = yaml.load(fs.readFileSync('./info.yml', "utf8"));
    const stage = projectInfo.stage;
    const title = projectInfo.title;
    const _version = projectInfo.version;
    const host = projectInfo.host;
    const description = projectInfo.description;
    const contact = projectInfo.contact;
    const version = `${stage}-${_version}`;
    const servers = [{ url: host }];
    const schemes = ["https"];
    let paths = {};
    //경로에 따라 정렬
    const obj = sortApiSpecListByPath(apiSpecList);
    //console.log(obj);
    for (var property in obj) {
        const _property = "/" + property;
        paths[_property] = {};
        for (var method in obj[property]) {

            const api = obj[property][method];
            paths[_property][method] = {};
            paths[_property][method].description = api.desc;
            if (!api.noAuth) {
                paths[_property][method].security =
                    [{
                        bearerAuth: ["test"]
                    }]
            }

            if (api.responses.content) {
                paths[_property][method].responses = {
                    "200": {
                        description: api.responses.description,
                    }
                }
                paths[_property][method].responses["200"]["content"] = {};
                paths[_property][method].responses["200"]["content"][api.responses.content] = {

                    schema: {
                        type: api.responses.schema.type,
                        properties: {},
                    }
                }
                for (var ptr in api.responses.schema.properties) {
                    paths[_property][method].responses["200"]["content"][api.responses.content]["schema"]["properties"][ptr] = {
                        type: api.responses.schema.properties[ptr].type.toLowerCase()
                    }
                }


                for (var property2 in api.errors) {
                    const errorName = property2;

                    const statusCode = api.errors[property2].status_code + "";

                    const reason = api.errors[property2].reason;
                    const schema = api.errors[property2].schema;
                    paths[_property][method].responses[statusCode] = {};
                    paths[_property][method].responses[statusCode]["description"] = errorName;
                    paths[_property][method].responses[statusCode]["content"] = {};
                    paths[_property][method].responses[statusCode]["content"]["application/json"] = {
                        schema: {
                            type: schema.type,
                            properties: {},
                        }
                    }
                    for (var ptr in schema.properties) {
                        paths[_property][method].responses[statusCode]["content"]["application/json"]["schema"]["properties"][ptr] = {
                            type: schema.properties[ptr].type.toLowerCase()
                        }
                    }
                }
            }


            paths[_property][method].parameters = [];
            if (method == "get" || method == "delete") {
                for (var parmName in api.parameters) {
                    const parm = api.parameters[parmName];

                    paths[_property][method].parameters.push(
                        {
                            name: parmName,
                            in: "query",
                            description: parm.desc,
                            required: parm.req,
                            schema: { type: parm.type.toLowerCase() }
                        }
                    )

                }
            }
            if (method == "post" || method == "put") {
                let requireds = [];
                let proprs = {};
                for (var parmName in api.parameters) {
                    const parm = api.parameters[parmName];
                    if (parm.req) {
                        requireds.push(parmName);
                    }
                    proprs[parmName] = {
                        type: parm.type.toLowerCase()
                    }
                }
                paths[_property][method].requestBody = {
                    required: true,
                    content: {
                        "application/json": {
                            "schema": {
                                "type": "object",
                                "required": requireds,
                                "properties": proprs,
                            }
                        }
                    }
                }

            }

        }
    }
    const all = {
        "openapi": "3.0.0",
        info: {

            version: version,
            title: `${title}(${stage})`,
            description: description,
            contact: contact,

        },
        servers: servers,
        paths: paths,
        components: {
            securitySchemes:
            {
                bearerAuth:
                {
                    type: "http",
                    scheme: "bearer"
                }
            }
        }
    }
    return all;
}
function sortApiSpecListByPath(apiSpecList) {
    let obj = {};
    for (var category in apiSpecList) {
        const prop = apiSpecList[category];
        prop.forEach((itemt) => {
            const item = itemt.item;
            if (!item || !item.type || item.hide || !item.method) {
                return;
            }
            if (!obj[item.uri]) {
                obj[item.uri] = [];
            }
            obj[item.uri][item.method.toLowerCase()] = item;
        })
    }
    return obj;
}
/*
가져온 apiSpec 리스트를 기반으로 serverless.yml파일을 만든다.
*/
async function printServerlessFunction(templateFile, apiSpecList, stage, version) {
    //템플릿 파일을 읽는다.
    let serverlessTemplet1 = yaml.load(fs.readFileSync(templateFile, "utf8"))
    let functions = {};
    //만들어둔 apiSpecList를 활용해서 
    for (var property in apiSpecList) {

        //apiSpecList는 카테고리 를 Key로 하여 구성되어 있다.
        let apiSpec = apiSpecList[property];
        if (apiSpec.length > 0) {
            //각 카테고리 별로..
            apiSpec.forEach(async (obj) => {
                const item = obj.item;
                //item의 method가 존재하고  disabled가 아니라면, 
                if (item && (item.disabled !== true) && (!(item.disabled_stages && item.disabled_stages.includes(stage)))) {
                    const nameArr = item.name.split("/");
                    let funcObject = {
                        name: item.functionName ? item.functionName : (`\${self:service}_${stage}_${version}_${nameArr.join("_")}`),
                        handler: `src/lambda/${item.name}.handler`,
                        events: [],
                    };
                    //event가 array가 아닐 때, 즉 옛날 버전

                    if (!(Array.isArray(item.event))) {
                        //웹소켓 타입
                        if (item.type == "websocket") {
                            funcObject.events.push({
                                websocket: {
                                    route: `${item.event.route}`,
                                }
                            })
                        }
                        else if (item.type == "REST") {
                            funcObject.events.push(
                                {
                                    httpApi: {
                                        path: `/${stage}/${item.uri}`,
                                        method: `${(item.method) ? item.method.toLowerCase() : item.event.method.toLowerCase()}`,
                                        authorizer: item.authorizer ? { name: item.authorizer } : undefined
                                    }
                                }
                            )
                        }

                        //s3에 의해 트리거 되는 함수
                        else if (item.type == "s3") {

                            funcObject.events.push({
                                s3: {
                                    bucket: `${item.event.bucket}`, event: item.event.event,
                                    existing: (item.event.existing) ? item.event.existing : false,
                                    rules: (item.event.rules) ? item.event.rules : undefined
                                }
                            })
                        }
                        //sqs에 의해 트리거 되는 함수
                        else if (item.type == "sqs") {

                            //sqs arn을 명시할 경우, 즉 이 serverless에서 SQS를 생성하는 것이 아닐 경우,
                            if (item.sqsARN) {
                                funcObject["events"].push({
                                    sqs: {
                                        arn: item.sqsARN,
                                        batchSize: item.batchSize,
                                        maximumBatchingWindow: item.maximumBatchingWindow
                                    }
                                })
                            }
                            //이 serverless에서 sqs를 생성하는 경우
                            else {
                                funcObject["events"].push({
                                    sqs: { arn: { "Fn::GetAtt": [item.sqs, "Arn"] }, batchSize: item.batchSize }
                                })
                            }
                        }
                        //cognito user pool에 의해 트리거 되는 함수
                        else if (item.type == "cognito") {
                            funcObject["events"].push({
                                cognitoUserPool: {
                                    pool: serverlessTemplet1.custom.apiSpec[item.poolNameRef],
                                    trigger: item.trigger,
                                    existing: true,
                                }
                            })
                        }
                        //step function에 의해 트리거 되는 함수
                        else if (item.type == "sfn") {
                            // serverless_template.yml에 정의된 step function에서 해당 state를 찾아서 functionName에 arn을 넣어준다
                            const foundObjects = findAllByKey(serverlessTemplet1.resources.Resources[item.machineName].Properties.Definition.States, item.stateName)
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
                                }
                            })
                        }
                        //어느 이벤트에도 트리거되지 않는 함수
                        else if (item.type == "pure") { }
                        //별도의 명시가 없다면 pure
                        else { }
                    }
                    else {
                        item.event.forEach(element => {
                            //웹소켓 타입
                            if (element.type == "websocket") {
                                funcObject.events.push({
                                    websocket: {
                                        route: `${element.route}`,
                                    }
                                })
                            }
                            else if (element.type == "REST") {
                                funcObject.events.push(
                                    {
                                        httpApi: {
                                            path: `/${stage}/${item.uri}`,
                                            method: `${element.method.toLowerCase()}`,
                                            authorizer: element.authorizer
                                        }
                                    }
                                )
                            }
                            else if (element.type == "cloudFront") {
                                funcObject.events.push(
                                    {
                                        cloudFront: {
                                            eventType: element.eventType,
                                            origin: element.origin,
                                        }
                                    }
                                )
                            }
                            else if (element.type == "datatable") {
                                funcObject.events.push(
                                    {
                                        httpApi: {
                                            path: `/${stage}/${item.uri}`,
                                            method: `get`,
                                            authorizer: element.authorizer
                                        }
                                    }
                                )
                            }
                            //s3에 의해 트리거 되는 함수
                            else if (element.type == "s3") {

                                funcObject.events.push({
                                    s3: {
                                        bucket: `${element.bucket}`, event: element.event,
                                        existing: (element.existing) ? element.existing : false,
                                        rules: (element.rules) ? element.rules : undefined
                                    }
                                })
                            }
                            //sqs에 의해 트리거 되는 함수
                            else if (element.type == "sqs") {
                                //sqs arn을 명시할 경우, 즉 이 serverless에서 SQS를 생성하는 것이 아닐 경우,
                                if (element.sqsARN) {
                                    funcObject["events"].push({
                                        sqs: { arn: element.sqsARN, batchSize: element.batchSize }
                                    })
                                }
                                //이 serverless에서 sqs를 생성하는 경우
                                else {
                                    funcObject["events"].push({
                                        sqs: { arn: { "Fn::GetAtt": [element.sqs, "Arn"] }, batchSize: element.batchSize }
                                    })
                                }
                            }
                            //cognito user pool에 의해 트리거 되는 함수
                            else if (element.type == "cognito") {
                                funcObject["events"].push({
                                    cognitoUserPool: {
                                        pool: serverlessTemplet1.custom.apiSpec[element.poolNameRef],
                                        trigger: element.trigger,
                                        existing: true,
                                    }
                                })
                            }
                            //step function에 의해 트리거 되는 함수
                            else if (element.type == "sfn") {
                                // serverless_template.yml에 정의된 step function에서 해당 state를 찾아서 functionName에 arn을 넣어준다
                                serverlessTemplet1.resources.Resources[element.machineName].Properties.Definition.States[element.stateName].Parameters.FunctionName = funcObject.name;
                            }
                            //iot action에 의해 트리거 되는 함수
                            else if (item.type == "iot") {
                                funcObject["events"].push({
                                    iot: {
                                        sql: `select *, topic() as topic from "${element.topic}"`,
                                        enabled: true,
                                    }
                                })
                            }
                            //dynamo db에 의해 트리거 되는 함수
                            else if (element.type == "ddb") {
                                funcObject["events"].push({
                                    stream: { type: "dynamodb", arn: { "Fn::GetAtt": [element.table, "StreamArn"] }, filterPatterns: element.filterPatterns }
                                })
                            }
                            //어느 이벤트에도 트리거되지 않는 함수
                            else if (item.type == "pure") { }
                            //별도의 명시가 없다면 pure
                            else { }
                        });
                    }
                    //레이어가 존재한다면 레이어 추가
                    if (item.layer) {
                        // 하위호환을 위해 배열로 들어오지 않은 경우 배열로 변환
                        funcObject["layers"] = Array.isArray(item.layer) ? item.layer : [item.layer];
                    }
                    //타임아웃이 존재한다면, 타임아웃 추가
                    if (item.timeout) {
                        funcObject["timeout"] = parseInt(item.timeout);
                    }
                    //메모리 설정이 존재한다면 메모리 추가
                    if (item.memorySize) {
                        funcObject["memorySize"] = parseInt(item.memorySize);
                    }
                    //스토리지 설정이 존재한다면 스토리지 추가
                    if (item.ephemeralStorageSize) {
                        funcObject["ephemeralStorageSize"] = parseInt(item.ephemeralStorageSize);
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
            Outputs: {}
        };
    }

    serverlessTemplet1.resources.Outputs = {
        ServerlessDeploymentBucketName: {
            Export: {
                Name: "${self:provider.stackName}-ServiceEndpoint",
            },
            Value: "${self:provider.stackName}-ServiceEndpoint"
        },
        HttpApiId: {
            Export: {
                Name: "${self:provider.stackName}-HttpApiId",
            },
            Value: "${self:provider.stackName}-HttpApiId"
        },
        HttpApiUrl: {
            Export: {
                Name: "${self:provider.stackName}-HttpApiUrl",
            },
            Value: "${self:provider.stackName}-HttpApiUrl"
        }, ...serverlessTemplet1.resources.Outputs
    }
    //serverless.yml파일을 쓴다.
    let yamlStr = yaml.dump(serverlessTemplet1, { lineWidth: 140 });
    fs.writeFileSync(`serverless.yml`, yamlStr, 'utf8');
}
module.exports.generateServerlessFunction = generateServerlessFunction;
module.exports.generateExportFile = generateExportFile;
module.exports.uploadToNotion = uploadToNotion;
