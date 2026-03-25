import { NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";

export async function GET() {
  // Blueprint lives one level up from the frontend folder
  const filePath = path.join(process.cwd(), "..", "dgat_blueprint.md");
  try {
    const content = await fs.readFile(filePath, "utf-8");
    return new NextResponse(content, {
      headers: { "Content-Type": "text/markdown; charset=utf-8" },
    });
  } catch {
    return NextResponse.json({ error: "dgat_blueprint.md not found" }, { status: 404 });
  }
}
