import { NextResponse } from "next/server";
import { executeTaskNow } from "@/lib/scheduler/cron-manager";

// POST - Execute a task immediately
export async function POST(req: Request) {
  try {
    const { taskId } = await req.json();
    if (!taskId) {
      return NextResponse.json({ error: "taskId required" }, { status: 400 });
    }

    const result = await executeTaskNow(taskId);
    return NextResponse.json({ success: true, content: result });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Error" },
      { status: 500 }
    );
  }
}
