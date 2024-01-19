#!/usr/bin/env node

require("dotenv").config();

const yargs = require("yargs");
const { hideBin } = require("yargs/helpers");
const builder = require("../src/lib/builder");
const argv = yargs(hideBin(process.argv)).argv;

let templateFile = argv.t ? argv.t : "serverless_template.yml";

const main = async () => {
  try {
    if (argv.n) {
      await builder.uploadToNotion(
        process.env.NOTION_SECRET ? process.env.NOTION_SECRET : argv.n,
        process.env.STAGE,
        process.env.VER
      );
    }

    if (argv.x) {
      await builder.generateOpenApiSpecFile(argv.x);
    }

    await builder.generateServerlessFunction(
      `./${templateFile}`,
      argv.stage ? argv.stage : process.env.STAGE,
      argv.ver ? argv.ver : process.env.VER
    );
  } catch (e) {
    console.error(e);
  }
};

// IIFE
(async () => {
  await main();

  process.exit(0);
})();
