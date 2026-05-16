// Mock CodeMirror State for testing

export interface TransactionSpec {
  changes?: any;
  selection?: any;
  effects?: any;
  annotations?: any;
  scrollIntoView?: boolean;
}

export class EditorState {
  static create(config?: any): EditorState {
    return new EditorState();
  }

  update(specs: TransactionSpec | TransactionSpec[]): Transaction {
    return new Transaction();
  }

  toJSON(): any {
    return {};
  }
}

export class Transaction {
  state: EditorState = new EditorState();
  changes: any;
  selection: any;
  effects: any;
  annotations: any;
}

export class Extension {
  // Mock extension
}

export class Facet<T> {
  static define<T>(config?: any): Facet<T> {
    return new Facet<T>();
  }
}

export class StateField<T> {
  static define<T>(config: any): StateField<T> {
    return new StateField<T>();
  }
}

export class StateEffect<T> {
  static define<T>(spec?: any): StateEffect<T> {
    return new StateEffect<T>();
  }

  of(value: T): StateEffect<T> {
    return this;
  }
}
