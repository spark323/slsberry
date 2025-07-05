<div align="center">
<img src="https://s3.ap-northeast-2.amazonaws.com/file.rubywave.io/slsberry_rect_2.png" >

</div>

# slsberry

AWS Lambda 기반의 Serverless 개발을 위한 포괄### websocket

```javascript
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

event.route : API Gateway Websocket Route ([참조](https://docs.aws.amazon.com/apigateway/latest/developerguide/websocket-api-develop-routes.html))주요 기능

1. **템플릿 기반 구성**: [Serverless Framework](https://www.serverless.com/)의 [serverless.yml](https://www.serverless.com/framework/docs/providers/aws/guide/serverless.yml) 파일을 템플릿을 기반으로 자동 생성
2. **자동 문서화**: 각 함수의 apiSpec을 기반으로 자동 문서 생성 및 export (Notion, OpenAPI 3.0)
3. **다양한 이벤트 소스 지원**: REST API, WebSocket, S3, SQS, Cognito, Step Functions, IoT 등
4. **환경별 배포 관리**: 스테이지 및 버전 기반 배포
5. **TypeScript 지원**: 타입 안전성을 위한 완전한 TypeScript 지원

## 설치

```bash
npm install slsberry
```

또는

```bash
yarn add slsberry
```

## 빠른 시작

1. **serverless.yml 빌드**
```bash
slsberry build
```

2. **배포 (Serverless Framework와 동일)**
```bash
serverless deploy --aws-profile [awsprofile 이름]
```

3. **문서 생성**
```bash
# OpenAPI 문서 생성
slsberry --openapi

# Notion 문서 생성
slsberry -n {notion_api_key}
```

# serverless.yml 생성

공통 리소스(기본 설정, IAM 역할, CloudFormation 기반 리소스 등)를 정의한 템플릿 파일을 기반으로 apiSpec이 정의된 함수가 포함된 새로운 serverless.yml 파일을 생성해줍니다.

## serverless_template.yml

Lambda 함수를 제외한 나머지 내용을 정의하는 템플릿 파일입니다. 기본 이름은 `serverless_template.yml`입니다. `-t` 플래그로 템플릿 파일을 지정할 수 있습니다.

```bash
slsberry -t serverless_template.yml
```

이 템플릿에서 정의되어 있는 app 이름이 함수명에 포함됩니다.

## 스테이지와 버전 관리

Serverless.yml 및 함수명 등에서 사용하는 stage와 각 스테이지별 버전을 지정할 수 있습니다.

```bash
slsberry --stage test --ver 1
```

## 환경 변수 설정

최상위 디렉토리에 `.env` 파일에 `STAGE`와 `VER`을 설정하면 해당 스테이지와 버전에 맞게 serverless.yml 파일을 생성합니다.

```bash
# .env 파일
STAGE=test
VER=3
```

이 경우 스테이지와 버전을 명시할 필요가 없습니다.

```bash
slsberry   # 위와 같은 .env가 정의되어 있을 경우 slsberry --stage test --ver 3과 같음
```

## Lambda 함수 경로 규칙

`./src/lambda` 경로 안에 정의된 함수들을 대상으로 합니다. REST 타입의 (HTTP로 트리거되는) Lambda 함수의 경우 경로가 곧 API Path가 됩니다.

예시: `./src/lambda/user/data/get.js`라면, API 경로는 다음과 같습니다:

```
https://{api_gateway_id}.execute-api.{region}.amazonaws.com/{stage}/user/data/get (Method: GET)
```

# apiSpec

각 Lambda 함수에 다음 형식으로 apiSpec을 선언하여 export 합니다.

```javascript
const apiSpec = {
    "category": "test",
    "desc": "테스트 함수",
    "event": [
        // 이벤트 설정
    ]
};

exports.apiSpec = apiSpec;
exports.handler = async (event, context) => {
    // 함수 구현
};
```

## category

함수의 카테고리입니다. 문서화 및 분류를 위해 사용합니다.

## desc

함수의 설명입니다.

## disabled

true로 설정할 경우 배포하지 않습니다.(serverless.yml에 포함되지 않습니다.)

```javascript
const apiSpec = {
    "category": "test",
    "desc": "테스트 함수",
    "disabled": true,
    "event": []
};
```

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

```javascript
const apiSpec = {
    "category": "test",
    "event": [{
        "type": "REST",
        "method":"Get"
    }]
    ...
};
```

- event.method : HTTP Method(Get,Put,Delete,Post...)
- authorizer(optional): Serveless Template에서 정의한 Congito Authorizer Logical Id

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

- event.method : HTTP Method(Get,Put,Delete,Post...)
- authorizer(optional): Serveless Template에서 정의한 Congito Authorizer Logical Id

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

```javascript
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

