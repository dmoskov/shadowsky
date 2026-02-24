'use strict';
// Lightweight polyfill for explicit resource management (TC39 proposal)
// Replaces core-js/proposals/explicit-resource-management which has
// Metro bundler resolution issues with core-js internals.

// Symbol.dispose / Symbol.asyncDispose
if (typeof Symbol !== 'undefined') {
  if (!Symbol.dispose) {
    Symbol.dispose = Symbol('Symbol.dispose');
  }
  if (!Symbol.asyncDispose) {
    Symbol.asyncDispose = Symbol('Symbol.asyncDispose');
  }
}

// SuppressedError
if (typeof globalThis.SuppressedError === 'undefined') {
  globalThis.SuppressedError = class SuppressedError extends Error {
    constructor(error, suppressed, message) {
      super(message);
      this.name = 'SuppressedError';
      this.error = error;
      this.suppressed = suppressed;
    }
  };
}

// DisposableStack
if (typeof globalThis.DisposableStack === 'undefined') {
  globalThis.DisposableStack = class DisposableStack {
    #disposed = false;
    #stack = [];

    get disposed() { return this.#disposed; }

    dispose() {
      if (this.#disposed) return;
      this.#disposed = true;
      let suppressed;
      while (this.#stack.length > 0) {
        const fn = this.#stack.pop();
        try { fn(); } catch (e) {
          suppressed = suppressed
            ? new SuppressedError(e, suppressed, 'An error was suppressed during disposal.')
            : e;
        }
      }
      if (suppressed) throw suppressed;
    }

    use(value) {
      if (value != null) {
        const dispose = value[Symbol.dispose];
        if (typeof dispose === 'function') {
          this.#stack.push(() => dispose.call(value));
        }
      }
      return value;
    }

    adopt(value, onDispose) {
      this.#stack.push(() => onDispose(value));
      return value;
    }

    defer(onDispose) {
      this.#stack.push(onDispose);
    }

    move() {
      const newStack = new DisposableStack();
      newStack.#stack = this.#stack.splice(0);
      return newStack;
    }

    [Symbol.dispose]() { this.dispose(); }
  };
}

// AsyncDisposableStack
if (typeof globalThis.AsyncDisposableStack === 'undefined') {
  globalThis.AsyncDisposableStack = class AsyncDisposableStack {
    #disposed = false;
    #stack = [];

    get disposed() { return this.#disposed; }

    async disposeAsync() {
      if (this.#disposed) return;
      this.#disposed = true;
      let suppressed;
      while (this.#stack.length > 0) {
        const fn = this.#stack.pop();
        try { await fn(); } catch (e) {
          suppressed = suppressed
            ? new SuppressedError(e, suppressed, 'An error was suppressed during disposal.')
            : e;
        }
      }
      if (suppressed) throw suppressed;
    }

    use(value) {
      if (value != null) {
        const dispose = value[Symbol.asyncDispose] || value[Symbol.dispose];
        if (typeof dispose === 'function') {
          this.#stack.push(() => dispose.call(value));
        }
      }
      return value;
    }

    adopt(value, onDispose) {
      this.#stack.push(() => onDispose(value));
      return value;
    }

    defer(onDispose) {
      this.#stack.push(onDispose);
    }

    move() {
      const newStack = new AsyncDisposableStack();
      newStack.#stack = this.#stack.splice(0);
      return newStack;
    }

    [Symbol.asyncDispose]() { return this.disposeAsync(); }
  };
}
