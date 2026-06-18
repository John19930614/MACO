import { NextRequest, NextResponse } from "next/server";
import { getComments, createComment, getProfiles, getSessionUser, AuthorizationError } from "@/lib/data/repo";
import { z } from "zod";

// GET /api/cells/[id]/comments — thread for a cell, with author display names.
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [comments, profiles] = await Promise.all([getComments(id), getProfiles()]);
  const name = (uid: string) => profiles.find((p) => p.id === uid)?.display_name ?? "Unknown";
  return NextResponse.json({ comments: comments.map((c) => ({ ...c, author_name: name(c.author_id) })) });
}

const schema = z.object({ body: z.string().min(1).max(2000) });

// POST /api/cells/[id]/comments — add a comment.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "validation" }, { status: 400 });
  let comment;
  try {
    comment = await createComment(id, parsed.data.body, (await getSessionUser()).id);
  } catch (e) {
    if (e instanceof AuthorizationError) return NextResponse.json({ error: "forbidden", detail: e.message }, { status: 403 });
    throw e;
  }
  if (!comment) return NextResponse.json({ error: "not_found" }, { status: 404 });
  return NextResponse.json({ comment }, { status: 201 });
}
