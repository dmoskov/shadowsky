// The server runs node-fetch v2 (CommonJS, Node streams), but module
// resolution finds v3 typings (ESM, web streams) hoisted at the repo root.
// Those types are wrong for the installed runtime, so stub the module as
// `any` rather than type-check against the wrong major version.
declare module "node-fetch" {
  const fetch: any;
  export = fetch;
}