- exisiting: 버킷이 이미 존재하는지 여부. false라면 serverless framwork에서 직접 S3 버킷을 생성
- bucket: 이미 존재하는 버킷 혹은 새로 생성할 버킷의 이름
- event: [S3 트리거 이벤트](https://docs.aws.amazon.com/AmazonS3/latest/userguide/notification-how-to-event-types-and-destinations.html#supported-notification-event-types)

### SQS

```javascript
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

- sqsARN: 이미 존재하는 SQS를 사용할 경우 ARN 명시
- sqs: Serverless Template에서 정의한 SQS의 Logical ID

### Cognito

```javascript
const apiSpec = {
    "category": "cognito",
    "event": [
        {
            "type": "cognito",
            "pool": "MyUserPool",
            "trigger": "PreSignUp"
        }
    ]
    ...
}
```

([Serverless Framework Cognito Event](https://www.serverless.com/framework/docs/providers/aws/events/cognito-user-pool) 참고)

- pool: Cognito User Pool의 Logical ID 또는 ARN
- trigger: Cognito 트리거 이벤트 (PreSignUp, PostConfirmation, PreAuthentication 등)

### Step Functions

```javascript
const apiSpec = {
    "category": "stepfunctions",
    "event": [
        {
            "type": "sfn"
        }
    ]
    ...
}
```

Step Functions에서 호출되는 Lambda 함수입니다. 별도의 이벤트 설정이 필요하지 않습니다.

### IoT

```javascript
const apiSpec = {
    "category": "iot",
    "event": [
        {
            "type": "iot",
            "sql": "SELECT * FROM 'topic/+/data'"
        }
    ]
    ...
}
```

([Serverless Framework IoT Event](https://www.serverless.com/framework/docs/providers/aws/events/iot) 참고)

- sql: IoT SQL 쿼리문

### pure

```javascript
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

```javascript
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
${self:service}_${stage}_${version}_{lambda 경로}
```

입니다.

예: ./src/lambda/user/data/get.js 라면, 함수명은

```
${self:service}_${stage}_${version}_user_data_get
```

입니다.

# CLI 명령어

slsberry는 다양한 CLI 옵션을 제공합니다:

## 기본 명령어

```bash
# 기본 빌드 (현재 디렉토리의 .env 파일 또는 기본값 사용)
slsberry

# 또는
slsberry build
```

## 옵션

```bash
# 스테이지와 버전 지정
slsberry --stage production --ver 2

# 템플릿 파일 지정
slsberry -t custom_template.yml

# OpenAPI 문서 생성
slsberry --openapi

# Notion 문서 생성
slsberry -n {notion_api_key}

# 도움말 보기
slsberry --help
```

## 환경 변수

`.env` 파일에서 다음 환경 변수를 설정할 수 있습니다:

```bash
STAGE=development
VER=1
TEMPLATE=serverless_template.yml
```

# 문서화

apiSpec을 기반으로 최상위 info.yml에 정의된 정보로 notion 혹은 OpenAPI에 export 할 수 있는 api 문서를 생성합니다.

## info.yml

프로젝트의 정보를 담습니다.

```yaml
title: demo-slsberry
description: demo project
version: 0.0.1
contact:
  name: spark
  email: spark@rubywave.io
  url: rubywave.io
host: https://rubywave.io
database_id: 4803f792302e4c7bbd2124a55b117465
```

## notion 문서화

```bash
slsberry -n {notion_api_key}
```

notion_api_key의 경우 [링크](https://developers.notion.com/) 를 참고해주세요. info.yml에 database_id가 정의되어 있어야 합니다. notion database_id의 경우 [Stack Overflow](https://stackoverflow.com/questions/67728038/where-to-find-database-id-for-my-database-in-notion) 를 참고해주세요.

Notion 데이터베이스는 경우 Name Description Stage(Select) Version 컬럼이 있어야 합니다.
![이미지](https://github.com/spark323/serverless-config-builder/blob/master/doc/image/1.png)

## OpenAPI 문서화

```bash
slsberry --openapi
```

REST API 이벤트가 포함된 함수들을 기반으로 OpenAPI 3.0 스펙의 JSON 파일을 생성합니다. 생성된 파일은 Swagger UI나 다른 OpenAPI 도구에서 사용할 수 있습니다.

## License

[Apache License](./LICENSE)