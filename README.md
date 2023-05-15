# serverless-cnf-builder
serverless-cnf-builder(이하 svlsbdr)는 AWS Lambda 기반의 Serverless 개발을 효율적으로 도와주는 기능이 있습니다.
1. [Serverless Framework](https://www.serverless.com/)에서 사용하는 [serverless.yml](https://www.serverless.com/framework/docs/providers/aws/guide/serverless.yml) 파일을 템플릿을 기반으로 쉽게 만들어줍니다.
2. 각 함수의 미리 선언된 spec을 기반으로 자동으로 문서를 생성하여 export(Notion,OpenAPI 3.0)해줍니다.

## 설치
```
npm install serverless-cnf-builder -g
```

## 사용 방법
```
svlsbdr 
```


# severless.yml 생성
공통 리소스(기본 설정,IAM 역할, Cloudformation 기반 리소스 등)를 정의한 템플릿 파일을 기반으로 apiSpec이 정의된 함수가 포함된 새로운 serverles.yml 파일을 생성해줍니다.

## serverless_template.yml

Lambda 함수를 제외한 나머지 내용을 정의하는 템플릿 파일입니다. 기본 이름은 serverless_template.yml 입니다.  -t flag 로 template 파일을 정의할 수 있습니다. 
```
svlsbdr -t serverless_template.yml 
```

* 이 템플릿에서 정의되어 있는 app 이름이 함수 명에 포함됩니다.

## stage, version
Serverless.yml 및 함수 명 등에서 사용하는 stage와 각 스테이지 별 버전을 지정할 수 있습니다.
```
svlsbdr --stage test --ver 1
```

## dotenv
최상위 디렉토리에 .env 파일에 STAGE와 VER을 설정하면 Stage와 Ver에 맞게 Serverless.yml 파일을 생성합니다.

```
//.env 파일
STAGE=test
VER=3
```
이 경우 스테이지와 버전을 명시 할 필요가 없습니다.

```
svlsbdr   (위와 같은 .env가 정의되어 있을 경우 svlsbdr --stage test --ver 3 과 같음)
```


## Lambda 경로
./src/lambda 경로 안에 정의된 함수들을 대상으로 합니다. Rest 타입의(HTTP로 트리거) Lambda함수의 경우 경로가 곧 Path가 됩니다.

예: ./src/lambda/user/data/get.js 라면,  API 경로는
```
https://{api_gateway_id}.execute-api.{region}.amazonaws.com/{stage}/user/data/get (Method: get)
```







# apiSpec
각 Lambda 함수에  다음 형식으로 apiSpec을 선언하여 export 합니다. apiSpec은 [lambda-code-helper](https://github.com/spark323/lambda-helper)에서도 활용합니다.
```
const apiSpec = {
    "category": "test",
    "desc": "테스트 함수",
    event [

    ]   
};
exports.apiSpec = apiSpec;
exports.handler = async (event, context) => {

}

```
## category
함수의 카테고리입니다. 문서화 및  분류를 위해 사용합니다.

## desc
함수의 설명입니다. 

## disabled
true로 설정할 경우 배포하지 않습니다.(serverless.yml에 포함되지 않습니다.)

## event 
각 함수의 트리거 이벤트를 설정할 수 있습니다. 현재 사용 가능한 트리거는 다음과 같습니다.
- REST : api gateway에서 http형식
- websocket : api gateway의 websocket
- s3 : Amazon S3의 이벤트
- sqs : Amazon SQS 
- cognito: Amazon Cognito UserPool
- sfn : Amazon Stepfunction
- iot : AWS IOT
- pure : 별도로 트리거를 지정하지 않음

### Rest
```
const apiSpec = {
    "category": "test",    
    "event": [{
        "type": "REST",
        "method":"Get"
    }]
    ...      
};
```
* event.method : HTTP Method(Get,Put,Delete,Post...) 
* authorizer(optional): Serveless Template에서 정의한 Congito Authorizer Logical Id 

### websocket
```
const apiSpec = {
    "category": "test",
   
    "event":[
        {
            "type": "websocket",
            "route":"$connect"
        }
    ]
    ...  
};
```
event.route : API Gateway Websocket Route ([참조](https://docs.aws.amazon.com/apigateway/latest/developerguide/websocket-api-develop-routes.html))

### S3
```
const apiSpec = {
    "category": "test",
    "event": [
        {
            "type": "s3",
            "existing": true,
            "bucket": `my-test-bucket`,
            "event": "s3:ObjectCreated:put"
        },
        {
            "type": "s3",
            "existing": false,
            "bucket": `\${ssm:/\${self:app}/\${opt:stage, "dev"}/filebucket}`,
            "event": "s3:ObjectCreated:post"
        }
    ],
    ...  
};
```
([Serverless Framework s3 Event](https://www.serverless.com/framework/docs/providers/aws/events/s3) 참고)

* exisiting: 버킷이 이미 존재하는지 여부. false라면 serverless framwork에서 직접 S3 버킷을 생성
* bucket: 이미 존재하는 버킷 혹은 새로 생성할 버킷의 이름
* event: [S3 트리거 이벤트](https://docs.aws.amazon.com/AmazonS3/latest/userguide/notification-how-to-event-types-and-destinations.html#supported-notification-event-types)

### SQS
```
const apiSpec = {
    "category": "s3",
    "event": [
        {
            "type": "sqs",
            "sqsARN": `arn:aws:sqs:ap-northeast-2:207637378596:test-queue-1`,
        },
        {
            "type": "sqs",
            "sqs": `MySQSQueue`,
        }
    ]
    ...
}
```
([Serverless Framework SQS Event](https://www.serverless.com/framework/docs/providers/aws/events/sqs) 참고)

* sqsARN: 이미 존재하는 SQS를 사용할 경우 ARN 명시
* sqs: Serverless Template에서 정의한 SQS의 Logical ID

### pure
```
const apiSpec = {
    "category": "test",
    "event": [
        {
            "type": "pure",
        }
    ]
    ...
}
```
다른 트리거 혹은 Cron JOb 등에서 사용되어 별도의 Trigger가 필요 없는 함수

## functionName
Lambda 함수의 이름을 정의합니다. 
```
const apiSpec = {
    "category": "test",
    "event": [
        {
            "type": "pure",
        }
    ],
    "functionName":"my_test_function"
    ...
}
```

Default 값은 
```
${self:app}_${stage}_${version}_{lambda 경로} 
```
입니다.

예: ./src/lambda/user/data/get.js 라면,  함수명은
```
${self:app}_${stage}_${version}_user_data_get
```
입니다.



# 문서화
apiSpec을 기반으로 최상위 info.yml에 정의된 정보로 notion 혹은 OpenAPI에 export 할 수 있는 api 문서를 생성합니다.

## info.yml
프로젝트의 정보를 담습니다.
```
title: plicarvs
description: plicarvs
contact:
  name: spark
  email: chris.park@reconlabs.kr
  url: reconlabs.ai
host: https://reconlabs.kr
database_id: 9f6364496412330ab8ee45a58fe02a7c (Notion Database ID)
```

## notion 문서화 
```
svlsbdr -n {notion_api_key} 
```
notion_api_key의 경우 [링크](https://developers.notion.com/) 를 참고해주세요. info.yml에 database_id가 정의되어 있어야 합니다. notion database_id의 경우 [Stack Overflow](https://stackoverflow.com/questions/67728038/where-to-find-database-id-for-my-database-in-notion) 를 참고해주세요.

Notion 데이터베이스는 경우 Name Description Stage(Select) Version 컬럼이 있어야 합니다.
![이미지](https://github.com/spark323/serverless-config-builder/blob/master/doc/image/1.png)




