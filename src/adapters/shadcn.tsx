import React from "react";
import { UISpecNode, UIEvent, UIEventType } from "../schema/ui";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogContent,
} from "@/components/ui/dialog";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";

// Utility to parse CSS style string into a React style object
const parseStyleString = (styleString: string): React.CSSProperties => {
  if (typeof styleString !== "string") {
    // If it's not a string (e.g., already an object or undefined), return it as is or an empty object
    return typeof styleString === "object" ? styleString : {};
  }
  const style: React.CSSProperties = {};
  styleString.split(";").forEach((declaration) => {
    const [property, value] = declaration.split(":");
    if (property && value) {
      const camelCasedProperty = property
        .trim()
        .replace(/-([a-z])/g, (g) => g[1].toUpperCase());
      // Revert to simple assignment, accepting the potential type mismatch flagged by linter.
      // Casting to 'any' is forbidden, and 'string' doesn't satisfy all properties.
      // @ts-expect-error - Trusting the string value is valid for the CSS property
      style[camelCasedProperty as keyof React.CSSProperties] = value.trim();
    }
  });
  return style;
};

const isArrayOf =
  <T,>(guard: (item: unknown) => item is T) =>
  (arr: unknown): arr is T[] =>
    Array.isArray(arr) && arr.every(guard);

// Shimmer components
export const ShimmerBlock: React.FC = () => (
  <div className="w-full h-8 bg-gray-200 animate-pulse rounded" />
);

export const ShimmerTable: React.FC<{ rows?: number }> = ({ rows = 3 }) => (
  <div className="w-full space-y-2">
    <div className="w-full h-10 bg-gray-200 animate-pulse rounded" />
    {Array.from({ length: rows }).map((_, i) => (
      <div key={i} className="w-full h-12 bg-gray-200 animate-pulse rounded" />
    ))}
  </div>
);

export const ShimmerCard: React.FC = () => (
  <div className="w-full p-4 space-y-4 border rounded-lg">
    <div className="w-3/4 h-6 bg-gray-200 animate-pulse rounded" />
    <div className="space-y-2">
      <div className="w-full h-4 bg-gray-200 animate-pulse rounded" />
      <div className="w-full h-4 bg-gray-200 animate-pulse rounded" />
      <div className="w-5/6 h-4 bg-gray-200 animate-pulse rounded" />
    </div>
  </div>
);

// Mock ShadCN components for demonstration
const Container: React.FC<{
  style?: React.CSSProperties;
  className?: string;
  children?: React.ReactNode;
}> = (props) => (
  <div className={`autoui-mock-container ${props.className || ""}`}>
    {props.children}
  </div>
);

const Header: React.FC<{ title: string; className?: string }> = ({
  title,
  className,
}) => (
  <header
    className={`py-4 px-6 border-b border-gray-300 mb-4 bg-gray-50 dark:bg-gray-800 ${
      className || ""
    }`}
  >
    <h1 className="text-xl font-semibold text-gray-800 dark:text-white">
      {title}
    </h1>
  </header>
);

const Button: React.FC<{
  onClick?: (() => void) | undefined;
  children: React.ReactNode;
  variant?: "default" | "outline" | "destructive" | undefined;
}> = ({ onClick, children, variant = "default" }) => (
  <button
    className={`px-4 py-2 rounded-md font-medium transition-colors ${
      variant === "default"
        ? "bg-blue-600 text-white hover:bg-blue-700"
        : variant === "outline"
        ? "border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800"
        : "bg-red-600 text-white hover:bg-red-700"
    }`}
    onClick={() => onClick?.()}
  >
    {children}
  </button>
);

