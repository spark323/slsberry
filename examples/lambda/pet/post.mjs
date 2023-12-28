export const apiSpec = {
  category: "Pet",
  desc: "Add a new pet to the store",
  event: [
    {
      type: "REST",
      method: "post",
    },
  ],
  parameters: {
    name: {
      type: "string",
      in: "body",
      required: true,
    },
    tag: {
      type: "string",
      in: "body",
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

async function lambdaHandler(inputObject, event) {
  return {
    status: 200,
    response: {
      result: "success",
    },
  };
}

export async function handler(event, context) {
  return await lambdaHandler(apiSpec, event);
}
