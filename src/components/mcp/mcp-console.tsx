"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type McpTool = {
  name: string;
  description?: string;
  inputSchema?: unknown;
};

type McpResource = {
  uri: string;
  name?: string;
  description?: string;
  mimeType?: string;
};

type McpPromptArg = {
  name: string;
  description?: string;
  required?: boolean;
};

type McpPrompt = {
  name: string;
  description?: string;
  arguments?: McpPromptArg[];
};

async function callMcp<T>(method: string, params?: unknown): Promise<T> {
  const response = await fetch("/api/mcp", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ method, params }),
  });

  const payload = await response.json();
  if (!response.ok) {
    const message =
      typeof payload?.error === "string"
        ? payload.error
        : payload?.error?.message ?? "MCP request failed.";
    throw new Error(message);
  }

  return payload as T;
}

function prettyJson(value: unknown) {
  return JSON.stringify(value, null, 2);
}

export function McpConsole() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [tools, setTools] = useState<McpTool[]>([]);
  const [resources, setResources] = useState<McpResource[]>([]);
  const [prompts, setPrompts] = useState<McpPrompt[]>([]);

  const [selectedTool, setSelectedTool] = useState<string>("");
  const [toolArgs, setToolArgs] = useState<string>("{}");
  const [toolOutput, setToolOutput] = useState<string>("");
  const [toolRunning, setToolRunning] = useState(false);

  const [selectedResource, setSelectedResource] = useState<string>("");
  const [resourceOutput, setResourceOutput] = useState<string>("");
  const [resourceRunning, setResourceRunning] = useState(false);

  const [selectedPrompt, setSelectedPrompt] = useState<string>("");
  const [promptArgs, setPromptArgs] = useState<string>("{}");
  const [promptOutput, setPromptOutput] = useState<string>("");
  const [promptRunning, setPromptRunning] = useState(false);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [toolsResult, resourcesResult, promptsResult] = await Promise.all([
        callMcp<{ tools: McpTool[] }>("tools/list"),
        callMcp<{ resources: McpResource[] }>("resources/list"),
        callMcp<{ prompts: McpPrompt[] }>("prompts/list"),
      ]);

      setTools(toolsResult.tools ?? []);
      setResources(resourcesResult.resources ?? []);
      setPrompts(promptsResult.prompts ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load MCP data.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchAll();
  }, [fetchAll]);

  const selectedToolDetails = useMemo(
    () => tools.find((tool) => tool.name === selectedTool),
    [tools, selectedTool]
  );

  const selectedPromptDetails = useMemo(
    () => prompts.find((prompt) => prompt.name === selectedPrompt),
    [prompts, selectedPrompt]
  );

  const runTool = async () => {
    if (!selectedTool) return;
    setToolRunning(true);
    setToolOutput("");
    try {
      const parsedArgs = toolArgs.trim() ? JSON.parse(toolArgs) : {};
      const result = await callMcp<unknown>("tools/call", {
        name: selectedTool,
        arguments: parsedArgs,
      });
      setToolOutput(prettyJson(result));
    } catch (err) {
      setToolOutput(
        prettyJson({
          error: err instanceof Error ? err.message : "Tool call failed.",
        })
      );
    } finally {
      setToolRunning(false);
    }
  };

  const readResource = async () => {
    if (!selectedResource) return;
    setResourceRunning(true);
    setResourceOutput("");
    try {
      const result = await callMcp<unknown>("resources/read", {
        uri: selectedResource,
      });
      setResourceOutput(prettyJson(result));
    } catch (err) {
      setResourceOutput(
        prettyJson({
          error: err instanceof Error ? err.message : "Resource read failed.",
        })
      );
    } finally {
      setResourceRunning(false);
    }
  };

  const getPrompt = async () => {
    if (!selectedPrompt) return;
    setPromptRunning(true);
    setPromptOutput("");
    try {
      const parsedArgs = promptArgs.trim() ? JSON.parse(promptArgs) : {};
      const result = await callMcp<unknown>("prompts/get", {
        name: selectedPrompt,
        arguments: parsedArgs,
      });
      setPromptOutput(prettyJson(result));
    } catch (err) {
      setPromptOutput(
        prettyJson({
          error: err instanceof Error ? err.message : "Prompt fetch failed.",
        })
      );
    } finally {
      setPromptRunning(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">MCP Console</h1>
          <p className="text-sm text-muted-foreground">
            Browse tools, resources, and prompts exposed by the MCP backend.
          </p>
        </div>
        <Button variant="outline" onClick={fetchAll} disabled={loading}>
          {loading ? "Refreshing..." : "Refresh"}
        </Button>
      </div>

      {error ? (
        <Card className="border-destructive/40">
          <CardHeader>
            <CardTitle className="text-destructive">Connection Error</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <p>{error}</p>
            <p>
              Check the MCP URL and any required auth headers in your
              environment variables.
            </p>
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Tools</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Select a tool</label>
              <select
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={selectedTool}
                onChange={(event) => setSelectedTool(event.target.value)}
              >
                <option value="">Choose a tool...</option>
                {tools.map((tool) => (
                  <option key={tool.name} value={tool.name}>
                    {tool.name}
                  </option>
                ))}
              </select>
              {selectedToolDetails?.description ? (
                <p className="text-sm text-muted-foreground">
                  {selectedToolDetails.description}
                </p>
              ) : null}
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Arguments (JSON)</label>
              <textarea
                className="min-h-[120px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-mono"
                value={toolArgs}
                onChange={(event) => setToolArgs(event.target.value)}
              />
            </div>

            <Button onClick={runTool} disabled={toolRunning || !selectedTool}>
              {toolRunning ? "Running..." : "Run Tool"}
            </Button>

            <div className="space-y-2">
              <label className="text-sm font-medium">Response</label>
              <pre
                className={cn(
                  "min-h-[160px] w-full rounded-md border border-input bg-muted/30 p-3 text-xs",
                  toolOutput ? "text-foreground" : "text-muted-foreground"
                )}
              >
                {toolOutput || "Tool output will appear here."}
              </pre>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Tool Schema</CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="max-h-[520px] overflow-auto rounded-md border border-input bg-muted/30 p-3 text-xs">
              {selectedToolDetails?.inputSchema
                ? prettyJson(selectedToolDetails.inputSchema)
                : "Select a tool to view its input schema."}
            </pre>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Resources</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Select a resource</label>
              <select
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={selectedResource}
                onChange={(event) => setSelectedResource(event.target.value)}
              >
                <option value="">Choose a resource...</option>
                {resources.map((resource) => (
                  <option key={resource.uri} value={resource.uri}>
                    {resource.name ? `${resource.name} (${resource.uri})` : resource.uri}
                  </option>
                ))}
              </select>
              {selectedResource ? (
                <div className="text-xs text-muted-foreground">
                  {resources.find((resource) => resource.uri === selectedResource)
                    ?.description ?? "No description provided."}
                </div>
              ) : null}
            </div>

            <Button
              onClick={readResource}
              disabled={resourceRunning || !selectedResource}
            >
              {resourceRunning ? "Loading..." : "Read Resource"}
            </Button>

            <div className="space-y-2">
              <label className="text-sm font-medium">Response</label>
              <pre
                className={cn(
                  "min-h-[160px] w-full rounded-md border border-input bg-muted/30 p-3 text-xs",
                  resourceOutput ? "text-foreground" : "text-muted-foreground"
                )}
              >
                {resourceOutput || "Resource payload will appear here."}
              </pre>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Prompts</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Select a prompt</label>
              <select
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={selectedPrompt}
                onChange={(event) => setSelectedPrompt(event.target.value)}
              >
                <option value="">Choose a prompt...</option>
                {prompts.map((prompt) => (
                  <option key={prompt.name} value={prompt.name}>
                    {prompt.name}
                  </option>
                ))}
              </select>
              {selectedPromptDetails?.description ? (
                <p className="text-sm text-muted-foreground">
                  {selectedPromptDetails.description}
                </p>
              ) : null}
            </div>

            {selectedPromptDetails?.arguments?.length ? (
              <div className="space-y-2 rounded-md border border-input bg-muted/30 p-3 text-xs">
                <div className="text-sm font-medium">Prompt arguments</div>
                {selectedPromptDetails.arguments.map((arg) => (
                  <div key={arg.name}>
                    <span className="font-semibold">{arg.name}</span>
                    {arg.required ? " (required)" : " (optional)"}
                    {arg.description ? ` - ${arg.description}` : ""}
                  </div>
                ))}
              </div>
            ) : null}

            <div className="space-y-2">
              <label className="text-sm font-medium">Arguments (JSON)</label>
              <textarea
                className="min-h-[120px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-mono"
                value={promptArgs}
                onChange={(event) => setPromptArgs(event.target.value)}
              />
            </div>

            <Button
              onClick={getPrompt}
              disabled={promptRunning || !selectedPrompt}
            >
              {promptRunning ? "Loading..." : "Get Prompt"}
            </Button>

            <div className="space-y-2">
              <label className="text-sm font-medium">Response</label>
              <pre
                className={cn(
                  "min-h-[160px] w-full rounded-md border border-input bg-muted/30 p-3 text-xs",
                  promptOutput ? "text-foreground" : "text-muted-foreground"
                )}
              >
                {promptOutput || "Prompt response will appear here."}
              </pre>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Connection Settings</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-md border border-input bg-muted px-2 py-1 text-xs text-foreground">
              MCP_SERVER_URL
            </span>
            Set to override the default server.
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-md border border-input bg-muted px-2 py-1 text-xs text-foreground">
              MCP_AUTH_HEADER
            </span>
            Provide a full authorization header if required.
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-md border border-input bg-muted px-2 py-1 text-xs text-foreground">
              MCP_AUTH_TOKEN
            </span>
            Used as a Bearer token when MCP_AUTH_HEADER is not set.
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
