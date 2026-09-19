const roles: readonly [RegExp, string][] = [
  [/comment/, "text-syn-c italic"],
  [
    /entity\.other\.attribute-name|variable\.other\.property|support\.type\.property-name|meta\.object-literal\.key/,
    "text-syn-p",
  ],
  [/string|regexp|heredoc/, "text-syn-s"],
  [/constant\.numeric|constant\.digit|\.numeric/, "text-syn-n"],
  [/entity\.name\.function|support\.function/, "text-syn-f"],
  [/entity\.name\.tag/, "text-syn-g"],
  [/entity\.name\.type|entity\.name\.class|support\.class|support\.type/, "text-syn-t"],
  [/keyword\.operator/, "text-syn-o"],
  [/storage(?:\.|$)|keyword\.|constant\.language|support\.constant/, "text-syn-k"],
  [/punctuation|meta\.brace/, "text-syn-u"],
];

export function tokenRole(names: readonly string[]): string {
  return roles.find(([pattern]) => names.some((name) => pattern.test(name)))?.[1] ?? "";
}
