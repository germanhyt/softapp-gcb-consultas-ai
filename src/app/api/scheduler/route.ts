import { NextResponse } from "next/server";
import { getTasks, updateTask, addTask, deleteTask } from "@/lib/scheduler/cron-manager";

// GET - List all scheduled tasks
export async function GET() {
  const tasks = getTasks();
  return NextResponse.json(tasks);
}

// POST - Create new task
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const task = addTask(body);
    return NextResponse.json(task, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Error" },
      { status: 400 }
    );
  }
}

// PATCH - Update existing task
export async function PATCH(req: Request) {
  try {
    const body = await req.json();
    const { id, ...updates } = body;
    if (!id) {
      return NextResponse.json({ error: "Task ID required" }, { status: 400 });
    }
    const task = updateTask(id, updates);
    if (!task) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }
    return NextResponse.json(task);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Error" },
      { status: 400 }
    );
  }
}

// DELETE - Delete task
export async function DELETE(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    if (!id) {
      return NextResponse.json({ error: "Task ID required" }, { status: 400 });
    }
    const deleted = deleteTask(id);
    if (!deleted) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Error" },
      { status: 400 }
    );
  }
}
