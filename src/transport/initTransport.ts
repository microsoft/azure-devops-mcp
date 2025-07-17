import fs from "fs/promises";
import path from "path";
import { transportProviders } from "./index.js";

function resolveArgs(args: string[], inputs: Record<string, string>) {
  return args.map(arg =>
    arg.replace(/\$\{input:([\w\d_-]+)\}/g, (_, inputId) => inputs[inputId] ?? "")
  );
}

export async function initTransport(): Promise<any> {
  const configRaw = await fs.readFile(path.resolve("config.json"), "utf-8");
  const config = JSON.parse(configRaw);

  const inputValues: Record<string, string> = {};
  for (const input of config.inputs ?? []) {
    inputValues[input.id] = process.env[`INPUT_${input.id.toUpperCase()}`] || "";
  }

  const [firstServerKey] = Object.keys(config.servers);
  const serverConfig = config.servers[firstServerKey];
  const { type, command, args = [] } = serverConfig;

  const resolvedArgs = resolveArgs(args, inputValues);

  const provider = transportProviders.find(p => p.supports(type));
  if (!provider) {
    throw new Error(`No transport provider found for type "${type}"`);
  }

  return provider.create({ command, args: resolvedArgs });
}
