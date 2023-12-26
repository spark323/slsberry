const apiSpec = {
  category: "TEST",
  desc: "sample",
  event: [
    {
      type: "REST",
      method: "post",
    },
  ],
  parameters: {},
  errors: {},
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
