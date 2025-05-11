import { UIEvent, UIEventType } from "../schema/ui";

export interface EventHookOptions {
  preventDefault?: boolean;
  stopPropagation?: boolean;
}

export interface EventHookContext {
  originalEvent: UIEvent;
  preventDefault: () => void;
  stopPropagation: () => void;
  isDefaultPrevented: () => boolean;
  isPropagationStopped: () => boolean;
}

export type EventHook = (context: EventHookContext) => void | Promise<void>;

export interface EventHooksMap {
  // Global hooks for all events
  all?: EventHook[];

  // Specific event type hooks
  [key: string]: EventHook[] | undefined;
}

/**
 * Event manager to handle registration and execution of event hooks
 */
export class EventManager {
  private hooks: EventHooksMap = {};

  /**
   * Register a hook for specific event types
   *
   * @param eventTypes - Event types to register for, or 'all' for all events
   * @param hook - Hook function to execute
   * @returns Unregister function
   */
  public register(
    eventTypes: UIEventType[] | "all",
    hook: EventHook
  ): () => void {
    if (eventTypes === "all") {
      if (!this.hooks.all) {
        this.hooks.all = [];
      }
      this.hooks.all.push(hook);

      return () => {
        if (this.hooks.all) {
          this.hooks.all = this.hooks.all.filter((h) => h !== hook);
        }
      };
    }

    eventTypes.forEach((type) => {
      if (!this.hooks[type]) {
        this.hooks[type] = [];
      }
      this.hooks[type]?.push(hook);
    });

    return () => {
      eventTypes.forEach((type) => {
        if (this.hooks[type]) {
          this.hooks[type] = this.hooks[type]?.filter((h) => h !== hook);
        }
      });
    };
  }

  /**
   * Process an event through all registered hooks
   *
   * @param event - The UI event to process
   * @returns Whether the default action should proceed
   */
  public async processEvent(event: UIEvent): Promise<boolean> {
    let defaultPrevented = false;
    let propagationStopped = false;

    const context: EventHookContext = {
      originalEvent: event,
      preventDefault: () => {
        defaultPrevented = true;
      },
      stopPropagation: () => {
        propagationStopped = true;
      },
      isDefaultPrevented: () => defaultPrevented,
      isPropagationStopped: () => propagationStopped,
    };

    // Run global hooks first
    if (this.hooks.all) {
      for (const hook of this.hooks.all) {
        await hook(context);
        if (propagationStopped) break;
      }
    }

    // If propagation not stopped and we have specific hooks for this event type
    if (!propagationStopped && this.hooks[event.type]) {
      for (const hook of this.hooks[event.type] || []) {
        await hook(context);
        if (propagationStopped) break;
      }
    }

    return !defaultPrevented;
  }
}

/**
 * Create a hook to intercept specific events
 *
 * @example
 * ```tsx
 * const unregister = useEventHook(['CLICK'], (ctx) => {
 *   if (ctx.originalEvent.nodeId === 'deleteButton') {
 *     // Show confirmation dialog
 *     const confirmed = window.confirm('Are you sure?');
 *     if (!confirmed) {
 *       ctx.preventDefault();
 *     }
 *   }
 * });
 * ```
 */
export function createEventHook(
  eventTypes: UIEventType[] | "all",
  hook: EventHook,
  options?: EventHookOptions
): EventHook {
  return async (context) => {
    await hook(context);

    if (options?.preventDefault) {
      context.preventDefault();
    }

    if (options?.stopPropagation) {
      context.stopPropagation();
    }
  };
}
