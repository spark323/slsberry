import { ApiSpec } from "../../../src/index";

const apiSpec: ApiSpec = {
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
