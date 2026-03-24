import { execSync } from "child_process";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const out = execSync(
      'git log -5 --pretty=format:"%h|%s|%ad" --date=short',
      { cwd: process.cwd() }
    ).toString().trim();

    const commits = out.split("\n").map((line) => {
      const [hash, ...rest] = line.split("|");
      const date = rest.pop()!;
      const message = rest.join("|");
      return { hash, message, date };
    });

    return NextResponse.json({ commits });
  } catch {
    return NextResponse.json({ commits: [] });
  }
}
