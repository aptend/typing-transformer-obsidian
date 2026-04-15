import { App, Modal, Setting, TextComponent } from "obsidian";

export class StringInputModal extends Modal {
    err: HTMLElement;
    result: string;
    onSubmit: (result: string) => boolean;

    constructor(app: App, onSubmit: (result: string) => boolean) {
        super(app);
        this.onSubmit = onSubmit;
    }

    submitEnterCallback = (evt: KeyboardEvent) => {
        if (evt.key === "Enter") {
            evt.preventDefault();
            this.submit();
        }
    };

    submit() {
        if (this.onSubmit(this.result)) this.close();
        else this.err.setText("Profile already exists!");
    }

    onOpen() {
        const { titleEl, contentEl } = this;
        titleEl.setText("Profile Name");
        const container = contentEl.createDiv();
        const textComponent = new TextComponent(container);
        this.err = container.createEl("p");
        textComponent.inputEl.style.width = "100%";
        textComponent
            .onChange((value) => this.result = value)
            .inputEl.addEventListener('keydown', this.submitEnterCallback);
        new Setting(contentEl)
            .addButton((btn) => btn
                .setButtonText("Submit")
                .setCta()
                .onClick(() => this.submit()));
    }

    onClose() {
        this.contentEl.empty();
    }
}

export class ConfirmationModal extends Modal {
    constructor(app: App, prompt: string, confirmCb: (ans: boolean) => Promise<void>) {
        super(app);
        this.contentEl.createEl("p", { text: prompt });
        new Setting(this.contentEl)
            .addButton(button => button
                .setButtonText("Confirm")
                .onClick(async () => {
                    await confirmCb(true);
                    this.close();
                })
            )
            .addButton(button => button
                .setButtonText("Cancel")
                .onClick(async () => {
                    await confirmCb(false);
                    this.close();
                })
            );
    }
}
