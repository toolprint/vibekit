"use client";
import { Archive, Check } from "lucide-react";

import { useTaskStore } from "@/stores/tasks";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";

export default function TaskList() {
  const { getActiveTasks, getArchivedTasks, archiveTask, unarchiveTask } =
    useTaskStore();

  const activeTasks = getActiveTasks();
  const archivedTasks = getArchivedTasks();

  return (
    <div className="max-w-2xl mx-auto w-full">
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
          <div className="flex flex-col gap-4">
            {activeTasks.length === 0 ? (
              <p className="text-muted-foreground py-4">No active tasks yet.</p>
            ) : (
              activeTasks.map((task) => (
                <div
                  key={task.id}
                  className="border rounded-lg p-4 flex items-center justify-between"
                >
                  <div>
                    <h3 className="font-medium">{task.title}</h3>
                    <p className="text-sm text-muted-foreground">
                      Status: {task.status} • Branch: {task.branch}
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => archiveTask(task.id)}
                  >
                    Archive
                  </Button>
                </div>
              ))
            )}
          </div>
        </TabsContent>
        <TabsContent value="archived">
          <div className="flex flex-col gap-4">
            {archivedTasks.length === 0 ? (
              <p className="text-muted-foreground py-4">
                No archived tasks yet.
              </p>
            ) : (
              archivedTasks.map((task) => (
                <div
                  key={task.id}
                  className="border rounded-lg p-4 flex items-center justify-between bg-muted/50"
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
                    size="sm"
                    onClick={() => unarchiveTask(task.id)}
                  >
                    Unarchive
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
