#!/usr/bin/env node

require("dotenv").config();

const yargs = require("yargs");
const { hideBin } = require("yargs/helpers");
const builder = require("../src/lib/builder");
const argv = yargs(hideBin(process.argv)).argv;

let templateFile = argv.t ? argv.t : "serverless_template.yml";

try {
  if (argv.n) {
    builder.uploadToNotion(
      process.env.NOTION_SECRET ? process.env.NOTION_SECRET : argv.n,
      process.env.STAGE,
      process.env.VER
    );
  } else {
    argv.x
      ? builder.generateOpenApiSpecFile(argv.x)
      : builder.generateServerlessFunction(
          `./${templateFile}`,
          argv.stage ? argv.stage : process.env.STAGE,
          argv.ver ? argv.ver : process.env.VER
        );
  }
} catch (e) {
  console.error(e);
}
