export interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
}

export interface Session {
  id: string;
  sessionId?: string;
  name: string;
  tunnelUrl?: string;
  messages: Message[];
  status:
    | "IN_PROGRESS"
    | "CLONING_REPO"
    | "INSTALLING_DEPENDENCIES"
    | "STARTING_DEV_SERVER"
    | "CREATING_TUNNEL"
    | "RUNNING";
}
