export function confirmAction(message) {
  return new Promise((resolve) => {
    const dialog = document.createElement("dialog");
    dialog.className = "confirm-dialog";
    dialog.setAttribute("aria-label", "Xác nhận thao tác");
    const title = document.createElement("h2");
    title.textContent = "Xác nhận thao tác";
    const text = document.createElement("p");
    text.textContent = message;
    const actions = document.createElement("div");
    actions.className = "action-row";
    const cancel = document.createElement("button");
    cancel.className = "btn secondary";
    cancel.textContent = "Quay lại";
    const accept = document.createElement("button");
    accept.className = "btn";
    accept.textContent = "Xác nhận";
    const done = (value) => {
      dialog.close();
      dialog.remove();
      resolve(value);
    };
    cancel.addEventListener("click", () => done(false));
    accept.addEventListener("click", () => done(true));
    dialog.addEventListener("cancel", (e) => {
      e.preventDefault();
      done(false);
    });
    actions.append(cancel, accept);
    dialog.append(title, text, actions);
    document.body.append(dialog);
    dialog.showModal();
    cancel.focus();
  });
}
