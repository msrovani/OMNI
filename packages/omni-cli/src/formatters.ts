import chalk from "chalk";

export function colorSuccess(msg: string): string {
  return chalk.green(msg);
}

export function colorError(msg: string): string {
  return chalk.red(msg);
}

export function colorWarning(msg: string): string {
  return chalk.yellow(msg);
}

export function colorInfo(msg: string): string {
  return chalk.blue(msg);
}

export function formatTable(
  rows: string[][],
  opts?: { header?: string[] },
): string {
  if (rows.length === 0) return "(no data)";
  let colCount = Math.max(...rows.map((r) => r.length));
  if (opts?.header) {
    colCount = Math.max(colCount, opts.header.length);
  }
  const colWidths = Array.from({ length: colCount }, (_, ci) =>
    Math.max(
      ...rows.map((r) => stripAnsi(r[ci] ?? "").length),
      opts?.header?.[ci] ? stripAnsi(opts.header[ci]).length : 0,
    ),
  );
  const lines: string[] = [];
  const sep = " │ ";
  if (opts?.header) {
    lines.push(
      opts.header.map((h, i) => h.padEnd(colWidths[i]!)).join(sep),
    );
    lines.push(colWidths.map((w) => "─".repeat(w)).join("─┼─"));
  }
  for (const row of rows) {
    lines.push(
      row.map((cell, i) => padVisual(cell, colWidths[i] ?? 0)).join(sep),
    );
  }
  return lines.join("\n");
}

function stripAnsi(s: string): string {
  return s.replace(/\x1B\[[0-9;]*m/g, "");
}

function padVisual(s: string, width: number): string {
  const visible = stripAnsi(s);
  const padLen = Math.max(0, width - visible.length);
  return s + " ".repeat(padLen);
}
