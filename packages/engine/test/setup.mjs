import process from "node:process";

process.chdir(new URL("./fixture/", import.meta.url).pathname);
