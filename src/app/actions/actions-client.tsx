"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Plus, RotateCw } from "lucide-react";
import type { ActionItem, Claim } from "@/lib/types";
import { humanize } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

async function readError(response: Response): Promise<string> {
  const data = (await response.json().catch(() => null)) as { error?: string } | null;
  return data?.error ?? "Request failed.";
}

const NEXT_STATUS: Record<ActionItem["status"], ActionItem["status"]> = {
  open: "in_progress",
  in_progress: "completed",
  completed: "open",
  dismissed: "open",
};

export function ActionsClient({
  initialActions,
  claims,
}: {
  initialActions: ActionItem[];
  claims: Claim[];
}) {
  const [actions, setActions] = useState(initialActions);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<ActionItem["priority"]>("medium");
  const claimsById = useMemo(() => new Map(claims.map((claim) => [claim.id, claim])), [claims]);

  async function createAction() {
    if (!title.trim()) {
      toast.error("Give the action a title.");
      return;
    }
    const response = await fetch("/api/actions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, description, priority }),
    });
    if (!response.ok) {
      toast.error(await readError(response));
      return;
    }
    const data = (await response.json()) as { action: ActionItem };
    setActions((current) => [data.action, ...current]);
    setTitle("");
    setDescription("");
    setPriority("medium");
    toast.success("Action created.");
  }

  async function cycleStatus(action: ActionItem) {
    const status = NEXT_STATUS[action.status];
    const response = await fetch(`/api/actions/${action.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    if (!response.ok) {
      toast.error(await readError(response));
      return;
    }
    const data = (await response.json()) as { action: ActionItem };
    setActions((current) => current.map((item) => (item.id === action.id ? data.action : item)));
  }

  return (
    <div className="grid gap-6 px-6 py-8 md:px-10 xl:grid-cols-[360px_minmax(0,1fr)]">
      <Card className="h-fit rounded-lg">
        <CardHeader>
          <CardTitle>New Action</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3">
          <div className="grid gap-2">
            <Label htmlFor="action-title">Title</Label>
            <Input id="action-title" value={title} onChange={(event) => setTitle(event.target.value)} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="action-description">Description</Label>
            <Textarea
              id="action-description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              rows={4}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="action-priority">Priority</Label>
            <select
              id="action-priority"
              value={priority}
              onChange={(event) => setPriority(event.target.value as ActionItem["priority"])}
              className="h-8 rounded-lg border border-input bg-background px-2 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
            </select>
          </div>
        </CardContent>
        <CardFooter>
          <Button type="button" onClick={createAction}>
            <Plus className="size-4" strokeWidth={1.75} />
            Add action
          </Button>
        </CardFooter>
      </Card>

      <section className="grid content-start gap-3">
        {actions.length === 0 ? (
          <p className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
            No actions yet.
          </p>
        ) : (
          actions.map((action) => {
            const claim = action.derivedFromClaimId
              ? claimsById.get(action.derivedFromClaimId)
              : undefined;
            return (
              <Card key={action.id} className="rounded-lg">
                <CardHeader>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <CardTitle>{action.title}</CardTitle>
                      {action.description ? (
                        <p className="mt-1 text-sm text-muted-foreground">{action.description}</p>
                      ) : null}
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      <Badge variant={action.priority === "high" ? "destructive" : "outline"}>
                        {humanize(action.priority)}
                      </Badge>
                      <Badge variant="secondary">{humanize(action.status)}</Badge>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="grid gap-2 text-sm text-muted-foreground">
                  {action.dueAt ? <p>Due {new Date(action.dueAt).toLocaleDateString()}</p> : null}
                  {claim ? (
                    <Link href={`/atlas?claim=${claim.id}`} className="text-primary underline underline-offset-4">
                      From claim: {claim.canonicalText}
                    </Link>
                  ) : null}
                </CardContent>
                <CardFooter>
                  <Button type="button" variant="outline" onClick={() => cycleStatus(action)}>
                    <RotateCw className="size-4" strokeWidth={1.75} />
                    Move to {humanize(NEXT_STATUS[action.status])}
                  </Button>
                </CardFooter>
              </Card>
            );
          })
        )}
      </section>
    </div>
  );
}
