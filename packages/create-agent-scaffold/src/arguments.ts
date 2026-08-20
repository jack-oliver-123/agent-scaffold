export interface CreatorArguments {
  target?: string;
  agents: string[];
  allAgents: boolean;
  yes: boolean;
  install: boolean;
  verbose: boolean;
  values: Record<string, string>;
}

const booleanFlags = new Set(["all-agents", "yes", "no-install", "verbose"]);
const valueFlags = new Set(["agent", "name", "package-name", "description", "profile"]);

export function parseCreatorArguments(argv: readonly string[]): CreatorArguments {
  const result: CreatorArguments = {
    agents: [],
    allAgents: false,
    yes: false,
    install: true,
    verbose: false,
    values: {},
  };

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (!argument) continue;
    if (!argument.startsWith("--")) {
      if (result.target) throw new Error("Provide at most one target directory.");
      result.target = argument;
      continue;
    }

    const key = argument.slice(2);
    if (booleanFlags.has(key)) {
      if (key === "all-agents") result.allAgents = true;
      if (key === "yes") result.yes = true;
      if (key === "no-install") result.install = false;
      if (key === "verbose") result.verbose = true;
      continue;
    }
    if (!valueFlags.has(key)) throw new Error(`Unknown option: --${key}.`);
    const value = argv[index + 1];
    if (!value || value.startsWith("--")) throw new Error(`Missing value for --${key}.`);
    if (key === "agent") result.agents.push(value);
    else result.values[key] = value;
    index += 1;
  }

  if (result.allAgents && result.agents.length > 0) {
    throw new Error("Use either repeated --agent options or --all-agents, not both.");
  }
  if (new Set(result.agents).size !== result.agents.length) {
    throw new Error("Agent options must be unique.");
  }
  return result;
}
