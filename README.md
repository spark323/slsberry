<div align="center">
<img src="https://s3.ap-northeast-2.amazonaws.com/file.rubywave.io/slsberry_rect_2.png" >

</div>

# slsberry

slsberry는 AWS Lambda 기반의 Serverless 개발을 효율적으로 도와주는 프레임워크입니다. 소스 코드 내의 파일에 정의된 스펙 문서를 기반으로 자동으로 Serverless Framework yml파일 내에 Lambda 함수를 생성해주고 OpenAPI 3.0, Notion 등으로 문서화도 수행합니다.  

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

`./src/lambda` (또는 TypeScript 프로젝트의 경우 `./trc/lambda`) 경로 안에 정의된 함수들을 대상으로 합니다. REST 타입의 (HTTP로 트리거되는) Lambda 함수의 경우 경로가 곧 API Path가 됩니다.

예시: `./src/lambda/user/data/get.js` 또는 `./trc/lambda/user/data/get.ts`라면, API 경로는 다음과 같습니다:

```
https://{api_gateway_id}.execute-api.{region}.amazonaws.com/{stage}/user/data/get (Method: GET)
```

### TypeScript 지원

TypeScript 프로젝트의 경우:
1. `trc/` 디렉토리에 TypeScript 소스 코드를 작성
2. `npx tsc` 명령으로 `src/` 디렉토리로 컴파일
3. `slsberry` 명령으로 serverless.yml 생성

```bash
# TypeScript 빌드 및 배포 예시
npx tsc && npx slsberry && npx sls deploy
```

# apiSpec

각 Lambda 함수에 다음 형식으로 apiSpec을 선언하여 export 합니다.

**JavaScript:**
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

**TypeScript:**
```typescript
export const apiSpec = {
    category: "User",
    event: [
        {
            type: "REST",
            method: "GET",
            authorizer: "AppAuthorizer",
        },
    ],
    summary: "Get user information",
    desc: "사용자 정보를 조회합니다",
    requestQuery: querySchemaToParameters(querySchema),
    errors: {},
    responses: {
        200: {
            description: "User retrieved successfully",
            content: { "application/json": { schema: responseSchema } },
        },
        400: { $ref: "#/components/responses/Validation" },
        401: { $ref: "#/components/responses/Unauthorized" },
        500: { $ref: "#/components/responses/InternalServerError" },
    },
};

export async function lambdaHandler(
    event: FromSchema<typeof eventSchema> & { v3TestProfile: AwsCredentialIdentityProvider },
    context: ApiKeyVerifiedContext,
): Promise<APIGatewayProxyResult> {
    // 함수 구현
}

export const handler = middy()
    .use(authGuard())
    .use(userFriendlyValidator({ eventSchema }))
    .handler(lambdaHandler);
```

## category

함수의 카테고리입니다. 문서화 및 분류를 위해 사용합니다.

## summary

OpenAPI 문서 생성 시 사용되는 API의 간단한 요약입니다.

```typescript
export const apiSpec = {
    summary: "Get user information",
    // ...
};
```

## hide

true로 설정할 경우 OpenAPI 문서에서 제외됩니다.

```typescript
export const apiSpec = {
    hide: true,
    // ...
};
```

## requestQuery

REST API의 쿼리 파라미터를 정의합니다. `querySchemaToParameters` 유틸리티 함수를 사용하여 JSON Schema로부터 자동 생성할 수 있습니다.

```typescript
export const apiSpec = {
    requestQuery: querySchemaToParameters(querySchema),
    // ...
};
```

## requestBody

REST API의 요청 본문을 정의합니다.

```typescript
export const apiSpec = {
    requestBody: {
        required: true,
        content: { "application/json": { schema: bodySchema } },
    },
    // ...
};
```

## responses

API의 응답을 정의합니다. OpenAPI 3.0 스펙에 따라 구성됩니다.

```typescript
export const apiSpec = {
    responses: {
        200: {
            description: "Success",
            content: { "application/json": { schema: responseSchema } },
        },
        400: { $ref: "#/components/responses/Validation" },
        401: { $ref: "#/components/responses/Unauthorized" },
        500: { $ref: "#/components/responses/InternalServerError" },
    },
    // ...
};
```

## memorySize

Lambda 함수의 메모리 크기를 지정합니다 (MB 단위).

