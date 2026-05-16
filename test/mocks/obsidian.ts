// Mock Obsidian API for testing

export interface DataAdapter {
  stat(path: string): Promise<any>;
  read(path: string): Promise<string>;
  write(path: string, data: string): Promise<void>;
  remove(path: string): Promise<void>;
  exists(path: string): Promise<boolean>;
  list(path: string): Promise<any>;
  getResourcePath(path: string): string;
  append(path: string, data: string): Promise<void>;
  process(path: string, fn: (data: string) => string): Promise<string>;
  mkdir(path: string): Promise<void>;
  rmdir(path: string, recursive: boolean): Promise<void>;
  trashSystem(path: string): Promise<boolean>;
  trashLocal(path: string): Promise<void>;
  rename(oldPath: string, newPath: string): Promise<void>;
  copy(srcPath: string, destPath: string): Promise<void>;
}

export function normalizePath(path: string): string {
  // Simple implementation for testing
  return path.replace(/\\/g, '/').replace(/\/+/g, '/');
}

export class Notice {
  constructor(message: string, timeout?: number) {
    // Mock implementation
  }
}

export class Plugin {
  app: any;
  manifest: any;

  addCommand(command: any): void {}
  addRibbonIcon(icon: string, title: string, callback: () => void): any {}
  addSettingTab(tab: any): void {}
  loadData(): Promise<any> { return Promise.resolve({}); }
  saveData(data: any): Promise<void> { return Promise.resolve(); }
  registerEvent(event: any): void {}
  registerDomEvent(element: any, type: string, callback: any): void {}
  registerInterval(interval: number): number { return 0; }
}

export class PluginSettingTab {
  constructor(app: any, plugin: any) {}
  display(): void {}
  hide(): void {}
}

export class Setting {
  constructor(containerEl: any) {}
  setName(name: string): this { return this; }
  setDesc(desc: string): this { return this; }
  addText(cb: (text: any) => void): this { return this; }
  addToggle(cb: (toggle: any) => void): this { return this; }
  addDropdown(cb: (dropdown: any) => void): this { return this; }
  addButton(cb: (button: any) => void): this { return this; }
  addTextArea(cb: (text: any) => void): this { return this; }
}

export class Modal {
  constructor(app: any) {}
  open(): void {}
  close(): void {}
  onOpen(): void {}
  onClose(): void {}
}

export class App {
  vault: any;
  workspace: any;
}

export const Platform = {
  isMobile: false,
  isMobileApp: false,
  isDesktopApp: true,
  isIosApp: false,
  isMacOS: false,
  isWin: false,
  isLinux: true,
};
