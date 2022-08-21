import { Extension, EditorState } from "@codemirror/state";
import { EditorView, ViewUpdate } from "@codemirror/view";
import { ButtonComponent } from "obsidian";
import * as React from "react";

const crossIcon =
    <path fill="currentColor" stroke="currentColor" d="M15.4,12.6l-2.9,2.9L47.1,50L12.6,84.6l2.9,2.9L50,52.9l34.6,34.6l2.9-2.9L52.9,50l34.6-34.6l-2.9-2.9L50,47.1L15.4,12.6z "></path>;


const checkmarkIcon =
    <path fill="currentColor" stroke="currentColor" d="M85.8,17.3c-0.1,0-0.1,0-0.2,0.1c-0.5,0.1-1,0.5-1.3,0.9L43.4,81.6L15.3,56.2c-0.5-0.6-1.3-0.9-2.1-0.7 c-0.8,0.2-1.3,0.9-1.5,1.6c-0.1,0.8,0.2,1.6,0.9,2l29.8,27c0.4,0.4,1,0.6,1.6,0.5c0.6-0.1,1.1-0.4,1.4-0.9l42.2-65.4 c0.5-0.7,0.5-1.5,0.1-2.2S86.5,17.1,85.8,17.3L85.8,17.3z"></path>;


function useObButton(onClick: (evt: MouseEvent) => void): (container: HTMLElement) => void {
    const [element, setElement] = React.useState<HTMLElement>();
    const cb = React.useCallback((container: HTMLElement) => {
        if(!container) return;
        setElement(container);
    }, []);
    React.useEffect(() => {
        if (!element) return;
        new ButtonComponent(element).setIcon("switch")
            .setTooltip("Reset to default rules")
            .onClick(onClick);
    }, [element]);
    return cb;
}

interface ResetProps {
    onClick: (evt: MouseEvent) => void
}

function ResetButton({onClick}: ResetProps) {
    const cb = useObButton(onClick);
    return <div className="rules-editor-buttons" ref={cb}></div>
}

interface FooterProps extends ValidityProps, ResetProps {}

function Footer({ errors, onClick}: FooterProps) {
    return (
        <div className="rules-footer">
            <ValidityIndictor errors={errors}/>
            <ResetButton onClick={onClick} />
        </div>
    );
}

interface ValidityProps {
    errors: string[] | null
}

export function ValidityIndictor(props: ValidityProps): JSX.Element {
    React.createRef;
    if (!props.errors) {
        return <div className="rules-editor-validity"/>;
    }
    const succ = props.errors.length === 0;
    const validClass = succ ? ' valid' : ' invalid';
    const text = succ ? "Saved" : props.errors.map((value: string) => <div>{value}</div>);
    const svgPath = succ ? checkmarkIcon : crossIcon;
    return <div className="rules-editor-validity">
        <div className={"setting-editor-extra-setting-button clickable-icon rules-editor-validity-indicator" + validClass}>
            <svg viewBox="0 0 100 100">{svgPath}</svg>
        </div>
        <div className="setting-item-description rules-editor-validity-txt">{text}</div>
    </div>;
}

interface EditorProps extends CMEditorProps {
    checkOnUpdate: (text: string) => Promise<string[]>,
    resetText: string
}


function useCodeMirror(text: string, extensions: Extension[]): [(el: HTMLElement) => void, (txt: string) => void] {
    const [element, setElement] = React.useState<HTMLElement>();
    const [view, setView] = React.useState<EditorView>();
    console.log("use CodeMirror");
    // callback ref, get the element where the CM editor mounted to
    const cbRef = React.useCallback((container: HTMLElement) => {
        if (!container) return;
        console.log("set container");
        setElement(container);
    }, []);

    const cbResetDoc = React.useCallback((text: string) => {
        const change = { changes: { from: 0, to: view.state.doc.length, insert: text } };
        console.log("change", change, view)
        view.dispatch(change);
    }, [view]);

    // if element mounted, new a CM editor as its child
    React.useEffect(() => {
        if (!element) return;
        console.log("new editor");
        const view = new EditorView({
            state: EditorState.create({ doc: text, extensions: extensions.slice() }),
            parent: element,
        });
        setView(view);
        return () => view?.destroy();
    }, [element]);

    return [cbRef, cbResetDoc];
}


export function Editor(props: EditorProps): JSX.Element {
    const [errs, setErrs] = React.useState<string[]>();
    const editorRef = React.useRef<CMEditorHandle>(null);

    const onReset = () => {
        editorRef.current.reset("");
    };

    const checkOnUpdateExt = EditorView.updateListener.of(async (v: ViewUpdate) => {
        if (v.docChanged) {
            const errors = await props.checkOnUpdate(v.state.doc.toString());
            setErrs(errors);
        }
    });
    const exts = props.extensions.concat([checkOnUpdateExt]);
    return (
        <div>
            <CMEditor text={props.text} extensions={exts} ref={editorRef} />
            <Footer errors={errs} onClick={ () => onReset() }/>
        </div>
        );
}

interface CMEditorProps {
    text: string,
    extensions: Extension[],
}

// expose some handle method to the parent component
type CMEditorHandle = {
    reset(text: string): void,
}

const CMEditor = React.forwardRef<CMEditorHandle, CMEditorProps>((props, ref) => {
    const [cbref, reset] = useCodeMirror(props.text, props.extensions);

    // use init() to create a CMEditorHandle
    React.useImperativeHandle(ref, () => ({
        reset: (text: string) => { reset(text); }
    }));

    return <div className="rules-editor-wrapper" ref={cbref} />;
});

