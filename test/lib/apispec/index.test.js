const {
  generateOasPaths,
  generateOasComponents,
  getApiSpecList,
  getFunctionList,
  sortApiSpecListByPath,
} = require("../../../src/lib/apispec/index.js");

const path = require("path");

describe("apispec", () => {
  describe("generateOasPaths", () => {
    test("기존 로직이 잘 동작하나요?", () => {
      // Mock input parameters
      const apiSpecList = {
        Pet: [
          {
            path: "/Users/reconlabs/workspace/slsberry/examples/lambda/pet/post.js",
            item: {
              category: "Pet",
              desc: "Add a new pet to the store",
              event: [{ type: "REST", method: "post" }],
              parameters: {
                name: { type: "string", in: "body", required: true },
                tag: { type: "string", in: "body" },
              },
              errors: {
                apikey_limit_exceeded_error: {
                  status_code: 403,
                  reason: "APIKeyLimitExceededError",
                },
              },
              responses: {
                description: "ok",
                content: "application/json",
                schema: { type: "object", properties: {} },
              },
              name: "pet/post",
              uri: "pet",
            },
          },
          {
            path: "/Users/reconlabs/workspace/slsberry/examples/lambda/pet/get.js",
            item: {
              category: "Pet",
              desc: "List all pets",
              event: [{ type: "REST", method: "get" }],
              parameters: {
                page: { type: "string", in: "query", default: 1 },
                limit: { type: "string", in: "query", default: 10 },
              },
              errors: {
                apikey_limit_exceeded_error: {
                  status_code: 403,
                  reason: "APIKeyLimitExceededError",
                },
              },
              responses: {
                description: "ok",
                content: "application/json",
                schema: { type: "object", properties: {} },
              },
              name: "pet/get",
              uri: "pet",
            },
          },
        ],
      };

      const result = generateOasPaths(apiSpecList);

      expect(result).toEqual({
        "/pet": {
          post: {
            description: "Add a new pet to the store",
            summary: undefined,
            operationId: undefined,
            tags: ["Pet"],
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
              403: { description: "apikey_limit_exceeded_error" },
            },
            parameters: [],
            requestBody: {
              required: true,
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    required: [],
                    properties: {
                      name: {
                        description: undefined,
                        type: "string",
                        properties: undefined,
                      },
                      tag: {
                        description: undefined,
                        type: "string",
                        properties: undefined,
                      },
                    },
                  },
                },
              },
            },
          },
          get: {
            description: "List all pets",
            summary: undefined,
            operationId: undefined,
            tags: ["Pet"],
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
              403: { description: "apikey_limit_exceeded_error" },
            },
            parameters: [
              {
                name: "page",
                in: "query",
                description: undefined,
                required: undefined,
                schema: { type: "string" },
              },
              {
                name: "limit",
                in: "query",
                description: undefined,
                required: undefined,
                schema: { type: "string" },
              },
            ],
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
      const result = await getFunctionList("./examples/lambda", []);

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
          path: path.join(__dirname, "../../../examples/lambda/pet/post.js"),
        },
        {
          path: path.join(__dirname, "../../../examples/lambda/pet/get.js"),
        },
      ]);

      // Verify that the result is an object with the expected structure
      expect(result).toEqual(
        expect.objectContaining({
          Pet: expect.any(Object),
        })
      );
    });

    // To test the ESM module system, we need to pass the --experimental-vm-modules flag to Node.js like this:
    // node --experimental-vm-modules 'node_modules/.bin/jest'
    test.skip("should supports ESM module system", async () => {
      process.env.MODULE = "ESM";
      const result = await getApiSpecList([
        {
          path: path.join(__dirname, "../../../examples/lambda/pet/post.mjs"),
        },
      ]);

      // Verify that the result is an object with the expected structure
      expect(result).toEqual(
        expect.objectContaining({
          Pet: expect.any(Object),
        })
      );
    });
  });
});
