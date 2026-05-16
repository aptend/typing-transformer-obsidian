// Mock CodeMirror View for testing

export class EditorView {
  state: any;
  dom: HTMLElement = document.createElement('div');

  constructor(config?: any) {
    this.state = config?.state;
  }

  dispatch(transaction: any): void {
    // Mock dispatch
  }

  update(transactions: any[]): void {
    // Mock update
  }

  destroy(): void {
    // Mock destroy
  }
}

export class ViewPlugin<T> {
  static define<T>(create: any, config?: any): ViewPlugin<T> {
    return new ViewPlugin<T>();
  }
}

export class Decoration {
  static mark(config: any): Decoration {
    return new Decoration();
  }

  static widget(config: any): Decoration {
    return new Decoration();
  }

  static line(config: any): Decoration {
    return new Decoration();
  }

  static replace(config: any): Decoration {
    return new Decoration();
  }
}

export class DecorationSet {
  static empty: DecorationSet = new DecorationSet();
}

export class PluginValue {
  update(update: any): void {
    // Mock update
  }

  destroy(): void {
    // Mock destroy
  }
}
