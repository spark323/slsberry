const apiSpec = {
  category: "Pet",
  desc: "List all pets",
  event: [
    {
      type: "REST",
      method: "get",
    },
  ],
  parameters: {
    page: {
      type: "string",
      in: "query",
      default: 1,
    },
    limit: {
      type: "string",
      in: "query",
      default: 10,
    },
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
    schema: {
      type: "object",
      properties: {},
    },
  },
};
exports.apiSpec = apiSpec;

async function handler(inputObject, event) {
  return {
    status: 200,
    response: {
      result: "success",
    },
  };
}

exports.handler = async (event, context) => {
  return await handler(event.body, event);
};
