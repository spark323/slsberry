const {
  generateOasPaths,
  generateOasComponents,
  getApiSpecList,
  getFunctionList,
} = require("../../../src/lib/apispec/index.js");

const path = require("path");
describe("apispec", () => {
  describe("generateOasPaths", () => {
    test("기존 로직이 잘 동작하나요?", () => {
      // Mock input parameters
      const apiSpecList = {
        api: {
          // 실제로는 배열이다. (객체처럼 사용되는 배열)
          get: {
            category: "Request",
            event: [{ type: "REST", method: "Get" }],
            desc: "api key verifiy",
            parameters: {},
            errors: {
              engine_not_supported: {
                status_code: 404,
                reason: "현재 지원하지 않는 엔진입니다.",
              },
              query_failed: {
                status_code: 500,
                reason: "db 쿼리 실행 중 문제가 발생했습니다.",
              },
            },
            responses: {
              description: "",
              content: "application/json",
              schema: {
                type: "object",
                properties: { result: { type: "String", desc: "처리 결과" } },
              },
            },
            name: "api/get",
            uri: "api",
          },
          post: {
            category: "Request",
            desc: "multipart upload 완료",
            event: [{ type: "REST", method: "Post" }],
            parameters: {
              key: { req: true, type: "String", desc: "key" },
              client_id: { req: true, type: "String", desc: "client_id" },
              user_id: { req: true, type: "String", desc: "user_id" },
              permission_type: {
                req: true,
                type: "String",
                desc: "permission_type",
              },
            },
            errors: {},
            responses: {
              description: "ok",
              content: "application/json",
              schema: { type: "object", properties: {} },
            },
            name: "api/post",
            uri: "api",
          },
        },
      };

      const result = generateOasPaths(apiSpecList);

      expect(result).toEqual({
        "/api": {
          get: {
            description: "api key verifiy",
            summary: undefined,
            operationId: undefined,
            tags: ["Request"],
            security: [{ bearerAuth: ["test"] }],
            responses: {
              200: {
                description: "",
                content: {
                  "application/json": {
                    schema: {
                      type: "object",
                      description: undefined,
                      properties: {
                        result: {
                          type: "string",
                          description: "처리 결과",
                          items: undefined,
                        },
                      },
                      items: undefined,
                    },
                  },
                },
              },
              404: { description: "engine_not_supported" },
              500: { description: "query_failed" },
            },
            parameters: [],
          },
          post: {
            description: "multipart upload 완료",
            summary: undefined,
            operationId: undefined,
            tags: ["Request"],
            security: [{ bearerAuth: ["test"] }],
            responses: {
              200: {
                description: "ok",
                content: {
                  "application/json": {
                    schema: {
                      type: "object",
                      description: undefined,
                      properties: {},
                      items: undefined,
                    },
                  },
                },
              },
            },
            parameters: [],
            requestBody: {
              required: true,
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    required: [
                      "key",
                      "client_id",
                      "user_id",
                      "permission_type",
                    ],
                    properties: {
                      key: {
                        description: "key",
                        type: "string",
                        properties: undefined,
                      },
                      client_id: {
                        description: "client_id",
                        type: "string",
                        properties: undefined,
                      },
                      user_id: {
                        description: "user_id",
                        type: "string",
                        properties: undefined,
                      },
                      permission_type: {
                        description: "permission_type",
                        type: "string",
                        properties: undefined,
                      },
                    },
                  },
                },
              },
            },
          },
        },
      });
    });

    test("query parameter 추가가 잘 되나요?", () => {
      const apiSpecList = {
        "api/task": {
          // 실제로는 배열이다. (객체처럼 사용되는 배열)
          get: {
            category: "Task",
            event: [{ type: "REST", method: "Get" }],
            summary: "get a task by id",
            desc: "get a task by id",
            operationId: "getTaskById",
            parameters: {
              seq: {
                req: true,
                type: "String",
                desc: "seq value to query",
                in: "query",
              },
            },
            responses: {},
            name: "api/task/get",
            uri: "api/task",
            noAuth: true,
          },
        },
      };

      const result = generateOasPaths(apiSpecList);

      expect(result).toEqual({
        "/api/task": {
          get: {
            operationId: "getTaskById",
            summary: "get a task by id",
            description: "get a task by id",
            tags: ["Task"],
            parameters: [
              {
                name: "seq",
                in: "query",
                description: "seq value to query",
                required: true,
                schema: {
                  type: "string",
                },
              },
            ],
          },
        },
      });
    });

    test("path parameter 추가가 잘 되나요?", () => {
      // Mock input parameters
      const apiSpecList = {
        "api/task/{taskId}": {
          // 실제로는 배열이다. (객체처럼 사용되는 배열)
          get: {
            category: "Task",
            event: [{ type: "REST", method: "Get" }],
            summary: "get a task by id",
            desc: "get a task by id",
            operationId: "getTaskById",
            parameters: {
              taskId: {
                req: true,
                type: "String",
                desc: "task id",
                in: "path",
              },
            },
            responses: {},
            name: "api/task/{taskId}/get",
            uri: "api/task/{taskId}",
            noAuth: true,
          },
        },
      };

      const result = generateOasPaths(apiSpecList);

      expect(result).toEqual({
        "/api/task/{taskId}": {
          get: {
            operationId: "getTaskById",
            summary: "get a task by id",
            description: "get a task by id",
            tags: ["Task"],
            parameters: [
              {
                name: "taskId",
                in: "path",
                description: "task id",
                required: true,
                schema: {
                  type: "string",
                },
              },
            ],
          },
        },
      });
    });

    test("header parameter 추가가 잘 되나요?", () => {
      const apiSpecList = {
        "api/task": {
          // 실제로는 배열이다. (객체처럼 사용되는 배열)
          get: {
            category: "Task",
            event: [{ type: "REST", method: "Get" }],
            summary: "get a task by id",
            desc: "get a task by id",
            operationId: "getTaskById",
            parameters: {
              customKey: {
                req: true,
                type: "String",
                desc: "custom key",
                in: "header",
              },
            },
            responses: {},
            name: "api/task/get",
            uri: "api/task",
            noAuth: true,
          },
        },
      };

      const result = generateOasPaths(apiSpecList);

      expect(result).toEqual({
        "/api/task": {
          get: {
            operationId: "getTaskById",
            summary: "get a task by id",
            description: "get a task by id",
            tags: ["Task"],
            parameters: [
              {
                name: "customKey",
                in: "header",
                description: "custom key",
                required: true,
                schema: {
                  type: "string",
                },
              },
            ],
          },
        },
      });
    });

    test("body 추가가 잘 되나요?", () => {
      const apiSpecList = {
        "api/task": {
          // 실제로는 배열이다. (객체처럼 사용되는 배열)
          post: {
            category: "Task",
            event: [{ type: "REST", method: "Post" }],
            summary: "create a task",
            desc: "create a task",
            operationId: "createTask",
            parameters: {
              key: { req: true, type: "String", desc: "key", in: "body" },
              client_id: {
                req: true,
                type: "String",
                desc: "client_id",
                in: "body",
              },
              user_id: {
                req: true,
                type: "String",
                desc: "user_id",
                in: "body",
              },
              permission_type: {
                req: true,
                type: "String",
                desc: "permission_type",
                in: "body",
              },
            },
            responses: {},
            name: "api/task/post",
            uri: "api/task",
            noAuth: true,
          },
        },
      };

      const result = generateOasPaths(apiSpecList);

      expect(result).toEqual({
        "/api/task": {
          post: {
            operationId: "createTask",
            summary: "create a task",
            description: "create a task",
            tags: ["Task"],
            parameters: [],
            requestBody: {
              required: true,
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    required: [
                      "key",
                      "client_id",
                      "user_id",
                      "permission_type",
                    ],
                    properties: {
                      key: {
                        description: "key",
                        type: "string",
                        properties: undefined,
                      },
                      client_id: {
                        description: "client_id",
                        type: "string",
                        properties: undefined,
                      },
                      user_id: {
                        description: "user_id",
                        type: "string",
                        properties: undefined,
                      },
                      permission_type: {
                        description: "permission_type",
                        type: "string",
                        properties: undefined,
                      },
                    },
                  },
                },
              },
            },
          },
        },
      });
    });
  });

  describe("generateOasComponents", () => {
    test("if there is no target dir, return empty object", async () => {
      const result = await generateOasComponents("__tests__/no_dir");

      expect(result).toEqual({});
    });

    test("should generate components properly", async () => {
      const components = await generateOasComponents(
        "examples/docs/components"
      );

      expect(components).toHaveProperty("schemas");
      expect(components).toHaveProperty("parameters");
      expect(components).toHaveProperty("schemas");

      expect(components.schemas).not.toHaveProperty("somename"); // file name이 아니라, schema name이다.
      expect(components.schemas).toHaveProperty("Todo");
      expect(components.schemas).toHaveProperty("User");

      expect(components.parameters).toHaveProperty("limit");
      expect(components.parameters).toHaveProperty("page");

      expect(components.responses).toHaveProperty("NotFound");
      expect(components.responses).toHaveProperty("Unauthorized");

      expect(components.examples).toHaveProperty("todo");
      expect(components.examples).toHaveProperty("user");
    });
  });

  describe("getFunctionList function", () => {
    // Test case (you can add more test cases based on different scenarios)
    test("should generate a list of all files in the specified directory and its subdirectories", async () => {
      const result = await getFunctionList("./src", []);

      // Verify that the result is an array with objects containing a 'path' property
      expect(result).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            path: expect.any(String),
          }),
        ])
      );
    });
  });

  describe("getApiSpecList function", () => {
    // Test case (you can add more test cases based on different scenarios)
    test("should retrieve API specifications from Lambda function files", async () => {
      const result = await getApiSpecList([
        {
          path: path.join(__dirname, "../../../examples/lambda/sample/post.js"),
        },
      ]);

      // Verify that the result is an object with the expected structure
      expect(result).toEqual(
        expect.objectContaining({
          nomatch: expect.any(Array),
          error: expect.any(Array),
        })
      );
    });
  });
});
