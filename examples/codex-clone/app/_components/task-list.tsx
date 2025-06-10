"use client";
import { Archive, Check, Trash2 } from "lucide-react";

import { useTaskStore } from "@/stores/tasks";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";

export default function TaskList() {
  const { getActiveTasks, getArchivedTasks, archiveTask, removeTask } =
    useTaskStore();

  const activeTasks = getActiveTasks();
  const archivedTasks = getArchivedTasks();

  return (
    <div className="max-w-3xl mx-auto w-full p-1 rounded-lg bg-muted">
      <Tabs defaultValue="active">
        <TabsList>
          <TabsTrigger value="active">
            <Check />
            Tasks
          </TabsTrigger>
          <TabsTrigger value="archived">
            <Archive />
            Archive
          </TabsTrigger>
        </TabsList>

        <TabsContent value="active">
          <div className="flex flex-col gap-1">
            {activeTasks.length === 0 ? (
              <p className="text-muted-foreground p-2">No active tasks yet.</p>
            ) : (
              activeTasks.map((task) => (
                <div
                  key={task.id}
                  className="border rounded-lg bg-background p-4 flex items-center justify-between"
                >
                  <div>
                    <h3 className="font-medium">{task.title}</h3>
                    <p className="text-sm text-muted-foreground">
                      Status: {task.status} • Branch: {task.branch}
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => archiveTask(task.id)}
                  >
                    <Archive />
                  </Button>
                </div>
              ))
            )}
          </div>
        </TabsContent>
        <TabsContent value="archived">
          <div className="flex flex-col gap-1">
            {archivedTasks.length === 0 ? (
              <p className="text-muted-foreground p-2">
                No archived tasks yet.
              </p>
            ) : (
              archivedTasks.map((task) => (
                <div
                  key={task.id}
                  className="border rounded-lg p-4 flex items-center justify-between bg-background"
                >
                  <div>
                    <h3 className="font-medium text-muted-foreground">
                      {task.title}
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      Status: {task.status} • Branch: {task.branch}
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => removeTask(task.id)}
                  >
                    <Trash2 />
                  </Button>
                </div>
              ))
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
