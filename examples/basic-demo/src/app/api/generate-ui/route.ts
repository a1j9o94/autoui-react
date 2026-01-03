import { NextRequest, NextResponse } from "next/server";

// Types for flat component structure
interface FlatComponent {
  id: string;
  type: string;
  parentId: string | null;
  props?: Record<string, any>;
  binding?: string | null;
  event?: {
    on: string;
    action: string;
    target: string;
  } | null;
}

interface UISpecNode {
  id: string;
  node_type: string;
  props: Record<string, any> | null;
  bindings: Record<string, any> | null;
  events: Record<string, { action: string; target: string; payload: Record<string, any> | null }> | null;
  children: UISpecNode[] | null;
}

// Flat component tool - LLM outputs flat array with parent references
const FLAT_UI_TOOL = {
  name: "generate_ui_components",
  description: `Generate a UI as a flat list of components with parent references.
RULES:
- First component must have parentId: null (root)
- Use parentId to establish hierarchy (child points to parent's id)
- ListView binding should be the data path (e.g., "tasks.data")
- Text/Button bindings use {{item.field}} for list items
- Button MUST have props.label
- Common props: className (Tailwind), label, placeholder, text, variant, size`,
  input_schema: {
    type: "object",
    properties: {
      components: {
        type: "array",
        description: "Flat list of UI components with parent references",
        items: {
          type: "object",
          properties: {
            id: {
              type: "string",
              description: "Unique identifier for this component"
            },
            type: {
              type: "string",
              enum: ["Container", "Card", "Header", "Button", "Input",
                     "Select", "Textarea", "Checkbox", "RadioGroup",
                     "ListView", "Detail", "Tabs", "Dialog", "Heading", "Text"],
              description: "Component type"
            },
            parentId: {
              type: ["string", "null"],
              description: "ID of parent component, or null for root"
            },
            props: {
              type: "object",
              description: "Component props (className, label, text, placeholder, variant, size, etc.)"
            },
            binding: {
              type: ["string", "null"],
              description: "Data binding - for ListView use path like 'tasks.data', for Text/others use '{{item.field}}'"
            },
            event: {
              type: ["object", "null"],
              description: "Event handler",
              properties: {
                on: {
                  type: "string",
                  enum: ["CLICK", "CHANGE", "SUBMIT"],
                  description: "Event type"
                },
                action: {
                  type: "string",
                  enum: ["SHOW_DETAIL", "HIDE_DETAIL", "UPDATE_DATA", "ADD_ITEM", "DELETE_ITEM", "OPEN_DIALOG", "CLOSE_DIALOG"],
                  description: "Action to execute"
                },
                target: {
                  type: "string",
                  description: "Target component ID or data path"
                }
              },
              required: ["on", "action", "target"]
            }
          },
          required: ["id", "type", "parentId"]
        }
      }
    },
    required: ["components"]
  }
};

export async function POST(request: NextRequest) {
  try {
    const { prompt, apiKey } = await request.json();

    // Use server-side env variable as fallback
    const effectiveApiKey = apiKey || process.env.ANTHROPIC_API_KEY;

    if (!effectiveApiKey) {
      return NextResponse.json(
        { error: "API key is required. Set ANTHROPIC_API_KEY env variable or pass apiKey in request." },
        { status: 400 }
      );
    }

    if (!prompt) {
      return NextResponse.json(
        { error: "Prompt is required" },
        { status: 400 }
      );
    }

    console.log("[API] Calling Anthropic API with flat component tool...");

    // Call Anthropic API directly
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "anthropic-version": "2023-06-01",
        "x-api-key": effectiveApiKey,
      },
      body: JSON.stringify({
        model: "claude-3-5-haiku-20241022",
        max_tokens: 2048,
        tools: [FLAT_UI_TOOL],
        tool_choice: { type: "tool", name: "generate_ui_components" },
        messages: [
          {
            role: "user",
            content: `${prompt}

You MUST call the generate_ui_components tool. Output a flat array of components:
- First component is root (parentId: null)
- Children reference parent's id via parentId
- ListView needs binding to data array (e.g., "tasks.data")
- Text inside ListView uses {{item.field}} binding
- Button MUST have label in props
- Use Tailwind classes for className`
          }
        ]
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("[API] Anthropic API error:", response.status, errorText);
      return NextResponse.json(
        { error: `Anthropic API error: ${response.status} - ${errorText}` },
        { status: response.status }
      );
    }

    const data = await response.json();
    console.log("[API] Anthropic response:", JSON.stringify(data, null, 2));

    // Extract tool use from response
    const toolUse = data.content?.find((block: { type: string }) => block.type === "tool_use");

    if (!toolUse) {
      console.error("[API] No tool_use in response:", data);
      return NextResponse.json(
        { error: "Model did not return structured output" },
        { status: 500 }
      );
    }

    console.log("[API] Tool input:", JSON.stringify(toolUse.input, null, 2));

    const flatComponents: FlatComponent[] = toolUse.input?.components;
    if (!flatComponents || !Array.isArray(flatComponents)) {
      console.error("[API] Invalid components in tool response:", toolUse.input);
      return NextResponse.json(
        { error: "Model returned invalid component structure" },
        { status: 500 }
      );
    }

    console.log("[API] Flat components count:", flatComponents.length);

    // Convert flat component list to nested UISpecNode tree
    const uiSpec = flatToTree(flatComponents);
    console.log("[API] Converted UISpec:", JSON.stringify(uiSpec, null, 2));

    return NextResponse.json({ uiSpec, flatComponents });
  } catch (error) {
    console.error("[API] Error generating UI:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}

/**
 * Convert flat component array to nested UISpecNode tree
 */
function flatToTree(components: FlatComponent[]): UISpecNode {
  // Group components by their parentId
  const childrenMap = new Map<string | null, FlatComponent[]>();

  components.forEach(c => {
    const parentId = c.parentId;
    const list = childrenMap.get(parentId) || [];
    list.push(c);
    childrenMap.set(parentId, list);
  });

  // Recursive function to build a node and its children
  function buildNode(c: FlatComponent): UISpecNode {
    const nodeChildren = childrenMap.get(c.id) || [];

    // Determine bindings based on component type
    let bindings: Record<string, any> | null = null;
    if (c.binding) {
      if (c.type === "ListView") {
        bindings = { data: c.binding };
      } else {
        // For text/other components, check if it's a template or direct path
        bindings = { text: c.binding };
      }
    }

    // Transform event to UISpecNode format
    let events: Record<string, { action: string; target: string; payload: Record<string, any> | null }> | null = null;
    if (c.event) {
      events = {
        [c.event.on]: {
          action: c.event.action,
          target: c.event.target,
          payload: null
        }
      };
    }

    return {
      id: c.id,
      node_type: c.type,
      props: c.props || {},
      bindings,
      events,
      children: nodeChildren.length > 0 ? nodeChildren.map(buildNode) : null,
    };
  }

  // Find root components (those with parentId = null)
  const roots = childrenMap.get(null) || [];

  if (roots.length === 0) {
    // No root found, return empty container
    console.warn("[API] No root component found (parentId: null)");
    return {
      id: "root",
      node_type: "Container",
      props: { className: "p-4" },
      bindings: null,
      events: null,
      children: null,
    };
  }

  if (roots.length === 1) {
    return buildNode(roots[0]);
  }

  // Multiple roots - wrap in container
  return {
    id: "root",
    node_type: "Container",
    props: { className: "p-4" },
    bindings: null,
    events: null,
    children: roots.map(buildNode),
  };
}