```typescript
export const apiSpec = {
    memorySize: 512,
    // ...
};
```

## timeout

Lambda 함수의 타임아웃을 지정합니다 (초 단위).

```typescript
export const apiSpec = {
    timeout: 30,
    // ...
};
```

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

### REST

```typescript
const apiSpec = {
    "category": "test",
    "event": [{
        "type": "REST",
        "method": "GET",
        "authorizer": "AppAuthorizer"  // 선택사항
    }]
    ...
};
```

- event.method : HTTP Method(GET, POST, PUT, DELETE, PATCH 등)
- authorizer(선택사항): Serverless Template에서 정의한 Cognito Authorizer Logical ID

### websocket

```typescript
const apiSpec = {
    "category": "websocket",
    "event": [{
        "type": "websocket",
        "route": "$connect"
    }]
    ...
};
```

- event.route : API Gateway Websocket Route ([참조](https://docs.aws.amazon.com/apigateway/latest/developerguide/websocket-api-develop-routes.html))
  - `$connect`: 연결 시
  - `$disconnect`: 연결 해제 시  
  - `$default`: 기본 라우트
  - 사용자 정의 라우트

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
    "category": "sqs",
    "event": [
        {
            "type": "sqs",
            "sqsARN": `arn:aws:sqs:ap-northeast-2:207637378596:test-queue-1`,
        },
        {
            "type": "sqs",
            "sqs": `MySQSQueue`,
            "batchSize": 9,
            "maximumBatchingWindow": 1,
        }
    ]
    ...
}
```

([Serverless Framework SQS Event](https://www.serverless.com/framework/docs/providers/aws/events/sqs) 참고)

- sqsARN: 이미 존재하는 SQS를 사용할 경우 ARN 명시
- sqs: Serverless Template에서 정의한 SQS의 Logical ID
- batchSize: 한 번에 처리할 메시지 수 (1-10, 기본값: 10)
- maximumBatchingWindow: 배치를 수집하는 최대 시간 (초)

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

다른 트리거 혹은 Cron Job 등에서 사용되어 별도의 Trigger가 필요 없는 함수입니다. 주로 다른 Lambda 함수에서 직접 호출되거나 Step Functions에서 사용됩니다.

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

# 운영체제 타입 지정 (Windows에서 실행 시)
slsberry -os windows

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

## 일반적인 사용 패턴

### 개발 워크플로우

```bash
# 1. TypeScript 컴파일 (TypeScript 프로젝트인 경우)
npx tsc

# 2. serverless.yml 생성
npx slsberry

# 3. 로컬 테스트 (serverless-offline 사용시)
npx sls offline

# 4. 배포
npx sls deploy --aws-profile [profile-name]
```

### package.json 스크립트 예시

```json
{
  "scripts": {
    "build": "npx slsberry",
    "build:windows": "rimraf src/lambda/* && npx tsc && npx slsberry -os windows",
    "deploy": "rimraf src/lambda/* && npx tsc && npx slsberry -os windows && npx sls deploy --verbose",
    "doc": "npx tsc && npx slsberry"
  }
}
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

# 모범 사례 및 고급 기능

## TypeScript와 함께 사용하기

TypeScript 프로젝트에서 slsberry를 사용할 때의 권장 구조:

```
project/
├── trc/                    # TypeScript 소스 코드
│   └── lambda/
│       ├── user/
│       │   ├── get.ts
│       │   └── put.ts
│       └── auth/
│           └── authorizer.ts
├── src/                    # 컴파일된 JavaScript (자동 생성)
├── serverless_template.yml
├── tsconfig.json
├── package.json
└── .env
```

### 권장 tsconfig.json 설정

```json
{
  "compilerOptions": {
    "target": "ESNext",
    "module": "ESNext",
    "moduleResolution": "node",
    "outDir": "./src",
    "rootDir": "./trc",
    "strict": true,
    "esModuleInterop": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true
  },
  "include": ["trc/**/*.ts"],
  "exclude": ["**/*.test.ts"]
}
```

## 미들웨어 패턴

middy와 함께 사용하는 현대적인 패턴을 권장합니다.

```typescript
import middy from "@middy/core";
import { ioLogger } from "../libs/middlewares/io-logger.js";
import { globalErrorHandler } from "../libs/middlewares/global-error-handler.js";
import { userFriendlyValidator } from "../libs/middlewares/user-friendly.validator.js";
import { authGuard } from "../libs/middlewares/auth.guard.js";

export const apiSpec = {
    category: "User",
    event: [{ type: "REST", method: "GET", authorizer: "AppAuthorizer" }],
    summary: "Get user information",
    // ...
};

export async function lambdaHandler(event, context) {
    // 비즈니스 로직
}

export const handler = middy()
    .use(ioLogger())
    .use(globalErrorHandler({
        name: apiSpec.summary,
        path: process.env.PATH,
        fallbackMessage: JSON.stringify({
            message: "Internal Server Error",
            code: "internal_server_error",
        }),
    }))
    .use(authGuard())
    .use(userFriendlyValidator({ eventSchema }))
    .handler(lambdaHandler);
```

## 스키마 기반 검증

JSON Schema to TypeScript를 활용한 타입 안전한 개발:

```typescript
import { FromSchema } from "json-schema-to-ts";

const querySchema = {
    type: "object",
    properties: {
        userId: { type: "string" },
        limit: { type: "number", minimum: 1, maximum: 100 }
    },
    required: ["userId"],
    additionalProperties: false,
} as const;

const eventSchema = {
    type: "object",
    properties: {
        queryStringParameters: querySchema,
    },
    required: ["queryStringParameters"],
} as const;

export async function lambdaHandler(
    event: FromSchema<typeof eventSchema> & { v3TestProfile: AwsCredentialIdentityProvider },
    context: ApiKeyVerifiedContext,
): Promise<APIGatewayProxyResult> {
    // event.queryStringParameters는 타입 안전함
    const { userId, limit } = event.queryStringParameters;
    // ...
}
```

## 성능 최적화

### 메모리 및 타임아웃 설정

```typescript
export const apiSpec = {
    // ...
    memorySize: 512,    // MB
    timeout: 30,        // seconds
};
```

### 배치 처리 최적화 (SQS)

```typescript
export const apiSpec = {
    category: "Queue",
    event: [{
        type: "sqs",
        sqs: "UserProcessingQueue",
        batchSize: 10,              // 최대 배치 크기
        maximumBatchingWindow: 5,   // 배치 수집 대기 시간(초)
    }],
    memorySize: 1024,              // 배치 처리를 위한 높은 메모리
};
```

## 디버깅 및 로깅

함수에서 `hide: true`를 사용하여 내부 함수를 OpenAPI 문서에서 제외:

```typescript
export const apiSpec = {
    hide: true,         // OpenAPI 문서에서 제외
    category: "Internal",
    event: [{ type: "pure" }],
    desc: "내부 유틸리티 함수",
};
```

# 트러블슈팅

## 일반적인 문제와 해결방법

### Windows에서 경로 문제

Windows 환경에서는 `-os windows` 플래그를 사용하세요:

```bash
npx slsberry -os windows
```

### TypeScript 컴파일 에러

1. `tsconfig.json`에서 `outDir`이 `./src`로 설정되어 있는지 확인
2. `rootDir`이 `./trc`로 설정되어 있는지 확인
3. 컴파일 전에 이전 빌드 파일 정리: `rimraf src/lambda/*`

### serverless.yml 생성 실패

1. `serverless_template.yml` 파일이 루트 디렉토리에 있는지 확인
2. apiSpec이 올바르게 export되고 있는지 확인
3. 함수 파일이 `src/lambda/` 또는 `trc/lambda/` 경로에 있는지 확인

### 함수가 serverless.yml에 포함되지 않는 경우

1. apiSpec에서 `disabled: true`로 설정되어 있지 않은지 확인
2. event 배열이 비어있지 않은지 확인
3. 파일이 올바른 디렉토리 구조에 있는지 확인

## 지원 및 기여

- GitHub Repository: [https://github.com/spark323/slsberry](https://github.com/spark323/slsberry)
- Issues: 버그 리포트나 기능 요청
- Pull Requests: 기여 환영

## 버전 히스토리

현재 버전: `^0.0.69`

주요 기능:
- TypeScript 완전 지원
- OpenAPI 3.0 문서 생성
- 다양한 AWS 이벤트 소스 지원
- Windows/Linux/macOS 크로스 플랫폼 지원

## License

[Apache License](./LICENSE)