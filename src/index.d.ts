export type ApiSpec = {
  category: string;
  event: (ApiSpecRestApiEvent | ApiSpecSqsEvent | ApiSpecWebsocketEvent)[];
  desc: string;
  parameters: any;
  responses: { description: string; content: string; schema: any };
  errors: Record<string, { status_code: number; code: string }>;
};

type ApiSpecSqsEvent = {
  type: "sqs";
  sqs: string;
  batchSize?: number;
};
type ApiSpecWebsocketEvent = {
  type: "websocket";
  method: "websocket";
  route: "$disconnect" | "$connect" | string;
};
type ApiSpecRestApiEvent = {
  type: "REST";
  method: HttpMethod;
  authorizer?: string;
};

type HttpMethod =
  | "GET"
  | "POST"
  | "DELETE"
  | "PUT"
  | "Get"
  | "Post"
  | "Delete"
  | "Put"
  | "get"
  | "post"
  | "delete"
  | "put";
