"use client";
import Link from "next/link";
import { ArrowLeft, Dot } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

import { Button } from "@/components/ui/button";
import { useTaskStore } from "@/stores/tasks";

interface Props {
  id: string;
}

export default function TaskNavbar({ id }: Props) {
  const { getTaskById } = useTaskStore();
  const task = getTaskById(id);

  return (
    <div className="h-14 border-b flex items-center px-4">
      <div className="flex items-center gap-x-2">
        <Link href="/">
          <Button variant="ghost" size="icon">
            <ArrowLeft />
          </Button>
        </Link>
        <div className="h-8 border-r" />
        <div className="flex flex-col gap-x-2 ml-4">
          <h3 className=" font-medium">{task?.title}</h3>
          <div className="flex items-center gap-x-0">
            <p className="text-sm text-muted-foreground">
              {formatDistanceToNow(new Date(task?.createdAt as string), {
                addSuffix: true,
              })}
            </p>
            <Dot className="size-4 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">{task?.repository}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
