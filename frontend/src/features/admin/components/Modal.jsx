import { X } from "lucide-react";

export default function Modal({ title, children, close }) {
  return (
    <div
      className="modal-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget) close();
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="modal"
      >
        <div className="modal-header">
          <h2>{title}</h2>
          <button className="icon-btn" onClick={close} aria-label="Đóng">
            <X />
          </button>
        </div>
        {children}
      </section>
    </div>
  );
}