const Detail: React.FC<{
  data?: Record<string, React.ReactNode> | undefined;
  fields?: { key: string; label: string; type?: string }[] | undefined;
  title?: string | undefined;
  visible?: boolean | undefined;
  onBack?: (() => void) | undefined;
}> = ({ data, fields = [], title, visible = true, onBack }) => {
  if (!visible) return null;

  return (
    <div className="w-full border border-gray-300 dark:border-gray-700 rounded-lg p-6 space-y-4 bg-white dark:bg-gray-900 shadow-sm">
      <div className="flex justify-between items-center border-b border-gray-200 dark:border-gray-700 pb-3">
        {title && (
          <h2 className="text-lg font-medium text-gray-800 dark:text-white">
            {title}
          </h2>
        )}
        {onBack && (
          <Button variant="outline" onClick={onBack}>
            Back
          </Button>
        )}
      </div>

      <div className="space-y-4">
        {fields.map((field) => {
          if (field.type === "heading") {
            return (
              <h3
                key={field.key}
                className="text-xl font-semibold text-gray-800 dark:text-white"
              >
                {data?.[field.key] ?? ""}
              </h3>
            );
          }

          if (field.type === "content") {
            return (
              <div
                key={field.key}
                className="text-sm text-gray-700 dark:text-gray-300"
              >
                {data?.[field.key] ?? ""}
              </div>
            );
          }

          return (
            <div
              key={field.key}
              className="flex flex-col border-b border-gray-100 dark:border-gray-800 py-2"
            >
              {field.label && (
                <span className="text-xs text-gray-600 dark:text-gray-400 font-medium">
                  {field.label}
                </span>
              )}
              <span className="text-sm text-gray-800 dark:text-gray-200">
                {data?.[field.key] ?? ""}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

const getSafeProp = <T, K extends string, D extends T>(
  props: Record<string, unknown> | null | undefined,
  key: K,
  validator: (value: unknown) => value is T,
  defaultValue: D
): T | D => {
  if (props && typeof props === "object" && key in props) {
    const value = props[key];
    if (validator(value)) {
      return value;
    }
  }
  return defaultValue;
};

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;
const isString = (value: unknown): value is string => typeof value === "string";
const isBoolean = (value: unknown): value is boolean =>
  typeof value === "boolean";
const isButtonVariant = (
  value: unknown
): value is "default" | "outline" | "destructive" =>
  isString(value) && ["default", "outline", "destructive"].includes(value);

const getSafeBinding = <T, K extends string, D extends T>(
  bindings: Record<string, unknown> | null | undefined,
  key: K,
  validator: (value: unknown) => value is T,
  defaultValue: D
): T | D => {
  if (bindings && typeof bindings === "object" && key in bindings) {
    const value = bindings[key];
    if (validator(value)) {
      return value;
    }
  }
  return defaultValue;
};

const isReactNode = (value: unknown): value is React.ReactNode => {
  // This is a simplified check. A full check is complex.
  // For basic scenarios, we can check for string, number, boolean, null, undefined, or React elements.
  return (
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean" ||
    value === null ||
    typeof value === "undefined" ||
    (typeof value === "object" && value !== null && "$$typeof" in value) // Basic check for React element
  );
};

const isRecordWithReactNodeValues = (
  value: unknown
): value is Record<string, React.ReactNode> =>
  isObject(value) && Object.values(value).every(isReactNode);

const isSelectOptionObject = (
  item: unknown
): item is { value: string; label: string } =>
  isObject(item) && isString(item.value) && isString(item.label);

const isTabObject = (
  item: unknown
): item is { value: string; label: string; content?: UISpecNode } => // Allow content to be optional initially
  isObject(item) &&
  isString(item.value) &&
  isString(item.label) &&
  (item.content === undefined || isUISpecNode(item.content));

const isUISpecNode = (value: unknown): value is UISpecNode => {
  if (!isObject(value)) return false;
  return isString(value.id) && isString(value.node_type); // Basic check
};

const isDetailFieldObject = (
  item: unknown
): item is { key: string; label: string; type?: string } =>
  isObject(item) &&
  isString(item.key) &&
  isString(item.label) &&
  (item.type === undefined || isString(item.type));

// Mock implementation - in a real application, this would dispatch events to your state engine
const createEventHandler = (
  node: UISpecNode,
  eventName: string,
  uiEventType: UIEventType,
  processEvent?: (event: UIEvent) => void
) => {
  const eventConfig = node.events?.[uiEventType];
  if (!processEvent || !eventConfig) return undefined;

  return (eventPayload?: Record<string, unknown>) => {
    const fullEvent: UIEvent = {
      type: uiEventType,
      nodeId: node.id,
      timestamp: Date.now(),
      payload: {
        ...(eventConfig.payload || {}),
        ...(eventPayload || {}),
      },
    };
    processEvent(fullEvent);
  };
};

export const adapterMap: Record<
  string,
  (
    node: UISpecNode,
    processEvent?: (event: UIEvent) => void
  ) => React.ReactElement
> = {
  Container: (node, processEvent) => {
    // Extract key and style first
    const { className, style: styleProp, key, ...restProps } = node.props || {};
    // Ensure children are rendered with keys
    const children = node.children?.map((child) =>
      // Use React.cloneElement to add the key prop to the element returned by renderNode
      React.cloneElement(renderNode(child, processEvent), { key: child.id })
    );
    // Parse style string if necessary
    const style =
      typeof styleProp === "string"
        ? parseStyleString(styleProp)
        : (styleProp as React.CSSProperties | undefined);

    return (
      <div
        key={key as React.Key} // Pass key directly
        className={cn("autoui-container", className as string)}
        style={style} // Use the parsed style object
        {...restProps}
        data-id={node.id}
      >
        {/* Add console log to see props during render */}
        {(() => {
          console.log(
            `[Adapter Debug] Rendering Container: id=${node.id}, props=`,
            node.props
          );
          return null;
        })()}
        {children}
      </div>
    );
  },

  Header: (node) => (
    <Header
      title={getSafeProp(node.props, "title", isString, "Untitled")}
      className={getSafeProp(node.props, "className", isString, "")}
    />
  ),

  Button: (node, processEvent) => (
    <Button
      variant={getSafeProp(node.props, "variant", isButtonVariant, "default")}
      onClick={createEventHandler(node, "onClick", "CLICK", processEvent)}
    >
      {getSafeProp(node.props, "label", isString, "Button")}
    </Button>
  ),

  ListView: (node, processEvent) => {
    // resolveBindings populates node.children with resolved items, each having a key.
    // We just need to render these children.
    // Extract key and style first
    const {
      className,
      style: styleProp,
      key,
      // Exclude data prop (array) from being spread onto the DOM element
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      data: _data,
      ...restProps
    } = node.props || {}; // Removed unused selectable & data

    // Parse style string if necessary
    const style =
      typeof styleProp === "string"
        ? parseStyleString(styleProp)
        : (styleProp as React.CSSProperties | undefined);

    // Add console log to see props during render
    console.log(
      `[Adapter Debug] Rendering ListView: id=${node.id}, props=`,
      node.props
    );

    // The children array from resolveBindings already contains React Elements with keys
    // if resolveBindings adds the key prop correctly.
    // If renderNode returns elements, they should retain their keys.
    // Fix: Add keys to children explicitly like in Container/Card
    const children = node.children?.map((child) =>
      React.cloneElement(renderNode(child, processEvent), { key: child.id })
    );

    return (
      <div
        key={key as React.Key} // Pass key directly
        className={cn(
          "autoui-listview-container space-y-2",
          className as string
        )}
        style={style} // Use the parsed style object
        {...restProps} // Spread remaining props (selectable, style, className, key are now excluded)
        data-id={node.id}
      >
        {children}
      </div>
    );
  },

  Detail: (node, processEvent) => {
    const data = getSafeBinding(
      node.bindings,
      "data",
      isRecordWithReactNodeValues,
      {}
    ) as Record<string, React.ReactNode>;
    const fields = getSafeBinding(
      node.bindings,
      "fields",
      isArrayOf(isDetailFieldObject),
      []
    );
    const title = getSafeProp(node.props, "title", isString, "");
    const visible = getSafeProp(node.props, "visible", isBoolean, true);

    return (
      <Detail
        data={data}
        fields={fields}
        title={title}
        visible={visible}
        onBack={createEventHandler(node, "onBack", "CLICK", processEvent)}
      />
    );
  },

  Card: (node, processEvent) => {
    // Extract key and style first
    const { className, style: styleProp, key, ...restProps } = node.props || {};
    // Ensure children are rendered with keys
    const children = node.children?.map((child) =>
      React.cloneElement(renderNode(child, processEvent), { key: child.id })
    );
    // Parse style string if necessary
    const style =
      typeof styleProp === "string"
        ? parseStyleString(styleProp)
        : (styleProp as React.CSSProperties | undefined);

    return (
      <Card
        key={key as React.Key} // Pass key directly
        className={cn("autoui-card", className as string)}
        style={style} // Use parsed style object
        {...restProps} // Spread remaining props
        data-id={node.id}
      >
        {/* Using CardContent as a default wrapper, adjust if needed */}
        <CardContent className="p-0">
          {" "}
          {/* Example: remove padding if children handle it */}
          {children}
        </CardContent>
      </Card>
    );
  },

  Input: (node, processEvent) => {
    const name = getSafeProp(node.props, "name", isString, "inputName");
    const label = getSafeProp(node.props, "label", isString, "");
    const value = getSafeBinding(node.bindings, "value", isString, "");
    const placeholder = getSafeProp(node.props, "placeholder", isString, "");
    const disabled = getSafeProp(node.props, "disabled", isBoolean, false);
    const className = getSafeProp(node.props, "className", isString, "");

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const handler = createEventHandler(
        node,
        "onChange",
        "CHANGE",
        processEvent
      );
      if (handler) handler({ value: e.target.value });
    };

    const handleFocus = () => {
      const handler = createEventHandler(
        node,
        "onFocus",
        "FOCUS",
        processEvent
      );
      if (handler) handler({});
    };

    const handleBlur = () => {
      const handler = createEventHandler(node, "onBlur", "BLUR", processEvent);
      if (handler) handler({});
    };

    return (
      <div className="grid w-full max-w-sm items-center gap-1.5">
        {label && <Label htmlFor={name}>{label}</Label>}
        <Input
          id={name} // Use name as id for label association
          name={name}
          placeholder={placeholder}
          disabled={disabled}
          value={value}
          onChange={handleChange}
          onFocus={handleFocus}
          onBlur={handleBlur}
          className={className}
        />
      </div>
    );
  },

  Select: (node, processEvent) => {
    const name = getSafeProp(node.props, "name", isString, "selectName");
    const label = getSafeProp(node.props, "label", isString, "");
    const placeholder = getSafeProp(
      node.props,
      "placeholder",
      isString,
      "Select..."
    );
    const disabled = getSafeProp(node.props, "disabled", isBoolean, false);
    const value = getSafeBinding(node.bindings, "value", isString, "");
    const options = getSafeBinding(
      node.bindings,
      "options",
      isArrayOf(isSelectOptionObject),
      []
    );
    const className = getSafeProp(node.props, "className", isString, "");

    const handleValueChange = (selectedValue: string) => {
      const handler = createEventHandler(
        node,
        "onValueChange",
        "CHANGE",
        processEvent
      );
      if (handler) handler({ value: selectedValue });
    };

    return (
      <div
        className={cn("grid w-full max-w-sm items-center gap-1.5", className)}
      >
        {label && <Label htmlFor={name}>{label}</Label>}
        <Select
          name={name}
          value={value}
          onValueChange={handleValueChange}
          disabled={disabled}
        >
          <SelectTrigger id={name}>
            <SelectValue placeholder={placeholder} />
          </SelectTrigger>
          <SelectContent>
            {options.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    );
  },

  Textarea: (node, processEvent) => {
    // Extract key first (style is usually handled by className for Textarea, but handle just in case)
    const { key, ...propsWithoutKey } = node.props || {};
    const name = getSafeProp(propsWithoutKey, "name", isString, "textareaName");
    const label = getSafeProp(propsWithoutKey, "label", isString, "");
    const placeholder = getSafeProp(
      propsWithoutKey,
      "placeholder",
      isString,
      ""
    );
    const disabled = getSafeProp(propsWithoutKey, "disabled", isBoolean, false);
    const rows = getSafeProp(
      propsWithoutKey,
      "rows",
      (v): v is number => typeof v === "number",
      3
    );
    const value = getSafeBinding(node.bindings, "value", isString, "");
    const className = getSafeProp(propsWithoutKey, "className", isString, "");

    const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const handler = createEventHandler(
        node,
        "onChange",
        "CHANGE",
        processEvent
      );
      if (handler) handler({ value: e.target.value });
    };

    const handleFocus = () => {
      const handler = createEventHandler(
        node,
        "onFocus",
        "FOCUS",
        processEvent
      );
      if (handler) handler({});
    };

    const handleBlur = () => {
      const handler = createEventHandler(node, "onBlur", "BLUR", processEvent);
      if (handler) handler({});
    };

    return (
      <div key={key as React.Key} className="grid w-full gap-1.5">
        {label && <Label htmlFor={name}>{label}</Label>}
        <Textarea
          id={name} // Use name as id for label association
          name={name}
          placeholder={placeholder}
          disabled={disabled}
          rows={rows}
          value={value}
          onChange={handleChange}
          onFocus={handleFocus}
          onBlur={handleBlur}
          className={className}
        />
      </div>
    );
  },

  Checkbox: (node, processEvent) => {
    // Extract key first (style is usually handled by className for Checkbox)
    const { key, ...propsWithoutKey } = node.props || {};
    const name = getSafeProp(propsWithoutKey, "name", isString, "checkboxName");
    const label = getSafeProp(propsWithoutKey, "label", isString, "");
    const checked = getSafeBinding(node.bindings, "checked", isBoolean, false);
    const disabled = getSafeProp(propsWithoutKey, "disabled", isBoolean, false);
    const className = getSafeProp(propsWithoutKey, "className", isString, "");

    const handleCheckedChange = (isChecked: boolean | "indeterminate") => {
      // Ensure we only pass boolean to our event handler
      if (typeof isChecked === "boolean") {
        const handler = createEventHandler(
          node,
          "onCheckedChange",
          "CHANGE",
          processEvent
        );
        if (handler) handler({ checked: isChecked });
      }
    };

    // Shadcn Checkbox often used with a Label
    return (
      <div
        key={key as React.Key}
        className={cn("flex items-center space-x-2", className as string)}
      >
        <Checkbox
          id={name} // Use name as id for label association
          name={name}
          checked={checked}
          disabled={disabled}
          onCheckedChange={handleCheckedChange}
        />
        {/* Add the aria-label for accessibility if no visible label */}
        {label && (
          <Label htmlFor={name} className="cursor-pointer">
            {label}
          </Label>
        )}
      </div>
    );
  },

  RadioGroup: (node, processEvent) => {
    // Extract key first (style is usually handled by className for RadioGroup)
    const { key, ...propsWithoutKey } = node.props || {};
    const name = getSafeProp(
      propsWithoutKey,
      "name",
      isString,
      "radioGroupName"
    );
    const label = getSafeProp(propsWithoutKey, "label", isString, "");
    const value = getSafeBinding(node.bindings, "value", isString, "");
    const options = getSafeBinding(
      node.bindings,
      "options",
      isArrayOf(isSelectOptionObject),
      []
    );
    const disabled = getSafeProp(propsWithoutKey, "disabled", isBoolean, false);
    const className = getSafeProp(propsWithoutKey, "className", isString, "");

    const handleValueChange = (selectedValue: string) => {
      const handler = createEventHandler(
        node,
        "onValueChange",
        "CHANGE",
        processEvent
      );
      if (handler) handler({ value: selectedValue });
    };

    return (
      <div
        key={key as React.Key}
        className={cn("grid gap-1.5", className as string)}
      >
        {label && <Label className="mb-1">{label}</Label>}
        <RadioGroup
          name={name}
          value={value}
          onValueChange={handleValueChange}
          disabled={disabled}
          className="flex flex-col space-y-1"
        >
          {options.map((option) => (
            <div key={option.value} className="flex items-center space-x-2">
              <RadioGroupItem
                value={option.value}
                id={`${name}-${option.value}`}
              />
              <Label
                htmlFor={`${name}-${option.value}`}
                className="cursor-pointer"
              >
                {option.label}
              </Label>
            </div>
          ))}
        </RadioGroup>
      </div>
    );
  },

  Tabs: (node, processEvent) => {
    // Extract key first (style is usually handled by className for Tabs)
    const { key, ...propsWithoutKey } = node.props || {};
    // For Tabs, children are defined by the 'tabs' prop which includes content as UISpecNode
    // We need to render these UISpecNode children.
    const rawTabs = getSafeBinding(
      node.bindings,
      "tabs",
      isArrayOf(isTabObject),
      []
    );
    const defaultValue = getSafeProp(
      propsWithoutKey,
      "defaultValue",
      isString,
      rawTabs[0]?.value || ""
    ); // Default to first tab if available
    const className = getSafeProp(propsWithoutKey, "className", isString, "");

    const handleValueChange = (value: string) => {
      const handler = createEventHandler(
        node,
        "onValueChange",
        "CHANGE",
        processEvent
      );
      if (handler) handler({ value });
    };

    return (
      <Tabs
        key={key as React.Key}
        defaultValue={defaultValue}
        onValueChange={handleValueChange}
        className={cn("autoui-tabs w-full", className)}
        data-id={node.id}
      >
        <TabsList>
          {rawTabs.map((tab) => (
            <TabsTrigger key={tab.value} value={tab.value}>
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>
        {rawTabs.map((tab) => (
          <TabsContent key={tab.value} value={tab.value}>
            {tab.content ? renderNode(tab.content, processEvent) : null}
          </TabsContent>
        ))}
      </Tabs>
    );
  },

  Dialog: (node, processEvent) => {
    // Determine if the dialog should be open. Check bindings first, then props.
    // Default to false if neither is specified.
    const isOpen = getSafeBinding(node.bindings, "visible", isBoolean, // Check bindings.visible (planner output)
                    getSafeProp(node.props, "open", isBoolean,          // Then props.open (if binding resolution put it there)
                      getSafeProp(node.props, "visible", isBoolean, false) // Then props.visible (if binding resolution put it there under 'visible')
                    )
                  );

    // Extract key and className first. Intentionally exclude styleProp and open (_open)
    const {
      title,
      description,
      className,
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      style: _styleProp,
      key,
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      open: _openProp,
      ...restProps
    } = node.props || {}; // Renamed unused styleProp to _styleProp, open to _openProp

    // Ensure children are rendered with keys
    const children = node.children?.map((child) =>
      React.cloneElement(renderNode(child, processEvent), { key: child.id })
    );

    const handleOpenChange = (open: boolean) => {
      if (!open) {
        // Only trigger onClose when dialog is closed
        const handler = createEventHandler(
          node,
          "onClose", // Assumed event name in UISpec
          "CLICK", // Use CLICK as the event type for closing dialogs
          processEvent
        );
        if (handler) {
          handler({}); // Trigger with empty payload or adjust as needed
        }
      }
      // We might need to update the state via an event if open is controlled by bindings
      // For now, assume direct control or one-way binding for visibility
    };

    // Add console log to see props during render
    console.log(
      `[Adapter Debug] Rendering Dialog: id=${node.id}, props=`,
      node.props,
      `isOpen=${isOpen}`
    );

    return (
      <Dialog
        key={key as React.Key}
        open={isOpen}
        onOpenChange={handleOpenChange}
      >
        <DialogContent
          className={cn("autoui-dialog-content", className as string)}
          {...restProps} // Pass restProps to DialogContent
          data-id={node.id} // Add data-id for debugging/testing
        >
          {(title || description) && (
            <DialogHeader>
              {title && <DialogTitle>{title as string}</DialogTitle>}
              {description && (
                <DialogDescription>{description as string}</DialogDescription>
              )}
            </DialogHeader>
          )}
          {children}
          {/* Removed explicit Close button, rely on Shadcn's built-in close or trigger via handleOpenChange */}
        </DialogContent>
      </Dialog>
    );
  },

  Heading: (node) => {
    // Extract key and style first. Remove unused textProp, levelProp.
    const { className, style: styleProp, key, ...restProps } = node.props || {};
    const text = getSafeProp(node.props, "text", isString, "Heading");
    // Ensure level is a valid heading level (1-6), default to 2
    let level = getSafeProp(
      node.props,
      "level",
      (v): v is number => typeof v === "number" && v >= 1 && v <= 6,
      2
    );
    if (typeof level !== "number" || level < 1 || level > 6) {
      level = 2; // Fallback to h2 if level is invalid
    }
    const Tag = `h${level}` as keyof JSX.IntrinsicElements;
    // Parse style string if necessary
    const style =
      typeof styleProp === "string"
        ? parseStyleString(styleProp)
        : (styleProp as React.CSSProperties | undefined);

    // Apply some default Shadcn-like heading styles based on level
    const headingStyles =
      {
        1: "scroll-m-20 text-4xl font-extrabold tracking-tight lg:text-5xl",
        2: "scroll-m-20 border-b pb-2 text-3xl font-semibold tracking-tight first:mt-0",
        3: "scroll-m-20 text-2xl font-semibold tracking-tight",
        4: "scroll-m-20 text-xl font-semibold tracking-tight",
        // Add styles for h5, h6 if needed, using text-lg, text-base etc.
      }[level] || "text-lg font-semibold"; // Default style

    return (
      <Tag
        key={key as React.Key}
        className={cn(headingStyles, className as string)}
        style={style}
        {...restProps}
      >
        {text}
      </Tag>
    );
  },

  Text: (node) => {
    // Extract key and style first. Remove unused textProp.
    const { className, style: styleProp, key, ...restProps } = node.props || {};
    const text = getSafeProp(node.props, "text", isString, "Some text");
    // Parse style string if necessary
    const style =
      typeof styleProp === "string"
        ? parseStyleString(styleProp)
        : (styleProp as React.CSSProperties | undefined);

    // Apply default paragraph styling
    return (
      <p
        key={key as React.Key}
        className={cn("leading-7", className as string)}
        style={style}
        {...restProps}
      >
        {text}
      </p>
    );
  },
};

export function renderNode(
  node: UISpecNode,
  processEvent?: (event: UIEvent) => void
): React.ReactElement {
  const mappedComponent = adapterMap[node.node_type];
  if (mappedComponent) {
    return mappedComponent(node, processEvent);
  }
  console.warn(`Unknown node type: ${node.node_type}`);
  return React.createElement(
    Container,
    {},
    `Unknown node type: ${node.node_type}`
  );
}
