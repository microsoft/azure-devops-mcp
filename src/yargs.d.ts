// Type declarations for yargs (resolves TS7016 when @types/yargs is not picked up by module resolution)
declare module "yargs" {
  interface PositionalOptions {
    describe?: string;
    type?: string;
    demandOption?: boolean;
  }

  interface OptionOptions {
    alias?: string;
    describe?: string;
    type?: "string" | "number";
    array?: boolean;
    default?: string | string[] | number;
    choices?: readonly string[];
  }

  interface Argv<T = unknown> {
    scriptName(name: string): Argv<T>;
    usage(usage: string): Argv<T>;
    version(ver: string): Argv<T>;
    command(
      name: string,
      describe: string,
      builder: (yargs: Argv<T>) => Argv<T> | void
    ): Argv<T>;
    positional(key: string, options: PositionalOptions): Argv<T>;
    option(name: string, opts: OptionOptions): Argv<T>;
    help(): Argv<T>;
    parseSync(argv?: string[]): { _?: string[]; $0?: string; [key: string]: unknown };
    parse(argv?: string[]): Promise<{ _?: string[]; $0?: string; [key: string]: unknown }>;
  }

  function yargs(args?: string[]): Argv;
  export = yargs;
}

declare module "yargs/helpers" {
  export function hideBin(argv: string[]): string[];
}
