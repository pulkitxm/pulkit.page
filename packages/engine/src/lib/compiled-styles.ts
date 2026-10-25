import { type Selector, transform } from "lightningcss";
import { isRecord } from "./guards.ts";

export function stylesheetClasses(css: string, filename: string): Set<string> {
  const names = new Set<string>();
  transform({
    filename,
    code: Buffer.from(css),
    visitor: {
      Selector(selector) {
        visit(selector, (value) => {
          if (value.type === "class" && typeof value.name === "string") {
            names.add(value.name);
          }
        });
      },
    },
  });
  return names;
}

function visit(value: unknown, visitor: (node: Record<string, unknown>) => void): void {
  if (Array.isArray(value)) {
    for (const item of value) {
      visit(item, visitor);
    }
  } else if (isRecord(value)) {
    visitor(value);
    for (const item of Object.values(value)) {
      visit(item, visitor);
    }
  }
}

export class CompiledStyles {
  readonly names = new Map<string, string>();
  readonly combinations = new Map<string, readonly string[]>();
  readonly mutable = new Set<string>();
  private readonly memberships = new Map<string, Set<string>>();
  private readonly combinedNames = new Map<string, string>();
  private next = 0;

  constructor(
    classes: Iterable<string>,
    private readonly reserved: ReadonlySet<string>,
  ) {
    for (const name of [...new Set(classes)].sort()) {
      this.names.set(name, this.allocate());
    }
  }

  private allocate(): string {
    let name: string;
    do {
      name = `s${(this.next++).toString(36)}`;
    } while (this.reserved.has(name));
    return name;
  }

  classes(value: string, combine = true): string {
    const tokens = value.trim().split(/\s+/).filter(Boolean);
    const staticClasses = [
      ...new Set(tokens.filter((name) => this.names.has(name) && !this.mutable.has(name))),
    ].sort();
    if (!combine || staticClasses.length < 2) {
      return tokens.map((name) => this.names.get(name) ?? name).join(" ");
    }
    const key = staticClasses.join(" ");
    let combined = this.combinedNames.get(key);
    if (!combined) {
      combined = this.allocate();
      this.combinedNames.set(key, combined);
      this.combinations.set(
        combined,
        staticClasses.map((name) => this.names.get(name) ?? name),
      );
      for (const name of staticClasses) {
        const members = this.memberships.get(name) ?? new Set<string>();
        members.add(combined);
        this.memberships.set(name, members);
      }
    }
    return [
      combined,
      ...tokens
        .filter((name) => !staticClasses.includes(name))
        .map((name) => this.names.get(name) ?? name),
    ].join(" ");
  }

  private selectors(names: Iterable<string>): Selector {
    const aliases = new Set<string>();
    for (const name of names) {
      aliases.add(this.names.get(name) ?? name);
      for (const member of this.memberships.get(name) ?? []) {
        aliases.add(member);
      }
    }
    const selectors: Selector[] = [...aliases].map((name) => [{ type: "class", name }]);
    return selectors.length === 1
      ? (selectors[0] ?? [])
      : [{ type: "pseudo-class", kind: "is", selectors }];
  }

  css(source: string, filename: string): string {
    return transform({
      filename,
      code: Buffer.from(source),
      minify: true,
      visitor: {
        Selector: (selector) => {
          const rewrite = (value: unknown): unknown => {
            if (Array.isArray(value)) {
              return value.flatMap((item) => {
                if (
                  isRecord(item) &&
                  item.type === "class" &&
                  typeof item.name === "string" &&
                  this.names.has(item.name)
                ) {
                  return this.selectors([item.name]);
                }
                if (
                  isRecord(item) &&
                  item.type === "attribute" &&
                  item.name === "class" &&
                  isRecord(item.operation)
                ) {
                  const { operator, value: match } = item.operation;
                  if (typeof match !== "string") {
                    throw new Error(`${filename}: unsupported class attribute selector`);
                  }
                  const matches = [...this.names.keys()].filter((name) => {
                    if (operator === "substring") {
                      return name.includes(match);
                    }
                    if (operator === "prefix") {
                      return name.startsWith(match);
                    }
                    if (operator === "suffix") {
                      return name.endsWith(match);
                    }
                    if (operator === "includes" || operator === "equal") {
                      return name === match;
                    }
                    return false;
                  });
                  if (matches.length > 0) {
                    if (operator === "equal") {
                      throw new Error(
                        `${filename}: exact class attribute selectors cannot be combined`,
                      );
                    }
                    return this.selectors(matches);
                  }
                }
                return [rewrite(item)];
              });
            }
            if (isRecord(value)) {
              return Object.fromEntries(
                Object.entries(value).map(([key, item]) => [key, rewrite(item)]),
              );
            }
            return value;
          };
          return rewrite(selector) as Selector;
        },
      },
    }).code.toString();
  }
}
