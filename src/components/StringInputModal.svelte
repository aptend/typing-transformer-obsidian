<script lang="ts">
    interface StringInputModalProps {
        onSubmit: (result: string) => boolean;
    }

    let { onSubmit } = $props();

    let err: string = "";
    let value = $state("");

    function checkKeyDown (event: KeyboardEvent) {
        if (event.key === "Enter") {
            event.preventDefault();
            submit();
        }

        err = "";
    }

    function submit() {
        if (onSubmit(value)) this.close();
        else err = "Profile already exists!";
    }
</script>

<div class="modal">
    <div class="modal-close-button"></div>
    <div class="modal-header">
        <div class="modal-title">Profile Name</div>
    </div>
    <div class="modal-content">
        <div>
            <input type="text" spellcheck="false" style="width: 100%;" onkeydown={checkKeyDown} bind:value>
            <p>{err}</p>
        </div>
        <div class="setting-item">
            <div class="setting-item-info">
                <div class="setting-item-name"></div>
                <div class="setting-item-description"></div>
            </div>
            <div class="setting-item-control"><button class="mod-cta">Submit</button></div>
        </div>
    </div>
</div>
